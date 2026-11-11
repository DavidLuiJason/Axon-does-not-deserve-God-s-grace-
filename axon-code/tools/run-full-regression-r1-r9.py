#!/usr/bin/env python3
"""Mandatory Round 9 runner: complete retained R1-R7 gates plus dedicated R9 tests."""
from __future__ import annotations
import json, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
DOCS.mkdir(exist_ok=True)

steps = [
    ('typecheck', ['npm', 'run', 'typecheck'], 'ROUND9_TYPECHECK_LOG.txt'),
    ('build', ['npm', 'run', 'build'], 'ROUND9_BUILD_LOG.txt'),
    ('combined-node-r1-r9', ['npm', 'test'], 'ROUND9_FULL_NODE_REGRESSION_LOG.txt'),
    ('dedicated-round9-unit-integration', ['node', '--test', 'tests/round9-environment.test.mjs', 'tests/round9-execution.test.mjs', 'tests/round9-intelligence.test.mjs', 'tests/round9-routing-evidence.test.mjs', 'tests/round9-workbench.test.mjs'], 'ROUND9_DEDICATED_TEST_LOG.txt'),
    ('r4-chromium-worker-regression', ['npm', 'run', 'test:r4-browser'], 'ROUND9_R4_CHROMIUM_REGRESSION_LOG.txt'),
    ('prer5-typescript-jsx-wasm-browser-regression', ['npm', 'run', 'test:prer5-browser'], 'ROUND9_PRER5_BROWSER_REGRESSION_LOG.txt'),
    ('r6-chromium-end-to-end-regression', ['npm', 'run', 'test:round6-browser'], 'ROUND9_R6_CHROMIUM_REGRESSION_LOG.txt'),
    ('r7-real-browser-download-regression', ['npm', 'run', 'test:round7-browser-actions'], 'ROUND9_R7_BROWSER_ACTIONS_LOG.txt'),
    ('legacy-trusted-host-smoke-regression', ['npm', 'run', 'test:host-smoke'], 'ROUND9_HOST_SMOKE_LOG.txt'),
    ('r5-host-toolchain-and-diagnostic-regression', ['npm', 'run', 'test:round5-host'], 'ROUND9_R5_HOST_DIAGNOSTICS_LOG.txt'),
    ('r6-host-inventory-regression', ['npm', 'run', 'test:round6-host-probe'], 'ROUND9_R6_HOST_PROBE_LOG.txt')
]
summary = []
for name, command, log_name in steps:
    env = dict(os.environ)
    if hasattr(os, 'geteuid') and os.geteuid() == 0:
        # Container-only Chromium launch exception; never a production runtime setting.
        env['AXON_CHROMIUM_NO_SANDBOX'] = '1'
    try:
        completed = subprocess.run(command, cwd=ROOT, env=env, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True, errors='replace', timeout=900)
        output, code = completed.stdout, completed.returncode
    except subprocess.TimeoutExpired as exc:
        raw = exc.stdout or ''
        output = (raw.decode('utf-8', 'replace') if isinstance(raw, bytes) else raw) + '\nTIMEOUT: command exceeded 900 seconds.\n'
        code = 124
    (DOCS / log_name).write_text(output, encoding='utf-8')
    item = {'suite': name, 'command': ' '.join(command), 'exitCode': code,
            'status': 'PASS' if code == 0 else 'FAIL', 'log': log_name}
    summary.append(item)
    print(f"[{item['status']}] {name}: {log_name}")
    if code != 0:
        print(output[-16000:])
        break

report = {
    'round': 9,
    'previousRoundsRerun': ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'],
    'newRound': 'R9',
    'mandatoryRetainedSuiteRule': True,
    'suites': summary,
    'completed': len(summary) == len(steps) and all(item['exitCode'] == 0 for item in summary)
}
(DOCS / 'ROUND9_REGRESSION_RUNNER_SUMMARY.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(f"Completed {len(summary)}/{len(steps)} regression suites.")
sys.exit(0 if report['completed'] else 1)
