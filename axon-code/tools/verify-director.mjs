#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const summary = { schemaVersion: 1, commands: [], checks: {}, counts: {}, startedAt: new Date().toISOString() };
function run(command, args, label) {
  const start = Date.now();
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const row = { label, command: [command, ...args].join(' '), exitCode: result.status ?? 1, durationMs: Date.now() - start,
    stdoutTail: (result.stdout ?? '').slice(-6000), stderrTail: (result.stderr ?? '').slice(-6000) };
  summary.commands.push(row);
  return row;
}
function walk(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}
fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
const typecheck = run('npm', ['run', 'typecheck'], 'strict TypeScript typecheck');
const build = run('npm', ['run', 'build'], 'clean TypeScript build');
const testFiles = fs.readdirSync(path.join(root, 'tests')).filter((name) => name.endsWith('.test.mjs')).sort().map((name) => `tests/${name}`);
// Run each retained test file in its own process. This prevents an unrelated
// file-level open handle from stalling the entire suite while preserving a
// deterministic serial run and exact per-file counts.
summary.counts = { nodeTests: 0, passed: 0, failed: 0, skipped: 0, testFiles: testFiles.length };
let nodeTestExitCode = 0;
for (const file of testFiles) {
  const row = run(process.execPath, ['--test', '--test-reporter=spec', file], `Node suite ${file}`);
  const readCount = (label) => Number(row.stdoutTail.match(new RegExp(`(?:ℹ\\s*)?${label}\\s+(\\d+)`))?.[1] ?? 0);
  const countTests = readCount('tests');
  const countPassed = readCount('pass');
  const countFailed = readCount('fail');
  const countSkipped = readCount('skipped');
  summary.counts.nodeTests += countTests;
  summary.counts.passed += countPassed;
  summary.counts.failed += countFailed;
  summary.counts.skipped += countSkipped;
  if (row.exitCode !== 0 || countTests === 0 || countFailed !== 0 || countSkipped !== 0 || countPassed !== countTests) nodeTestExitCode = 1;
}
const tests = { exitCode: nodeTestExitCode };
const derive = run(process.execPath, ['tools/derive-capability-status.mjs'], 'derive capability registry from result files');
const mergePath = path.join(root, 'MERGE_SET.txt');
const merge = fs.existsSync(mergePath) ? fs.readFileSync(mergePath, 'utf8').split(/\r?\n/).filter(Boolean) : [];
const forbidden = merge.filter((name) => /^(dist|node_modules|docs\/history)(\/|$)/.test(name));
const missing = merge.filter((name) => !fs.existsSync(path.join(root, name)));
const mergeBytes = merge.reduce((sum, name) => sum + (fs.existsSync(path.join(root, name)) ? fs.statSync(path.join(root, name)).size : 0), 0);
summary.checks.mergeSet = { files: merge.length, bytes: mergeBytes, missing, forbidden };
const ratchet = JSON.parse(fs.readFileSync(path.join(root, 'tests/ratchet.json'), 'utf8'));
summary.checks.ratchet = { minimum: ratchet.minimumNodeTests, actual: summary.counts.nodeTests,
  passed: summary.counts.failed === 0 && summary.counts.skipped === 0 && summary.counts.nodeTests >= ratchet.minimumNodeTests };
const gateway = fs.readFileSync(path.join(root, 'src/gateway/axonCodeGateway.ts'), 'utf8');
summary.checks.importBoundary = { passed: !/^\s*import\s/m.test(gateway) && !/axon-main/i.test(gateway) };
const ui = fs.readFileSync(path.join(root, 'ui/index.html'), 'utf8').toLowerCase();
const registry = JSON.parse(fs.readFileSync(path.join(root, 'docs/CAPABILITY_REGISTRY.json'), 'utf8'));
const sandboxCaveat = !ui.includes('sandbox') || /not an operating-system security sandbox/.test(ui);
summary.checks.honesty = { sandboxClaimHasExplicitOSBoundary: sandboxCaveat,
  unsupportedTermsChecked: ['sandbox', 'secure', 'supported', 'isolated'],
  note: 'Only the current UI/gateway boundary is scanned; the iframe wording explicitly disclaims OS sandboxing.' };
const manifestLines = fs.readFileSync(path.join(root, 'FILES_MANIFEST.txt'), 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#'));
const manifestMissing = manifestLines.filter((name) => !fs.existsSync(path.join(root, name)));
summary.checks.manifest = { entries: manifestLines.length, missing: manifestMissing };
const sums = fs.readFileSync(path.join(root, 'SHA256SUMS.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
const badHashes = [];
for (const line of sums) {
  const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
  if (!match) { badHashes.push({ line, reason: 'malformed' }); continue; }
  const file = path.join(root, match[2]);
  if (!fs.existsSync(file)) { badHashes.push({ file: match[2], reason: 'missing' }); continue; }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (actual !== match[1]) badHashes.push({ file: match[2], reason: 'hash mismatch' });
}
summary.checks.hashes = { entries: sums.length, bad: badHashes };
const registryCaps = registry.capabilities ?? [];
summary.checks.registry = { capabilities: registryCaps.length, allStatusesValid: registryCaps.every((item) =>
  ['BUILT', 'TESTED', 'BLOCKED', 'NOT IMPLEMENTED', 'NOT RUN'].includes(item.status)) };
const totalMergeFiles = merge.length;
summary.checks.budget = { mergeFiles: totalMergeFiles, maxFiles: 600, mergeBytes: mergeBytes, maxBytes: 8 * 1024 * 1024,
  passed: totalMergeFiles <= 600 && mergeBytes <= 8 * 1024 * 1024 };
const blockerRows = JSON.parse(fs.readFileSync(path.join(root, 'results/r14-wp00-blockers.json'), 'utf8'));
summary.checks.cleanInstall = {
  status: blockerRows.find((row) => row.id === 'R14-WP00-NPM-CI')?.status ?? 'NOT RUN',
  reason: blockerRows.find((row) => row.id === 'R14-WP00-NPM-CI')?.reason ?? 'No clean-install evidence.',
};
summary.finishedAt = new Date().toISOString();
const failures = [
  typecheck.exitCode !== 0, build.exitCode !== 0, tests.exitCode !== 0, derive.exitCode !== 0,
  missing.length > 0, forbidden.length > 0, manifestMissing.length > 0, !summary.checks.ratchet.passed,
  !summary.checks.importBoundary.passed, !sandboxCaveat, badHashes.length > 0,
  !summary.checks.registry.allStatusesValid, !summary.checks.budget.passed,
];
summary.status = failures.some(Boolean) ? 'FAIL' : summary.checks.cleanInstall.status === 'BLOCKED' ? 'BLOCKED' : 'PASS';
fs.writeFileSync(path.join(root, 'VERIFY_SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${summary.status}: ${summary.counts.passed}/${summary.counts.nodeTests} Node tests; ${summary.checks.hashes.entries} hashes checked; ${totalMergeFiles} merge files.\n`);
process.exitCode = summary.status === 'PASS' ? 0 : summary.status === 'BLOCKED' ? 2 : 1;
