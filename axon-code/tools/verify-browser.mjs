#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = spawnSync(process.execPath, ['--version'], { encoding: 'utf8' }).stdout.trim();
const py = spawnSync('python3', ['--version'], { encoding: 'utf8' }).stdout.trim();
const fingerprint = crypto.createHash('sha256').update(`${os.platform()}|${os.release()}|${os.arch()}|${version}|${py}`).digest('hex').slice(0,16);
const candidates = ['chromium', 'chromium-browser', 'google-chrome'];
let browser = null;
for (const name of candidates) {
  const found = spawnSync('which', [name], { encoding: 'utf8' });
  if (found.status === 0 && found.stdout.trim()) { browser = found.stdout.trim(); break; }
}
const resultsDir = path.join(root, 'results');
fs.mkdirSync(resultsDir, { recursive: true });
const output = path.join(resultsDir, 'r14-browser-verification.json');
const rows = [];
if (!browser) {
  rows.push({ id:'R14-VERIFY-BROWSER', suite:'browser-verification', capability:'chromium-browser-verification',
    status:'NOT RUN', command:'npm run verify:browser', exitCode:null, durationMs:null, hostFingerprint:fingerprint,
    reason:'Chromium executable not found; browser integration suites were not run.' });
  process.stdout.write('NOT RUN: Chromium executable not found; reason recorded.\n');
} else {
  for (const script of ['tests/round12-browser-runtime.integration.py','tests/round12-workbench-ui.integration.py','tests/r14-wp02-wp12-browser.integration.py']) {
    const start=Date.now();
    const result=spawnSync('python3',[script],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
    let status = result.status===0 ? 'PASS' : 'FAIL';
    let reason;
    const capability = script.includes('r14-wp02-wp12') ? 'indexeddb-reload-persistence' : 'chromium-browser-verification';
    if (script.includes('r14-wp02-wp12')) {
      try {
        const proof = JSON.parse(fs.readFileSync(path.join(resultsDir,'r14-wp02-wp12-browser.json'),'utf8'));
        if (proof.some(item=>item.status==='FAIL')) status='FAIL';
        else if (proof.some(item=>item.status==='NOT RUN')) { status='NOT RUN'; reason=proof.map(item=>item.reason).filter(Boolean).join(' '); }
      } catch { status='FAIL'; reason='Browser persistence result file was not produced or was malformed.'; }
    }
    rows.push({ id:`R14-${path.basename(script).toUpperCase().replaceAll('.','-')}`,suite:'browser-verification',
      capability,status,command:`python3 ${script}`,exitCode:status==='NOT RUN'?null:(result.status??1),durationMs:Date.now()-start,hostFingerprint:fingerprint,
      ...(reason?{reason}:{}),stdoutTail:(result.stdout??'').slice(-3000),stderrTail:(result.stderr??'').slice(-3000) });
  }
  process.stdout.write(`Browser verification: ${rows.filter(x=>x.status==='PASS').length} PASS, ${rows.filter(x=>x.status==='NOT RUN').length} NOT RUN, ${rows.filter(x=>x.status==='FAIL').length} FAIL.\n`);
}
fs.writeFileSync(output,`${JSON.stringify(rows,null,2)}\n`);
const derived = spawnSync(process.execPath, ['tools/derive-capability-status.mjs'], {cwd:root,encoding:'utf8'});
if (derived.status !== 0) { process.stderr.write(derived.stderr || derived.stdout); process.exitCode = 1; }
process.exitCode=(derived.status!==0 || rows.some(x=>x.status==='FAIL'))?1:0;
