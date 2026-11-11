import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AxonLagControlManager,
  AXON_LAG_CONTROL_OWNER,
  KeyValueLagControlStateStore,
  JavaScriptWorkerExecutionAdapter,
  parseZipArchive,
  SafeZipExtractor,
  MemoryTransactionalExtractionSink,
  MemoryKeyValueStore,
  PersistentJobManager,
  CheckpointManager,
  RecoveryCoordinator,
  MemoryWorkspaceFileStore,
  KeyValueWorkspaceJournalStore,
  WorkingCopyManager,
  PlatformCapabilityRegistry,
  evaluateRuntimeRequirements,
  DiagnosticAdapterRegistry,
  benchmarkParserCandidates,
  AndroidApkBuildService,
  HostProcessRuntimeAdapter,
  IndexedDbProjectExtractionSink,
  IndexedDbProjectReader
} from '../dist/index.js';
import { makeZip } from './helpers/zipBuilder.mjs';

function createLagAdapters() {
  const calls = [];
  return {
    calls,
    background: {
      async suspendAllManagedWork(owner, reason) { calls.push(['suspend', owner, reason]); return { allManagedWorkSuspended: true, suspendedTaskIds: ['job-1'], unpausableTaskIds: [], notes: [] }; },
      async releaseManagedWorkSuspension(owner) { calls.push(['release', owner]); },
      async setWorkerCap(owner, count) { calls.push(['cap', owner, count]); },
      async clearWorkerCap(owner) { calls.push(['clear-cap', owner]); }
    },
    telemetry: {
      async setSamplingEnabled(owner, enabled) { calls.push(['sampling', owner, enabled]); },
      async setSamplingIntervalMultiplier(owner, multiplier) { calls.push(['interval', owner, multiplier]); }
    }
  };
}

const healthySample = { sampledAt: 100, inputToPaintP95Ms: 20, eventLoopDelayP95Ms: 5, frameOverrunRatio: 0, longTaskCount: 0 };

// AXON-controlled lag modes

test('lag control starts in AUTO and hard safety is always declared enabled', () => {
  const adapters = createLagAdapters();
  const manager = new AxonLagControlManager(adapters);
  assert.equal(manager.getStatus().mode, 'AUTO');
  const decision = manager.observe(healthySample);
  assert.equal(decision.hardSafetyControlsEnabled, true);
  assert.equal(decision.controlMode, 'AUTO');
});

test('AXON can suspend all managed work and disable optional telemetry', async () => {
  const adapters = createLagAdapters();
  const manager = new AxonLagControlManager(adapters);
  const status = await manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'SUSPENDED', reason: 'User needs full device resources.', durationMs: 30_000 });
  assert.equal(status.mode, 'SUSPENDED');
  assert.deepEqual(adapters.calls.map((item) => item[0]), ['suspend', 'sampling', 'cap']);
  assert.deepEqual(adapters.calls[2], ['cap', AXON_LAG_CONTROL_OWNER, 0]);
  const decision = manager.observe(healthySample);
  assert.equal(decision.state, 'AXON_SUSPENDED');
  assert.equal(decision.pauseBackground, true);
  assert.equal(decision.telemetrySamplingEnabled, false);
  assert.equal(decision.hardSafetyControlsEnabled, true);
});

test('REDUCED mode lowers telemetry frequency and background concurrency', async () => {
  const adapters = createLagAdapters();
  const manager = new AxonLagControlManager(adapters);
  await manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'REDUCED', reason: 'Save overhead.', durationMs: 10_000 });
  assert.ok(adapters.calls.some((item) => item[0] === 'interval' && item[2] === 4));
  assert.ok(adapters.calls.some((item) => item[0] === 'cap' && item[2] === 1));
  assert.equal(manager.observe(healthySample).controlMode, 'REDUCED');
});

test('AUTO releases only the manager-owned pause and clears its cap', async () => {
  const adapters = createLagAdapters();
  const manager = new AxonLagControlManager(adapters);
  await manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'SUSPENDED', reason: 'Yield device.', durationMs: 30_000 });
  await manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'AUTO', reason: 'Resume automatic controls.' });
  assert.ok(adapters.calls.some((item) => item[0] === 'release'));
  assert.ok(adapters.calls.some((item) => item[0] === 'clear-cap'));
  assert.equal(manager.getStatus().mode, 'AUTO');
});

test('non-Brain callers cannot change lag-control mode', async () => {
  const manager = new AxonLagControlManager(createLagAdapters());
  await assert.rejects(() => manager.applyCommand({ requestedBy: 'USER', mode: 'SUSPENDED', reason: 'Try bypass', durationMs: 1000 }), /Only AXON Brain/);
});

test('bounded suspension duration is mandatory', async () => {
  const manager = new AxonLagControlManager(createLagAdapters());
  await assert.rejects(() => manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'SUSPENDED', reason: 'No limit' }), /require a positive duration/);
  await assert.rejects(() => manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'SUSPENDED', reason: 'Too long', durationMs: 99_999_999 }), /no greater than/);
});

test('suspension expires automatically when the manager is next reconciled', async () => {
  let now = 1000;
  const manager = new AxonLagControlManager(createLagAdapters(), {}, () => now, 10_000);
  await manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'SUSPENDED', reason: 'Temporary yield.', durationMs: 1000 });
  now = 2500;
  assert.equal(manager.getStatus().mode, 'SUSPENDED');
  await manager.reconcile();
  assert.equal(manager.getStatus().mode, 'AUTO');
});

test('startup reconciliation reapplies a currently active suspension to host adapters', async () => {
  const adapters = createLagAdapters();
  const manager = new AxonLagControlManager(adapters);
  await manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'SUSPENDED', reason: 'Reboot test.', durationMs: 30_000 });
  const before = adapters.calls.length;
  await manager.reconcile();
  assert.equal(adapters.calls.length, before + 3);
});

test('AXON lag-control override persists and is reapplied before managed work after restart', async () => {
  const store = new MemoryKeyValueStore();
  const stateStore = new KeyValueLagControlStateStore(store);
  let now = 10_000;
  const firstAdapters = createLagAdapters();
  const first = new AxonLagControlManager(firstAdapters, {}, () => now, 60_000, stateStore);
  await first.initialize();
  await first.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'SUSPENDED', reason: 'Keep the device responsive.', durationMs: 30_000 });

  const restartedAdapters = createLagAdapters();
  const restarted = new AxonLagControlManager(restartedAdapters, {}, () => now, 60_000, stateStore);
  const restored = await restarted.initialize();
  assert.equal(restored.mode, 'SUSPENDED');
  assert.equal(restarted.observe(healthySample).state, 'AXON_SUSPENDED');
  assert.ok(restartedAdapters.calls.some((item) => item[0] === 'suspend'));
  assert.deepEqual(restartedAdapters.calls.slice(-3).map((item) => item[0]), ['suspend', 'sampling', 'cap']);
});

test('expired persisted lag-control override returns to AUTO during startup', async () => {
  const store = new MemoryKeyValueStore();
  const stateStore = new KeyValueLagControlStateStore(store);
  let now = 1000;
  const first = new AxonLagControlManager(createLagAdapters(), {}, () => now, 60_000, stateStore);
  await first.initialize();
  await first.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'REDUCED', reason: 'Temporarily reduce overhead.', durationMs: 5000 });
  now = 7000;
  const adapters = createLagAdapters();
  const restarted = new AxonLagControlManager(adapters, {}, () => now, 60_000, stateStore);
  const restored = await restarted.initialize();
  assert.equal(restored.mode, 'AUTO');
  assert.ok(adapters.calls.some((item) => item[0] === 'release'));
  assert.equal((await stateStore.load()).mode, 'AUTO');
});

test('corrupt persisted lag-control state blocks startup reconciliation', async () => {
  const store = new MemoryKeyValueStore();
  await store.put('axon-code/lag-control/override', { mode: 'SUSPENDED', reason: 'x', changedAt: 1, expiresAt: 50_000 });
  const adapters = createLagAdapters();
  const manager = new AxonLagControlManager(adapters, {}, Date.now, 60_000, new KeyValueLagControlStateStore(store));
  await assert.rejects(() => manager.initialize(), /Persisted AXON lag-control state is invalid/);
  assert.equal(adapters.calls.length, 0);
});

test('AXON suspension is not confirmed when a managed task cannot pause safely', async () => {
  const adapters = createLagAdapters();
  adapters.background.suspendAllManagedWork = async () => ({ allManagedWorkSuspended: false, suspendedTaskIds: ['job-1'], unpausableTaskIds: ['job-2'], notes: ['job-2 cannot pause safely'] });
  const manager = new AxonLagControlManager(adapters);
  await assert.rejects(() => manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'SUSPENDED', reason: 'Test partial failure.', durationMs: 1000 }), /could not safely suspend every managed task/);
  assert.equal(manager.getStatus().mode, 'AUTO');
  assert.equal(adapters.calls.some((item) => item[0] === 'sampling' && item[2] === false), false);
});

test('telemetry adapter failure does not claim suspension succeeded', async () => {
  const adapters = createLagAdapters();
  adapters.telemetry.setSamplingEnabled = async () => { throw new Error('telemetry unavailable'); };
  const manager = new AxonLagControlManager(adapters);
  await assert.rejects(() => manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'SUSPENDED', reason: 'Fail closed.', durationMs: 1000 }), /telemetry unavailable/);
  assert.equal(manager.getStatus().mode, 'AUTO');
  assert.ok(adapters.calls.some((item) => item[0] === 'suspend'));
});

// ZIP parser and transactional extractor

test('ZIP parser reads actual stored archive bytes', () => {
  const archive = parseZipArchive(makeZip([{ name: 'src/main.js', data: 'console.log(1)' }]));
  assert.equal(archive.entries.length, 1);
  assert.equal(archive.entries[0].path, 'src/main.js');
  assert.equal(archive.manifestReport.safeToExtract, true);
});

test('ZIP extractor writes and verifies stored file contents', async () => {
  const zip = makeZip([{ name: 'src/main.js', data: 'hello AXON' }]);
  const sink = new MemoryTransactionalExtractionSink();
  const result = await new SafeZipExtractor().extract(zip, sink, 'stored-1');
  assert.equal(result.success, true);
  assert.equal(new TextDecoder().decode(sink.committed.get('src/main.js')), 'hello AXON');
  assert.equal(result.evidence, 'ZIP_BYTES_PARSED_AND_CONTENT_VERIFIED');
});

test('ZIP extractor handles raw DEFLATE using host DecompressionStream', async () => {
  const zip = makeZip([{ name: 'data.txt', data: 'deflated-content-'.repeat(200), method: 8 }]);
  const sink = new MemoryTransactionalExtractionSink(64 * 1024);
  const result = await new SafeZipExtractor().extract(zip, sink, 'deflated-1');
  assert.equal(result.filesWritten, 1);
  assert.equal(new TextDecoder().decode(sink.committed.get('data.txt')), 'deflated-content-'.repeat(200));
});

test('ZIP parser rejects path traversal', () => {
  assert.throws(() => parseZipArchive(makeZip([{ name: '../outside.txt', data: 'x' }])), /UNSAFE_ARCHIVE_PATH/);
});

test('ZIP parser rejects duplicate normalized names', () => {
  assert.throws(() => parseZipArchive(makeZip([{ name: 'a.txt', data: '1' }, { name: 'a.txt', data: '2' }])), /DUPLICATE_PATH/);
});

test('ZIP parser rejects case-colliding names', () => {
  assert.throws(() => parseZipArchive(makeZip([{ name: 'A.txt', data: '1' }, { name: 'a.TXT', data: '2' }])), /CASE_COLLISION/);
});

test('ZIP parser rejects encrypted entries', () => {
  assert.throws(() => parseZipArchive(makeZip([{ name: 'secret.txt', data: 'x', flags: 1 }])), /ENCRYPTED_ENTRY_REJECTED/);
});

test('ZIP parser rejects symlink entries', () => {
  assert.throws(() => parseZipArchive(makeZip([{ name: 'link', data: 'target', symlink: true }])), /SYMLINK_REJECTED/);
});

test('ZIP parser rejects unsupported compression methods', () => {
  assert.throws(() => parseZipArchive(makeZip([{ name: 'a.bin', data: 'x', method: 99 }])), /UNSUPPORTED_COMPRESSION_METHOD/);
});

test('ZIP parser rejects oversized expansion ratio based on actual central metadata', () => {
  const content = 'A'.repeat(100_000);
  assert.throws(() => parseZipArchive(makeZip([{ name: 'bomb.txt', data: content, method: 8 }])), /COMPRESSION_RATIO_LIMIT/);
});

test('ZIP extractor rejects content that expands beyond its declared file size and rolls back', async () => {
  const zip = makeZip([{ name: 'lie.txt', data: 'Z'.repeat(10_000), method: 8, declaredUncompressed: 100 }]);
  const sink = new MemoryTransactionalExtractionSink(20_000);
  await assert.rejects(() => new SafeZipExtractor().extract(zip, sink, 'lying-size'), /size limit/);
  assert.equal(sink.committed.size, 0);
});

test('ZIP extractor rejects CRC mismatch and rolls back', async () => {
  const zip = makeZip([{ name: 'bad.txt', data: 'correct bytes', declaredCrc: 123 }]);
  const sink = new MemoryTransactionalExtractionSink();
  await assert.rejects(() => new SafeZipExtractor().extract(zip, sink, 'bad-crc'), /CRC-32/);
  assert.equal(sink.committed.size, 0);
});

test('ZIP extractor respects in-flight cancellation and rolls back', async () => {
  const controller = new AbortController();
  controller.abort();
  const sink = new MemoryTransactionalExtractionSink();
  await assert.rejects(() => new SafeZipExtractor().extract(makeZip([{ name: 'a.txt', data: 'a' }]), sink, 'cancel', controller.signal), /cancelled/);
  assert.equal(sink.committed.size, 0);
});

test('ZIP parser rejects truncated archive bytes', () => {
  const bytes = makeZip([{ name: 'a.txt', data: 'a' }]);
  assert.throws(() => parseZipArchive(bytes.slice(0, bytes.length - 10)), /end-of-central-directory/);
});


test('ZIP extractor validates signed data descriptors', async () => {
  const zip = makeZip([{ name: 'descriptor.txt', data: 'descriptor data', method: 8, dataDescriptor: true }]);
  const sink = new MemoryTransactionalExtractionSink();
  const result = await new SafeZipExtractor().extract(zip, sink, 'descriptor-zip');
  assert.equal(result.filesWritten, 1);
  assert.equal(new TextDecoder().decode(sink.committed.get('descriptor.txt')), 'descriptor data');
});

test('ZIP parser rejects non-canonical dot-segment paths', () => {
  assert.throws(() => parseZipArchive(makeZip([{ name: './src/main.js', data: 'x' }])), /canonical safe project path/);
});

test('ZIP extractor preserves previous committed snapshot when a new extraction fails', async () => {
  const sink = new MemoryTransactionalExtractionSink();
  await new SafeZipExtractor().extract(makeZip([{ name: 'old.txt', data: 'old' }]), sink, 'prior');
  const badZip = makeZip([{ name: 'bad.txt', data: 'bad', declaredCrc: 1 }]);
  await assert.rejects(() => new SafeZipExtractor().extract(badZip, sink, 'replacement'), /CRC-32/);
  assert.deepEqual([...sink.committed.keys()], ['old.txt']);
});


test('IndexedDB project sink commits complete snapshots and reader sees committed files', async () => {
  const store = new MemoryKeyValueStore();
  const sink = new IndexedDbProjectExtractionSink(store, () => 42);
  await new SafeZipExtractor().extract(makeZip([{ name: 'src/app.js', data: 'first' }, { name: 'README.md', data: 'docs' }]), sink, 'project-a');
  const reader = new IndexedDbProjectReader(store);
  assert.deepEqual(await reader.listFiles('project-a'), ['README.md', 'src/app.js']);
  assert.equal(new TextDecoder().decode(await reader.readFile('project-a', 'src/app.js')), 'first');
});

test('IndexedDB project sink rollback preserves previously committed project version', async () => {
  const store = new MemoryKeyValueStore();
  let clock = 10;
  const sink = new IndexedDbProjectExtractionSink(store, () => ++clock);
  const reader = new IndexedDbProjectReader(store);
  await new SafeZipExtractor().extract(makeZip([{ name: 'src/app.js', data: 'known-good' }]), sink, 'project-b');
  const bad = makeZip([{ name: 'src/app.js', data: 'corrupt', declaredCrc: 9 }]);
  await assert.rejects(() => new SafeZipExtractor().extract(bad, sink, 'project-b'), /CRC-32/);
  assert.equal(new TextDecoder().decode(await reader.readFile('project-b', 'src/app.js')), 'known-good');
});

// Persistent recovery

test('startup recovery marks an active job interrupted and validates its checkpoint', async () => {
  const store = new MemoryKeyValueStore();
  const jobs = new PersistentJobManager(store);
  await jobs.create({ id: 'job-1', projectId: 'project-1', projectFingerprint: 'fp-1', runtimeId: 'runtime-1' });
  await jobs.update('job-1', { state: 'ANALYSING' });
  await jobs.update('job-1', { state: 'READY' });
  await jobs.update('job-1', { state: 'RUNNING' });
  const checkpoints = new CheckpointManager(store);
  await checkpoints.save({ id: 'cp-1', jobId: 'job-1', projectId: 'project-1', projectFingerprint: 'fp-1', runtimeId: 'runtime-1',
    stateFormat: 'units-v1', state: new Uint8Array([1, 2, 3]), stateBytes: 3, completedUnits: ['u1'], resumable: true });
  await jobs.update('job-1', { checkpointId: 'cp-1' });
  const recoveredJobs = new PersistentJobManager(store);
  const recovered = new RecoveryCoordinator(recoveredJobs, new CheckpointManager(store));
  const items = await recovered.inspectStartup();
  assert.equal(items[0].job.state, 'INTERRUPTED');
  assert.equal(items[0].assessment.disposition, 'RESUME_FROM_CHECKPOINT');
  const prepared = await recovered.prepareResume('job-1');
  assert.equal(prepared.job.state, 'READY');
});

test('recovery refuses missing checkpoint', async () => {
  const store = new MemoryKeyValueStore();
  const jobs = new PersistentJobManager(store);
  await jobs.create({ id: 'job-2', projectId: 'p2', projectFingerprint: 'fp2', runtimeId: 'r2' });
  await jobs.update('job-2', { state: 'ANALYSING' });
  await jobs.update('job-2', { state: 'READY' });
  await jobs.update('job-2', { state: 'RUNNING' });
  const coordinator = new RecoveryCoordinator(new PersistentJobManager(store), new CheckpointManager(store));
  const results = await coordinator.inspectStartup();
  assert.equal(results[0].assessment.disposition, 'MANUAL_INTERVENTION');
});

test('recovery refuses project/runtime mismatch', async () => {
  const store = new MemoryKeyValueStore();
  const jobs = new PersistentJobManager(store);
  await jobs.create({ id: 'job-3', projectId: 'p3', projectFingerprint: 'fp3', runtimeId: 'r3' });
  await jobs.update('job-3', { state: 'ANALYSING' });
  await jobs.update('job-3', { state: 'READY' });
  await jobs.update('job-3', { state: 'RUNNING' });
  const cps = new CheckpointManager(store);
  await cps.save({ id: 'cp-3', jobId: 'job-3', projectId: 'p3', projectFingerprint: 'different', runtimeId: 'r3', stateFormat: 'x', state: new Uint8Array([1]), stateBytes: 1, completedUnits: [], resumable: true });
  await jobs.update('job-3', { checkpointId: 'cp-3' });
  const results = await new RecoveryCoordinator(new PersistentJobManager(store), cps).inspectStartup();
  assert.equal(results[0].assessment.disposition, 'MANUAL_INTERVENTION');
});

test('checkpoint size and state length are bounded and exact', async () => {
  const store = new MemoryKeyValueStore();
  const cps = new CheckpointManager(store, Date.now, 2);
  const base = { id: 'cp', jobId: 'j', projectId: 'p', projectFingerprint: 'f', runtimeId: 'r', stateFormat: 'v1', completedUnits: [], resumable: true };
  await assert.rejects(() => cps.save({ ...base, state: new Uint8Array([1, 2, 3]), stateBytes: 3 }), /no larger than/);
  await assert.rejects(() => cps.save({ ...base, state: new Uint8Array([1]), stateBytes: 2 }), /match the actual/);
});

// Workspace and undo

test('working copy creates an isolated project snapshot', async () => {
  const files = new MemoryWorkspaceFileStore();
  const manager = new WorkingCopyManager(files);
  await manager.create('w1', { 'src/main.js': 'const a = 1;' });
  assert.deepEqual(await manager.snapshot('w1'), { 'src/main.js': 'const a = 1;' });
});

test('working copy rejects traversal paths', async () => {
  const manager = new WorkingCopyManager(new MemoryWorkspaceFileStore());
  await assert.rejects(() => manager.create('w2', { '../protected.js': 'x' }), /Invalid working-copy file/);
});

test('mechanical patch applies against exact source and supports durable-journal undo', async () => {
  const files = new MemoryWorkspaceFileStore();
  const journalStore = new MemoryKeyValueStore();
  const journal = new KeyValueWorkspaceJournalStore(journalStore);
  const manager = new WorkingCopyManager(files, journal);
  await manager.create('w3', { 'a.js': 'const a = 1;' });
  const patch = { file: 'a.js', startOffset: 10, endOffset: 11, oldText: '1', baseText: 'const a = 1;', newText: '2', reason: 'Mechanical fixture', safety: 'mechanical' };
  const applied = await manager.applyPatch('w3', patch, { approvedByUser: false });
  assert.equal(await files.read('w3', 'a.js'), 'const a = 2;');
  const reloadedManager = new WorkingCopyManager(files, journal);
  const undone = await reloadedManager.undo('w3', applied.id);
  assert.ok(undone.undoneAt);
  assert.equal(await files.read('w3', 'a.js'), 'const a = 1;');
});

test('logic-changing patch requires explicit user approval reference', async () => {
  const files = new MemoryWorkspaceFileStore();
  const manager = new WorkingCopyManager(files);
  await manager.create('w4', { 'a.js': 'let x = 1;' });
  const patch = { file: 'a.js', startOffset: 8, endOffset: 9, oldText: '1', baseText: 'let x = 1;', newText: '9', reason: 'Logic change', safety: 'logic-changing' };
  await assert.rejects(() => manager.applyPatch('w4', patch, { approvedByUser: false }), /require explicit user approval/);
  await manager.applyPatch('w4', patch, { approvedByUser: true, approvalReference: 'owner-approval-1' });
  assert.equal(await files.read('w4', 'a.js'), 'let x = 9;');
});

test('working copy rejects stale source snapshot', async () => {
  const files = new MemoryWorkspaceFileStore();
  const manager = new WorkingCopyManager(files);
  await manager.create('w5', { 'a.js': 'const x = 1;' });
  await files.write('w5', 'a.js', 'const x = 3;');
  const patch = { file: 'a.js', startOffset: 10, endOffset: 11, oldText: '1', baseText: 'const x = 1;', newText: '2', reason: 'stale', safety: 'mechanical' };
  await assert.rejects(() => manager.applyPatch('w5', patch, { approvedByUser: false }), /stale/);
});

test('working copy refuses undo after later manual modification', async () => {
  const files = new MemoryWorkspaceFileStore();
  const manager = new WorkingCopyManager(files);
  await manager.create('w6', { 'a.js': 'const x = 1;' });
  const patch = { file: 'a.js', startOffset: 10, endOffset: 11, oldText: '1', baseText: 'const x = 1;', newText: '2', reason: 'change', safety: 'mechanical' };
  const applied = await manager.applyPatch('w6', patch, { approvedByUser: false });
  await files.write('w6', 'a.js', 'const x = 3;');
  await assert.rejects(() => manager.undo('w6', applied.id), /refusing unsafe undo/);
});

// Platform capability discovery and runtime requirements

test('platform registry distinguishes registered adapters from target platforms', async () => {
  const registry = new PlatformCapabilityRegistry();
  registry.register({ platform: 'browser', async probe() { return { platform: 'browser', architecture: 'wasm32', detectedAt: 1, evidence: 'HOST_PROBE' }; } });
  assert.equal((await registry.probe('browser')).platform, 'browser');
  assert.equal(await registry.probe('android'), null);
});

test('runtime requirement evaluator reports missing host toolchains', () => {
  const report = evaluateRuntimeRequirements({ runtimeId: 'android-gradle', host: 'android', requiredComponents: ['gradle', 'sdk'], availableComponents: ['gradle'], isolation: 'process', implementationState: 'BUILT' });
  assert.equal(report.state, 'MISSING_DEPENDENCY');
  assert.deepEqual(report.missingComponents, ['sdk']);
});

test('runtime requirement evaluator does not disguise unimplemented runtimes as available', () => {
  const report = evaluateRuntimeRequirements({ runtimeId: 'python', host: 'browser', requiredComponents: ['python'], availableComponents: ['python'], isolation: 'process', implementationState: 'NOT_IMPLEMENTED' });
  assert.equal(report.state, 'NOT_IMPLEMENTED');
});

// JavaScript worker adapter with a host-provided security attestation

class FakeWorker {
  listeners = { message: [], error: [] };
  terminated = false;
  onPost = null;
  addEventListener(type, listener) { this.listeners[type].push(listener); }
  removeEventListener(type, listener) { this.listeners[type] = this.listeners[type].filter((item) => item !== listener); }
  postMessage(message) { this.onPost?.(message, this); }
  terminate() { this.terminated = true; }
  emit(data) { for (const listener of this.listeners.message) listener({ data }); }
  fail(message) { for (const listener of this.listeners.error) listener({ message }); }
}

const validAttestation = { providerId: 'test-isolated-origin-provider', isolatedOrigin: true, networkBlockedByHostPolicy: true, filesystemBridgeAbsent: true, restrictiveCspConfirmed: true, noPrivilegedHostBridge: true };
function makeWorkerAdapter(worker, attestation = validAttestation) {
  return new JavaScriptWorkerExecutionAdapter(
    { async readSingleEntry() { return { path: 'main.js', source: 'console.log("hello")' }; } },
    { attest() { return attestation; }, createWorker() { return worker; } }
  );
}
const workerRequest = { requestId: 'r1', projectId: 'p', entryFiles: ['main.js'], runtimeId: 'javascript-worker-ac2', mode: 'FULL_LOCAL', timeoutMs: 100, outputLimitBytes: 100, networkAllowed: false, fileAccess: 'none' };

test('JavaScript Worker adapter refuses provider without security attestations', async () => {
  const adapter = makeWorkerAdapter(new FakeWorker(), { providerId: 'bad', isolatedOrigin: true, networkBlockedByHostPolicy: false, filesystemBridgeAbsent: true, restrictiveCspConfirmed: true, noPrivilegedHostBridge: true });
  assert.equal(adapter.canHandle(workerRequest), false);
  assert.equal((await adapter.execute(workerRequest)).status, 'blocked');
});

test('JavaScript Worker adapter executes protocol and bounds messages', async () => {
  const worker = new FakeWorker();
  worker.onPost = (_message, current) => queueMicrotask(() => { current.emit({ type: 'stdout', text: 'ok\n' }); current.emit({ type: 'completed', exitCode: 0 }); });
  const result = await makeWorkerAdapter(worker).execute(workerRequest);
  assert.equal(result.status, 'completed');
  assert.equal(result.stdout, 'ok\n');
  assert.equal(worker.terminated, true);
});

test('JavaScript Worker adapter times out and terminates unresponsive worker', async () => {
  const worker = new FakeWorker();
  const result = await makeWorkerAdapter(worker).execute({ ...workerRequest, timeoutMs: 5 });
  assert.equal(result.status, 'timed-out');
  assert.equal(worker.terminated, true);
});

test('JavaScript Worker adapter cancels on AbortSignal', async () => {
  const worker = new FakeWorker();
  const controller = new AbortController();
  const promise = makeWorkerAdapter(worker).execute(workerRequest, controller.signal);
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();
  const result = await promise;
  assert.equal(result.status, 'cancelled');
  assert.equal(worker.terminated, true);
});

test('JavaScript Worker adapter rejects output above request limit', async () => {
  const worker = new FakeWorker();
  worker.onPost = (_message, current) => queueMicrotask(() => current.emit({ type: 'stdout', text: 'x'.repeat(101) }));
  const result = await makeWorkerAdapter(worker).execute(workerRequest);
  assert.equal(result.status, 'blocked');
  assert.match(result.notes[0], /output limit/);
});

test('JavaScript Worker adapter rejects requested network or file access', () => {
  const adapter = makeWorkerAdapter(new FakeWorker());
  assert.equal(adapter.canHandle({ ...workerRequest, networkAllowed: true }), false);
  assert.equal(adapter.canHandle({ ...workerRequest, fileAccess: 'project-read-only' }), false);
});

test('JavaScript Worker adapter rejects source exceeding its source-size cap', async () => {
  const worker = new FakeWorker();
  const adapter = new JavaScriptWorkerExecutionAdapter(
    { async readSingleEntry() { return { path: 'main.js', source: 'x'.repeat(1025) }; } },
    { attest() { return validAttestation; }, createWorker() { return worker; } },
    { maxSourceBytes: 1024 }
  );
  const result = await adapter.execute(workerRequest);
  assert.equal(result.status, 'blocked');
  assert.equal(worker.terminated, false);
});

// Host build bridge verifies APK instead of trusting build success

test('Android APK service blocks without SDK and Gradle toolchain', async () => {
  const service = new AndroidApkBuildService({
    async probeAndroidBuildTools() { return { available: false, isolated: false, networkBlocked: false, filesystemIsolated: false, timeLimitEnforced: false, outputLimitEnforced: false, unprivilegedIdentity: false, notes: ['No SDK found'] }; },
    async buildApk() { throw new Error('must not run'); },
    async verifyApk() { throw new Error('must not run'); }
  });
  const result = await service.build({ projectId: 'p', workingDirectoryToken: 'w', timeoutMs: 1000, outputLimitBytes: 1000, userApproved: true });
  assert.equal(result.status, 'BLOCKED');
});

test('Android APK service requires post-build package identity and hash verification', async () => {
  const service = new AndroidApkBuildService({
    async probeAndroidBuildTools() { return { available: true, isolated: true, networkBlocked: true, filesystemIsolated: true, timeLimitEnforced: true, outputLimitEnforced: true, unprivilegedIdentity: true, notes: [] }; },
    async buildApk() { return { success: true, artifactToken: 'apk-1', diagnostics: [] }; },
    async verifyApk() { return { valid: false, notes: ['manifest mismatch'] }; }
  });
  const result = await service.build({ projectId: 'p', workingDirectoryToken: 'w', timeoutMs: 1000, outputLimitBytes: 1000, userApproved: true });
  assert.equal(result.status, 'VERIFICATION_FAILED');
});


test('host process runtime is unavailable until host probe confirms OS-level isolation', async () => {
  const adapter = new HostProcessRuntimeAdapter('python-host', {
    async probe() { return { available: true, platform: 'linux', executable: 'python3', isolationConfirmed: false, networkBlocked: true, filesystemIsolated: true, memoryLimitEnforced: true, timeLimitEnforced: true, unprivilegedIdentity: true, notes: [] }; },
    async run() { throw new Error('must not execute without isolation'); }
  }, 'python3', ['unknown'], ['linux'], 'process');
  const report = await adapter.initialize();
  assert.equal(report.state, 'BLOCKED');
  assert.equal(adapter.descriptor.available, false);
});

test('host process runtime validates paths and network policy before dispatch', async () => {
  let called = false;
  const adapter = new HostProcessRuntimeAdapter('tool-host', {
    async probe() { return { available: true, platform: 'linux', executable: 'tool', isolationConfirmed: true, networkBlocked: true, filesystemIsolated: true, memoryLimitEnforced: true, timeLimitEnforced: true, unprivilegedIdentity: true, notes: [] }; },
    async run() { called = true; return { exitCode: 0, stdout: '', stderr: '', elapsedMs: 2, timedOut: false, cancelled: false, outputTruncated: false }; }
  }, 'tool', ['unknown'], ['linux'], 'process');
  await adapter.initialize();
  assert.equal(adapter.canHandle({ ...workerRequest, runtimeId: 'tool-host', entryFiles: ['../escape.js'], fileAccess: 'project-read-only' }), false);
  assert.equal(adapter.canHandle({ ...workerRequest, runtimeId: 'tool-host', networkAllowed: true, fileAccess: 'project-read-only' }), false);
  assert.equal(called, false);
});

test('host process runtime dispatches only with a confirmed sandbox and bounded output', async () => {
  const adapter = new HostProcessRuntimeAdapter('tool-host-2', {
    async probe() { return { available: true, platform: 'linux', executable: 'tool', isolationConfirmed: true, networkBlocked: true, filesystemIsolated: true, memoryLimitEnforced: true, timeLimitEnforced: true, unprivilegedIdentity: true, notes: [] }; },
    async run(request) { return { exitCode: 0, stdout: 'abcdefghij', stderr: '', elapsedMs: 3, timedOut: false, cancelled: false, outputTruncated: false }; }
  }, 'tool', ['unknown'], ['linux'], 'process');
  await adapter.initialize();
  const result = await adapter.execute({ ...workerRequest, runtimeId: 'tool-host-2', fileAccess: 'project-read-only', outputLimitBytes: 4 });
  assert.equal(result.status, 'failed');
  assert.equal(new TextEncoder().encode(result.stdout).byteLength, 4);
  assert.match(result.notes[0], /truncated/);
});

test('host process runtime rejects no-isolation adapters even when host says available', async () => {
  const adapter = new HostProcessRuntimeAdapter('unsafe-host', {
    async probe() { return { available: true, platform: 'windows', executable: 'x', isolationConfirmed: true, networkBlocked: true, filesystemIsolated: true, memoryLimitEnforced: true, timeLimitEnforced: true, unprivilegedIdentity: true, notes: [] }; },
    async run() { throw new Error('must not run'); }
  }, 'x', ['unknown'], ['windows'], 'none');
  const report = await adapter.initialize();
  assert.equal(report.state, 'BLOCKED');
});

// Diagnostic adapter and AC1M measurement

test('diagnostic registry rejects adapter locations that name another file', async () => {
  const registry = new DiagnosticAdapterRegistry();
  registry.register({ id: 'bad-locator', supports: (lang) => lang === 'javascript', analyze: () => [{ id: '1', code: 'E1', severity: 'error', stage: 'syntax', message: 'bad', location: { file: 'wrong.js', line: 1, column: 1 }, evidence: 'CHECKED', confidence: 'high' }] });
  await assert.rejects(() => registry.analyze('javascript', 'main.js', 'x'), /different file/);
});

test('diagnostic registry deduplicates identical findings from adapters', async () => {
  const registry = new DiagnosticAdapterRegistry();
  const diagnostic = { id: '1', code: 'E1', severity: 'error', stage: 'syntax', message: 'bad', location: { file: 'a.js', line: 1, column: 1 }, evidence: 'CHECKED', confidence: 'high' };
  registry.register({ id: 'a', supports: () => true, analyze: () => [diagnostic] });
  registry.register({ id: 'b', supports: () => true, analyze: () => [diagnostic] });
  assert.equal((await registry.analyze('javascript', 'a.js', 'x')).length, 1);
});

test('parser measurement reports precision, recall, duration and declared package size', async () => {
  const candidate = { id: 'fixture-parser', packageSizeBytes: 1234, adapter: { supports: (lang) => lang === 'javascript', analyze: () => [{ id: '1', code: 'E1', severity: 'error', stage: 'syntax', message: 'bad', location: { file: 'a.js', line: 2, column: 1 }, evidence: 'CHECKED', confidence: 'high' }] } };
  let clock = 0;
  const result = await benchmarkParserCandidates([candidate], [{ file: 'a.js', language: 'javascript', source: 'a\nb', expected: [{ code: 'E1', line: 2 }, { code: 'E2', line: 3 }] }], () => ++clock);
  assert.equal(result[0].truePositive, 1);
  assert.equal(result[0].falseNegative, 1);
  assert.equal(result[0].packageSizeBytes, 1234);
});
