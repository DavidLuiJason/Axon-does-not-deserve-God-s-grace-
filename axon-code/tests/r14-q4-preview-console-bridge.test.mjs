import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import http from 'node:http';
import { createManagedPreview } from '../src/preview/managedPreviewServer.mjs';
import { compileRealModuleMutant } from './helpers/r14-mutant.mjs';

function message(window, data, origin, source) {
  return new window.MessageEvent('message', { data, origin, source });
}

test('Q4 real preview server injects the console bridge and sends console/error events in jsdom', async () => {
  const preview = createManagedPreview({ files: {
    'index.html': '<!doctype html><html><head></head><body><script>console.warn("preview-warning"); throw new Error("preview-failure");</script></body></html>',
  } });
  const port = await preview.start();
  const origin = `http://127.0.0.1:${port}`;
  const response = await fetch(`${origin}/index.html`);
  const html = await response.text();
  const csp = response.headers.get('content-security-policy');
  assert.match(csp, /sandbox allow-scripts allow-same-origin/);
  assert.match(csp, /script-src 'self' 'nonce-/);
  assert.match(html, /__axonPreview/);
  const sent = [];
  const frame = new JSDOM(html, {
    url: `${origin}/index.html`,
    runScripts: 'dangerously',
    beforeParse(window) { window.parent.postMessage = (data) => sent.push(data); },
  });
  const host = new JSDOM('<!doctype html>');
  const bridge = preview.createConsoleBridge({ window: host.window, iframeWindow: frame.window }).attach();
  try {
    assert.ok(sent.some((row) => row.type === 'console' && /preview-warning/.test(row.payload.message)));
    assert.ok(sent.some((row) => row.type === 'error' && /preview-failure/.test(row.payload.message)));
    for (const row of sent) host.window.dispatchEvent(message(host.window, row, origin, frame.window));
    assert.ok(bridge.events.some((row) => row.type === 'console' && /preview-warning/.test(row.message)));
    assert.ok(bridge.events.some((row) => row.type === 'error' && /preview-failure/.test(row.message)));
  } finally {
    bridge.close();
    frame.window.close();
    host.window.close();
    await preview.stop();
  }
});

test('Q4 bridge rejects forged source, foreign origin and wrong token', async () => {
  const preview = createManagedPreview({ files: { 'index.html': '<h1>safe</h1>' } });
  const port = await preview.start();
  const host = new JSDOM('<!doctype html>');
  const iframe = new JSDOM('<!doctype html>');
  const impostor = new JSDOM('<!doctype html>');
  const bridge = preview.createConsoleBridge({ window: host.window, iframeWindow: iframe.window }).attach();
  try {
    const good = { __axonPreview: true, token: 'wrong', type: 'console', payload: { level: 'log', message: 'forged' } };
    host.window.dispatchEvent(message(host.window, good, `http://127.0.0.1:${port}`, iframe.window));
    host.window.dispatchEvent(message(host.window, { ...good, token: 'wrong' }, 'https://attacker.invalid', iframe.window));
    host.window.dispatchEvent(message(host.window, { ...good, token: 'wrong' }, `http://127.0.0.1:${port}`, impostor.window));
    assert.equal(bridge.events.length, 0);
  } finally {
    bridge.close(); host.window.close(); iframe.window.close(); impostor.window.close(); await preview.stop();
  }
});

test('Q4 bridge accepts only the iframe origin and source and caps event count', async () => {
  const preview = createManagedPreview({ files: { 'index.html': '<h1>x</h1>' } });
  const port = await preview.start();
  const host = new JSDOM('');
  const iframe = new JSDOM('');
  const bridge = preview.createConsoleBridge({ window: host.window, iframeWindow: iframe.window, maxBridgeEvents: 1 }).attach();
  try {
    const token = preview.events.token;
    // The token is intentionally not exposed through the event ledger.
    assert.equal(token, undefined);
    const scriptResponse = await fetch(`http://127.0.0.1:${port}/index.html`);
    const source = await scriptResponse.text();
    const match = /token = "([^"]+)"/.exec(source);
    assert.ok(match);
    const data = { __axonPreview: true, token: match[1], type: 'console', payload: { level: 'info', message: 'accepted' } };
    host.window.dispatchEvent(message(host.window, data, `http://127.0.0.1:${port}`, iframe.window));
    host.window.dispatchEvent(message(host.window, { ...data, payload: { level: 'info', message: 'second' } }, `http://127.0.0.1:${port}`, iframe.window));
    assert.equal(bridge.events.length, 1);
    assert.equal(bridge.events[0].message, 'accepted');
  } finally { bridge.close(); host.window.close(); iframe.window.close(); await preview.stop(); }
});

test('Q4 bridge caps aggregate event bytes and truncates individual messages', async () => {
  const preview = createManagedPreview({ files: { 'index.html': '<h1>x</h1>' } });
  const port = await preview.start();
  const html = await (await fetch(`http://127.0.0.1:${port}/index.html`)).text();
  const token = /token = "([^"]+)"/.exec(html)[1];
  const host = new JSDOM('');
  const iframe = new JSDOM('');
  const bridge = preview.createConsoleBridge({ window: host.window, iframeWindow: iframe.window, maxBridgeBytes: 150 }).attach();
  try {
    const data = { __axonPreview: true, token, type: 'error', payload: { message: 'x'.repeat(4000) } };
    host.window.dispatchEvent(message(host.window, data, `http://127.0.0.1:${port}`, iframe.window));
    assert.equal(bridge.events.length, 0);
  } finally { bridge.close(); host.window.close(); iframe.window.close(); await preview.stop(); }
});

test('Q4 bridge refuses malformed messages and closes its listener', async () => {
  const preview = createManagedPreview({ files: { 'index.html': '<h1>x</h1>' } });
  const port = await preview.start();
  const html = await (await fetch(`http://127.0.0.1:${port}/index.html`)).text();
  const token = /token = "([^"]+)"/.exec(html)[1];
  const host = new JSDOM('');
  const iframe = new JSDOM('');
  const bridge = preview.createConsoleBridge({ window: host.window, iframeWindow: iframe.window }).attach();
  try {
    host.window.dispatchEvent(message(host.window, { __axonPreview: true, token, type: 'eval', payload: {} }, `http://127.0.0.1:${port}`, iframe.window));
    assert.equal(bridge.events.length, 0);
    bridge.close();
    host.window.dispatchEvent(message(host.window, { __axonPreview: true, token, type: 'error', payload: { message: 'late' } }, `http://127.0.0.1:${port}`, iframe.window));
    assert.equal(bridge.events.length, 0);
  } finally { bridge.close(); host.window.close(); iframe.window.close(); await preview.stop(); }
});

test('Q4 preview server refuses foreign Host header rebinding', async () => {
  const preview = createManagedPreview({ files: { 'index.html': 'ok' } });
  const port = await preview.start();
  try {
    const status = await new Promise((resolve, reject) => {
      const request = http.request({ host: '127.0.0.1', port, path: '/index.html', headers: { host: `attacker.invalid:${port}` } }, (response) => { response.resume(); resolve(response.statusCode); });
      request.once('error', reject);
      request.end();
    });
    assert.equal(status, 421);
  } finally { await preview.stop(); }
});

test('Q4 real compiled bridge mutant removing source/origin validation is caught', async () => {
  const needle = 'if (this.closed || event.origin !== this.origin || event.source !== this.iframeWindow) return false;';
  const mutant = await compileRealModuleMutant('src/preview/managedPreviewServer.mjs', needle, 'if (this.closed) return false;');
  try {
    const host = new JSDOM('');
    const iframe = new JSDOM('');
    const bridge = new mutant.module.PreviewConsoleBridge({ window: host.window, iframeWindow: iframe.window, origin: 'http://127.0.0.1:1234', token: 'token' }).attach();
    let detected = false;
    try {
      assert.equal(bridge.handle(message(host.window, { __axonPreview: true, token: 'token', type: 'error', payload: { message: 'forged' } }, 'https://attacker.invalid', iframe.window)), false);
    } catch { detected = true; }
    assert.equal(detected, true, 'the source/origin security assertion must fail against the mutant');
    bridge.close(); host.window.close(); iframe.window.close();
  } finally { await mutant.cleanup(); }
});
