#!/usr/bin/env python3
"""Run fixed, trusted host-toolchain fixtures only; never run an imported user project."""
from __future__ import annotations
import json, os, shutil, subprocess, tempfile, time, platform
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'ROUND5_HOST_TOOLCHAIN_RESULTS.json'
MAX_OUTPUT = 256 * 1024
TIMEOUT = 20
results = []

def clip(value: str) -> str:
    raw = value.encode('utf-8', 'replace')[:MAX_OUTPUT]
    return raw.decode('utf-8', 'replace')

def run(command: list[str], cwd: Path, timeout: int = TIMEOUT) -> dict:
    started = time.perf_counter()
    try:
        completed = subprocess.run(command, cwd=cwd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True, errors='replace', timeout=timeout,
                                   env={'PATH': os.environ.get('PATH', ''), 'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8',
                                        'HOME': str(cwd), 'TMPDIR': str(cwd)})
        return {'exitCode': completed.returncode, 'stdout': clip(completed.stdout), 'stderr': clip(completed.stderr),
                'elapsedMs': round((time.perf_counter() - started) * 1000, 2), 'timedOut': False}
    except subprocess.TimeoutExpired as exc:
        return {'exitCode': None, 'stdout': clip((exc.stdout or b'').decode('utf-8', 'replace') if isinstance(exc.stdout, bytes) else (exc.stdout or '')),
                'stderr': clip((exc.stderr or b'').decode('utf-8', 'replace') if isinstance(exc.stderr, bytes) else (exc.stderr or '')),
                'elapsedMs': round((time.perf_counter() - started) * 1000, 2), 'timedOut': True}

def add(identifier: str, status: str, detail: dict | None = None, note: str = ''):
    results.append({'id': identifier, 'status': status, 'pass': status in ('PASS', 'BLOCKED_EXPECTED', 'MISSING_DEPENDENCY_EXPECTED'),
                    'note': note, **(detail or {})})

with tempfile.TemporaryDirectory(prefix='axon-r5-trusted-host-') as temp:
    work = Path(temp)
    py_ok = work / 'sample.py'
    py_ok.write_text('value = 6 * 7\nprint(value)\n', encoding='utf-8')
    python = shutil.which('python3')
    if python:
        py = run([python, '-I', '-B', str(py_ok)], work)
        add('PYTHON-TRUSTED-SMOKE', 'PASS' if py['exitCode'] == 0 and py['stdout'].strip() == '42' and not py['timedOut'] else 'FAIL', py,
            'Fixed trusted fixture only; this is not AXON sandbox execution.')
        py_bad = work / 'python_bad.py'
        py_bad.write_text('value = 5\nprint(missing_symbol + value)\n', encoding='utf-8')
        py_err = run([python, '-I', '-B', str(py_bad)], work)
        py_err['requestedFile'] = 'python_bad.py'
        add('PYTHON-INJECTED-ERROR', 'PASS' if py_err['exitCode'] != 0 and 'NameError' in py_err['stderr'] and 'line 2' in py_err['stderr'] else 'FAIL', py_err,
            'Expected a genuine Python NameError from a fixed test fixture.')
    else:
        add('PYTHON-TRUSTED-SMOKE', 'MISSING_DEPENDENCY_EXPECTED', note='python3 unavailable')
        add('PYTHON-INJECTED-ERROR', 'MISSING_DEPENDENCY_EXPECTED', note='python3 unavailable')

    compiler = shutil.which('g++') or shutil.which('clang++')
    if compiler:
        cpp_ok = work / 'sample.cpp'
        cpp_ok.write_text('#include <iostream>\nint main() { std::cout << 42 << "\\n"; return 0; }\n', encoding='utf-8')
        exe = work / 'sample'
        compile_ok = run([compiler, '-std=c++17', '-O0', '-Wall', '-Wextra', str(cpp_ok), '-o', str(exe)], work)
        add('CPP-TRUSTED-COMPILE', 'PASS' if compile_ok['exitCode'] == 0 and not compile_ok['timedOut'] else 'FAIL', compile_ok,
            'Fixed trusted source compiled by host compiler; no arbitrary user build scripts executed.')
        if compile_ok['exitCode'] == 0:
            cpp_run = run([str(exe)], work)
            add('CPP-TRUSTED-RUN', 'PASS' if cpp_run['exitCode'] == 0 and cpp_run['stdout'].strip() == '42' else 'FAIL', cpp_run,
                'Trusted compiled fixture run directly on the build host, outside AXON strict sandbox.')
        else:
            add('CPP-TRUSTED-RUN', 'BLOCKED_EXPECTED', note='compile fixture failed; execution skipped')
        cpp_bad = work / 'cpp_bad.cpp'
        cpp_bad.write_text('int main() { return missing_symbol; }\n', encoding='utf-8')
        cpp_err = run([compiler, '-std=c++17', '-fsyntax-only', str(cpp_bad)], work)
        cpp_err['requestedFile'] = 'cpp_bad.cpp'
        add('CPP-INJECTED-COMPILE-ERROR', 'PASS' if cpp_err['exitCode'] != 0 and ('not declared' in cpp_err['stderr'] or 'undeclared identifier' in cpp_err['stderr']) else 'FAIL', cpp_err,
            'Expected a genuine compiler undefined-symbol diagnostic from a fixed fixture.')
    else:
        for key in ('CPP-TRUSTED-COMPILE', 'CPP-TRUSTED-RUN', 'CPP-INJECTED-COMPILE-ERROR'):
            add(key, 'MISSING_DEPENDENCY_EXPECTED', note='g++/clang++ unavailable')

    probes = {
      'RUSTC': ['rustc', '--version'], 'CARGO': ['cargo', '--version'],
      'GRADLE': ['gradle', '--version'], 'ADB': ['adb', 'version'],
      'ANDROID-SDKMANAGER': ['sdkmanager', '--version'],
      'UNITY': ['Unity', '-version'], 'UNREAL': ['UnrealEditor', '-version'],
      'WASMTIME': ['wasmtime', '--version'], 'WASMER': ['wasmer', '--version']
    }
    for identifier, command in probes.items():
        executable = shutil.which(command[0])
        if not executable:
            add(f'{identifier}-PROBE', 'MISSING_DEPENDENCY_EXPECTED', {'executable': None}, 'Required host toolchain was not installed.')
        else:
            version = run([executable, *command[1:]], work, timeout=8)
            add(f'{identifier}-PROBE', 'PASS' if not version['timedOut'] else 'FAIL', {'executable': executable, 'probe': version},
                'Toolchain presence only; strict sandbox and end-to-end runtime still required.')

# Record explicit sandbox provider availability. Presence of rlimits/uid alone is not a strict sandbox.
sandbox_commands = {name: shutil.which(name) for name in ('bwrap', 'firejail', 'nsjail', 'docker', 'podman')}
namespace = run(['unshare', '-n', 'true'], Path(tempfile.gettempdir()), timeout=3)
landlock_probe = 'not-performed-by-host-smoke'
add('STRICT-SANDBOX-PROVIDER-PROBE', 'BLOCKED_EXPECTED' if not any(sandbox_commands.values()) and namespace['exitCode'] != 0 else 'PASS',
    {'providers': sandbox_commands, 'networkNamespaceProbe': namespace, 'landlockProbe': landlock_probe},
    'No arbitrary AXON user project is executed unless a complete isolation provider is available and attested.')

summary = {
  'purpose': 'Round 5 fixed trusted host toolchain smoke; not an AXON project sandbox test.',
  'host': {'system': platform.system(), 'release': platform.release(), 'machine': platform.machine(), 'python': platform.python_version()},
  'results': results,
  'passed': sum(item['pass'] for item in results),
  'failed': sum(item['status'] == 'FAIL' for item in results),
  'blockedOrMissingExpected': sum(item['status'] in ('BLOCKED_EXPECTED', 'MISSING_DEPENDENCY_EXPECTED') for item in results),
  'securityBoundary': 'All executed source fixtures in this tool were fixed, trusted test code. This host has no verified strict process sandbox provider.'
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in summary.items() if k != 'results'}, indent=2))
print(f'Full host evidence: {OUT}')
raise SystemExit(1 if summary['failed'] else 0)
