import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { runWasm } from '../src/providers/wasm/wasmProvider.mjs';
import { BackgroundJobQueue } from '../src/jobs/backgroundJobQueue.mjs';
import { compileRealModuleMutant } from './helpers/r14-mutant.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const emptyWasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
const memoryWasm = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0,
  5, 4, 1, 1, 1, 4,
  7, 10, 1, 6, 109, 101, 109, 111, 114, 121, 2, 0,
]);
const metrics = {};

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForQueue(queue, expected) {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    if ([...queue.jobs.values()].filter((job) => ['completed', 'failed', 'cancelled'].includes(job.state)).length === expected) return;
    await delay(2);
  }
  throw new Error('QUEUE_PERFORMANCE_TIMEOUT');
}

test('Q6 real WASM provider startup stays below the 3-second Node budget', async () => {
  const workspace = root;
  const started = performance.now();
  const result = await runWasm({ bytes: emptyWasm, workspace, timeoutMs: 1500 });
  metrics.providerStartMs = Number((performance.now() - started).toFixed(2));
  assert.equal(result.ok, true);
  assert.ok(metrics.providerStartMs < 3000, `provider start took ${metrics.providerStartMs} ms`);
});

test('Q6 per-job WASM guest memory stays within the 2 MiB budget', async () => {
  const result = await runWasm({ bytes: memoryWasm, workspace: root, memoryBytes: 2 * 1024 * 1024 });
  metrics.guestWasmMemoryBytes = result.memoryBytes;
  assert.equal(result.ok, true);
  assert.ok(result.memoryBytes <= 2 * 1024 * 1024);
});

test('Q6 deterministic UI bundle stays below its 16 MiB packaging budget', async () => {
  const report = JSON.parse(await readFile(path.join(root, 'build/ui/size-report.json'), 'utf8'));
  metrics.uiBundleBytes = report.totalBytes;
  metrics.uiBundleBudgetBytes = report.budgetBytes;
  assert.equal(report.withinBudget, true);
  assert.ok(report.totalBytes <= 16 * 1024 * 1024);
});

test('Q6 background queue throughput stays above 100 completed jobs per second', async () => {
  const queue = new BackgroundJobQueue({ concurrency: 8, perOwnerQuota: 100, maxJobs: 600 });
  const started = performance.now();
  for (let index = 0; index < 500; index += 1) {
    queue.submit({ owner: `owner-${index % 10}`, priority: index % 5, run: async () => index });
  }
  await waitForQueue(queue, 500);
  const elapsed = performance.now() - started;
  metrics.queueJobs = 500;
  metrics.queueElapsedMs = Number(elapsed.toFixed(2));
  metrics.queueThroughputPerSecond = Number((500 / (elapsed / 1000)).toFixed(2));
  assert.ok(metrics.queueThroughputPerSecond > 100, `queue throughput ${metrics.queueThroughputPerSecond} jobs/s`);
  await queue.close();
});

test('Q6 rejects out-of-budget WASM memory configuration and queue overload', async () => {
  await assert.rejects(runWasm({ bytes: emptyWasm, workspace: root, memoryBytes: 1024 }), /MEMORY_LIMIT_CONFIG/);
  const queue = new BackgroundJobQueue({ concurrency: 1, perOwnerQuota: 2, maxJobs: 1 });
  queue.submit({ owner: 'alice', run: ({ signal }) => new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true })) });
  assert.throws(() => queue.submit({ owner: 'bob', run: async () => 1 }), /JOB_CAP_REACHED/);
  await queue.close();
});

test('Q6 real compiled queue mutant removing the global job cap is caught', async () => {
  const needle = "if (this.jobs.size >= this.maxJobs) throw new Error(\"JOB_CAP_REACHED\");";
  const mutant = await compileRealModuleMutant('src/jobs/backgroundJobQueue.mjs', needle, '');
  try {
    const queue = new mutant.module.BackgroundJobQueue({ concurrency: 1, perOwnerQuota: 5, maxJobs: 1 });
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    queue.submit({ owner: 'alice', run: () => gate });
    let detected = false;
    try { assert.throws(() => queue.submit({ owner: 'bob', run: async () => 2 }), /JOB_CAP_REACHED/); }
    catch { detected = true; }
    assert.equal(detected, true, 'the normal global-cap assertion must fail against the mutant');
    release();
    await queue.close();
  } finally { await mutant.cleanup(); }
});

test.after(async () => {
  await mkdir(path.join(root, 'results'), { recursive: true });
  await writeFile(path.join(os.tmpdir(), 'axon-code-q6-performance.json'), JSON.stringify({
    schemaVersion: 1,
    host: `${process.platform} ${process.arch} Node ${process.version}`,
    measurements: metrics,
    budgets: { providerStartMs: 3000, guestWasmMemoryBytes: 2 * 1024 * 1024, uiBundleBytes: 16 * 1024 * 1024, queueThroughputPerSecondMinimum: 100 },
    phonePerformance: 'NOT RUN — no physical Android device was used.',
    memoryScope: 'WASM guest linear memory only; this is not total process RSS or Android memory.',
  }, null, 2) + '\n');
});
