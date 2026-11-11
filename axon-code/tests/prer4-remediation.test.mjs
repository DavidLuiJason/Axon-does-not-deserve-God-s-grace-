import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AdaptiveResourceGovernor, LagProtectionController, runCooperatively,
  PersistentJobManager, CheckpointManager, MemoryKeyValueStore,
  IndexedDbKeyValueStore, inspectArchiveManifest, planAdaptiveExecution, applyPatch, chooseExecutionPlan, analyzeProject
} from '../dist/index.js';

const MB = 1024 * 1024;
const baseDevice = (overrides = {}) => ({
  sampledAt: 1000, totalRamBytes: 8 * 1024 * MB, availableRamBytes: 4 * 1024 * MB,
  availableStorageBytes: 20 * 1024 * MB, logicalCpuCores: 8, cpuLoadPercent: 10,
  gpuAvailable: true, thermalState: 'normal', batteryPercent: 80,
  charging: true, powerSaver: false, networkAvailable: true, ...overrides
});
const baseWorkload = (overrides = {}) => ({
  id: 'analysis-large', kind: 'analysis', priority: 'background',
  estimatedWorkingSetBytes: 900 * MB, perWorkerRamBytes: 350 * MB,
  supportsParallelism: true, supportsCooperativeYield: true,
  maxParallelism: 8, ...overrides
});
const goodSample = (overrides = {}) => ({
  sampledAt: 1000, inputToPaintP95Ms: 30, eventLoopDelayP95Ms: 10,
  frameOverrunRatio: 0.02, longTaskCount: 0, ...overrides
});

// Adaptive Resource Governor
for (const [name, device] of [
  ['1GB device', baseDevice({ totalRamBytes: 1 * 1024 * MB, availableRamBytes: 700 * MB, logicalCpuCores: 2 })],
  ['4GB device', baseDevice({ totalRamBytes: 4 * 1024 * MB, availableRamBytes: 2 * 1024 * MB, logicalCpuCores: 4 })],
  ['8GB device', baseDevice({ totalRamBytes: 8 * 1024 * MB, availableRamBytes: 4 * 1024 * MB, logicalCpuCores: 8 })],
  ['16GB device', baseDevice({ totalRamBytes: 16 * 1024 * MB, availableRamBytes: 10 * 1024 * MB, logicalCpuCores: 12 })],
  ['32GB device', baseDevice({ totalRamBytes: 32 * 1024 * MB, availableRamBytes: 24 * 1024 * MB, logicalCpuCores: 16 })]
]) {
  test(`governor admits a fitting workload on ${name}`, () => {
    const plan = new AdaptiveResourceGovernor().plan(device, baseWorkload(), 'NORMAL');
    assert.equal(plan.canStart, true);
    assert.ok(plan.memoryBudgetBytes < device.availableRamBytes);
    assert.equal(plan.preserveForeground, true);
  });
}

test('higher RAM increases safe memory and cache budget', () => {
  const governor = new AdaptiveResourceGovernor();
  const low = governor.plan(baseDevice({ totalRamBytes: 4 * 1024 * MB, availableRamBytes: 2 * 1024 * MB }), baseWorkload(), 'NORMAL');
  const high = governor.plan(baseDevice({ totalRamBytes: 32 * 1024 * MB, availableRamBytes: 24 * 1024 * MB, logicalCpuCores: 16 }), baseWorkload(), 'NORMAL');
  assert.ok(high.memoryBudgetBytes > low.memoryBudgetBytes);
  assert.ok(high.cacheBudgetBytes > low.cacheBudgetBytes);
  assert.ok(high.maxWorkers >= low.maxWorkers);
});

test('higher RAM alone cannot exceed CPU worker ceiling', () => {
  const governor = new AdaptiveResourceGovernor({ maximumWorkers: 3 });
  const plan = governor.plan(baseDevice({ totalRamBytes: 128 * 1024 * MB, availableRamBytes: 100 * 1024 * MB, logicalCpuCores: 64 }), baseWorkload(), 'NORMAL');
  assert.ok(plan.maxWorkers <= 3);
});

test('governor reserves RAM for the host', () => {
  const device = baseDevice({ totalRamBytes: 4 * 1024 * MB, availableRamBytes: 2 * 1024 * MB });
  const plan = new AdaptiveResourceGovernor().plan(device, baseWorkload(), 'NORMAL');
  assert.ok(plan.memoryBudgetBytes < device.availableRamBytes);
});

test('governor blocks when safe memory cannot fit one worker', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice({ totalRamBytes: 1 * MB, availableRamBytes: 100 * 1024 }), baseWorkload({ perWorkerRamBytes: 2 * MB }), 'NORMAL');
  assert.equal(plan.canStart, false);
  assert.equal(plan.maxWorkers, 0);
});

test('governor blocks work in critical thermal state', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice({ thermalState: 'critical' }), baseWorkload(), 'NORMAL');
  assert.equal(plan.canStart, false);
  assert.equal(plan.mode, 'PAUSE_BACKGROUND');
});

test('hot device throttles to one worker', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice({ thermalState: 'hot' }), baseWorkload(), 'NORMAL');
  assert.equal(plan.maxWorkers, 1);
  assert.equal(plan.mode, 'THROTTLE');
});

test('warm device selects conservative scheduling', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice({ thermalState: 'warm' }), baseWorkload(), 'NORMAL');
  assert.equal(plan.mode, 'CONSERVE');
});

test('low battery selects conservative scheduling when not charging', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice({ batteryPercent: 8, charging: false }), baseWorkload(), 'NORMAL');
  assert.equal(plan.mode, 'CONSERVE');
});

test('charging device at low battery is not battery-throttled solely by percentage', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice({ batteryPercent: 8, charging: true }), baseWorkload(), 'NORMAL');
  assert.equal(plan.mode, 'NORMAL');
});

test('power saver selects conservative scheduling', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice({ powerSaver: true }), baseWorkload(), 'NORMAL');
  assert.equal(plan.mode, 'CONSERVE');
});

test('high CPU load constrains worker count', () => {
  const governor = new AdaptiveResourceGovernor();
  const low = governor.plan(baseDevice({ cpuLoadPercent: 5 }), baseWorkload(), 'NORMAL');
  const high = governor.plan(baseDevice({ cpuLoadPercent: 96 }), baseWorkload(), 'NORMAL');
  assert.ok(high.maxWorkers <= low.maxWorkers);
});

test('foreground responsiveness pause blocks background workload', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice(), baseWorkload(), 'PAUSE_BACKGROUND');
  assert.equal(plan.canStart, false);
});

test('foreground task is not rejected solely because background work is paused', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice(), baseWorkload({ priority: 'foreground' }), 'PAUSE_BACKGROUND');
  assert.equal(plan.canStart, true);
});

test('unknown responsiveness blocks background work', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice(), baseWorkload(), 'UNKNOWN');
  assert.equal(plan.canStart, false);
  assert.equal(plan.backgroundWorkers, 0);
});

test('unknown responsiveness permits only one cooperative foreground worker', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice(), baseWorkload({ priority: 'foreground' }), 'UNKNOWN');
  assert.equal(plan.requireCooperativeYield, true);
  assert.equal(plan.mode, 'CONSERVE');
  assert.equal(plan.maxWorkers, 1);
});

test('governor rejects NaN memory telemetry', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice({ availableRamBytes: Number.NaN }), baseWorkload(), 'NORMAL');
  assert.equal(plan.mode, 'UNKNOWN');
  assert.equal(plan.canStart, false);
});

test('governor rejects available RAM greater than total RAM', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice({ totalRamBytes: 100, availableRamBytes: 101 }), baseWorkload(), 'NORMAL');
  assert.equal(plan.canStart, false);
});

test('governor rejects zero CPU cores', () => {
  assert.equal(new AdaptiveResourceGovernor().plan(baseDevice({ logicalCpuCores: 0 }), baseWorkload()).mode, 'UNKNOWN');
});

test('governor rejects CPU load outside 0..100', () => {
  assert.equal(new AdaptiveResourceGovernor().plan(baseDevice({ cpuLoadPercent: 101 }), baseWorkload()).canStart, false);
});

test('governor respects workload max parallelism', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice(), baseWorkload({ maxParallelism: 1 }), 'NORMAL');
  assert.equal(plan.maxWorkers, 1);
});

test('non-parallel workload is restricted to one worker', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice(), baseWorkload({ supportsParallelism: false }), 'NORMAL');
  assert.equal(plan.maxWorkers, 1);
});

test('insufficient storage blocks workload', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice({ availableStorageBytes: 5 }), baseWorkload({ minStorageBytes: 10 }));
  assert.equal(plan.canStart, false);
});

test('GPU-required workload blocks without GPU', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice({ gpuAvailable: false }), baseWorkload({ gpuRequired: true }));
  assert.equal(plan.canStart, false);
});

test('cache and prefetch grow with useful normal-mode headroom', () => {
  const governor = new AdaptiveResourceGovernor();
  const mid = governor.plan(baseDevice({ totalRamBytes: 4 * 1024 * MB, availableRamBytes: 2 * 1024 * MB }), baseWorkload(), 'NORMAL');
  const high = governor.plan(baseDevice({ totalRamBytes: 32 * 1024 * MB, availableRamBytes: 24 * 1024 * MB, logicalCpuCores: 16 }), baseWorkload(), 'NORMAL');
  assert.ok(high.prefetchDepth >= mid.prefetchDepth);
  assert.ok(high.cacheBudgetBytes >= mid.cacheBudgetBytes);
});

// Responsiveness / lag guard

test('lag controller starts in UNKNOWN and pauses background work on invalid telemetry', () => {
  const guard = new LagProtectionController();
  const d = guard.observe(goodSample({ inputToPaintP95Ms: Number.NaN }));
  assert.equal(d.state, 'UNKNOWN');
  assert.equal(d.pauseBackground, true);
});

test('healthy host telemetry allows normal scheduling', () => {
  const d = new LagProtectionController().observe(goodSample());
  assert.equal(d.state, 'NORMAL');
  assert.ok(d.maxBackgroundWorkers > 0);
});

test('moderate latency enters WATCH state', () => {
  const d = new LagProtectionController().observe(goodSample({ inputToPaintP95Ms: 80 }));
  assert.equal(d.state, 'WATCH');
  assert.ok(d.maxBackgroundWorkers < 4);
});

test('high input latency throttles background work', () => {
  const d = new LagProtectionController().observe(goodSample({ inputToPaintP95Ms: 150 }));
  assert.equal(d.state, 'THROTTLE_BACKGROUND');
  assert.equal(d.maxBackgroundWorkers, 1);
});

test('high event-loop delay throttles background work', () => {
  assert.equal(new LagProtectionController().observe(goodSample({ eventLoopDelayP95Ms: 80 })).state, 'THROTTLE_BACKGROUND');
});

test('high frame overrun ratio throttles background work', () => {
  assert.equal(new LagProtectionController().observe(goodSample({ frameOverrunRatio: 0.3 })).state, 'THROTTLE_BACKGROUND');
});

test('critical input latency pauses background work', () => {
  const d = new LagProtectionController().observe(goodSample({ inputToPaintP95Ms: 300 }));
  assert.equal(d.state, 'PAUSE_BACKGROUND');
  assert.equal(d.maxBackgroundWorkers, 0);
});

test('critical event-loop delay pauses background work', () => {
  assert.equal(new LagProtectionController().observe(goodSample({ eventLoopDelayP95Ms: 200 })).state, 'PAUSE_BACKGROUND');
});

test('critical frame overrun pauses background work', () => {
  assert.equal(new LagProtectionController().observe(goodSample({ frameOverrunRatio: 0.8 })).state, 'PAUSE_BACKGROUND');
});

test('long tasks contribute to throttling', () => {
  assert.equal(new LagProtectionController().observe(goodSample({ longTaskCount: 4 })).state, 'THROTTLE_BACKGROUND');
});

test('lag controller uses hysteresis before recovering from pause', () => {
  const guard = new LagProtectionController();
  guard.observe(goodSample({ inputToPaintP95Ms: 300 }));
  assert.equal(guard.observe(goodSample()).state, 'PAUSE_BACKGROUND');
  assert.equal(guard.observe(goodSample()).state, 'PAUSE_BACKGROUND');
  assert.equal(guard.observe(goodSample()).state, 'NORMAL');
});

test('lag controller recovers from throttle only after healthy streak', () => {
  const guard = new LagProtectionController();
  guard.observe(goodSample({ inputToPaintP95Ms: 140 }));
  guard.observe(goodSample());
  assert.equal(guard.currentState(), 'THROTTLE_BACKGROUND');
  guard.observe(goodSample());
  assert.equal(guard.currentState(), 'THROTTLE_BACKGROUND');
  guard.observe(goodSample());
  assert.equal(guard.currentState(), 'NORMAL');
});

test('invalid frame ratio is rejected', () => {
  assert.equal(new LagProtectionController().observe(goodSample({ frameOverrunRatio: 2 })).evidence, 'INVALID_SAMPLE');
});

test('negative event loop latency is rejected', () => {
  assert.equal(new LagProtectionController().observe(goodSample({ eventLoopDelayP95Ms: -1 })).state, 'UNKNOWN');
});

test('lag policy requires recovery thresholds below throttle thresholds', () => {
  assert.throws(() => new LagProtectionController({ recoverInputP95Ms: 120 }), /Recovery thresholds/);
});

test('pause decision requests a yield before next chunk', () => {
  const d = new LagProtectionController().observe(goodSample({ inputToPaintP95Ms: 300 }));
  assert.equal(d.yieldBeforeNextChunk, true);
});

test('cooperative runner processes every item in original order', async () => {
  const input = Array.from({ length: 80 }, (_, i) => i);
  const output = await runCooperatively(input, (n) => n * 2, { chunkSize: 7, maxSliceMs: 1 });
  assert.deepEqual(output, input.map((n) => n * 2));
});

test('cooperative runner does not skip remainder when a time slice expires', async () => {
  const input = Array.from({ length: 30 }, (_, i) => i);
  const seen = [];
  const output = await runCooperatively(input, (n) => { seen.push(n); const until = Date.now() + 2; while (Date.now() < until) {} return n; }, { chunkSize: 10, maxSliceMs: 1 });
  assert.deepEqual(output, input);
  assert.deepEqual(seen, input);
});

test('cooperative runner reports monotonic progress', async () => {
  const progress = [];
  await runCooperatively([1, 2, 3, 4, 5], (n) => n, { chunkSize: 2, onProgress: (done) => progress.push(done) });
  assert.deepEqual(progress, [2, 4, 5]);
});

test('cooperative runner rejects zero chunk size', async () => {
  await assert.rejects(runCooperatively([1], (n) => n, { chunkSize: 0 }), /chunkSize/);
});

test('cooperative runner observes cancellation', async () => {
  const controller = new AbortController();
  await assert.rejects(runCooperatively([1, 2, 3], (n) => { controller.abort(); return n; }, { chunkSize: 1, signal: controller.signal }), /cancelled/);
});

test('cooperative runner handles empty workloads', async () => {
  assert.deepEqual(await runCooperatively([], (n) => n, { chunkSize: 2 }), []);
});

// Persistent jobs and recovery

test('job creation persists an initial version and event', async () => {
  const manager = new PersistentJobManager(new MemoryKeyValueStore(), () => 10);
  const job = await manager.create({ id: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker' });
  assert.equal(job.state, 'QUEUED');
  assert.equal(job.version, 1);
  assert.equal(job.events.length, 1);
});

test('duplicate job ID is rejected', async () => {
  const manager = new PersistentJobManager(new MemoryKeyValueStore());
  const input = { id: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker' };
  await manager.create(input);
  await assert.rejects(manager.create(input), /already exists/);
});

test('job state transitions follow the state machine', async () => {
  const manager = new PersistentJobManager(new MemoryKeyValueStore());
  await manager.create({ id: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker' });
  const a = await manager.update('j1', { state: 'ANALYSING' });
  const b = await manager.update('j1', { state: 'READY', expectedVersion: a.version });
  const c = await manager.update('j1', { state: 'RUNNING', expectedVersion: b.version });
  const d = await manager.update('j1', { state: 'VERIFYING', expectedVersion: c.version });
  const e = await manager.update('j1', { state: 'COMPLETED', progress: 1, expectedVersion: d.version });
  assert.equal(e.state, 'COMPLETED');
});

test('illegal job transition is rejected', async () => {
  const manager = new PersistentJobManager(new MemoryKeyValueStore());
  await manager.create({ id: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker' });
  await assert.rejects(manager.update('j1', { state: 'COMPLETED' }), /Illegal job transition/);
});

test('job progress cannot move backwards', async () => {
  const manager = new PersistentJobManager(new MemoryKeyValueStore());
  await manager.create({ id: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker' });
  await manager.update('j1', { progress: 0.5 });
  await assert.rejects(manager.update('j1', { progress: 0.4 }), /monotonic/);
});

test('job progress cannot exceed one', async () => {
  const manager = new PersistentJobManager(new MemoryKeyValueStore());
  await manager.create({ id: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker' });
  await assert.rejects(manager.update('j1', { progress: 1.1 }), /monotonic/);
});

test('completed unit is idempotent and recorded once', async () => {
  const manager = new PersistentJobManager(new MemoryKeyValueStore());
  await manager.create({ id: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker' });
  await manager.update('j1', { completedUnit: 'unit-A' });
  const job = await manager.update('j1', { completedUnit: 'unit-A' });
  assert.deepEqual(job.completedUnits, ['unit-A']);
});

test('job event journal appends on every update', async () => {
  const manager = new PersistentJobManager(new MemoryKeyValueStore());
  await manager.create({ id: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker' });
  const job = await manager.update('j1', { stage: 'scan-1' });
  assert.equal(job.events.length, 2);
  assert.equal(job.events[1].sequence, 2);
});

test('stale job version is rejected', async () => {
  const manager = new PersistentJobManager(new MemoryKeyValueStore());
  await manager.create({ id: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker' });
  await manager.update('j1', { stage: 'stage-1' });
  await assert.rejects(manager.update('j1', { stage: 'stage-2', expectedVersion: 1 }), /version conflict/);
});

test('active jobs are marked interrupted after recovery scan', async () => {
  const manager = new PersistentJobManager(new MemoryKeyValueStore());
  await manager.create({ id: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker' });
  await manager.update('j1', { state: 'ANALYSING' });
  const marked = await manager.markInterruptedOnRecovery();
  assert.equal(marked[0].state, 'INTERRUPTED');
});

test('completed jobs are not marked interrupted', async () => {
  const manager = new PersistentJobManager(new MemoryKeyValueStore());
  await manager.create({ id: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker' });
  await manager.update('j1', { state: 'ANALYSING' });
  await manager.update('j1', { state: 'READY' });
  await manager.update('j1', { state: 'RUNNING' });
  await manager.update('j1', { state: 'VERIFYING' });
  await manager.update('j1', { state: 'COMPLETED', progress: 1 });
  assert.deepEqual(await manager.markInterruptedOnRecovery(), []);
});

test('checkpoint saves SHA-256 integrity metadata', async () => {
  const store = new MemoryKeyValueStore();
  const manager = new CheckpointManager(store, () => 123);
  const saved = await manager.save({ id: 'c1', jobId: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker', stateFormat: 'test-v1', state: new Uint8Array([1, 2, 3]), completedUnits: ['u1'], resumable: true });
  assert.match(saved.sha256, /^[a-f0-9]{64}$/);
  assert.equal(saved.createdAt, 123);
});

test('checkpoint resumes only when project and runtime match', async () => {
  const store = new MemoryKeyValueStore();
  const manager = new CheckpointManager(store);
  await manager.save({ id: 'c1', jobId: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker', stateFormat: 'test-v1', state: new Uint8Array([1, 2, 3]), completedUnits: [], resumable: true });
  const result = await manager.assess('c1', { projectFingerprint: 'fp1', runtimeId: 'js-worker' });
  assert.equal(result.disposition, 'RESUME_FROM_CHECKPOINT');
});

test('checkpoint rejects changed project fingerprint', async () => {
  const manager = new CheckpointManager(new MemoryKeyValueStore());
  await manager.save({ id: 'c1', jobId: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker', stateFormat: 'test-v1', state: new Uint8Array([1]), completedUnits: [], resumable: true });
  assert.equal((await manager.assess('c1', { projectFingerprint: 'fp2', runtimeId: 'js-worker' })).disposition, 'MANUAL_INTERVENTION');
});

test('checkpoint rejects changed runtime identity', async () => {
  const manager = new CheckpointManager(new MemoryKeyValueStore());
  await manager.save({ id: 'c1', jobId: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker', stateFormat: 'test-v1', state: new Uint8Array([1]), completedUnits: [], resumable: true });
  assert.equal((await manager.assess('c1', { projectFingerprint: 'fp1', runtimeId: 'python' })).disposition, 'MANUAL_INTERVENTION');
});

test('checkpoint rejects non-resumable runtime state', async () => {
  const manager = new CheckpointManager(new MemoryKeyValueStore());
  await assert.rejects(manager.save({ id: 'c1', jobId: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker', stateFormat: 'test-v1', state: new Uint8Array([1]), completedUnits: [], resumable: false }), /not declare/);
});

test('checkpoint corruption is detected', async () => {
  const store = new MemoryKeyValueStore();
  const manager = new CheckpointManager(store);
  const saved = await manager.save({ id: 'c1', jobId: 'j1', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js-worker', stateFormat: 'test-v1', state: new Uint8Array([1, 2, 3]), completedUnits: [], resumable: true });
  await store.put('checkpoint/c1', { ...saved, state: new Uint8Array([9, 9, 9]) });
  assert.equal((await manager.assess('c1', { projectFingerprint: 'fp1', runtimeId: 'js-worker' })).disposition, 'CHECKPOINT_CORRUPT');
});

test('checkpoint missing is not treated as resumable', async () => {
  const manager = new CheckpointManager(new MemoryKeyValueStore());
  assert.equal((await manager.assess('missing', { projectFingerprint: 'fp1', runtimeId: 'js' })).disposition, 'MANUAL_INTERVENTION');
});

test('IndexedDB adapter reports unavailable host instead of pretending persistence', async () => {
  const store = new IndexedDbKeyValueStore('test-db', 'records', undefined);
  await assert.rejects(store.get('x'), /IndexedDB is unavailable/);
});

// Archive manifest safety (not byte-level ZIP parsing or extraction)

test('archive manifest accepts ordinary safe entries', () => {
  const report = inspectArchiveManifest([{ path: 'src/index.js', compressedBytes: 100, uncompressedBytes: 200 }, { path: 'README.md', compressedBytes: 50, uncompressedBytes: 80 }]);
  assert.equal(report.safeToExtract, true);
  assert.equal(report.evidence, 'METADATA_ONLY');
});

test('archive manifest rejects parent traversal', () => {
  assert.equal(inspectArchiveManifest([{ path: '../outside.txt', compressedBytes: 10, uncompressedBytes: 20 }]).safeToExtract, false);
});

test('archive manifest rejects absolute paths', () => {
  assert.equal(inspectArchiveManifest([{ path: '/root/file', compressedBytes: 10, uncompressedBytes: 20 }]).safeToExtract, false);
});

test('archive manifest rejects Windows absolute paths', () => {
  assert.equal(inspectArchiveManifest([{ path: 'C:/outside/file', compressedBytes: 10, uncompressedBytes: 20 }]).safeToExtract, false);
});

test('archive manifest rejects backslash paths', () => {
  assert.equal(inspectArchiveManifest([{ path: 'folder\\..\\evil', compressedBytes: 10, uncompressedBytes: 20 }]).safeToExtract, false);
});

test('archive manifest detects duplicate normalized entries', () => {
  const report = inspectArchiveManifest([{ path: 'a//b.txt', compressedBytes: 10, uncompressedBytes: 20 }, { path: 'a/b.txt', compressedBytes: 10, uncompressedBytes: 20 }]);
  assert.ok(report.findings.some((f) => f.code === 'DUPLICATE_PATH'));
});

test('archive manifest detects case collisions', () => {
  const report = inspectArchiveManifest([{ path: 'Readme.md', compressedBytes: 10, uncompressedBytes: 20 }, { path: 'README.md', compressedBytes: 10, uncompressedBytes: 20 }]);
  assert.ok(report.findings.some((f) => f.code === 'CASE_COLLISION'));
});

test('archive manifest enforces entry count cap', () => {
  const report = inspectArchiveManifest([{ path: 'a', compressedBytes: 1, uncompressedBytes: 1 }, { path: 'b', compressedBytes: 1, uncompressedBytes: 1 }], { maxEntries: 1 });
  assert.ok(report.findings.some((f) => f.code === 'ENTRY_COUNT_LIMIT'));
});

test('archive manifest enforces per-entry size', () => {
  const report = inspectArchiveManifest([{ path: 'big.bin', compressedBytes: 100, uncompressedBytes: 1000 }], { maxEntryBytes: 500 });
  assert.ok(report.findings.some((f) => f.code === 'ENTRY_SIZE_LIMIT'));
});

test('archive manifest enforces total uncompressed size', () => {
  const report = inspectArchiveManifest([{ path: 'a', compressedBytes: 10, uncompressedBytes: 60 }, { path: 'b', compressedBytes: 10, uncompressedBytes: 60 }], { maxTotalUncompressedBytes: 100 });
  assert.ok(report.findings.some((f) => f.code === 'TOTAL_SIZE_LIMIT'));
});

test('archive manifest detects zip-bomb-like compression ratio', () => {
  const report = inspectArchiveManifest([{ path: 'bomb.bin', compressedBytes: 1, uncompressedBytes: 10000 }], { maxCompressionRatio: 100 });
  assert.ok(report.findings.some((f) => f.code === 'COMPRESSION_RATIO_LIMIT'));
});

test('archive manifest rejects symbolic links by default', () => {
  const report = inspectArchiveManifest([{ path: 'link', compressedBytes: 10, uncompressedBytes: 10, isSymlink: true }]);
  assert.ok(report.findings.some((f) => f.code === 'SYMLINK_REJECTED'));
});

test('archive manifest rejects encrypted entries by default', () => {
  const report = inspectArchiveManifest([{ path: 'secret', compressedBytes: 10, uncompressedBytes: 10, encrypted: true }]);
  assert.ok(report.findings.some((f) => f.code === 'ENCRYPTED_ENTRY_REJECTED'));
});

test('archive manifest rejects NaN size metadata', () => {
  const report = inspectArchiveManifest([{ path: 'bad', compressedBytes: Number.NaN, uncompressedBytes: 1 }]);
  assert.ok(report.findings.some((f) => f.code === 'INVALID_SIZE_METADATA'));
});

test('archive manifest rejects invalid safety policy', () => {
  const report = inspectArchiveManifest([], { maxCompressionRatio: 0 });
  assert.equal(report.safeToExtract, false);
  assert.ok(report.findings.some((f) => f.code === 'INVALID_POLICY'));
});


test('compile workloads are required to use a worker or process adapter', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice(), baseWorkload({ kind: 'compile' }), 'NORMAL');
  assert.equal(plan.executionPlacement, 'WORKER_OR_PROCESS_REQUIRED');
});

test('small analysis tasks can use cooperative bounded scheduling', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice(), baseWorkload({ kind: 'analysis' }), 'NORMAL');
  assert.equal(plan.executionPlacement, 'LIGHT_COOPERATIVE');
});

test('adaptive execution admission applies host reserve after the raw planner', () => {
  const runtimes = [{ id: 'js', label: 'JS', languages: ['javascript'], platforms: ['web'], available: true, supportsStreaming: true, supportsCheckpoint: false, isolation: 'worker' }];
  const decision = planAdaptiveExecution(
    { runtimeId: 'js', estimatedPeakRamBytes: 50 * MB, requiredStorageBytes: 1 },
    baseDevice({ totalRamBytes: 512 * MB, availableRamBytes: 100 * MB, logicalCpuCores: 2 }),
    runtimes,
    baseWorkload({ perWorkerRamBytes: 80 * MB }),
    'NORMAL'
  );
  assert.equal(chooseExecutionPlan({ runtimeId: 'js', estimatedPeakRamBytes: 50 * MB, requiredStorageBytes: 1 }, { availableRamBytes: 100 * MB, availableStorageBytes: 20 * 1024 * MB, networkAllowed: true, gpuAvailable: true }, runtimes).mode, 'FULL_LOCAL');
  assert.equal(decision.canStart, false);
  assert.equal(decision.execution.mode, 'WAIT_FOR_RESOURCES');
});

test('adaptive execution allows a safe plan when both planners admit it', () => {
  const runtimes = [{ id: 'js', label: 'JS', languages: ['javascript'], platforms: ['web'], available: true, supportsStreaming: true, supportsCheckpoint: false, isolation: 'worker' }];
  const decision = planAdaptiveExecution(
    { runtimeId: 'js', estimatedPeakRamBytes: 100 * MB, requiredStorageBytes: 1 },
    baseDevice(), runtimes, baseWorkload({ perWorkerRamBytes: 100 * MB }), 'NORMAL'
  );
  assert.equal(decision.canStart, true);
});

test('adaptive execution respects a foreground pause signal for background requests', () => {
  const runtimes = [{ id: 'js', label: 'JS', languages: ['javascript'], platforms: ['web'], available: true, supportsStreaming: true, supportsCheckpoint: false, isolation: 'worker' }];
  const decision = planAdaptiveExecution(
    { runtimeId: 'js', estimatedPeakRamBytes: 100 * MB, requiredStorageBytes: 1 },
    baseDevice(), runtimes, baseWorkload({ perWorkerRamBytes: 100 * MB }), 'PAUSE_BACKGROUND'
  );
  assert.equal(decision.canStart, false);
});

test('patch application refuses a patch without an exact source snapshot', () => {
  assert.throws(() => applyPatch('abc', { startOffset: 1, endOffset: 1, oldText: '', newText: 'x' }), /exact source snapshot/);
});


test('archive manifest rejects Windows alternate data stream paths', () => {
  const report = inspectArchiveManifest([{ path: 'folder/file.txt:stream', compressedBytes: 10, uncompressedBytes: 20 }]);
  assert.ok(report.findings.some((f) => f.code === 'NONPORTABLE_PATH_SEGMENT'));
});

test('archive manifest rejects Windows reserved device names', () => {
  const report = inspectArchiveManifest([{ path: 'CON.txt', compressedBytes: 10, uncompressedBytes: 20 }]);
  assert.ok(report.findings.some((f) => f.code === 'NONPORTABLE_PATH_SEGMENT'));
});

test('archive manifest rejects trailing dots and spaces in path segments', () => {
  const report = inspectArchiveManifest([{ path: 'folder/name. ', compressedBytes: 10, uncompressedBytes: 20 }]);
  assert.ok(report.findings.some((f) => f.code === 'NONPORTABLE_PATH_SEGMENT'));
});

test('project analyser rejects duplicate normalized paths', async () => {
  const source = {
    async listFiles() { return [
      { path: 'src//index.js', sizeBytes: 10, kind: 'text' },
      { path: 'src/index.js', sizeBytes: 10, kind: 'text' }
    ]; },
    async readTextFile() { return 'export const value = 1;'; }
  };
  const result = await analyzeProject('dupe', source);
  assert.equal(result.files.length, 1);
  assert.ok(result.diagnostics.some((d) => d.code === 'DUPLICATE_NORMALIZED_PATH'));
});

test('project analyser retains only the first normalized duplicate for deterministic graphs', async () => {
  const source = {
    async listFiles() { return [
      { path: 'a/./main.js', sizeBytes: 20, kind: 'text' },
      { path: 'a/main.js', sizeBytes: 20, kind: 'text' },
      { path: 'a/lib.js', sizeBytes: 20, kind: 'text' }
    ]; },
    async readTextFile(path) { return path.endsWith('main.js') ? "import './lib.js';" : 'export const x = 1;'; }
  };
  const result = await analyzeProject('dupe', source);
  assert.deepEqual(result.files.map((f) => f.path), ['a/main.js', 'a/lib.js']);
  assert.equal(result.outline.dependencyGraphComplete, true);
});


test('with equal CPU, additional RAM can admit more workers for a memory-bound workload', () => {
  const governor = new AdaptiveResourceGovernor();
  const low = governor.plan(baseDevice({ totalRamBytes: 4 * 1024 * MB, availableRamBytes: 1024 * MB, logicalCpuCores: 8 }), baseWorkload({ perWorkerRamBytes: 1024 * MB, maxParallelism: 8 }), 'NORMAL');
  const high = governor.plan(baseDevice({ totalRamBytes: 32 * 1024 * MB, availableRamBytes: 16 * 1024 * MB, logicalCpuCores: 8 }), baseWorkload({ perWorkerRamBytes: 1024 * MB, maxParallelism: 8 }), 'NORMAL');
  assert.equal(low.canStart, false);
  assert.equal(high.canStart, true);
  assert.ok(high.maxWorkers > low.maxWorkers);
});

test('pause state limits foreground work to one worker', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice(), baseWorkload({ priority: 'foreground' }), 'PAUSE_BACKGROUND');
  assert.equal(plan.canStart, true);
  assert.equal(plan.maxWorkers, 1);
  assert.equal(plan.backgroundWorkers, 0);
  assert.equal(plan.mode, 'THROTTLE');
});


test('archive manifest rejects parent segments even when they normalize inside the project', () => {
  const report = inspectArchiveManifest([{ path: 'inside/../safe.txt', compressedBytes: 10, uncompressedBytes: 20 }]);
  assert.ok(report.findings.some((f) => f.code === 'UNSAFE_ARCHIVE_PATH'));
});

test('job event history has a bounded rolling window and monotonic sequence', async () => {
  const store = new MemoryKeyValueStore();
  const manager = new PersistentJobManager(store);
  await manager.create({ id: 'bounded', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js' });
  let job;
  for (let i = 0; i < 150; i += 1) job = await manager.update('bounded', { stage: `step-${i}` });
  assert.equal(job.events.length, 128);
  assert.equal(job.eventSequence, 151);
  assert.equal(job.events.at(-1).sequence, 151);
});

test('tracked completed-unit identifiers have a hard storage bound', async () => {
  const manager = new PersistentJobManager(new MemoryKeyValueStore());
  await manager.create({ id: 'unit-cap', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'js' });
  for (let i = 0; i < 4096; i += 1) await manager.update('unit-cap', { completedUnit: `unit-${i}` });
  await assert.rejects(manager.update('unit-cap', { completedUnit: 'unit-overflow' }), /limit reached/);
});
