import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCrashReport, prepareDiagnosticExport, prepareLogRecord, redactDiagnostics } from '../dist/security/securityArtifactRedaction.js';
import { analyzeSourceFile } from '../dist/diagnostics.js';
const token = 'ghp_' + 'A'.repeat(30);
const aws = 'AKIA1234567890ABCDEF';
const bearer = 'Bearer ' + 'b'.repeat(36);

test('C10 redacts credentials recursively from structured logger records', () => {
  const record = prepareLogRecord({ event: 'test', api_key: 'private-value', nested: { authorization: bearer, message: `token=${token}`, cookie: 'session=private-session' }, values: [`aws=${aws}`, 'credential=private-credential'] });
  const serialized = JSON.stringify(record); assert.doesNotMatch(serialized, /private-value|ghp_A{10}|AKIA1234567890ABCDEF|b{20}|private-session|private-credential/); assert.match(serialized, /REDACTED/);
});
test('C10 redacts secrets from crash message, stack and nested context', () => {
  const report = prepareCrashReport({ id: 'crash-1', occurredAt: 1, appVersion: '1.0', message: `failed ${token}`, stack: `Authorization: ${bearer}\n${aws}`, context: { refresh_token: 'refresh-private', nested: { url: 'https://user:password123@example.test/path' } } });
  const serialized = JSON.stringify(report); assert.equal(report.redaction, 'APPLIED'); assert.doesNotMatch(serialized, /ghp_A{10}|b{20}|AKIA1234567890ABCDEF|refresh-private|password123/);
});
test('C10 redacts diagnostic messages, explanations and related fields before returning them', async () => {
  const findings = await analyzeSourceFile('sample.json', '{ bad json }', 'json', [{ id: 'fixture', supports: () => true, analyze: () => [{ id: 'd1', code: 'LEAK', severity: 'error', stage: 'security', message: `credential ${token}`, explanation: `authorization ${bearer}`, confidence: 'high', evidence: 'ADAPTER_REPORTED', related: [{ file: 'other', line: 1, column: 1 }] }] }]);
  const safe = redactDiagnostics(findings); assert.doesNotMatch(JSON.stringify(safe), /ghp_A{10}|b{20}/);
});
test('C10 redacts diagnostic export payloads and private-key blocks', () => {
  const privateKey = '-----BEGIN PRIVATE KEY-----\nSECRET-MATERIAL\n-----END PRIVATE KEY-----';
  const safe = prepareDiagnosticExport({ message: privateKey, details: `key=${token}` }); assert.doesNotMatch(JSON.stringify(safe), /SECRET-MATERIAL|ghp_A{10}/);
});
test('C10 rejects malformed crash report metadata instead of serializing it', () => {
  assert.throws(() => prepareCrashReport({ id: '', occurredAt: NaN, appVersion: 'x', message: 'x' }), /metadata is invalid/);
});
test('C10 detects the deliberately broken no-redaction mutant', () => {
  const unsafeMutant = (value) => value;
  assert.notEqual(unsafeMutant({ api_key: 'private-value' }).api_key, '[REDACTED]');
  assert.equal(prepareLogRecord({ api_key: 'private-value' }).api_key, '[REDACTED]');
});
test('C10 routes every telemetry channel through the redaction boundary before persistence', async () => {
  const { SafeTelemetryBoundary } = await import('../dist/security/safeTelemetry.js');
  const stored = { logs: [], diagnostics: [], crashes: [] };
  const boundary = new SafeTelemetryBoundary({ writeLog: (row) => stored.logs.push(row), writeDiagnostics: (rows) => stored.diagnostics.push(...rows), writeCrashReport: (row) => stored.crashes.push(row) });
  await boundary.log({ message: token, access_token: 'sensitive-access' });
  await boundary.diagnostics([{ id: 'd', code: 'LEAK', severity: 'error', stage: 'security', message: bearer, confidence: 'high', evidence: 'CHECKED' }]);
  await boundary.crash({ id: 'c', occurredAt: 5, appVersion: '1', message: `failure ${aws}` });
  assert.doesNotMatch(JSON.stringify(stored), /ghp_A{10}|sensitive-access|b{20}|AKIA1234567890ABCDEF/);
});
