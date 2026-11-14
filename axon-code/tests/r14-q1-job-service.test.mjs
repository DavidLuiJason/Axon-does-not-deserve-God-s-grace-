import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { BackgroundJobQueue } from '../src/jobs/backgroundJobQueue.mjs';
import { LinuxChildProcessHost } from '../src/jobs/linuxChildProcessHost.mjs';
import { AxonCodeJobGateway, MemoryGatewayStore } from '../src/gateway/jobGateway.mjs';
import { compileRealModuleMutant } from './helpers/r14-mutant.mjs';

const executable = process.execPath;
async function waitFor(predicate, timeoutMs = 3000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await predicate()) return;
    await delay(10);
  }
  throw new Error('WAIT_TIMEOUT');
}
function request(gateway, operation, payload, caller = 'alice', authority = 'USER') {
  return (async () => {
    const base = {
      protocolVersion: '1', requestId: `${operation}-${Math.random()}`, auditId: `audit-${Math.random()}`,
      callerContext: { callerId: caller, sessionId: 'session', authority },
      scope: { projectId: 'project', workspaceId: 'workspace', permissions: [operation] },
      operation, payload,
    };
    const approvalReference = await gateway.approve(base, { projectId: 'project', workspaceId: 'workspace' });
    return gateway.call({ ...base, approvalReference });
  })();
}

test('Q1 user can cancel an AXON-origin job in the same workspace', async () => {
  const store = new MemoryGatewayStore();
  const gateway = new AxonCodeJobGateway({ store, executor: () => new Promise(() => {}) });
  const submitted = await request(gateway, 'job.submit', { task: 'long' }, 'brain', 'AXON_BRAIN');
  const cancelled = await request(gateway, 'job.cancel', { jobId: submitted.result.jobId });
  assert.equal(cancelled.result.state, 'cancelled');
  assert.equal((await store.get(`job/${submitted.result.jobId}`)).origin, 'AXON');
});

test('Q1 AXON cannot cancel a user job without explicit manage permission', async () => {
  const store = new MemoryGatewayStore();
  const gateway = new AxonCodeJobGateway({ store, executor: () => new Promise(() => {}) });
  const submitted = await request(gateway, 'job.submit', { task: 'long' });
  const denied = await request(gateway, 'job.cancel', { jobId: submitted.result.jobId }, 'brain', 'AXON_BRAIN');
  assert.equal(denied.code, 'OWNER_MISMATCH');
  assert.ok(store.audit.some((row) => row.status === 'REFUSED' && row.reason === 'OWNER_MISMATCH'));
});

test('Q1 real Linux child stops consuming CPU while SIGSTOPped and resumes with SIGCONT', async (t) => {
  if (process.platform !== 'linux') return t.skip('Linux signal semantics required.');
  const root = await mkdtemp(path.join(os.tmpdir(), 'axon-q1-process-'));
  const host = new LinuxChildProcessHost({ workspaceRoot: root, allowedExecutables: [executable] });
  const jobId = 'cpu-child';
  const run = host.run({ jobId, file: executable, args: ['-e', 'let n=0; while(true){n++}'], cwd: root, timeLimitMs: 5000 });
  await waitFor(() => host.children.get(jobId)?.child.pid);
  const pid = host.children.get(jobId).child.pid;
  const cpuTicks = async () => {
    const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
    return Number(fields[11]) + Number(fields[12]);
  };
  await delay(120);
  assert.equal(host.pause(jobId), true);
  const before = await cpuTicks();
  await delay(180);
  const after = await cpuTicks();
  assert.equal(after, before, 'paused process CPU ticks must not advance');
  assert.equal(host.resume(jobId), true);
  await delay(100);
  assert.ok((await cpuTicks()) > after);
  host.cancel(jobId);
  const stopped = await run;
  assert.equal(stopped.signal, 'SIGTERM');
  await host.stopAll();
  await rm(root, { recursive: true, force: true });
});

test('Q1 paused child is killed and recorded interrupted after service restart', async (t) => {
  if (process.platform !== 'linux') return t.skip('Linux signal semantics required.');
  const root = await mkdtemp(path.join(os.tmpdir(), 'axon-q1-restart-'));
  const host = new LinuxChildProcessHost({ workspaceRoot: root, allowedExecutables: [executable] });
  const store = new MemoryGatewayStore();
  const gateway = new AxonCodeJobGateway({ store, processHost: host });
  const id = 'restart-child';
  const running = host.run({ jobId: id, file: executable, args: ['-e', 'setInterval(()=>{},1000)'], cwd: root });
  await waitFor(() => host.children.has(id));
  const base = { id, projectId: 'project', workspaceId: 'workspace', owner: 'alice', origin: 'user', state: 'paused', createdAt: 1, updatedAt: 1 };
  await store.put(`job/${id}`, base);
  assert.equal(host.pause(id), true);
  await gateway.recover();
  const recovered = await store.get(`job/${id}`);
  assert.equal(recovered.state, 'interrupted');
  assert.match(recovered.interruptedReason, /cannot be restored/);
  const interrupted = await running;
  assert.equal(interrupted.signal, 'SIGKILL');
  await host.stopAll();
  await rm(root, { recursive: true, force: true });
});

test('Q1 process host refuses unapproved executable, shell injection and workspace escape', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'axon-q1-refuse-'));
  const host = new LinuxChildProcessHost({ workspaceRoot: root, allowedExecutables: [executable] });
  await assert.rejects(host.run({ jobId: 'bad-exe', file: '/bin/sh', args: ['-c', 'touch /tmp/nope'] }), /EXECUTABLE_NOT_ALLOWED/);
  await assert.rejects(host.run({ jobId: 'bad-cwd', file: executable, cwd: '/etc', args: ['-e', ''] }), /PROCESS_CWD_OUTSIDE_WORKSPACE/);
  await assert.rejects(host.run({ jobId: 'bad-args', file: executable, args: [1] }), /INVALID_PROCESS_ARGUMENTS/);
  await rm(root, { recursive: true, force: true });
});

test('Q1 background queue enforces concurrency, per-owner quota and global cap', async () => {
  const queue = new BackgroundJobQueue({ concurrency: 1, perOwnerQuota: 2, maxJobs: 3 });
  let release;
  const hold = new Promise((resolve) => { release = resolve; });
  const first = queue.submit({ owner: 'alice', run: () => hold });
  queue.submit({ owner: 'alice', run: async () => 'second' });
  assert.throws(() => queue.submit({ owner: 'alice', run: async () => 'third' }), /OWNER_QUOTA_REACHED/);
  queue.submit({ owner: 'bob', run: async () => 'fourth' });
  assert.throws(() => queue.submit({ owner: 'carol', run: async () => 'fifth' }), /JOB_CAP_REACHED/);
  release();
  await waitFor(() => queue.status(first).state === 'completed');
  await queue.close();
});

test('Q1 background queue rotates owners fairly and prioritises within an owner', async () => {
  const queue = new BackgroundJobQueue({ concurrency: 1, perOwnerQuota: 10, maxJobs: 20 });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const order = [];
  queue.submit({ owner: 'gate', run: () => gate });
  queue.submit({ owner: 'alice', priority: 1, run: async () => order.push('alice-low') });
  queue.submit({ owner: 'alice', priority: 9, run: async () => order.push('alice-high') });
  queue.submit({ owner: 'bob', run: async () => order.push('bob') });
  release();
  await waitFor(() => order.length === 3);
  assert.equal(order[0], 'alice-high');
  assert.ok(order.indexOf('bob') < order.indexOf('alice-low'));
  await queue.close();
});

test('Q1 queue survives 1,000 start/stop cycles without retaining active jobs', async () => {
  const queue = new BackgroundJobQueue({ concurrency: 8, perOwnerQuota: 2000, maxJobs: 1100 });
  for (let i = 0; i < 1000; i += 1) {
    const id = queue.submit({ owner: `owner-${i % 10}`, run: async () => i });
    if (i % 3 === 0) queue.cancel(id);
  }
  await waitFor(() => [...queue.jobs.values()].every((job) => ['completed', 'failed', 'cancelled'].includes(job.state)), 10000);
  assert.equal(queue.active, 0);
  assert.equal([...queue.jobs.values()].filter((job) => job.state === 'running' || job.state === 'queued').length, 0);
  await queue.close();
});

test('Q1 rejects queue work after shutdown and duplicate process ids', async () => {
  const queue = new BackgroundJobQueue();
  await queue.close();
  assert.throws(() => queue.submit({ owner: 'a', run: async () => 1 }), /QUEUE_CLOSED/);
  const root = await mkdtemp(path.join(os.tmpdir(), 'axon-q1-dup-'));
  const host = new LinuxChildProcessHost({ workspaceRoot: root, allowedExecutables: [executable] });
  const p = host.run({ jobId: 'same', file: executable, args: ['-e', 'setTimeout(()=>{},1000)'], cwd: root });
  await waitFor(() => host.children.has('same'));
  await assert.rejects(host.run({ jobId: 'same', file: executable, args: [], cwd: root }), /DUPLICATE_PROCESS_JOB/);
  host.cancel('same');
  const stopped = await p;
  assert.equal(stopped.signal, 'SIGTERM');
  await rm(root, { recursive: true, force: true });
});

test('Q1 real compiled queue mutant removing per-owner quota is caught', async () => {
  const needle = 'if (ownerJobs.length >= this.perOwnerQuota) throw new Error("OWNER_QUOTA_REACHED");';
  const mutant = await compileRealModuleMutant('src/jobs/backgroundJobQueue.mjs', needle, '');
  try {
    const queue = new mutant.module.BackgroundJobQueue({ concurrency: 1, perOwnerQuota: 1, maxJobs: 4 });
    let release;
    const hold = new Promise((resolve) => { release = resolve; });
    queue.submit({ owner: 'alice', run: () => hold });
    let detected = false;
    try { assert.throws(() => queue.submit({ owner: 'alice', run: async () => 2 }), /OWNER_QUOTA_REACHED/); }
    catch { detected = true; }
    assert.equal(detected, true, 'the normal quota assertion must fail against the mutant');
    release();
    await queue.close();
  } finally {
    await mutant.cleanup();
  }
});

test('Q1 gateway submissions enter the bounded background queue and enforce owner quota', async () => {
  const store = new MemoryGatewayStore();
  const gateway = new AxonCodeJobGateway({
    store,
    queueConcurrency: 1,
    perOwnerQuota: 1,
    maxQueuedJobs: 2,
    executor: ({ signal }) => new Promise((resolve) => signal.addEventListener('abort', () => resolve({ output: 'cancelled' }), { once: true })),
  });
  const first = await request(gateway, 'job.submit', { task: 'first' });
  assert.equal(first.status, 'COMPLETED');
  const second = await request(gateway, 'job.submit', { task: 'second' });
  assert.equal(second.code, 'QUOTA_EXCEEDED');
  const cancelled = await request(gateway, 'job.cancel', { jobId: first.result.jobId });
  assert.equal(cancelled.result.state, 'cancelled');
  await gateway.queue.close();
});

test('Q1 user can pause and resume an AXON-origin child-process job in the same workspace', async () => {
  if (process.platform !== 'linux') throw new Error('This Q1 proof requires the Linux process host.');
  const root = await mkdtemp(path.join(os.tmpdir(), 'axon-q1-user-control-'));
  const processHost = new LinuxChildProcessHost({ workspaceRoot: root, allowedExecutables: [executable] });
  const store = new MemoryGatewayStore();
  const gateway = new AxonCodeJobGateway({ store, processHost });
  try {
    const submitted = await request(gateway, 'job.submit', {
      process: { file: executable, args: ['-e', 'let n=0;while(true){n++}'], cwd: root, timeLimitMs: 15000 },
    }, 'brain', 'AXON_BRAIN');
    await waitFor(() => processHost.children.has(submitted.result.jobId));
    const paused = await request(gateway, 'job.pause', { jobId: submitted.result.jobId });
    assert.equal(paused.result.state, 'paused');
    const resumed = await request(gateway, 'job.resume', { jobId: submitted.result.jobId });
    assert.equal(resumed.result.state, 'running');
    const cancelled = await request(gateway, 'job.cancel', { jobId: submitted.result.jobId });
    assert.equal(cancelled.result.state, 'cancelled');
  } finally {
    await processHost.stopAll();
    await rm(root, { recursive: true, force: true });
  }
});

test('Q1 AXON can manage a user job only with explicit permission and an audit record', async () => {
  if (process.platform !== 'linux') throw new Error('This Q1 proof requires the Linux process host.');
  const root = await mkdtemp(path.join(os.tmpdir(), 'axon-q1-brain-manage-'));
  const processHost = new LinuxChildProcessHost({ workspaceRoot: root, allowedExecutables: [executable] });
  const store = new MemoryGatewayStore();
  const gateway = new AxonCodeJobGateway({ store, processHost });
  try {
    const submitted = await request(gateway, 'job.submit', {
      process: { file: executable, args: ['-e', 'let n=0;while(true){n++}'], cwd: root, timeLimitMs: 15000 },
    });
    await waitFor(() => processHost.children.has(submitted.result.jobId));
    const base = {
      protocolVersion: '1', requestId: 'brain-manage', auditId: 'brain-manage-audit',
      callerContext: { callerId: 'brain', sessionId: 'brain-session', authority: 'AXON_BRAIN' },
      scope: { projectId: 'project', workspaceId: 'workspace', permissions: ['job.cancel', 'job.manage.any'] },
      operation: 'job.cancel', payload: { jobId: submitted.result.jobId },
    };
    const approvalReference = await gateway.approve(base, base.scope);
    const response = await gateway.call({ ...base, approvalReference });
    assert.equal(response.result.state, 'cancelled');
    assert.ok(store.audit.some((row) => row.caller === 'brain' && row.operation === 'job.cancel' && row.status === 'COMPLETED'));
  } finally {
    await processHost.stopAll();
    await rm(root, { recursive: true, force: true });
  }
});

test('Q1 queue prunes terminal history and accepts more than its concurrent job cap over time', async () => {
  const queue = new BackgroundJobQueue({ concurrency: 1, perOwnerQuota: 1, maxJobs: 2 });
  for (let index = 0; index < 12; index += 1) {
    const id = queue.submit({ owner: 'reused-owner', run: async () => index });
    await waitFor(() => queue.status(id)?.state === 'completed');
    assert.ok(queue.jobs.size <= 2);
  }
  assert.equal(queue.active, 0);
  await queue.close();
});

test('Q1 Linux child host completes 1,000 real spawn/cancel cycles without retained children', async (t) => {
  if (process.platform !== 'linux') throw new Error('This Q1 proof requires the Linux process host.');
  const root = await mkdtemp(path.join(os.tmpdir(), 'axon-q1-thousand-processes-'));
  const host = new LinuxChildProcessHost({ workspaceRoot: root, allowedExecutables: [executable], maxTimeMs: 5000 });
  const activeResourceCount = () => process.getActiveResourcesInfo().filter((name) => name === 'Timeout' || name === 'ChildProcess').length;
  const beforeResources = activeResourceCount();
  try {
    for (let index = 0; index < 1000; index += 1) {
      const jobId = `cycle-${index}`;
      const running = host.run({ jobId, file: executable, args: ['-e', 'setInterval(()=>{},1000)'], cwd: root, timeLimitMs: 4000 });
      await waitFor(() => host.children.has(jobId));
      assert.equal(host.cancel(jobId), true);
      const result = await running;
      assert.equal(result.signal, 'SIGTERM');
      assert.equal(host.children.size, 0, `child map leaked after cycle ${index}`);
    }
    await host.stopAll();
    assert.equal(host.children.size, 0);
    assert.ok(activeResourceCount() <= beforeResources + 1, 'no timer or child-process resource leak after 1,000 cycles');
  } finally {
    await host.stopAll();
    await rm(root, { recursive: true, force: true });
  }
});

test('Q1 gateway restart interruption is not overwritten when the killed child exits', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'axon-q1-gateway-restart-'));
  const processHost = new LinuxChildProcessHost({ workspaceRoot: root, allowedExecutables: [executable] });
  const store = new MemoryGatewayStore();
  const gateway = new AxonCodeJobGateway({ store, processHost });
  try {
    const submitted = await request(gateway, 'job.submit', {
      process: { file: executable, args: ['-e', 'let n=0;while(true){n++}'], cwd: root, timeLimitMs: 15000 },
    });
    await waitFor(() => processHost.children.has(submitted.result.jobId));
    await gateway.recover();
    await waitFor(async () => !processHost.children.has(submitted.result.jobId));
    await delay(30);
    const recovered = await store.get(`job/${submitted.result.jobId}`);
    assert.equal(recovered.state, 'interrupted');
    assert.match(recovered.interruptedReason, /cannot be restored/);
  } finally {
    await processHost.stopAll();
    await gateway.queue.close();
    await rm(root, { recursive: true, force: true });
  }
});
