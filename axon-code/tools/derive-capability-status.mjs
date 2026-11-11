#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resultsDir = path.join(root, 'results');
const output = path.join(root, 'docs', 'CAPABILITY_REGISTRY.json');
const allowed = new Set(['BUILT', 'TESTED', 'BLOCKED', 'NOT IMPLEMENTED', 'NOT RUN', 'PASS', 'FAIL']);
const rows = [];

for (const name of fs.readdirSync(resultsDir).filter((item) => item.endsWith('.json')).sort()) {
  const parsed = JSON.parse(fs.readFileSync(path.join(resultsDir, name), 'utf8'));
  for (const row of Array.isArray(parsed) ? parsed : [parsed]) {
    if (!row || typeof row.id !== 'string' || typeof row.capability !== 'string' ||
        typeof row.status !== 'string' || !allowed.has(row.status) ||
        typeof row.suite !== 'string' || typeof row.command !== 'string' ||
        !Object.hasOwn(row, 'exitCode') || !Object.hasOwn(row, 'durationMs') ||
        typeof row.hostFingerprint !== 'string') {
      throw new Error(`Invalid machine result record in ${name}`);
    }
    rows.push({ ...row, resultFile: `results/${name}` });
  }
}
const grouped = new Map();
for (const row of rows) {
  const group = grouped.get(row.capability) ?? [];
  group.push(row);
  grouped.set(row.capability, group);
}
const priority = ['BLOCKED', 'NOT IMPLEMENTED', 'NOT RUN', 'FAIL', 'TESTED', 'PASS', 'BUILT'];
const capabilities = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, evidence]) => {
  const statuses = new Set(evidence.map((row) => row.status));
  const picked = priority.find((candidate) => statuses.has(candidate)) ?? 'NOT RUN';
  const status = picked === 'PASS' ? 'TESTED' : picked === 'FAIL' ? 'BLOCKED' : picked;
  const grades = [...new Set(evidence.map((row) => row.grade).filter((grade) => typeof grade === 'string'))];
  return { id, status, grade: grades.length === 1 ? grades[0] : grades.length ? 'MIXED' : 'UNSPECIFIED',
    evidenceIds: evidence.map((row) => row.id), resultFiles: [...new Set(evidence.map((row) => row.resultFile))] };
});
const resultSetHash = crypto.createHash('sha256')
  .update(rows.map((row) => JSON.stringify(row)).sort().join('\\n'))
  .digest('hex');
const registry = {
  schemaVersion: 1,
  generatedFrom: 'results/*.json',
  resultSetSha256: resultSetHash,
  capabilityCount: capabilities.length,
  capabilities,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(registry, null, 2)}\n`);
process.stdout.write(`Derived ${capabilities.length} capability statuses from ${rows.length} result records.\n`);
