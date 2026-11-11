#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const suites = [
  { wp:'00', files:['tests/r14-wp00-baseline.test.mjs'], capability:'dependency-and-pty-regression' },
  { wp:'01', files:['tests/r14-wp01-gateway-registry.test.mjs'], capability:'axon-code-brain-gateway-contract' },
  { wp:'02', files:['tests/r14-wp02-workspace.test.mjs'], capability:'durable-workspace-and-transaction-journal' },
  { wp:'03', files:['tests/r14-wp03-android-host-contract.test.mjs','tests/r14-wp03-editor-engine-contract.test.mjs'], capability:'android-and-editor-host-contracts' },
  { wp:'04', files:['tests/r14-wp04-pyodide-provider.test.mjs'], capability:'pyodide-cpython-wasm-worker' },
  { wp:'05', files:['tests/r14-wp05-security.test.mjs','tests/r14-wp05-trust.test.mjs','tests/r14-wp05-security-completion.test.mjs'], capability:'workspace-trust-and-secret-redaction' },
  { wp:'12', files:['tests/r14-wp12-recovery.test.mjs'], capability:'persistent-jobs-and-crash-recovery' },
];
const hostFingerprint = crypto.createHash('sha256').update(`${os.platform()}|${os.release()}|${os.arch()}|${process.version}`).digest('hex').slice(0,16);
let failed = false;
for (const suite of suites) {
  const command = `node --test ${suite.files.join(' ')}`;
  const start = Date.now();
  const result = spawnSync(process.execPath, ['--test','--test-reporter=tap',...suite.files], { cwd:root, encoding:'utf8', maxBuffer:32*1024*1024 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const tests = [];
  let current = null;
  for (const line of output.split(/\r?\n/)) {
    const sub = line.match(/^# Subtest: (.+)$/);
    if (sub) { current = { name:sub[1], durationMs:null, status:'NOT RUN' }; continue; }
    const done = line.match(/^(ok|not ok) (\d+) - (.+?)(?: # (SKIP|TODO).*)?$/);
    if (done) {
      const name = current?.name ?? done[3];
      const duration = output.match(new RegExp(`# Subtest: ${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[\\s\\S]*?duration_ms: ([0-9.]+)`));
      const negativeTest = /reject|refus|invalid|stale|conflict|tamper|expired|replay|block|corrupt|unsafe|missing|unknown|without|deni|mismatch|broken|mutant|wrong|external|oversized|rate limit|host|origin|token|traversal|overwrite|illegal|changed/i.test(name);
      tests.push({ name, status:done[1]==='ok' ? 'PASS' : 'FAIL', durationMs:duration ? Number(duration[1]) : null,
        negativeTest, mutantCaught:/mutant/i.test(name), grade:'T1' });
      current = null;
    }
  }
  if (result.status !== 0 || tests.some(t=>t.status!=='PASS')) failed = true;
  const rows = tests.map((item,index)=>({ id:`R14-WP${suite.wp}-${String(index+1).padStart(2,'0')}`, suite:`r14-wp${suite.wp}-tests`, capability:suite.capability,
    status:item.status, command, exitCode:result.status ?? 1, durationMs:item.durationMs, hostFingerprint, name:item.name,
    negativeTest:item.negativeTest, mutantCaught:item.mutantCaught, grade:item.grade }));
  if (!rows.length) rows.push({ id:`R14-WP${suite.wp}-SUITE`, suite:`r14-wp${suite.wp}-tests`, capability:suite.capability,
    status:'FAIL', command, exitCode:result.status ?? 1, durationMs:Date.now()-start, hostFingerprint, reason:'TAP output did not contain any test result rows.' });
  fs.writeFileSync(path.join(root,'results',`r14-wp${suite.wp}-tests.json`),`${JSON.stringify(rows,null,2)}\n`);
  process.stdout.write(`WP${suite.wp}: ${tests.filter(t=>t.status==='PASS').length}/${tests.length} passed; ${rows.length} evidence rows.\n`);
}
process.exitCode = failed ? 1 : 0;
