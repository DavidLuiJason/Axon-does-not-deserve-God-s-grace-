#!/usr/bin/env bash
# Shell runner chosen so browser children write directly to log files rather than inherited pipes.
set +e
cd "$(dirname "$0")/.." || exit 2
mkdir -p docs
: > docs/ROUND10_RUNNER_STAGES.tsv
run_step() {
  local name="$1" log="$2" command="$3"
  timeout --kill-after=5 120 bash -lc "$command" > "docs/$log" 2>&1
  local rc=$?
  local status=FAIL
  [ "$rc" -eq 0 ] && status=PASS
  printf '%s\t%s\t%s\n' "$name" "$status" "$log" >> docs/ROUND10_RUNNER_STAGES.tsv
  echo "[$status] $name -> docs/$log"
  if [ "$rc" -ne 0 ]; then tail -60 "docs/$log"; return "$rc"; fi
  return 0
}
run_step typecheck ROUND10_TYPECHECK_LOG.txt 'npm run typecheck' || exit 1
run_step build ROUND10_BUILD_LOG.txt 'npm run build' || exit 1
run_step dedicated-round10 ROUND10_DEDICATED_LOG.txt 'npm run test:round10' || exit 1
run_step all-node-r1-r10 ROUND10_FULL_NODE_REGRESSION_LOG.txt 'npm test' || exit 1
run_step r4-browser ROUND10_R4_BROWSER_REGRESSION_LOG.txt 'python3 tests/round4-browser.integration.py' || exit 1
run_step prer5-browser ROUND10_PRER5_BROWSER_REGRESSION_LOG.txt 'python3 tests/prer5-browser.integration.py' || exit 1
run_step r6-browser ROUND10_R6_BROWSER_REGRESSION_LOG.txt 'python3 tests/round6-browser.integration.py' || exit 1
run_step r7-browser-actions ROUND10_R7_BROWSER_REGRESSION_LOG.txt 'python3 tests/round7-browser-actions.integration.py' || exit 1
run_step legacy-host-smoke ROUND10_LEGACY_HOST_SMOKE_LOG.txt 'python3 tools/host-toolchain-smoke.py' || exit 1
run_step r5-host ROUND10_R5_HOST_REGRESSION_LOG.txt 'python3 tools/round5-host-toolchain-tests.py' || exit 1
run_step r5-diagnostic-check ROUND10_R5_DIAGNOSTIC_REGRESSION_LOG.txt 'node tools/verify-round5-host-diagnostics.mjs' || exit 1
python3 - <<'PY'
import json
from pathlib import Path
root=Path('docs')
stages=[]
for line in (root/'ROUND10_RUNNER_STAGES.tsv').read_text().splitlines():
    name,status,log=line.split('\t')
    stages.append({'suite':name,'status':status,'exitCode':0 if status=='PASS' else 1,'log':log})
report={
 'round':10,
 'previousRoundsRerun':['R1','R2','R3','R4','R5','R6','R7','R9'],
 'newRound':'R10',
 'mandatoryRetainedSuiteRule':True,
 'stages':stages,
 'standaloneHostInventory':'Round 6 host inventory was rerun separately and is recorded in ROUND10_R6_HOST_PROBE_LOG.txt.',
 'completed':len(stages)==11 and all(s['status']=='PASS' for s in stages),
 'interpretation':'PASS means the automated check completed. Expected missing toolchains remain marked missing/blocked in detailed evidence; not all platforms are thereby operational.'
}
(root/'ROUND10_REGRESSION_RUNNER_SUMMARY.json').write_text(json.dumps(report,indent=2)+'\n')
print(f"Regression summary: {sum(s['status']=='PASS' for s in stages)}/{len(stages)} stages PASS")
raise SystemExit(0 if report['completed'] else 1)
PY
