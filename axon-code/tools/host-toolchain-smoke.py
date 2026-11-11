#!/usr/bin/env python3
"""Safe, fixed-source toolchain smoke checks. Does not execute user-supplied projects."""
from __future__ import annotations
import json, os, pathlib, shutil, subprocess, tempfile, time

RESULTS = []
def run_case(case_id: str, command: list[str], cwd: pathlib.Path, timeout: float = 10.0) -> dict:
    started = time.perf_counter()
    try:
        proc = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=timeout, env={
            'PATH': os.environ.get('PATH',''), 'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8', 'PYTHONNOUSERSITE': '1'
        })
        return {'id': case_id, 'exitCode': proc.returncode, 'stdout': proc.stdout[-8000:], 'stderr': proc.stderr[-8000:],
                'elapsedMs': round((time.perf_counter()-started)*1000,2), 'completed': proc.returncode == 0}
    except Exception as exc:
        return {'id': case_id, 'error': str(exc), 'elapsedMs': round((time.perf_counter()-started)*1000,2), 'completed': False}

with tempfile.TemporaryDirectory(prefix='axon-safe-toolchain-smoke-') as td:
    root = pathlib.Path(td)
    py = shutil.which('python3')
    if py:
        (root/'ok.py').write_text('def multiply(a: int, b: int) -> int:\n    return a * b\nprint(multiply(6, 7))\n', encoding='utf-8')
        ok = run_case('PYTHON-OK', [py, '-I', '-B', str(root/'ok.py')], root)
        ok['pass'] = ok['completed'] and ok.get('stdout','').strip() == '42'
        RESULTS.append(ok)
        (root/'error.py').write_text('value = 7\nprint(missing_name + value)\n', encoding='utf-8')
        err = run_case('PYTHON-INJECTED-NAMEERROR', [py, '-I', '-B', str(root/'error.py')], root)
        err['pass'] = err.get('exitCode') != 0 and 'NameError' in err.get('stderr','') and 'error.py", line 2' in err.get('stderr','')
        RESULTS.append(err)
    else:
        RESULTS.append({'id':'PYTHON-TOOLCHAIN','pass':False,'state':'MISSING_DEPENDENCY'})

    compiler = shutil.which('g++') or shutil.which('clang++')
    if compiler:
        (root/'ok.cpp').write_text('#include <iostream>\nint main() { std::cout << 6 * 7 << "\\n"; return 0; }\n', encoding='utf-8')
        build = run_case('CPP-COMPILE-OK', [compiler, '-std=c++17', '-O0', str(root/'ok.cpp'), '-o', str(root/'ok')], root, 20)
        build['pass'] = build['completed']
        RESULTS.append(build)
        if build['completed']:
            run = run_case('CPP-RUN-OK', [str(root/'ok')], root)
            run['pass'] = run['completed'] and run.get('stdout','').strip() == '42'
            RESULTS.append(run)
        (root/'bad.cpp').write_text('int main() {\n  return missing_symbol;\n}\n', encoding='utf-8')
        bad = run_case('CPP-INJECTED-UNDEFINED-NAME', [compiler, '-std=c++17', '-fsyntax-only', str(root/'bad.cpp')], root, 20)
        bad['pass'] = bad.get('exitCode') != 0 and ('bad.cpp:2:' in bad.get('stderr','')) and ('not declared' in bad.get('stderr','') or 'undeclared' in bad.get('stderr',''))
        RESULTS.append(bad)
    else:
        RESULTS.append({'id':'CPP-TOOLCHAIN','pass':False,'state':'MISSING_DEPENDENCY'})

    for key, command in [('RUST','rustc'),('GRADLE','gradle'),('ADB','adb'),('ANDROID-SDK','sdkmanager'),('UNITY','Unity'),('UNREAL','UnrealEditor'),('WASMTIME','wasmtime'),('WASMER','wasmer')]:
        RESULTS.append({'id':f'{key}-PROBE','available':bool(shutil.which(command)),'path':shutil.which(command),'pass':True,
                        'state':'AVAILABLE' if shutil.which(command) else 'MISSING_DEPENDENCY'})

report = {'purpose':'fixed-source host toolchain smoke tests only; not an AXON sandbox test', 'host':'Linux execution container',
          'tests':RESULTS, 'passed':sum(1 for x in RESULTS if x.get('pass')), 'failed':sum(1 for x in RESULTS if not x.get('pass'))}
print(json.dumps(report, indent=2))
if report['failed']:
    raise SystemExit(1)
