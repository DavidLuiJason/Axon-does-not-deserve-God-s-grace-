import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ExecutionTargetRouter, RoutedExecutionCoordinator,
  EvidenceLedger, MemoryEvidenceStore, KeyValueEvidenceStore, MemoryKeyValueStore,
  ProjectQualityGate
} from '../dist/index.js';

const local = (overrides = {}) => ({
  platform: 'linux', runtimeIds: ['node'], available: true,
  sandboxAttested: true, networkBlocked: true, filesystemIsolated: true,
  memoryLimitEnforced: true, timeLimitEnforced: true, unprivileged: true,
  availableMemoryBytes: 1024, availableStorageBytes: 1024, availableCpuUnits: 4,
  gpuAvailable: false, ...overrides
});
const remote = (overrides = {}) => ({
  providerId: 'remote-a', available: true, runtimeIds: ['node'],
  sandboxAttested: true, networkEgressControlled: true, filesystemIsolated: true,
  unprivileged: true, estimatedCostMinorUnits: 250, currency: 'USD', ...overrides
});
const demand = (overrides = {}) => ({ memoryBytes: 512, storageBytes: 128, cpuUnits: 1, gpuRequired: false, estimatedDurationMs: 1000, ...overrides });
const routeInput = (overrides = {}) => ({ runtimeId: 'node', demand: demand(), preference: 'LOCAL_FIRST', classification: 'PUBLIC', local: local(), ...overrides });
const executionResult = (overrides = {}) => ({ requestId: 'exec-1', status: 'completed', elapsedMs: 5, stdout: 'ok', stderr: '', artifacts: [], diagnostics: [], notes: [], ...overrides });

test('R9 target router prefers a verified local sandbox without remote transfer', () => {
  const plan = new ExecutionTargetRouter().plan(routeInput());
  assert.equal(plan.target, 'LOCAL');
  assert.equal(plan.estimatedCostMinorUnits, 0);
});

test('R9 target router only selects remote after policy and explicit cost approval', () => {
  const input = routeInput({ local: local({ availableMemoryBytes: 10 }), remote: remote(), preference: 'REMOTE_ALLOWED' });
  assert.equal(new ExecutionTargetRouter().plan(input).target, 'BLOCKED');
  const approved = { ...input, remoteApproval: { approved: true, approvalReference: 'approve-remote', maxCostMinorUnits: 250, allowConfidentialData: false } };
  const plan = new ExecutionTargetRouter().plan(approved);
  assert.equal(plan.target, 'REMOTE');
  assert.equal(plan.providerId, 'remote-a');
});

test('R9 target router refuses SECRET data and over-budget remote execution', () => {
  const base = { ...routeInput({ local: local({ availableMemoryBytes: 1 }), remote: remote(), preference: 'REMOTE_ALLOWED' }), remoteApproval: { approved: true, approvalReference: 'ok', maxCostMinorUnits: 1000, allowConfidentialData: true } };
  assert.equal(new ExecutionTargetRouter().plan({ ...base, classification: 'SECRET' }).target, 'BLOCKED');
  assert.equal(new ExecutionTargetRouter().plan({ ...base, remoteApproval: { ...base.remoteApproval, maxCostMinorUnits: 100 } }).target, 'BLOCKED');
});

test('R9 target router requires separate approval for CONFIDENTIAL data', () => {
  const base = { ...routeInput({ local: local({ availableMemoryBytes: 1 }), remote: remote(), preference: 'REMOTE_ALLOWED', classification: 'CONFIDENTIAL' }), remoteApproval: { approved: true, approvalReference: 'ok', maxCostMinorUnits: 500, allowConfidentialData: false } };
  assert.equal(new ExecutionTargetRouter().plan(base).target, 'BLOCKED');
  assert.equal(new ExecutionTargetRouter().plan({ ...base, remoteApproval: { ...base.remoteApproval, allowConfidentialData: true } }).target, 'REMOTE');
});

test('R9 routed execution does not run an unapproved remote provider', async () => {
  let calls = 0;
  const provider = { id: 'remote-a', execute: async () => { calls++; return executionResult(); } };
  const coordinator = new RoutedExecutionCoordinator(new ExecutionTargetRouter(), provider, provider);
  const input = routeInput({ local: local({ availableMemoryBytes: 1 }), remote: remote(), preference: 'REMOTE_ALLOWED', remoteApproval: { approved: false, approvalReference: '', maxCostMinorUnits: 500, allowConfidentialData: false }, projectId: 'p', workspaceSnapshotToken: 'snapshot', timeoutMs: 1000, outputLimitBytes: 1024 });
  const result = await coordinator.execute(input, { approved: false, approvalReference: '' });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(calls, 0);
});

test('R9 routed execution binds the approved remote provider and bounds its output', async () => {
  let captured;
  const localProvider = { id: 'local', execute: async () => executionResult() };
  const remoteProvider = { id: 'remote-a', execute: async (input) => { captured = input; return executionResult({ stdout: 'remote-result' }); } };
  const wrong = new RoutedExecutionCoordinator(new ExecutionTargetRouter(), localProvider, { ...remoteProvider, id: 'other' });
  const base = routeInput({ local: local({ availableMemoryBytes: 1 }), remote: remote(), preference: 'REMOTE_ALLOWED', remoteApproval: { approved: true, approvalReference: 'approve', maxCostMinorUnits: 500, allowConfidentialData: false }, projectId: 'p', workspaceSnapshotToken: 'snapshot', timeoutMs: 1000, outputLimitBytes: 1024 });
  assert.equal((await wrong.execute(base, { approved: true, approvalReference: 'approve' })).status, 'BLOCKED');
  const coordinator = new RoutedExecutionCoordinator(new ExecutionTargetRouter(), localProvider, remoteProvider);
  const result = await coordinator.execute(base, { approved: true, approvalReference: 'approve' });
  assert.equal(result.status, 'EXECUTED');
  assert.equal(captured.networkAllowed, false);
  assert.equal(captured.approvalReference, 'approve');
  const oversized = new RoutedExecutionCoordinator(new ExecutionTargetRouter(), localProvider, { id: 'remote-a', execute: async () => executionResult({ stdout: 'x'.repeat(2048) }) });
  assert.equal((await oversized.execute({ ...base, outputLimitBytes: 100 }, { approved: true, approvalReference: 'approve' })).status, 'FAILED');
});

test('R9 evidence ledger creates verifiable append-only hash chains', async () => {
  const ledger = new EvidenceLedger(new MemoryEvidenceStore(), () => 123);
  const first = await ledger.append({ projectId: 'p', operation: 'analyse', status: 'PASS', summary: 'Project analysis completed.' });
  const second = await ledger.append({ projectId: 'p', operation: 'build', status: 'BLOCKED', summary: 'No verified host builder.' });
  assert.equal(second.previousHash, first.recordHash);
  assert.deepEqual(await ledger.verify('p'), { valid: true, checked: 2 });
});

test('R9 evidence ledger detects record tampering', async () => {
  const store = new MemoryEvidenceStore();
  const ledger = new EvidenceLedger(store);
  await ledger.append({ projectId: 'p', operation: 'test', status: 'PASS', summary: 'tested' });
  const rows = await store.list('p');
  rows[0].summary = 'changed';
  // Use a deliberately hostile store to simulate tampering after persistence.
  const hostile = { list: async () => rows, append: async () => {} };
  assert.equal((await new EvidenceLedger(hostile).verify('p')).valid, false);
});

test('R9 evidence store prevents concurrent ledgers from creating a fork', async () => {
  const store = new MemoryEvidenceStore();
  const a = new EvidenceLedger(store);
  const b = new EvidenceLedger(store);
  const results = await Promise.allSettled([
    a.append({ projectId: 'p', operation: 'a', status: 'PASS', summary: 'a' }),
    b.append({ projectId: 'p', operation: 'b', status: 'PASS', summary: 'b' })
  ]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal((await store.list('p')).length, 1);
});

test('R9 key-value evidence store uses atomic compare-and-append across independent writers', async () => {
  const store = new KeyValueEvidenceStore(new MemoryKeyValueStore());
  const one = new EvidenceLedger(store); const two = new EvidenceLedger(store);
  const outcomes = await Promise.allSettled([
    one.append({ projectId: 'p', operation: 'one', status: 'PASS', summary: 'one' }),
    two.append({ projectId: 'p', operation: 'two', status: 'PASS', summary: 'two' })
  ]);
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal((await one.verify('p')).valid, true);
});

test('R9 quality gate requires evidence for PASS and separates incomplete from blocked', () => {
  const gate = new ProjectQualityGate();
  assert.throws(() => gate.evaluate('p', [{ id: 'build', state: 'PASS', required: true, reason: 'built' }]), /evidence/);
  assert.equal(gate.evaluate('p', [{ id: 'build', state: 'NOT_RUN', required: true, reason: 'not run' }]).state, 'INCOMPLETE');
  assert.equal(gate.evaluate('p', [{ id: 'runtime', state: 'BLOCKED', required: true, reason: 'provider missing' }]).state, 'NOT_READY');
  assert.equal(gate.evaluate('p', [{ id: 'build', state: 'PASS', required: true, evidenceReference: 'ev-1', reason: 'verified' }]).state, 'READY');
});
