import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKeyValueStore, PersistentJobManager, CheckpointManager } from '../dist/jobs/persistentJobs.js';
import { RecoveryCoordinator } from '../dist/jobs/recoveryCoordinator.js';
import { AdaptiveResourceGovernor } from '../dist/resources/resourceGovernor.js';

const baseDevice = { sampledAt: 100, totalRamBytes: 4*1024**3, availableRamBytes: 2*1024**3, availableStorageBytes: 10*1024**3,
  logicalCpuCores: 4, cpuLoadPercent: 20, gpuAvailable: false, thermalState: 'normal', batteryPercent: 80, charging: false, powerSaver: false, networkAvailable: true };
const workload = { id: 'index', kind: 'analysis', priority: 'background', estimatedWorkingSetBytes: 64*1024**2, perWorkerRamBytes: 128*1024**2, supportsParallelism: true, supportsCooperativeYield: true };

test('R14 WP12 new jobs start QUEUED with an auditable first event', async () => {
  const jobs = new PersistentJobManager(new MemoryKeyValueStore(), () => 1000);
  const job = await jobs.create({ id: 'j1', projectId: 'p1', projectFingerprint: 'fp', runtimeId: 'js' });
  assert.equal(job.state, 'QUEUED');
  assert.equal(job.events[0].state, 'QUEUED');
});

test('R14 WP12 rejects illegal state transitions', async () => {
  const jobs = new PersistentJobManager(new MemoryKeyValueStore());
  await jobs.create({ id: 'j2', projectId: 'p1', projectFingerprint: 'fp', runtimeId: 'js' });
  await assert.rejects(jobs.update('j2', { state: 'COMPLETED' }), /Illegal job transition/);
});

test('R14 WP12 progress is monotonic and bounded', async () => {
  const jobs = new PersistentJobManager(new MemoryKeyValueStore());
  await jobs.create({ id: 'j3', projectId: 'p1', projectFingerprint: 'fp', runtimeId: 'js' });
  await jobs.update('j3', { state: 'ANALYSING', progress: 0.5 });
  await assert.rejects(jobs.update('j3', { progress: 0.4 }), /monotonic/);
  await assert.rejects(jobs.update('j3', { progress: 1.1 }), /monotonic/);
});

test('R14 WP12 stale concurrent updates fail version checks', async () => {
  const jobs = new PersistentJobManager(new MemoryKeyValueStore());
  const job = await jobs.create({ id: 'j4', projectId: 'p1', projectFingerprint: 'fp', runtimeId: 'js' });
  await jobs.update('j4', { state: 'ANALYSING', expectedVersion: job.version });
  await assert.rejects(jobs.update('j4', { stage: 'stale', expectedVersion: job.version }), /version conflict/);
});

test('R14 WP12 restart marks live work INTERRUPTED but preserves completed jobs', async () => {
  const store = new MemoryKeyValueStore(); const jobs = new PersistentJobManager(store);
  await jobs.create({ id: 'active', projectId: 'p1', projectFingerprint: 'fp', runtimeId: 'js' });
  await jobs.update('active', { state: 'ANALYSING' }); await jobs.update('active', { state: 'READY' }); await jobs.update('active', { state: 'RUNNING' });
  await jobs.create({ id: 'done', projectId: 'p1', projectFingerprint: 'fp', runtimeId: 'js' });
  await jobs.update('done', { state: 'ANALYSING' }); await jobs.update('done', { state: 'READY' }); await jobs.update('done', { state: 'RUNNING' }); await jobs.update('done', { state: 'VERIFYING' }); await jobs.update('done', { state: 'COMPLETED' });
  const recovered = await new PersistentJobManager(store).markInterruptedOnRecovery();
  assert.equal(recovered.length, 1); assert.equal(recovered[0].state, 'INTERRUPTED');
  assert.equal((await jobs.get('done')).state, 'COMPLETED');
});

test('R14 WP12 valid checkpoint can be recovered after manager reconstruction', async () => {
  const store = new MemoryKeyValueStore(); const jobs = new PersistentJobManager(store); const checkpoints = new CheckpointManager(store, () => 2000);
  await jobs.create({ id: 'j6', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'runtime-a' });
  await jobs.update('j6', { state: 'ANALYSING' }); await jobs.update('j6', { state: 'READY' }); await jobs.update('j6', { state: 'RUNNING' });
  const checkpoint = await checkpoints.save({ id: 'cp6', jobId: 'j6', projectId: 'p1', projectFingerprint: 'fp1', runtimeId: 'runtime-a', stateFormat: 'json-v1', state: new TextEncoder().encode('{"offset":4}'), completedUnits: ['a','b'], resumable: true });
  await jobs.update('j6', { checkpointId: checkpoint.id });
  const coordinator = new RecoveryCoordinator(new PersistentJobManager(store), new CheckpointManager(store));
  const items = await coordinator.inspectStartup();
  assert.equal(items[0].assessment.disposition, 'RESUME_FROM_CHECKPOINT');
  const prepared = await coordinator.prepareResume('j6');
  assert.equal(prepared.job.state, 'READY');
});

test('R14 WP12 changed project fingerprints prevent automatic checkpoint resume', async () => {
  const store = new MemoryKeyValueStore(); const jobs = new PersistentJobManager(store); const checkpoints = new CheckpointManager(store);
  await jobs.create({ id: 'j7', projectId: 'p1', projectFingerprint: 'old', runtimeId: 'runtime-a' });
  await jobs.update('j7', { state: 'ANALYSING' }); await jobs.update('j7', { state: 'READY' }); await jobs.update('j7', { state: 'RUNNING' });
  const cp = await checkpoints.save({ id: 'cp7', jobId: 'j7', projectId: 'p1', projectFingerprint: 'old', runtimeId: 'runtime-a', stateFormat: 'bin-v1', state: new Uint8Array([1,2]), completedUnits: [], resumable: true });
  await jobs.update('j7', { checkpointId: cp.id });
  await jobs.update('j7', { state: 'INTERRUPTED' });
  const assessment = await checkpoints.assess('cp7', { projectFingerprint: 'new', runtimeId: 'runtime-a' });
  assert.equal(assessment.disposition, 'MANUAL_INTERVENTION');
});

test('R14 WP12 corrupted checkpoint state is detected by its digest', async () => {
  const store = new MemoryKeyValueStore(); const checkpoints = new CheckpointManager(store);
  const cp = await checkpoints.save({ id: 'cp8', jobId: 'j8', projectId: 'p1', projectFingerprint: 'fp', runtimeId: 'r', stateFormat: 'bytes', state: new Uint8Array([1,2,3]), completedUnits: [], resumable: true });
  await store.put(`checkpoint/${cp.id}`, { ...cp, state: new Uint8Array([9,9,9]) });
  const assessment = await checkpoints.assess(cp.id, { projectFingerprint: 'fp', runtimeId: 'r' });
  assert.equal(assessment.disposition, 'CHECKPOINT_CORRUPT');
});

test('R14 WP12 no-checkpoint interrupted jobs require manual intervention', async () => {
  const store = new MemoryKeyValueStore(); const jobs = new PersistentJobManager(store);
  await jobs.create({ id: 'j9', projectId: 'p1', projectFingerprint: 'fp', runtimeId: 'r' });
  await jobs.update('j9', { state: 'ANALYSING' }); await jobs.update('j9', { state: 'READY' }); await jobs.update('j9', { state: 'RUNNING' });
  const coordinator = new RecoveryCoordinator(jobs, new CheckpointManager(store));
  const result = await coordinator.inspectStartup();
  assert.equal(result[0].assessment.disposition, 'MANUAL_INTERVENTION');
});

test('R14 WP12 governor pauses background work under unknown responsiveness', () => {
  const plan = new AdaptiveResourceGovernor().plan(baseDevice, workload, 'UNKNOWN');
  assert.equal(plan.canStart, false); assert.equal(plan.mode, 'BLOCKED');
});

test('R14 WP12 governor protects foreground work but throttles on thermal pressure', () => {
  const plan = new AdaptiveResourceGovernor().plan({ ...baseDevice, thermalState: 'hot', cpuLoadPercent: 95 }, { ...workload, priority: 'foreground' }, 'NORMAL');
  assert.equal(plan.canStart, true); assert.equal(plan.mode, 'THROTTLE'); assert.equal(plan.maxWorkers, 1);
});

test('R14 WP12 catches a deliberately broken mutant that auto-resumes without a checkpoint', async () => {
  const store = new MemoryKeyValueStore(); const jobs = new PersistentJobManager(store);
  await jobs.create({ id: 'j-mutant', projectId: 'p', projectFingerprint: 'fp', runtimeId: 'r' });
  await jobs.update('j-mutant', { state: 'ANALYSING' }); await jobs.update('j-mutant', { state: 'READY' }); await jobs.update('j-mutant', { state: 'RUNNING' });
  const result = await new RecoveryCoordinator(jobs, new CheckpointManager(store)).inspectStartup();
  const brokenMutant = { disposition: 'RESUME_FROM_CHECKPOINT' };
  assert.equal(result[0].assessment.disposition, 'MANUAL_INTERVENTION');
  assert.throws(() => assert.equal(brokenMutant.disposition, result[0].assessment.disposition), { name: 'AssertionError' });
});
