#!/usr/bin/env python3
"""Rerun all retained R1-R4 suites plus Round 5 checks in a fixed sequence."""
from __future__ import annotations
import os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
DOCS.mkdir(exist_ok=True)

steps = [
    ('typecheck', ['npm', 'run', 'typecheck'], 'ROUND5_TYPECHECK_LOG.txt'),
    ('combined-node-r1-r5', ['npm', 'test'], 'ROUND5_FULL_NODE_TEST_LOG.txt'),
    ('round4-chromium', ['npm', 'run', 'test:r4-browser'], 'ROUND5_R4_BROWSER_LOG.txt'),
    ('prer5-chromium-typescript-jsx-wasm', ['npm', 'run', 'test:prer5-browser'], 'ROUND5_PRER5_BROWSER_LOG.txt'),
    ('legacy-prer5-host-smoke', ['npm', 'run', 'test:host-smoke'], 'ROUND5_LEGACY_HOST_SMOKE_LOG.txt'),
    ('round5-host-toolchains-and-diagnostics', ['npm', 'run', 'test:round5-host'], 'ROUND5_HOST_TOOLCHAIN_LOG.txt'),
]

summary = []
for name, command, log_name in steps:
    env = dict(os.environ)
    # Chromium refuses to start with its normal sandbox when this test container
    # runs as root. This is a container-test exception only and must not be used
    # for production execution or copied into app runtime configuration.
    if name in ('round4-chromium', 'prer5-chromium-typescript-jsx-wasm') and hasattr(os, 'geteuid') and os.geteuid() == 0:
        env['AXON_CHROMIUM_NO_SANDBOX'] = '1'
    try:
        completed = subprocess.run(command, cwd=ROOT, env=env, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True, errors='replace', timeout=600)
        output = completed.stdout
        code = completed.returncode
    except subprocess.TimeoutExpired as exc:
        output = (exc.stdout or '') + '\nTIMEOUT: command exceeded 600 seconds.\n'
        code = 124
    (DOCS / log_name).write_text(output, encoding='utf-8')
    summary.append({'suite': name, 'exitCode': code, 'status': 'PASS' if code == 0 else 'FAIL', 'log': log_name})
    print(f"[{summary[-1]['status']}] {name}: {log_name}")
    if code != 0:
        print(output[-8000:])
        break

for item in summary:
    pass
print(f"Completed {len(summary)}/{len(steps)} regression suites.")
sys.exit(1 if any(item['exitCode'] != 0 for item in summary) or len(summary) != len(steps) else 0)
