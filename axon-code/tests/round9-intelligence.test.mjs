import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ContentLengthFrameCodec, LanguageServiceClient, LanguageServiceRegistry, LanguageServiceSession,
  EMPTY_LANGUAGE_CAPABILITIES, IncrementalAnalysisScheduler
} from '../dist/index.js';

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
class FakeTransport {
  sent = [];
  closed = false;
  async send(message) { this.sent.push(message); }
  async close() { this.closed = true; }
  respond(id, result) { this.client.receive({ jsonrpc: '2.0', id, result }); }
  fail(id, error) { this.client.receive({ jsonrpc: '2.0', id, error }); }
}
function frame(value) { return new ContentLengthFrameCodec().encode(value); }

 test('R9 Content-Length codec handles fragmented headers and UTF-8 bodies', () => {
  const codec = new ContentLengthFrameCodec(1024, 128);
  const bytes = frame({ jsonrpc: '2.0', method: 'notify', params: { text: 'héllo 🌍' } });
  const first = codec.push(bytes.slice(0, 7));
  const second = codec.push(bytes.slice(7, 21));
  const third = codec.push(bytes.slice(21));
  assert.deepEqual(first, []); assert.deepEqual(second, []);
  assert.deepEqual(JSON.parse(third[0]), { jsonrpc: '2.0', method: 'notify', params: { text: 'héllo 🌍' } });
});

test('R9 Content-Length codec accepts multiple frames in a single larger chunk', () => {
  const codec = new ContentLengthFrameCodec(128, 64);
  const one = frame({ jsonrpc: '2.0', method: 'one', params: 'x'.repeat(75) });
  const two = frame({ jsonrpc: '2.0', method: 'two', params: 'y'.repeat(75) });
  const joined = new Uint8Array(one.length + two.length); joined.set(one); joined.set(two, one.length);
  const results = codec.push(joined);
  assert.equal(results.length, 2);
  assert.equal(JSON.parse(results[0]).method, 'one');
  assert.equal(JSON.parse(results[1]).method, 'two');
});

test('R9 Content-Length codec rejects malformed, duplicate and oversized headers', () => {
  const codec = new ContentLengthFrameCodec(64, 64);
  assert.throws(() => codec.push(new TextEncoder().encode('Content-Length: x\r\n\r\n')), /invalid/i);
  const duplicate = new TextEncoder().encode('Content-Length: 2\r\nContent-Length: 2\r\n\r\n{}');
  assert.throws(() => codec.push(duplicate), /exactly one/i);
  assert.throws(() => new ContentLengthFrameCodec(32, 32).push(new TextEncoder().encode('Content-Length: 999\r\n\r\n')), /outside/i);
});

test('R9 Content-Length codec rejects malformed UTF-8 and oversized unterminated headers', () => {
  const codec = new ContentLengthFrameCodec(64, 24);
  const header = new TextEncoder().encode('Content-Length: 1\r\n\r\n');
  const invalid = new Uint8Array(header.length + 1); invalid.set(header); invalid[header.length] = 255;
  assert.throws(() => codec.push(invalid), /utf-8/i);
  codec.reset();
  assert.throws(() => codec.push(new TextEncoder().encode('x'.repeat(30))), /header exceeds/i);
});

test('R9 LanguageServiceClient matches request IDs and handles protocol errors', async () => {
  const transport = new FakeTransport();
  const client = new LanguageServiceClient(transport, 500);
  transport.client = client;
  const pending = client.request('textDocument/completion', { uri: 'file:///a.ts' });
  const request = transport.sent[0];
  transport.respond(request.id, [{ label: 'hello' }]);
  assert.deepEqual(await pending, [{ label: 'hello' }]);
  const failed = client.request('textDocument/definition', {});
  const errorRequest = transport.sent.at(-1);
  transport.fail(errorRequest.id, { code: -32601, message: 'method missing' });
  await assert.rejects(failed, /method missing/);
  await client.close();
  assert.equal(transport.closed, true);
});

test('R9 LanguageServiceClient supports timeout, cancellation and close rejection', async () => {
  const transport = new FakeTransport();
  const client = new LanguageServiceClient(transport, 20); transport.client = client;
  await assert.rejects(client.request('timeout'), /timed out/);
  const controller = new AbortController();
  const cancelled = client.request('cancel-me', {}, { signal: controller.signal });
  controller.abort();
  await assert.rejects(cancelled, /cancelled/);
  assert.ok(transport.sent.some((item) => item.method === '$/cancelRequest'));
  const pending = client.request('close-me');
  await client.close();
  await assert.rejects(pending, /closed/);
});

test('R9 LanguageServiceClient handles server requests and isolates notification handler faults', async () => {
  const transport = new FakeTransport();
  const errors = [];
  const client = new LanguageServiceClient(transport, 100, (error) => errors.push(error.message));
  client.onNotification('diagnostics', () => { throw new Error('consumer bug'); });
  client.receive({ jsonrpc: '2.0', method: 'diagnostics', params: {} });
  assert.deepEqual(errors, ['consumer bug']);
  client.onServerRequest('workspace/configuration', () => ['config']);
  client.receive({ jsonrpc: '2.0', id: 90, method: 'workspace/configuration', params: {} });
  await sleep();
  assert.ok(transport.sent.some((item) => item.id === 90 && item.result[0] === 'config'));
  await client.close();
});

test('R9 LanguageServiceSession negotiates, tracks document versions and closes documents', async () => {
  const transport = new FakeTransport();
  const client = new LanguageServiceClient(transport, 500);
  const rawSend = transport.send.bind(transport);
  transport.send = async (message) => {
    await rawSend(message);
    if (message.method === 'initialize') queueMicrotask(() => client.receive({ jsonrpc: '2.0', id: message.id, result: { capabilities: { completionProvider: true } } }));
  };
  const session = new LanguageServiceSession(client);
  const caps = await session.initialize({ processId: 123, rootUri: 'file:///project' });
  assert.equal(caps.completionProvider, true);
  await session.openDocument('file:///project/main.ts', 'typescript', 'const x = 1;');
  assert.equal(await session.changeDocument('file:///project/main.ts', 'const x = 2;'), 2);
  const completion = session.completion('file:///project/main.ts', 0, 3);
  const req = transport.sent.findLast((item) => item.method === 'textDocument/completion');
  client.receive({ jsonrpc: '2.0', id: req.id, result: { items: [] } });
  assert.deepEqual(await completion, { items: [] });
  await session.closeDocument('file:///project/main.ts');
  assert.ok(transport.sent.some((item) => item.method === 'textDocument/didClose'));
  await session.close();
});

test('R9 LanguageServiceRegistry does not claim availability from language recognition alone', async () => {
  const registry = new LanguageServiceRegistry();
  registry.register({ id: 'python-lsp', language: 'python', state: 'ADAPTER_REQUIRED', capabilities: { ...EMPTY_LANGUAGE_CAPABILITIES } });
  assert.equal(registry.get('python').state, 'ADAPTER_REQUIRED');
  await assert.rejects(registry.connect('python'), /not operational/);
  assert.throws(() => registry.register({ id: 'bad', language: 'rust', state: 'AVAILABLE', capabilities: { ...EMPTY_LANGUAGE_CAPABILITIES } }), /factory/);
});

test('R9 incremental analysis scales concurrency to RAM and CPU, with conservative unknown thermal state', () => {
  const scheduler = new IncrementalAnalysisScheduler({ maxWorkers: 6, memoryPerWorkerBytes: 100, maxQueue: 20 });
  scheduler.setResourceBudget({ availableForWorkBytes: 1000, cpuCores: 4, thermalState: 'normal' });
  assert.equal(scheduler.getConcurrencyLimit(), 4);
  scheduler.setResourceBudget({ availableForWorkBytes: 300, cpuCores: 6, thermalState: 'unknown' });
  assert.equal(scheduler.getConcurrencyLimit(), 1);
  scheduler.setResourceBudget({ availableForWorkBytes: 1000, cpuCores: 0, thermalState: 'normal' });
  assert.equal(scheduler.getConcurrencyLimit(), 0);
});

test('R9 incremental analysis prioritises foreground work and preserves latest revisions', async () => {
  const scheduler = new IncrementalAnalysisScheduler({ maxWorkers: 1, memoryPerWorkerBytes: 1, maxQueue: 10 });
  scheduler.setResourceBudget({ availableForWorkBytes: 100, cpuCores: 2, thermalState: 'normal' });
  const order = [];
  const first = scheduler.enqueue({ projectId: 'p', filePath: 'slow.ts', revision: 1, priority: 'BACKGROUND_INDEX', estimatedMemoryBytes: 1, run: async () => { order.push('first'); await sleep(10); return 1; } });
  const background = scheduler.enqueue({ projectId: 'p', filePath: 'b.ts', revision: 1, priority: 'BACKGROUND_INDEX', estimatedMemoryBytes: 1, run: async () => { order.push('background'); return 2; } });
  const foreground = scheduler.enqueue({ projectId: 'p', filePath: 'a.ts', revision: 1, priority: 'ACTIVE_DOCUMENT', estimatedMemoryBytes: 1, run: async () => { order.push('foreground'); return 3; } });
  await Promise.all([first, background, foreground]);
  assert.ok(order.indexOf('foreground') < order.indexOf('background'));
  await scheduler.close();
});

test('R9 incremental analysis bounds queue and does not stale an active revision for rejected work', async () => {
  const scheduler = new IncrementalAnalysisScheduler({ maxWorkers: 1, memoryPerWorkerBytes: 1, maxQueue: 1 });
  scheduler.setResourceBudget({ availableForWorkBytes: 100, cpuCores: 1, thermalState: 'normal' });
  let finish;
  const running = scheduler.enqueue({ projectId: 'p', filePath: 'same.ts', revision: 1, priority: 'ACTIVE_DOCUMENT', estimatedMemoryBytes: 1, run: () => new Promise((resolve) => { finish = resolve; }) });
  await sleep();
  const queued = scheduler.enqueue({ projectId: 'p', filePath: 'other.ts', revision: 1, priority: 'BACKGROUND_INDEX', estimatedMemoryBytes: 1, run: async () => true });
  await assert.rejects(scheduler.enqueue({ projectId: 'p', filePath: 'same.ts', revision: 2, priority: 'ACTIVE_DOCUMENT', estimatedMemoryBytes: 1, run: async () => 2 }), /queue limit/);
  finish('old-result');
  assert.equal((await running).status, 'COMPLETED');
  await queued;
  await scheduler.close();
});

test('R9 incremental analysis suspends background indexing in REDUCED and all work in SUSPENDED', async () => {
  const scheduler = new IncrementalAnalysisScheduler({ maxWorkers: 2, memoryPerWorkerBytes: 1, maxQueue: 10 });
  scheduler.setResourceBudget({ availableForWorkBytes: 100, cpuCores: 2, thermalState: 'normal' });
  scheduler.setMode('REDUCED');
  let started = false;
  const background = scheduler.enqueue({ projectId: 'p', filePath: 'index.ts', revision: 1, priority: 'BACKGROUND_INDEX', estimatedMemoryBytes: 1, run: async () => { started = true; return 'done'; } });
  await sleep(10);
  assert.equal(started, false);
  scheduler.setMode('AUTO');
  assert.equal((await background).status, 'COMPLETED');
  scheduler.setMode('SUSPENDED');
  assert.equal(scheduler.getConcurrencyLimit(), 0);
  scheduler.setMode('AUTO');
  await scheduler.close();
});

test('R9 incremental analysis rejects malformed task and resource samples', async () => {
  const scheduler = new IncrementalAnalysisScheduler({ maxWorkers: 2, memoryPerWorkerBytes: 1, maxQueue: 2 });
  assert.throws(() => scheduler.setResourceBudget({ availableForWorkBytes: -1, cpuCores: 1, thermalState: 'normal' }), /invalid/i);
  assert.throws(() => scheduler.setMode('FAST'), /invalid/i);
  await assert.rejects(scheduler.enqueue({ projectId: '', filePath: 'x', revision: 1, priority: 'ACTIVE_DOCUMENT', estimatedMemoryBytes: 1, run: async () => 1 }), /invalid/i);
  await scheduler.close();
});
