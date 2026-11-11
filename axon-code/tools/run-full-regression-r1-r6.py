#!/usr/bin/env python3
"""Mandatory Round 6 runner: reruns every retained R1-R5 suite plus all R6 suites."""
from __future__ import annotations
import json, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
DOCS.mkdir(exist_ok=True)

steps = [
    ('typecheck', ['npm', 'run', 'typecheck'], 'ROUND6_TYPECHECK_LOG.txt'),
    ('combined-node-r1-r6', ['npm', 'test'], 'ROUND6_FULL_NODE_TEST_LOG.txt'),
    ('r4-chromium-worker-regression', ['npm', 'run', 'test:r4-browser'], 'ROUND6_R4_BROWSER_REGRESSION_LOG.txt'),
    ('prer5-typescript-jsx-wasm-browser-regression', ['npm', 'run', 'test:prer5-browser'], 'ROUND6_PRER5_BROWSER_REGRESSION_LOG.txt'),
    ('r6-chromium-end-to-end', ['npm', 'run', 'test:round6-browser'], 'ROUND6_CHROMIUM_E2E_LOG.txt'),
    ('legacy-trusted-host-smoke-regression', ['npm', 'run', 'test:host-smoke'], 'ROUND6_LEGACY_HOST_SMOKE_LOG.txt'),
    ('r5-host-toolchains-diagnostics-regression', ['npm', 'run', 'test:round5-host'], 'ROUND6_R5_HOST_REGRESSION_LOG.txt'),
    ('r6-host-inventory', ['npm', 'run', 'test:round6-host-probe'], 'ROUND6_HOST_PROBE_LOG.txt')
]
summary = []
for name, command, log_name in steps:
    env = dict(os.environ)
    if hasattr(os, 'geteuid') and os.geteuid() == 0:
        env['AXON_CHROMIUM_NO_SANDBOX'] = '1'
    try:
        completed = subprocess.run(command, cwd=ROOT, env=env, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True, errors='replace', timeout=900)
        output, code = completed.stdout, completed.returncode
    except subprocess.TimeoutExpired as exc:
        output = (exc.stdout or '') + '\nTIMEOUT: command exceeded 900 seconds.\n'
        code = 124
    (DOCS / log_name).write_text(output, encoding='utf-8')
    item = {'suite': name, 'exitCode': code, 'status': 'PASS' if code == 0 else 'FAIL', 'log': log_name}
    summary.append(item)
    print(f"[{item['status']}] {name}: {log_name}")
    if code != 0:
        print(output[-12000:])
        break

report = {
    'round': 6,
    'previousRoundsRerun': ['R1', 'R2', 'R3', 'R4', 'R5'],
    'newRound': 'R6',
    'mandatoryRetainedSuiteRule': True,
    'suites': summary,
    'completed': len(summary) == len(steps) and all(item['exitCode'] == 0 for item in summary)
}
(DOCS / 'ROUND6_REGRESSION_RUNNER_SUMMARY.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(f"Completed {len(summary)}/{len(steps)} regression suites.")
sys.exit(0 if report['completed'] else 1)
