import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { FileKvStore } from './helpers/fileKvStore.mjs';
import {
  AdaptiveResourceGovernor,
  planAdaptiveExecution,
  MemoryKeyValueStore,
  PersistentJobManager,
  CheckpointManager,
  RecoveryCoordinator,
  AxonLagControlManager,
  KeyValueLagControlStateStore,
} from '../dist/index.js';

const MB = 1024 * 1024;
const GB = 1024 * MB;
function device(patch = {}) {
  return {
    sampledAt: 1000, totalRamBytes: 8 * GB, availableRamBytes: 6 * GB,
    availableStorageBytes: 20 * GB, logicalCpuCores: 32, cpuLoadPercent: 5,
    gpuAvailable: true, thermalState: 'normal', batteryPercent: 90,
    charging: true, powerSaver: false, networkAvailable: true, ...patch
  };
}
function workload(patch = {}) {
  return {
    id: 'large-parallel-analysis', kind: 'analysis', priority: 'background',
    estimatedWorkingSetBytes: 512 * MB, perWorkerRamBytes: 256 * MB,
    supportsParallelism: true, supportsCooperativeYield: true, maxParallelism: 32,
    minStorageBytes: 10 * MB, ...patch
  };
}
const normal = 'NORMAL';

test('R5-RES-001 available RAM increase expands safe worker budget for parallel workload', () => {
  const governor = new AdaptiveResourceGovernor({ maximumWorkers: 32 });
  const samples = [1, 2, 3, 4, 8, 16].map((gb) => governor.plan(device({ totalRamBytes: gb * GB, availableRamBytes: gb * 0.75 * GB }), workload(), normal).maxWorkers);
  for (let i = 1; i < samples.length; i += 1) assert.ok(samples[i] >= samples[i - 1], `${samples[i]} >= ${samples[i - 1]}`);
  assert.ok(samples.at(-1) > samples[0], `expected high-RAM concurrency to exceed low-RAM concurrency: ${samples}`);
});

test('R5-RES-002 more RAM grows eligible cache and batch budgets', () => {
  const governor = new AdaptiveResourceGovernor({ maximumWorkers: 24 });
  const low = governor.plan(device({ totalRamBytes: GB, availableRamBytes: 700 * MB }), workload(), normal);
  const high = governor.plan(device({ totalRamBytes: 16 * GB, availableRamBytes: 12 * GB }), workload(), normal);
  assert.ok(high.memoryBudgetBytes > low.memoryBudgetBytes);
  assert.ok(high.cacheBudgetBytes >= low.cacheBudgetBytes);
  assert.ok(high.batchSize >= low.batchSize);
});

test('R5-RES-003 serial workloads do not acquire extra workers with more RAM', () => {
  const governor = new AdaptiveResourceGovernor({ maximumWorkers: 32 });
  for (const gb of [1, 3, 8, 16, 32]) {
    const plan = governor.plan(device({ totalRamBytes: gb * GB, availableRamBytes: gb * 0.75 * GB }), workload({ supportsParallelism: false }), normal);
    assert.equal(plan.maxWorkers, 1);
  }
});

test('R5-RES-004 task maxParallelism remains a hard cap on high-RAM hosts', () => {
  const plan = new AdaptiveResourceGovernor({ maximumWorkers: 64 }).plan(device({ totalRamBytes: 64 * GB, availableRamBytes: 48 * GB }), workload({ maxParallelism: 3 }), normal);
  assert.ok(plan.maxWorkers <= 3);
});

test('R5-RES-005 governor preserves declared system headroom on high-RAM hosts', () => {
  const plan = new AdaptiveResourceGovernor().plan(device({ totalRamBytes: 32 * GB, availableRamBytes: 28 * GB }), workload(), normal);
  assert.ok(plan.memoryBudgetBytes < 28 * GB);
  assert.ok(plan.memoryBudgetBytes <= Math.floor(28 * GB * 0.68));
});

test('R5-RES-006 high RAM does not override critical thermal state', () => {
  const plan = new AdaptiveResourceGovernor().plan(device({ totalRamBytes: 32 * GB, availableRamBytes: 28 * GB, thermalState: 'critical' }), workload(), normal);
  assert.equal(plan.canStart, false);
});

test('R5-RES-007 high RAM does not override critical CPU saturation', () => {
  const plan = new AdaptiveResourceGovernor().plan(device({ totalRamBytes: 32 * GB, availableRamBytes: 28 * GB, cpuLoadPercent: 99 }), workload(), normal);
  assert.ok(plan.maxWorkers <= 1);
});

test('R5-RES-008 high RAM does not override storage shortage', () => {
  const plan = new AdaptiveResourceGovernor().plan(device({ totalRamBytes: 32 * GB, availableRamBytes: 28 * GB, availableStorageBytes: 0 }), workload({ minStorageBytes: 1 }), normal);
  assert.equal(plan.canStart, false);
});

test('R5-RES-009 high RAM does not override missing GPU for GPU-required work', () => {
  const plan = new AdaptiveResourceGovernor().plan(device({ totalRamBytes: 32 * GB, availableRamBytes: 28 * GB, gpuAvailable: false }), workload({ gpuRequired: true }), normal);
  assert.equal(plan.canStart, false);
});

test('R5-RES-010 low battery and power saver keep resource policy conservative', () => {
  const governor = new AdaptiveResourceGovernor({ maximumWorkers: 32 });
  const plan = governor.plan(device({ totalRamBytes: 16 * GB, availableRamBytes: 12 * GB, batteryPercent: 7, charging: false, powerSaver: true }), workload(), normal);
  assert.ok(plan.mode === 'CONSERVE' || plan.mode === 'THROTTLE');
  assert.equal(plan.preserveForeground, true);
});

test('R5-RES-011 unknown responsiveness does not admit background work', () => {
  const plan = new AdaptiveResourceGovernor().plan(device(), workload(), 'UNKNOWN');
  assert.equal(plan.canStart, false);
});

test('R5-RES-012 pause-background allows only a foreground task to be considered', () => {
  const governor = new AdaptiveResourceGovernor();
  const background = governor.plan(device(), workload(), 'PAUSE_BACKGROUND');
  const foreground = governor.plan(device(), workload({ priority: 'foreground' }), 'PAUSE_BACKGROUND');
  assert.equal(background.canStart, false);
  assert.equal(foreground.canStart, true);
});

test('R5-RES-013 adaptive plan combines runtime feasibility and device budget', () => {
  const runtimes = [{ id: 'js', label: 'JavaScript worker', languages: ['javascript'], platforms: ['linux'], isolation: 'worker', available: true, supportsStreaming: true, supportsCheckpoint: false }];
  const req = { runtimeId: 'js', estimatedPeakRamBytes: 64 * MB, requiredStorageBytes: 10 * MB, canStreamAssets: true, streamingWorkingSetBytes: 16 * MB, canChunkIndependentWork: true, chunkWorkingSetBytes: 16 * MB };
  const plan = planAdaptiveExecution(req, device(), runtimes, workload({ perWorkerRamBytes: 16 * MB, estimatedWorkingSetBytes: 64 * MB }), 'NORMAL');
  assert.equal(plan.canStart, true);
  assert.ok(plan.resources.memoryBudgetBytes > 0);
});

test('R5-RES-014 invalid live measurements fail closed at high total RAM', () => {
  const plan = new AdaptiveResourceGovernor().plan(device({ totalRamBytes: 64 * GB, availableRamBytes: Number.POSITIVE_INFINITY }), workload(), normal);
  assert.equal(plan.canStart, false);
  assert.equal(plan.mode, 'UNKNOWN');
});

test('R5-RES-015 impossible free RAM greater than total RAM is rejected', () => {
  const plan = new AdaptiveResourceGovernor().plan(device({ totalRamBytes: 2 * GB, availableRamBytes: 3 * GB }), workload(), normal);
  assert.equal(plan.canStart, false);
});

// Persistent store round-trip: new managers share the same durable-store abstraction.
test('R5-REC-001 new job manager instance sees persisted completed units after restart simulation', async () => {
  const store = new MemoryKeyValueStore();
  const first = new PersistentJobManager(store, () => 100);
  await first.create({ id: 'restart-1', projectId: 'p', projectFingerprint: 'fp', runtimeId: 'js' });
  await first.update('restart-1', { state: 'ANALYSING', progress: 0.1, completedUnit: 'scan-1' });
  await first.update('restart-1', { state: 'READY', progress: 0.4, completedUnit: 'scan-2' });
  const restarted = new PersistentJobManager(store, () => 200);
  const restored = await restarted.get('restart-1');
  assert.deepEqual(restored.completedUnits, ['scan-1', 'scan-2']);
  assert.equal(restored.progress, 0.4);
});

test('R5-REC-002 recovery coordinator resumes a valid checkpoint through a new manager instance', async () => {
  const store = new MemoryKeyValueStore();
  const first = new PersistentJobManager(store);
  await first.create({ id: 'restart-2', projectId: 'p2', projectFingerprint: 'fp2', runtimeId: 'runtime-js' });
  await first.update('restart-2', { state: 'ANALYSING' });
  await first.update('restart-2', { state: 'READY' });
  await first.update('restart-2', { state: 'RUNNING', progress: 0.5, completedUnit: 'chunk-1' });
  const checkpoints = new CheckpointManager(store);
  await checkpoints.save({ id: 'cp2', jobId: 'restart-2', projectId: 'p2', projectFingerprint: 'fp2', runtimeId: 'runtime-js', stateFormat: 'counter-v1', state: new Uint8Array([0, 0, 0, 2]), completedUnits: ['chunk-1'], resumable: true });
  await first.update('restart-2', { checkpointId: 'cp2' });
  const restarted = new PersistentJobManager(store);
  const recovered = new RecoveryCoordinator(restarted, new CheckpointManager(store));
  const report = await recovered.inspectStartup();
  assert.equal(report[0].job.state, 'INTERRUPTED');
  assert.equal(report[0].assessment.disposition, 'RESUME_FROM_CHECKPOINT');
  const resume = await recovered.prepareResume('restart-2');
  assert.equal(resume.job.state, 'READY');
});

test('R5-REC-002B durable checkpoint survives a separate Node process restart', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'axon-r5-durable-recovery-'));
  try {
    const store = new FileKvStore(root);
    const jobs = new PersistentJobManager(store);
    await jobs.create({ id: 'process-restart', projectId: 'project', projectFingerprint: 'fingerprint-v1', runtimeId: 'js-worker-v1' });
    await jobs.update('process-restart', { state: 'ANALYSING', progress: 0.2, completedUnit: 'parse-1' });
    await jobs.update('process-restart', { state: 'READY', progress: 0.4 });
    await jobs.update('process-restart', { state: 'RUNNING', progress: 0.6, completedUnit: 'run-1' });
    const checkpoints = new CheckpointManager(store);
    await checkpoints.save({ id: 'process-checkpoint', jobId: 'process-restart', projectId: 'project', projectFingerprint: 'fingerprint-v1', runtimeId: 'js-worker-v1', stateFormat: 'progress-v1', state: new Uint8Array([4, 2]), completedUnits: ['parse-1', 'run-1'], resumable: true });
    await jobs.update('process-restart', { checkpointId: 'process-checkpoint' });

    const worker = path.join(path.dirname(fileURLToPath(import.meta.url)), 'helpers', 'round5-recovery-restart-worker.mjs');
    const child = spawnSync(process.execPath, [worker, root], { encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024 });
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout);
    assert.equal(result.jobs, 1);
    assert.equal(result.state, 'INTERRUPTED');
    assert.equal(result.disposition, 'RESUME_FROM_CHECKPOINT');
    assert.equal(result.recoveredState, 'READY');
    assert.deepEqual(result.completedUnits, ['parse-1', 'run-1']);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('R5-REC-003 recovery rejects a project changed since checkpoint', async () => {
  const store = new MemoryKeyValueStore();
  const jobs = new PersistentJobManager(store);
  await jobs.create({ id: 'restart-3', projectId: 'p3', projectFingerprint: 'new-fingerprint', runtimeId: 'js' });
  await jobs.update('restart-3', { state: 'ANALYSING' });
  await jobs.update('restart-3', { state: 'READY' });
  await jobs.update('restart-3', { state: 'RUNNING' });
  const cps = new CheckpointManager(store);
  await cps.save({ id: 'cp3', jobId: 'restart-3', projectId: 'p3', projectFingerprint: 'old-fingerprint', runtimeId: 'js', stateFormat: 'v1', state: new Uint8Array([1]), completedUnits: [], resumable: true });
  await jobs.update('restart-3', { checkpointId: 'cp3' });
  const result = await new RecoveryCoordinator(new PersistentJobManager(store), cps).inspectStartup();
  assert.equal(result[0].assessment.disposition, 'MANUAL_INTERVENTION');
});

test('R5-REC-004 recovery rejects a checkpoint created by a different runtime', async () => {
  const store = new MemoryKeyValueStore();
  const jobs = new PersistentJobManager(store);
  await jobs.create({ id: 'restart-4', projectId: 'p4', projectFingerprint: 'fp4', runtimeId: 'runtime-new' });
  await jobs.update('restart-4', { state: 'ANALYSING' });
  await jobs.update('restart-4', { state: 'READY' });
  await jobs.update('restart-4', { state: 'RUNNING' });
  const cps = new CheckpointManager(store);
  await cps.save({ id: 'cp4', jobId: 'restart-4', projectId: 'p4', projectFingerprint: 'fp4', runtimeId: 'runtime-old', stateFormat: 'v1', state: new Uint8Array([1]), completedUnits: [], resumable: true });
  await jobs.update('restart-4', { checkpointId: 'cp4' });
  const result = await new RecoveryCoordinator(new PersistentJobManager(store), cps).inspectStartup();
  assert.equal(result[0].assessment.disposition, 'MANUAL_INTERVENTION');
});

test('R5-REC-005 corrupt checkpoint is never automatically resumed', async () => {
  const store = new MemoryKeyValueStore();
  const jobs = new PersistentJobManager(store);
  await jobs.create({ id: 'restart-5', projectId: 'p5', projectFingerprint: 'fp5', runtimeId: 'js' });
  await jobs.update('restart-5', { state: 'ANALYSING' });
  await jobs.update('restart-5', { state: 'READY' });
  await jobs.update('restart-5', { state: 'RUNNING' });
  const cps = new CheckpointManager(store);
  await cps.save({ id: 'cp5', jobId: 'restart-5', projectId: 'p5', projectFingerprint: 'fp5', runtimeId: 'js', stateFormat: 'v1', state: new Uint8Array([1, 2]), completedUnits: [], resumable: true });
  const raw = await store.get('checkpoint/cp5');
  raw.state[0] = 99;
  await store.put('checkpoint/cp5', raw);
  await jobs.update('restart-5', { checkpointId: 'cp5' });
  const result = await new RecoveryCoordinator(new PersistentJobManager(store), cps).inspectStartup();
  assert.equal(result[0].assessment.disposition, 'CHECKPOINT_CORRUPT');
});

test('R5-REC-006 a non-resumable runtime state cannot be recorded as a checkpoint', async () => {
  const cps = new CheckpointManager(new MemoryKeyValueStore());
  await assert.rejects(() => cps.save({ id: 'cp6', jobId: 'j6', projectId: 'p6', projectFingerprint: 'fp6', runtimeId: 'js', stateFormat: 'v1', state: new Uint8Array([1]), completedUnits: [], resumable: false }), /did not declare this checkpoint resumable/);
});

test('R5-REC-007 duplicate job identity is rejected after restart-visible record exists', async () => {
  const store = new MemoryKeyValueStore();
  await new PersistentJobManager(store).create({ id: 'duplicate', projectId: 'p', projectFingerprint: 'fp', runtimeId: 'js' });
  await assert.rejects(() => new PersistentJobManager(store).create({ id: 'duplicate', projectId: 'p', projectFingerprint: 'fp', runtimeId: 'js' }), /already exists/);
});

test('R5-REC-008 completed units cannot be recorded twice', async () => {
  const store = new MemoryKeyValueStore();
  const jobs = new PersistentJobManager(store);
  await jobs.create({ id: 'units', projectId: 'p', projectFingerprint: 'fp', runtimeId: 'js' });
  await jobs.update('units', { state: 'ANALYSING', completedUnit: 'u1' });
  const next = await jobs.update('units', { completedUnit: 'u1' });
  assert.deepEqual(next.completedUnits, ['u1']);
});

test('R5-REC-009 progress cannot decrease after interruption recovery', async () => {
  const jobs = new PersistentJobManager(new MemoryKeyValueStore());
  await jobs.create({ id: 'monotonic', projectId: 'p', projectFingerprint: 'fp', runtimeId: 'js' });
  await jobs.update('monotonic', { state: 'ANALYSING', progress: 0.6 });
  await assert.rejects(() => jobs.update('monotonic', { progress: 0.5 }), /monotonic/);
});

test('R5-REC-010 illegal state transition is rejected', async () => {
  const jobs = new PersistentJobManager(new MemoryKeyValueStore());
  await jobs.create({ id: 'transition', projectId: 'p', projectFingerprint: 'fp', runtimeId: 'js' });
  await assert.rejects(() => jobs.update('transition', { state: 'COMPLETED' }), /Illegal job transition/);
});

function lagAdapters() {
  const calls = [];
  return {
    calls,
    background: {
      async suspendAllManagedWork(owner, reason) { calls.push(['suspend', owner]); return { allManagedWorkSuspended: true, suspendedTaskIds: ['job'], unpausableTaskIds: [], notes: [] }; },
      async releaseManagedWorkSuspension(owner) { calls.push(['release', owner]); },
      async setWorkerCap(owner, count) { calls.push(['cap', owner, count]); },
      async clearWorkerCap(owner) { calls.push(['clear', owner]); }
    },
    telemetry: {
      async setSamplingEnabled(owner, enabled) { calls.push(['sampling', owner, enabled]); },
      async setSamplingIntervalMultiplier(owner, n) { calls.push(['interval', owner, n]); }
    }
  };
}

test('R5-LAG-001 SUSPENDED mode requests zero workers and disables optional sampling', async () => {
  const adapters = lagAdapters();
  const manager = new AxonLagControlManager(adapters);
  await manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'SUSPENDED', reason: 'Foreground task', durationMs: 5000 });
  const decision = manager.observe({ sampledAt: 1, inputToPaintP95Ms: 10, eventLoopDelayP95Ms: 2, frameOverrunRatio: 0, longTaskCount: 0 });
  assert.equal(decision.maxBackgroundWorkers, 0);
  assert.equal(decision.pauseBackground, true);
  assert.equal(decision.telemetrySamplingEnabled, false);
  assert.equal(decision.hardSafetyControlsEnabled, true);
  assert.ok(adapters.calls.some((call) => call[0] === 'cap' && call[2] === 0));
});

test('R5-LAG-002 REDUCED mode caps concurrency and slows optional sampling', async () => {
  const adapters = lagAdapters();
  const manager = new AxonLagControlManager(adapters);
  await manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'REDUCED', reason: 'Device under load', durationMs: 5000 });
  const decision = manager.observe({ sampledAt: 1, inputToPaintP95Ms: 10, eventLoopDelayP95Ms: 2, frameOverrunRatio: 0, longTaskCount: 0 });
  assert.equal(decision.maxBackgroundWorkers, 1);
  assert.equal(decision.telemetryIntervalMultiplier, 4);
  assert.equal(decision.hardSafetyControlsEnabled, true);
});

test('R5-LAG-003 only AXON Brain may change the lag-control mode', async () => {
  const manager = new AxonLagControlManager(lagAdapters());
  await assert.rejects(() => manager.applyCommand({ requestedBy: 'USER', mode: 'SUSPENDED', reason: 'Test', durationMs: 1000 }), /Only AXON Brain/);
});

test('R5-LAG-004 partial suspension is rejected rather than falsely reported as complete', async () => {
  const adapters = lagAdapters();
  adapters.background.suspendAllManagedWork = async () => ({ allManagedWorkSuspended: false, suspendedTaskIds: [], unpausableTaskIds: ['native-build'], notes: [] });
  const manager = new AxonLagControlManager(adapters);
  await assert.rejects(() => manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'SUSPENDED', reason: 'Foreground task', durationMs: 5000 }), /could not safely suspend/);
});

test('R5-LAG-005 persisted SUSPENDED intent is restored by a new manager instance', async () => {
  const store = new MemoryKeyValueStore();
  const first = new AxonLagControlManager(lagAdapters(), {}, () => 1000, 60_000, new KeyValueLagControlStateStore(store));
  await first.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'SUSPENDED', reason: 'Device foreground use', durationMs: 30_000 });
  const secondAdapters = lagAdapters();
  const second = new AxonLagControlManager(secondAdapters, {}, () => 2000, 60_000, new KeyValueLagControlStateStore(store));
  const restored = await second.initialize();
  assert.equal(restored.mode, 'SUSPENDED');
  assert.ok(secondAdapters.calls.some((call) => call[0] === 'cap' && call[2] === 0));
});

test('R5-LAG-006 expired persisted override returns to AUTO', async () => {
  const store = new MemoryKeyValueStore();
  const first = new AxonLagControlManager(lagAdapters(), {}, () => 1000, 60_000, new KeyValueLagControlStateStore(store));
  await first.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'REDUCED', reason: 'Temporary load', durationMs: 2000 });
  const second = new AxonLagControlManager(lagAdapters(), {}, () => 5000, 60_000, new KeyValueLagControlStateStore(store));
  assert.equal((await second.initialize()).mode, 'AUTO');
});

test('R5-LAG-007 user/manual pause ownership is not removed by AXON release contract', async () => {
  const owners = new Set(['user-manual']);
  const adapters = lagAdapters();
  adapters.background.releaseManagedWorkSuspension = async (owner) => { owners.delete(owner); };
  const manager = new AxonLagControlManager(adapters);
  await manager.applyCommand({ requestedBy: 'AXON_BRAIN', mode: 'AUTO', reason: 'Return to automatic mode' });
  assert.deepEqual([...owners], ['user-manual']);
});

test('R5-LAG-008 invalid persisted policy prevents managed work from being admitted', async () => {
  const store = new MemoryKeyValueStore();
  await store.put('axon-code/lag-control/override', { mode: 'SUSPENDED', reason: '', changedAt: 0, expiresAt: 10 });
  const manager = new AxonLagControlManager(lagAdapters(), {}, () => 1, 60_000, new KeyValueLagControlStateStore(store));
  await assert.rejects(() => manager.initialize(), /Persisted AXON lag-control state is invalid/);
});
