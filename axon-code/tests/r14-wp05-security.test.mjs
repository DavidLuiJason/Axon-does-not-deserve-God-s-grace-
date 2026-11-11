import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSensitiveText, redactSensitiveData } from '../dist/security/secretRedactor.js';

test('R14 WP5 redacts common provider tokens and bearer credentials', () => {
  const source = 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345; api_key=sk-proj-abcdefghijklmnopqrstuvwxyz0123456789';
  const result = redactSensitiveText(source, 'logs');
  assert.doesNotMatch(result, /abcdefghijklmnopqrstuvwxyz012345|sk-proj-abcdefghijklmnopqrstuvwxyz/);
  assert.match(result, /\[REDACTED\]/);
});

test('R14 WP5 redacts GitHub and AWS key patterns', () => {
  const result = redactSensitiveText('ghp_abcdefghijklmnopqrstuvwxyz123456 AKIA1234567890ABCDEF', 'diagnostics');
  assert.equal((result.match(/\[REDACTED\]/g) ?? []).length, 2);
});

test('R14 WP5 redacts private-key blocks and URL passwords', () => {
  const source = '-----BEGIN PRIVATE KEY-----\nPRIVATE_MATERIAL\n-----END PRIVATE KEY----- https://alice:supersecret@host.test/path';
  const result = redactSensitiveText(source, 'crash-reports');
  assert.doesNotMatch(result, /PRIVATE_MATERIAL|supersecret/);
  assert.match(result, /\[REDACTED PRIVATE KEY\]/);
});

test('R14 WP5 recursively redacts sensitive object keys in exports', () => {
  const result = redactSensitiveData({ apiKey: 'secret-a', nested: [{ password: 'secret-b', note: 'ordinary' }] }, 'exports');
  assert.equal(result.apiKey, '[REDACTED]');
  assert.equal(result.nested[0].password, '[REDACTED]');
  assert.equal(result.nested[0].note, 'ordinary');
});

test('R14 WP5 redacts case and separator variants of secret field names', () => {
  const result = redactSensitiveData({ ACCESS_TOKEN: 'a', client_secret: 'b', privateKey: 'c', refreshToken: 'd' }, 'logs');
  assert.deepEqual(result, { ACCESS_TOKEN: '[REDACTED]', client_secret: '[REDACTED]', privateKey: '[REDACTED]', refreshToken: '[REDACTED]' });
});

test('R14 WP5 preserves ordinary prose that only mentions a secret concept', () => {
  const source = 'The secret to readable code is consistent naming; use a password manager.';
  assert.equal(redactSensitiveText(source, 'diagnostics'), source);
});

test('R14 WP5 handles cycles without recursion failure', () => {
  const value = { message: 'safe' };
  value.self = value;
  const result = redactSensitiveData(value, 'crash-reports');
  assert.equal(result.self, '[CIRCULAR]');
});

test('R14 WP5 rejects non-text input to the text redactor', () => {
  assert.throws(() => redactSensitiveText(42, 'logs'), /text/);
});

test('R14 WP5 applies the same redaction contract to all four output contexts', () => {
  for (const context of ['logs', 'diagnostics', 'exports', 'crash-reports']) {
    assert.equal(redactSensitiveText('password=do-not-leak', context), 'password=[REDACTED]');
  }
});

test('R14 WP5 catches a deliberately broken no-op redaction mutant', () => {
  const brokenMutant = (value) => value;
  const secret = 'Bearer abcdefghijklmnopqrstuvwxyz012345';
  const expected = redactSensitiveText(secret, 'logs');
  assert.throws(() => assert.equal(brokenMutant(secret), expected), { name: 'AssertionError' });
});

import { MemoryWorkspaceFileStore } from '../dist/workspace/workingCopy.js';
import { ProjectSelectionManager } from '../dist/workspace/projectSelection.js';
import { ProjectExportService } from '../dist/workspace/projectExport.js';
import { EvidenceLedger, MemoryEvidenceStore } from '../dist/verification/evidenceLedger.js';

test('R14 WP5 actual project export redacts credential-like literals and reports affected paths', async () => {
  const store = new MemoryWorkspaceFileStore();
  await store.write('export-project', 'src/config.ts', 'export const api_key = "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789";');
  const selectionManager = new ProjectSelectionManager(store);
  const selection = await selectionManager.select({ workspaceId:'export-project', mode:'ALL' });
  const payload = await new ProjectExportService(selectionManager).export(selection, 'txt');
  const text = new TextDecoder().decode(payload.bytes);
  assert.doesNotMatch(text, /sk-proj-abcdefghijklmnopqrstuvwxyz/);
  assert.match(text, /\[REDACTED\]/);
  assert.ok(payload.warnings.some((warning) => warning.includes('src/config.ts')));
});

test('R14 WP5 evidence ledger redacts credential-bearing diagnostics before persistence', async () => {
  const store = new MemoryEvidenceStore();
  const ledger = new EvidenceLedger(store, () => 100);
  await ledger.append({ projectId:'p1', operation:'build', status:'FAIL', summary:'Build failed: Authorization Bearer abcdefghijklmnopqrstuvwxyz012345' });
  const rows = await store.list('p1');
  assert.doesNotMatch(rows[0].summary, /abcdefghijklmnopqrstuvwxyz012345/);
  assert.match(rows[0].summary, /\[REDACTED\]/);
  assert.equal((await ledger.verify('p1')).valid, true);
});
