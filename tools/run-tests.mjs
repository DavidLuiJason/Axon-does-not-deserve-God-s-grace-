// Runs EVERY tests/*.test.ts one by one with tsx and exits non-zero if any fails.
// Why it exists: test:kernel lists tests by hand and 46 of 76 test files were never listed, so they never ran.
// Usage: npm run test:all            (all tests)
//        node tools/run-tests.mjs calc (only tests whose file name contains "calc")
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const filter = (process.argv[2] ?? '').toLowerCase();
const dir = 'tests';
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.ts') && f.toLowerCase().includes(filter))
  .sort();
if (files.length === 0) { console.error(`No test files match "${filter}".`); process.exit(2); }

const tsx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const failed = [];
const started = Date.now();
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(tsx, ['tsx', join(dir, f)], { encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024 });
  const ok = r.status === 0;
  const last = (r.stdout || '').trim().split('\n').filter(Boolean).pop() ?? '';
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${f}  (${((Date.now() - t0) / 1000).toFixed(1)}s)  ${ok ? last.slice(0, 100) : ''}`);
  if (!ok) {
    const err = ((r.stderr || '') + (r.stdout || '')).split('\n').filter((l) => /Error|FAIL|Cannot find|Assertion/.test(l)).slice(0, 3).join(' | ');
    console.log(`      ${r.signal ? 'killed by ' + r.signal + ': ' : ''}${err.slice(0, 300)}`);
    failed.push(f);
  }
}
console.log(`\n${files.length - failed.length} of ${files.length} test files passed in ${((Date.now() - started) / 1000).toFixed(0)}s.`);
if (failed.length) { console.log('FAILED: ' + failed.join(', ')); process.exit(1); }
