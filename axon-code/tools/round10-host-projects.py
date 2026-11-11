#!/usr/bin/env python3
"""Round 10 fixed, trusted host workload checks; not AXON Code sandbox execution."""
from __future__ import annotations
import json, os, platform, shutil, subprocess, tempfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'ROUND10_HOST_PROJECT_RESULTS.json'
RESULTS: list[dict] = []

def run(identifier: str, command: list[str], cwd: Path, timeout: int = 20) -> dict:
    start = time.perf_counter()
    try:
        proc = subprocess.run(command, cwd=cwd, stdin=subprocess.DEVNULL, capture_output=True,
                              text=True, errors='replace', timeout=timeout,
                              env={'PATH': os.environ.get('PATH', ''), 'HOME': str(cwd), 'TMPDIR': str(cwd),
                                   'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8', 'PYTHONNOUSERSITE': '1'})
        return {'id': identifier, 'exitCode': proc.returncode, 'stdout': proc.stdout[-8000:],
                'stderr': proc.stderr[-8000:], 'elapsedMs': round((time.perf_counter()-start)*1000, 2),
                'timedOut': False}
    except subprocess.TimeoutExpired as exc:
        def decode(v):
            if isinstance(v, bytes): return v.decode('utf-8', 'replace')
            return v or ''
        return {'id': identifier, 'exitCode': None, 'stdout': decode(exc.stdout)[-8000:],
                'stderr': decode(exc.stderr)[-8000:], 'elapsedMs': round((time.perf_counter()-start)*1000, 2),
                'timedOut': True}

def record(identifier: str, status: str, note: str, detail: dict | None = None):
    RESULTS.append({'id': identifier, 'status': status, 'pass': status in ('PASS', 'BLOCKED_EXPECTED', 'MISSING_DEPENDENCY_EXPECTED'),
                    'note': note, **(detail or {})})

with tempfile.TemporaryDirectory(prefix='axon-r10-trusted-workloads-') as td:
    base = Path(td)
    # Python multi-file project + genuine runtime error with exact traceback location.
    python = shutil.which('python3')
    if python:
        py = base / 'python-project'; (py / 'pkg').mkdir(parents=True)
        (py / 'pkg' / '__init__.py').write_text('from .maths import multiply\n', encoding='utf-8')
        (py / 'pkg' / 'maths.py').write_text('def multiply(a, b):\n    return a * b\n', encoding='utf-8')
        (py / 'main.py').write_text('from pkg import multiply\nprint("R10_PYTHON", multiply(6, 7))\n', encoding='utf-8')
        ok = run('R10-PYTHON-MULTIFILE', [python, '-B', str(py / 'main.py')], py)
        record('R10-PYTHON-MULTIFILE', 'PASS' if ok['exitCode'] == 0 and ok['stdout'].strip() == 'R10_PYTHON 42' else 'FAIL',
               'Actual multi-file Python host execution using a fixed trusted fixture. Outside AXON sandbox.', ok)
        (py / 'main_error.py').write_text('from pkg import multiply\nprint(missing_symbol + multiply(6, 7))\n', encoding='utf-8')
        err = run('R10-PYTHON-INJECTED-ERROR', [python, '-B', str(py / 'main_error.py')], py)
        correct = err['exitCode'] != 0 and 'NameError' in err['stderr'] and 'main_error.py", line 2' in err['stderr']
        record('R10-PYTHON-INJECTED-ERROR', 'PASS' if correct else 'FAIL',
               'Expected a real NameError and exact line 2 traceback. Host smoke only.', err)
    else:
        record('R10-PYTHON-MULTIFILE', 'MISSING_DEPENDENCY_EXPECTED', 'python3 is not installed.')
        record('R10-PYTHON-INJECTED-ERROR', 'MISSING_DEPENDENCY_EXPECTED', 'python3 is not installed.')

    # C++ multi-file native compile/run + compiler-diagnosed error.
    compiler = shutil.which('clang++') or shutil.which('g++')
    if compiler:
        cpp = base / 'cpp-project'; (cpp / 'src').mkdir(parents=True); (cpp / 'include').mkdir()
        (cpp / 'include' / 'maths.hpp').write_text('#pragma once\nint multiply(int a, int b);\n', encoding='utf-8')
        (cpp / 'src' / 'maths.cpp').write_text('#include "maths.hpp"\nint multiply(int a, int b) { return a * b; }\n', encoding='utf-8')
        (cpp / 'src' / 'main.cpp').write_text('#include <iostream>\n#include "maths.hpp"\nint main() { std::cout << "R10_CPP " << multiply(6, 7) << "\\n"; }\n', encoding='utf-8')
        exe = cpp / 'app'
        build = run('R10-CPP-MULTIFILE-BUILD', [compiler, '-std=c++17', '-O0', '-Wall', '-Wextra', '-I', str(cpp / 'include'),
                                                    str(cpp / 'src' / 'main.cpp'), str(cpp / 'src' / 'maths.cpp'), '-o', str(exe)], cpp, 30)
        record('R10-CPP-MULTIFILE-BUILD', 'PASS' if build['exitCode'] == 0 and not build['timedOut'] else 'FAIL',
               'Actual multi-file native compilation with host compiler; outside AXON sandbox.', build)
        if build['exitCode'] == 0:
            exe_result = run('R10-CPP-MULTIFILE-RUN', [str(exe)], cpp)
            record('R10-CPP-MULTIFILE-RUN', 'PASS' if exe_result['exitCode'] == 0 and exe_result['stdout'].strip() == 'R10_CPP 42' else 'FAIL',
                   'Actual execution of fixed trusted native binary on Linux host.', exe_result)
        else:
            record('R10-CPP-MULTIFILE-RUN', 'BLOCKED_EXPECTED', 'Skipped because compilation did not succeed.')
        (cpp / 'src' / 'main_error.cpp').write_text('#include "maths.hpp"\nint main() { return missing_symbol + multiply(6, 7); }\n', encoding='utf-8')
        bad = run('R10-CPP-INJECTED-ERROR', [compiler, '-std=c++17', '-fsyntax-only', '-I', str(cpp / 'include'), str(cpp / 'src' / 'main_error.cpp')], cpp, 30)
        detected = bad['exitCode'] != 0 and ('missing_symbol' in bad['stderr']) and ('main_error.cpp:2:' in bad['stderr'])
        record('R10-CPP-INJECTED-ERROR', 'PASS' if detected else 'FAIL',
               'Compiler rejects undefined symbol and identifies expected source line. Host smoke only.', bad)
    else:
        for cid in ('R10-CPP-MULTIFILE-BUILD', 'R10-CPP-MULTIFILE-RUN', 'R10-CPP-INJECTED-ERROR'):
            record(cid, 'MISSING_DEPENDENCY_EXPECTED', 'Neither clang++ nor g++ is installed.')

    # Node multi-file server-side module execution.
    node = shutil.which('node')
    if node:
        js = base / 'node-project'; (js / 'src').mkdir(parents=True)
        (js / 'src' / 'math.mjs').write_text('export const multiply = (a, b) => a * b;\n', encoding='utf-8')
        (js / 'src' / 'main.mjs').write_text('import { multiply } from "./math.mjs";\nconsole.log("R10_NODE", multiply(6, 7));\n', encoding='utf-8')
        nr = run('R10-NODE-MULTIFILE', [node, str(js / 'src' / 'main.mjs')], js)
        record('R10-NODE-MULTIFILE', 'PASS' if nr['exitCode'] == 0 and nr['stdout'].strip() == 'R10_NODE 42' else 'FAIL',
               'Actual local Node host execution; not AXON process-provider execution.', nr)
    else:
        record('R10-NODE-MULTIFILE', 'MISSING_DEPENDENCY_EXPECTED', 'node is not installed.')

    # Availability probes; missing tools are expected blockers, not test failures.
    probes = {
        'RUSTC': ['rustc', '--version'], 'CARGO': ['cargo', '--version'], 'JAVA': ['java', '-version'],
        'GRADLE': ['gradle', '--version'], 'ADB': ['adb', 'version'], 'ANDROID-SDKMANAGER': ['sdkmanager', '--version'],
        'UNITY': ['Unity', '-version'], 'UNREAL': ['UnrealEditor', '-version'], 'WASMTIME': ['wasmtime', '--version'],
        'WASMER': ['wasmer', '--version'], 'BWRAP': ['bwrap', '--version'], 'FIREJAIL': ['firejail', '--version'],
        'DOCKER': ['docker', '--version'], 'PODMAN': ['podman', '--version']
    }
    for label, command in probes.items():
        path = shutil.which(command[0])
        if not path:
            record(f'R10-{label}-PROBE', 'MISSING_DEPENDENCY_EXPECTED', f'{command[0]} not present on this host.', {'path': None})
        else:
            res = run(f'R10-{label}-PROBE', [path, *command[1:]], base, 8)
            record(f'R10-{label}-PROBE', 'PASS' if res['exitCode'] == 0 and not res['timedOut'] else 'BLOCKED_EXPECTED',
                   'Presence/version probe only; not proof of AXON integration.', {'path': path, 'probe': res})

summary = {
    'purpose': 'Round 10 trusted host project smoke tests. These execute fixed generated test fixtures directly on the development host; they are not execution through AXON Code sandbox providers.',
    'host': {'system': platform.system(), 'release': platform.release(), 'machine': platform.machine(), 'python': platform.python_version()},
    'tests': RESULTS,
    'passed': sum(x['status'] == 'PASS' for x in RESULTS),
    'failed': sum(x['status'] == 'FAIL' for x in RESULTS),
    'blockedOrMissingExpected': sum(x['status'] in ('BLOCKED_EXPECTED', 'MISSING_DEPENDENCY_EXPECTED') for x in RESULTS),
    'securityBoundary': 'Only fixed, generated, trusted fixtures were executed. No arbitrary imported user project was executed. This host has no verified production-grade AXON sandbox provider.'
}
OUT.write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k != 'tests'}, indent=2))
print(f'Host evidence: {OUT}')
raise SystemExit(1 if summary['failed'] else 0)
