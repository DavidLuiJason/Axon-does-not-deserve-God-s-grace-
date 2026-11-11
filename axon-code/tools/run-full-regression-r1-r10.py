#!/usr/bin/env python3
"""Mandatory R10 regression runner with process-group cleanup and per-stage logs."""
from __future__ import annotations
import json, os, signal, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DOCS=ROOT/'docs'; DOCS.mkdir(exist_ok=True)
steps=[
 ('typescript-typecheck',['npm','run','typecheck'],'ROUND10_TYPECHECK_LOG.txt'),
 ('production-build',['npm','run','build'],'ROUND10_BUILD_LOG.txt'),
 ('dedicated-round10-direct-user-browser-host',['npm','run','test:round10'],'ROUND10_DEDICATED_LOG.txt'),
 ('all-node-tests-r1-r10',['npm','test'],'ROUND10_FULL_NODE_REGRESSION_LOG.txt'),
 ('r4-chromium-worker-regression',['python3','tests/round4-browser.integration.py'],'ROUND10_R4_BROWSER_REGRESSION_LOG.txt'),
 ('prer5-typescript-jsx-wasm-regression',['python3','tests/prer5-browser.integration.py'],'ROUND10_PRER5_BROWSER_REGRESSION_LOG.txt'),
 ('r6-chromium-end-to-end-regression',['python3','tests/round6-browser.integration.py'],'ROUND10_R6_BROWSER_REGRESSION_LOG.txt'),
 ('r7-browser-project-actions-regression',['python3','tests/round7-browser-actions.integration.py'],'ROUND10_R7_BROWSER_REGRESSION_LOG.txt'),
 ('legacy-host-toolchain-smoke',['python3','tools/host-toolchain-smoke.py'],'ROUND10_LEGACY_HOST_SMOKE_LOG.txt'),
 ('r5-host-toolchain-regression',['python3','tools/round5-host-toolchain-tests.py'],'ROUND10_R5_HOST_REGRESSION_LOG.txt'),
 ('r5-host-diagnostic-crosscheck',['node','tools/verify-round5-host-diagnostics.mjs'],'ROUND10_R5_DIAGNOSTIC_REGRESSION_LOG.txt'),
]
summary=[]
for name,command,logname in steps:
 logpath=DOCS/logname
 with logpath.open('w',encoding='utf-8') as log:
  try:
   proc=subprocess.Popen(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,start_new_session=True,env=dict(os.environ))
   try: code=proc.wait(timeout=120)
   except subprocess.TimeoutExpired:
    try: os.killpg(proc.pid,signal.SIGTERM)
    except ProcessLookupError: pass
    try: proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
     try: os.killpg(proc.pid,signal.SIGKILL)
     except ProcessLookupError: pass
     proc.wait(timeout=5)
    log.write('\nTIMEOUT: step exceeded 120 seconds; process group terminated.\n')
    code=124
  except Exception as exc:
   log.write(f'RUNNER_ERROR: {type(exc).__name__}: {exc}\n'); code=125
 item={'suite':name,'command':' '.join(command),'exitCode':code,'status':'PASS' if code==0 else 'FAIL','log':logname}
 summary.append(item)
 print(f"[{item['status']}] {name} -> {logname}",flush=True)
 if code:
  print(logpath.read_text(encoding='utf-8',errors='replace')[-12000:],flush=True)
  break
report={'round':10,'previousRoundsRerun':['R1','R2','R3','R4','R5','R6','R7','R9'],'newRound':'R10',
 'mandatoryRetainedSuiteRule':True,'stages':summary,
 'standaloneHostInventory':'Round 6 host inventory was rerun separately and is recorded in ROUND10_R6_HOST_PROBE_LOG.txt; it is an environment inventory, not a functional regression suite.',
 'completed':len(summary)==len(steps) and all(x['exitCode']==0 for x in summary),
 'interpretation':'A PASS stage confirms its automated check completed. Expected missing toolchains remain documented as missing/blocked; it does not mean all platforms are operational.'}
(DOCS/'ROUND10_REGRESSION_RUNNER_SUMMARY.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(f"Completed {len(summary)}/{len(steps)} stages.",flush=True)
sys.exit(0 if report['completed'] else 1)
