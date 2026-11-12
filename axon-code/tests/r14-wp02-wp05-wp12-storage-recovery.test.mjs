import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbKeyValueStore } from '../dist/storage/indexedDbStore.js';
import { IndexedDbWorkspaceFileStore } from '../dist/storage/indexedDbWorkspaceFileStore.js';
import { IndexedDbProjectExtractionSink, IndexedDbProjectReader } from '../dist/storage/indexedDbProjectSink.js';
import { FileBackedKeyValueStore } from '../dist/storage/fileBackedKeyValueStore.js';
import { NodeFileKeyValueHost } from './helpers/file-kv-node-host.mjs';
import { resolveWorkspaceTrust, SingleUseExecutionApprovalVault, authorizeWorkspaceAction } from '../dist/security/workspaceTrust.js';
import { prepareCrashReport, prepareDiagnosticExport, prepareLogRecord } from '../dist/security/securityArtifactRedaction.js';
import { SafeTelemetryBoundary } from '../dist/security/safeTelemetry.js';

let root;
before(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'axon-r14-p6-')); });
after(async () => { if (root) await fs.rm(root, { recursive: true, force: true }); });

function makeIndexedDb(name) {
  const factory = new IDBFactory();
  return { factory, store: new IndexedDbKeyValueStore(name, 'records', factory) };
}

test('P6 file-backed KeyValueStore persists structured values and Uint8Array across reconstruction', async () => {
  const directory = path.join(root, 'file-persist');
  const first = new FileBackedKeyValueStore(directory, new NodeFileKeyValueHost());
  await first.put('job/one', { state: 'RUNNING', bytes: new Uint8Array([0, 1, 255]), nested: { count: 2 } });
  const reopened = new FileBackedKeyValueStore(directory, new NodeFileKeyValueHost());
  const row = await reopened.get('job/one');
  assert.equal(row.state, 'RUNNING'); assert.deepEqual(row.bytes, new Uint8Array([0, 1, 255])); assert.equal(row.nested.count, 2);
  assert.deepEqual((await reopened.list('job/')).map(item => item.key), ['job/one']);
});

test('P6 kill-during-save recovery keeps the previous atomic file record after a real SIGKILL', async () => {
  const directory = path.join(root, 'kill-save');
  const store = new FileBackedKeyValueStore(directory, new NodeFileKeyValueHost());
  await store.put('workspace/current', { revision: 1, body: 'committed-before' });
  const moduleUrl = pathToFileURL(path.resolve('dist/storage/fileBackedKeyValueStore.js')).href;
  const hostUrl = pathToFileURL(path.resolve('tests/helpers/file-kv-node-host.mjs')).href;
  const script = `import { FileBackedKeyValueStore } from ${JSON.stringify(moduleUrl)}; import { NodeFileKeyValueHost } from ${JSON.stringify(hostUrl)}; const store = new FileBackedKeyValueStore(${JSON.stringify(directory)}, new NodeFileKeyValueHost()); await store.put('workspace/current', { revision: 2, body: 'uncommitted-new-value' });`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { cwd: process.cwd(), env: { PATH: process.env.PATH ?? '', AXON_FILE_STORE_FAILPOINT: 'kill-after-temp-sync' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const exit = await new Promise(resolve => child.on('close', (code, signal) => resolve({ code, signal })));
  assert.equal(exit.signal, 'SIGKILL');
  const recovered = await new FileBackedKeyValueStore(directory, new NodeFileKeyValueHost()).get('workspace/current');
  assert.deepEqual(recovered, { revision: 1, body: 'committed-before' });
});

test('P6 fake-indexeddb interrupted project import leaves the last committed project version visible', async () => {
  const { store, factory } = makeIndexedDb('p6-import-interrupt');
  const initial = new IndexedDbProjectExtractionSink(store, () => 100);
  await initial.begin('project-a'); await initial.beginFile('src/main.js', 3); await initial.writeChunk('src/main.js', new Uint8Array([1, 2, 3])); await initial.endFile('src/main.js'); await initial.commit();
  const interrupted = new IndexedDbProjectExtractionSink(store, () => 200);
  await interrupted.begin('project-a'); await interrupted.beginFile('src/main.js', 6); await interrupted.writeChunk('src/main.js', new Uint8Array([9, 9, 9]));
  const readerAfterRestart = new IndexedDbProjectReader(new IndexedDbKeyValueStore('p6-import-interrupt', 'records', factory));
  assert.deepEqual(await readerAfterRestart.readFile('project-a', 'src/main.js'), new Uint8Array([1, 2, 3]));
  await store.close();
});

test('P6 fake-indexeddb two-tab compare-and-write rejects the stale second tab', async () => {
  const factory = new IDBFactory();
  const tabAStore = new IndexedDbKeyValueStore('p6-two-tab', 'records', factory);
  const tabBStore = new IndexedDbKeyValueStore('p6-two-tab', 'records', factory);
  const tabA = new IndexedDbWorkspaceFileStore(tabAStore);
  const tabB = new IndexedDbWorkspaceFileStore(tabBStore);
  await tabA.write('workspace-a', 'src/app.ts', 'version-1');
  const [snapshotA, snapshotB] = await Promise.all([tabA.read('workspace-a', 'src/app.ts'), tabB.read('workspace-a', 'src/app.ts')]);
  assert.equal(snapshotA, 'version-1'); assert.equal(snapshotB, 'version-1');
  assert.equal(await tabA.compareAndWrite('workspace-a', 'src/app.ts', snapshotA, 'version-2'), true);
  assert.equal(await tabB.compareAndWrite('workspace-a', 'src/app.ts', snapshotB, 'stale-version-3'), false);
  assert.equal(await tabA.read('workspace-a', 'src/app.ts'), 'version-2');
  await tabAStore.close(); await tabBStore.close();
});

test('P6 NEGATIVE: file-backed store enforces its configured total-byte quota without replacing prior data', async () => {
  const directory = path.join(root, 'quota');
  const store = new FileBackedKeyValueStore(directory, new NodeFileKeyValueHost(), 700);
  await store.put('quota/item', { value: 'small' });
  const before = await store.get('quota/item');
  await assert.rejects(store.put('quota/item', { value: 'x'.repeat(2000) }), /quota exceeded/);
  assert.deepEqual(await store.get('quota/item'), before);
});

test('P6 NEGATIVE: concurrent file-store writes serialize quota checks across different keys', async () => {
  const directory = path.join(root, 'quota-race');
  const store = new FileBackedKeyValueStore(directory, new NodeFileKeyValueHost(), 700);
  const results = await Promise.allSettled([
    store.put('quota/a', { payload: 'a'.repeat(300) }),
    store.put('quota/b', { payload: 'b'.repeat(300) })
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const refused = results.find(result => result.status === 'rejected');
  assert.ok(refused); assert.match(String(refused.reason), /quota exceeded/);
  assert.equal((await store.list('quota/')).length, 1);
});

test('P6 NEGATIVE: file-backed store detects a corrupted record using its stored SHA-256', async () => {
  const directory = path.join(root, 'corrupt'); const host = new NodeFileKeyValueHost();
  const store = new FileBackedKeyValueStore(directory, host);
  await store.put('workspace/corrupt', { payload: 'before' });
  const recordPath = path.join(directory, `${encodeURIComponent('workspace/corrupt')}.json`);
  const serialized = await fs.readFile(recordPath, 'utf8');
  await fs.writeFile(recordPath, serialized.replace('before', 'after!'));
  await assert.rejects(store.get('workspace/corrupt'), /integrity verification failed/);
});

test('P6 NEGATIVE: unknown and mismatched workspace trust records default to Restricted', () => {
  assert.equal(resolveWorkspaceTrust({ projectFingerprint: 'fp-new' }), 'RESTRICTED');
  assert.equal(resolveWorkspaceTrust({ projectFingerprint: 'fp-new', record: { projectFingerprint: 'fp-old', status: 'TRUSTED', approvedAt: 1, expiresAt: 9999, approvalReference: 'owner-ok' }, now: 2 }), 'RESTRICTED');
  assert.equal(resolveWorkspaceTrust({ projectFingerprint: 'fp-new', record: { projectFingerprint: 'fp-new', status: 'TRUSTED', approvedAt: 1, expiresAt: 9999, approvalReference: 'owner-ok' }, now: 2 }), 'TRUSTED');
});

test('P6 NEGATIVE: single-use approval refuses replay, cross-project use and changed request use', async () => {
  const vault = new SingleUseExecutionApprovalVault();
  const request = { command: 'npm install fixture@1.0.0', args: ['--ignore-scripts'] };
  const approval = await vault.issue({ projectFingerprint: 'project-fp', action: 'task', request, approvalReference: 'owner-approval-1', expiresAt: Date.now() + 60_000 });
  const first = await authorizeWorkspaceAction({ trustStatus: 'RESTRICTED', projectFingerprint: 'project-fp', action: 'task', request, approval: { token: approval.token }, vault });
  assert.equal(first.allowed, true);
  const replay = await authorizeWorkspaceAction({ trustStatus: 'RESTRICTED', projectFingerprint: 'project-fp', action: 'task', request, approval: { token: approval.token }, vault });
  assert.equal(replay.allowed, false); assert.match(replay.reason, /already consumed/);
  const cross = await vault.issue({ projectFingerprint: 'project-fp', action: 'task', request, approvalReference: 'owner-approval-2', expiresAt: Date.now() + 60_000 });
  const crossResult = await authorizeWorkspaceAction({ trustStatus: 'RESTRICTED', projectFingerprint: 'other-project', action: 'task', request, approval: { token: cross.token }, vault });
  assert.equal(crossResult.allowed, false); assert.match(crossResult.reason, /another project/);
  const changed = await vault.issue({ projectFingerprint: 'project-fp', action: 'task', request, approvalReference: 'owner-approval-3', expiresAt: Date.now() + 60_000 });
  const changedResult = await authorizeWorkspaceAction({ trustStatus: 'RESTRICTED', projectFingerprint: 'project-fp', action: 'task', request: { ...request, command: 'npm install evil@1.0.0' }, approval: { token: changed.token }, vault });
  assert.equal(changedResult.allowed, false); assert.match(changedResult.reason, /changed after confirmation/);
});

test('P6 secrets corpus is redacted across logs, diagnostics, exports and crash reports', async () => {
  const github = `ghp_${'A'.repeat(30)}`;
  const aws = 'AKIA1234567890ABCDEF';
  const bearer = `Bearer ${'b'.repeat(36)}`;
  const privateKey = '-----BEGIN PRIVATE KEY-----\nSYNTHETIC-PRIVATE-KEY-BODY\n-----END PRIVATE KEY-----';
  const passwordUrl = 'https://test-user:synthetic-password@example.invalid/path';
  const corpus = { api_key: github, aws_access_key_id: aws, authorization: bearer, private_key: privateKey, endpoint: passwordUrl, nested: { refresh_token: 'synthetic-refresh-token' } };
  const log = prepareLogRecord({ event: 'corpus', ...corpus });
  const diagnosticExport = prepareDiagnosticExport({ diagnostic: { message: `failed with ${github} ${bearer}`, context: corpus } });
  const crash = prepareCrashReport({ id: 'p6-crash', occurredAt: 1, appVersion: 'test', message: JSON.stringify(corpus), stack: `${privateKey}\n${aws}`, context: corpus });
  const stored = { logs: [], diagnostics: [], crashes: [] };
  const telemetry = new SafeTelemetryBoundary({ writeLog: row => stored.logs.push(row), writeDiagnostics: rows => stored.diagnostics.push(...rows), writeCrashReport: row => stored.crashes.push(row) });
  await telemetry.log({ ...corpus });
  await telemetry.diagnostics([{ id: 'p6-d', code: 'REDACTION', severity: 'error', stage: 'security', message: `${github} ${bearer}`, confidence: 'high', evidence: 'CHECKED' }]);
  await telemetry.crash({ id: 'p6-telemetry-crash', occurredAt: 2, appVersion: 'test', message: `${aws} ${passwordUrl}`, stack: privateKey, context: corpus });
  const combined = JSON.stringify({ log, diagnosticExport, crash, stored });
  for (const secret of [github, aws, bearer, 'SYNTHETIC-PRIVATE-KEY-BODY', 'synthetic-password', 'synthetic-refresh-token']) assert.equal(combined.includes(secret), false, `secret corpus member leaked: ${secret.slice(0, 8)}`);
});

test('P6 NEGATIVE: malformed file-store record is rejected instead of silently returning data', async () => {
  const directory = path.join(root, 'malformed'); const host = new NodeFileKeyValueHost();
  const store = new FileBackedKeyValueStore(directory, host);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, `${encodeURIComponent('workspace/bad')}.json`), '{not-json');
  await assert.rejects(store.get('workspace/bad'), /malformed/);
});

test('P6 NEGATIVE (real mutant): removing the compiled file-store hash guard permits a corrupted record', async () => {
  const directory = path.join(root, 'mutant'); const host = new NodeFileKeyValueHost();
  const real = new FileBackedKeyValueStore(directory, host);
  await real.put('workspace/mutant', { value: 'original' });
  const recordPath = path.join(directory, `${encodeURIComponent('workspace/mutant')}.json`);
  const serialized = await fs.readFile(recordPath, 'utf8'); await fs.writeFile(recordPath, serialized.replace('original', 'mutated!'));
  await assert.rejects(real.get('workspace/mutant'), /integrity verification failed/);
  const compiledUrl = new URL('../dist/storage/fileBackedKeyValueStore.js', import.meta.url);
  const compiled = await fs.readFile(compiledUrl, 'utf8');
  const guard = 'if (await digest(body) !== record.sha256)';
  assert.ok(compiled.includes(guard), 'mutant must remove the actual compiled SHA-256 verification');
  const mutantPath = path.join(path.dirname(fileURLToPath(compiledUrl)), `fileBackedKeyValueStore-mutant-${process.pid}.mjs`);
  await fs.writeFile(mutantPath, compiled.replace(guard, 'if (false)'));
  try {
    const { FileBackedKeyValueStore: MutantStore } = await import(`${pathToFileURL(mutantPath).href}?mutant=${process.pid}`);
    const bypass = await new MutantStore(directory, host).get('workspace/mutant');
    assert.deepEqual(bypass, { value: 'mutated!' });
  } finally { await fs.rm(mutantPath, { force: true }); }
});
