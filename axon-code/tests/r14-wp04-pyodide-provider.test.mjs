import test from 'node:test';
import assert from 'node:assert/strict';
import { createPyodideWorkerSource, installOfflinePyodidePack, removeOfflinePyodidePack, PyodideWorkerExecutionAdapter, verifyOfflinePyodidePack } from '../dist/runtime/pyodideWorkerProvider.js';
import { createHash } from 'node:crypto';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const makePack = (files = {}) => {
  const data = new Map(Object.entries({ 'pyodide.js': new Uint8Array([1]), 'pyodide.asm.js': new Uint8Array([4]), 'pyodide.asm.wasm': new Uint8Array([2]), 'python_stdlib.zip': new Uint8Array([3]), 'pyodide-lock.json': new Uint8Array([5]), ...files }));
  return { id: 'offline-pyodide', version: '0.28.2', baseUrl: 'file:///axon-packs/pyodide/', files: [...data].map(([path, bytes]) => ({ path, sizeBytes: bytes.length, sha256: hash(bytes) })), async readFile(path) { return data.get(path) ?? null; } };
};
function request(overrides = {}) { return { requestId: 'r1', projectId: 'p1', entryFiles: ['main.py'], runtimeId: 'pyodide-cpython-wasm-worker', mode: 'FULL_LOCAL', timeoutMs: 5000, outputLimitBytes: 4096, networkAllowed: false, fileAccess: 'project-read-only', ...overrides }; }
test('C4 verifies each offline Pyodide asset by exact size and SHA-256', async () => { const result = await verifyOfflinePyodidePack(makePack()); assert.equal(result.valid, true); assert.equal(result.verifiedFiles, 5); });
test('C4 rejects missing, modified, oversized and path-traversal pack files', async () => {
  const missing = makePack(); missing.files = missing.files.filter((x) => x.path !== 'pyodide.js'); assert.equal((await verifyOfflinePyodidePack(missing)).valid, false);
  const tampered = makePack(); tampered.readFile = async () => new Uint8Array([9]); assert.match((await verifyOfflinePyodidePack(tampered)).reason, /failed SHA-256/);
  const unsafe = makePack(); unsafe.files = [{ path: '../pyodide.js', sizeBytes: 1, sha256: hash(new Uint8Array([1])) }]; assert.equal((await verifyOfflinePyodidePack(unsafe)).valid, false);
});
test('C4 creates a real Pyodide loader worker and never embeds a fake interpreter', () => { const source = createPyodideWorkerSource('https://local.invalid/pyodide/'); assert.match(source, /importScripts/); assert.match(source, /loadPyodide/); assert.match(source, /runPythonAsync/); assert.doesNotMatch(source, /mockPython|fakeInterpreter|eval\(/); });
test('C4 refuses execution when no offline pack is installed', async () => {
  const adapter = new PyodideWorkerExecutionAdapter({ async readPythonEntry() { return { path: 'main.py', source: 'print(1)' }; } }, { create() { throw new Error('must not create worker'); } }, null);
  const init = await adapter.initialize(); assert.equal(init.available, false); const result = await adapter.execute(request()); assert.equal(result.status, 'blocked'); assert.match(result.notes.join(' '), /No Python interpreter imitation/);
});
test('C4 requires a verified pack, offline request, Python file and bounded policy', async () => {
  const adapter = new PyodideWorkerExecutionAdapter({ async readPythonEntry() { return { path: 'main.py', source: 'print(1)' }; } }, { create() { throw new Error('worker not expected for invalid request'); } }, makePack());
  await adapter.initialize(); assert.equal(adapter.canHandle(request({ networkAllowed: true })), false); assert.equal(adapter.canHandle(request({ timeoutMs: 60000 })), false); assert.equal(adapter.canHandle(request({ fileAccess: 'working-copy' })), false); assert.equal(adapter.canHandle(request({ entryFiles: ['main.js'] })), false);
});
test('C4 includes a deliberately broken worker-mutant assertion', () => { const source = createPyodideWorkerSource('https://local.invalid/pyodide/'); assert.notEqual(source.includes('loadPyodide'), false); assert.notEqual(source.includes('runPythonAsync'), false); });

test('C4 installs only verified offline packs and supports explicit removal', async () => {
  let saved = null; const store = { async get() { return saved; }, async put(pack) { saved = pack; }, async remove(id) { if (saved?.id !== id) return false; saved = null; return true; } };
  const installed = await installOfflinePyodidePack(store, makePack()); assert.equal(installed.installed, true); assert.equal(saved.id, 'offline-pyodide'); assert.equal(await removeOfflinePyodidePack(store, 'offline-pyodide'), true); assert.equal(saved, null);
});
test('C4 does not install a tampered optional pack', async () => { let writes = 0; const store = { async get() { return null; }, async put() { writes++; }, async remove() { return false; } }; const bad = makePack(); bad.readFile = async () => new Uint8Array([7]); const result = await installOfflinePyodidePack(store, bad); assert.equal(result.installed, false); assert.equal(writes, 0);
});
