import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LspFrameDecoder, TypeScriptLspClient } from '../src/lsp/typescriptLspClient.mjs';
import { compileRealModuleMutant } from './helpers/r14-mutant.mjs';

function frame(message) {
  const body = Buffer.from(JSON.stringify(message));
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]);
}

test('Q3 strict decoder accepts a valid response for the oldest outstanding request', () => {
  const decoder = new LspFrameDecoder();
  decoder.expect(1);
  assert.deepEqual(decoder.push(frame({ jsonrpc: '2.0', id: 1, result: { ok: true } })), [{ jsonrpc: '2.0', id: 1, result: { ok: true } }]);
  decoder.finish();
});

test('Q3 malformed headers and duplicate Content-Length are refused', () => {
  const malformed = new LspFrameDecoder();
  assert.throws(() => malformed.push(Buffer.from('Content-Length nope\r\n\r\n{}')), /LSP_MALFORMED_HEADER/);
  const duplicate = new LspFrameDecoder();
  assert.throws(() => duplicate.push(Buffer.from('Content-Length: 2\r\nContent-Length: 2\r\n\r\n{}')), /LSP_DUPLICATE_CONTENT_LENGTH/);
});

test('Q3 oversized Content-Length is refused before body allocation', () => {
  const decoder = new LspFrameDecoder({ maxMessageBytes: 128 });
  assert.throws(() => decoder.push(Buffer.from('Content-Length: 999999999\r\n\r\n')), /LSP_INVALID_CONTENT_LENGTH/);
});

test('Q3 truncated body is reported when the server closes the stream', () => {
  const decoder = new LspFrameDecoder();
  decoder.push(Buffer.from('Content-Length: 40\r\n\r\n{"jsonrpc":"2.0"}'));
  assert.throws(() => decoder.finish(), /LSP_TRUNCATED_FRAME/);
});

test('Q3 out-of-order and duplicate responses are rejected', () => {
  const decoder = new LspFrameDecoder();
  decoder.expect(10);
  decoder.expect(11);
  assert.throws(() => decoder.push(frame({ jsonrpc: '2.0', id: 11, result: null })), /LSP_RESPONSE_ORDER/);
  const duplicate = new LspFrameDecoder();
  duplicate.expect(1);
  duplicate.push(frame({ jsonrpc: '2.0', id: 1, result: null }));
  assert.throws(() => duplicate.push(frame({ jsonrpc: '2.0', id: 1, result: null })), /LSP_RESPONSE_ORDER/);
});

test('Q3 notification flood is stopped at the configured count', () => {
  const decoder = new LspFrameDecoder({ maxNotifications: 2 });
  decoder.push(frame({ jsonrpc: '2.0', method: 'window/logMessage', params: { message: 'one' } }));
  decoder.push(frame({ jsonrpc: '2.0', method: 'window/logMessage', params: { message: 'two' } }));
  assert.throws(() => decoder.push(frame({ jsonrpc: '2.0', method: 'window/logMessage', params: { message: 'three' } })), /LSP_NOTIFICATION_FLOOD/);
});

test('Q3 oversized and unterminated headers remain bounded', () => {
  const decoder = new LspFrameDecoder({ maxHeaderBytes: 64 });
  assert.throws(() => decoder.push(Buffer.from(`X-Header: ${'x'.repeat(80)}`)), /LSP_HEADER_TOO_LARGE/);
  const invalid = new LspFrameDecoder();
  assert.throws(() => invalid.push(Buffer.from('Content-Length: -2\r\n\r\n')), /LSP_INVALID_CONTENT_LENGTH/);
});

test('Q3 real client times out and can terminate a server that never answers', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'axon-q3-no-answer-'));
  const server = path.join(root, 'never.mjs');
  await writeFile(server, "process.stdin.on('data', () => {}); setInterval(() => {}, 1000);\n");
  const client = new TypeScriptLspClient({ cwd: root, command: process.execPath, args: [server], timeoutMs: 100 });
  try {
    client.start();
    await assert.rejects(client.request('initialize', {}), /LSP_TIMEOUT/);
    const child = client.proc;
    client.stop();
    await new Promise((resolve) => child.once('exit', resolve));
    assert.equal(client.pending.size, 0);
  } finally { client.stop(); await rm(root, { recursive: true, force: true }); }
});

test('Q3 real compiled decoder mutant removing Content-Length bounds is caught', async () => {
  const needle = 'if (!Number.isSafeInteger(contentLength) || contentLength < 2 || contentLength > this.maxMessageBytes)';
  const mutant = await compileRealModuleMutant('src/lsp/typescriptLspClient.mjs', needle, 'if (false)');
  try {
    const decoder = new mutant.module.LspFrameDecoder({ maxMessageBytes: 64 });
    let detected = false;
    try { assert.throws(() => decoder.push(Buffer.from('Content-Length: 999999\r\n\r\n')), /LSP_INVALID_CONTENT_LENGTH/); }
    catch { detected = true; }
    assert.equal(detected, true, 'the normal length-bound assertion must fail against the mutant');
  } finally { await mutant.cleanup(); }
});
