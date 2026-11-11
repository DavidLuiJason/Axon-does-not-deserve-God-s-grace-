#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testFiles = fs.readdirSync(path.join(root, 'tests')).filter((name) => name.endsWith('.test.mjs')).sort();
const hostFingerprint = crypto.createHash('sha256').update(`${os.platform()}|${os.release()}|${os.arch()}|${process.version}`).digest('hex').slice(0, 16);
const rows = [];
const runStarted = Date.now();
for (const name of testFiles) {
  const file = `tests/${name}`;
  const started = Date.now();
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', file], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const count = (label) => Number(output.match(new RegExp(`(?:ℹ\\s*)?${label}\\s+(\\d+)`))?.[1] ?? 0);
  const tests = count('tests'); const passed = count('pass'); const failed = count('fail'); const skipped = count('skipped');
  const exitCode = result.status ?? 1;
  const valid = exitCode === 0 && tests > 0 && passed === tests && failed === 0 && skipped === 0;
  rows.push({ id: `R14-FULL-${name.replace(/\.test\.mjs$/, '').toUpperCase()}`, suite: 'full-node-regression', capability: 'full-retained-node-regression',
    status: valid ? 'PASS' : 'FAIL', command: `node --test --test-reporter=spec ${file}`, exitCode, durationMs: Date.now() - started,
    hostFingerprint, testFile: file, tests, passed, failed, skipped, grade: 'T1',
    ...(!valid ? { reason: (result.stderr || result.stdout || 'Node test suite failed or emitted no complete summary.').slice(-3000) } : {}) });
  process.stdout.write(`${valid ? 'PASS' : 'FAIL'} ${file}: ${passed}/${tests}, failed=${failed}, skipped=${skipped}\n`);
}
const summary = { schemaVersion: 1, testFiles: rows.length, tests: rows.reduce((sum, row) => sum + row.tests, 0),
  passed: rows.reduce((sum, row) => sum + row.passed, 0), failed: rows.reduce((sum, row) => sum + row.failed, 0),
  skipped: rows.reduce((sum, row) => sum + row.skipped, 0), status: rows.every((row) => row.status === 'PASS') ? 'PASS' : 'FAIL' };
fs.writeFileSync(path.join(root, 'results/r14-full-regression-per-file.json'), `${JSON.stringify(rows, null, 2)}\n`);
const summaryEvidence = { id: 'R14-FULL-REGRESSION-SUMMARY', suite: 'full-node-regression', capability: 'full-retained-node-regression', status: summary.status, command: 'npm run test:full-r14', exitCode: summary.status === 'PASS' ? 0 : 1, durationMs: Date.now() - runStarted, hostFingerprint, ...summary, grade: 'T1' };
fs.writeFileSync(path.join(root, 'results/r14-full-regression-summary.json'), `${JSON.stringify(summaryEvidence, null, 2)}\n`);
process.stdout.write(`${summary.status}: ${summary.passed}/${summary.tests} tests across ${summary.testFiles} files; ${summary.failed} failed, ${summary.skipped} skipped.\n`);
process.exitCode = summary.status === 'PASS' ? 0 : 1;
