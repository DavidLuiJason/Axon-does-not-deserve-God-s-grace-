import test from 'node:test';
import assert from 'node:assert/strict';
import { readAndroidDocument, writeAndroidDocument, validateAndroidCapabilities } from '../dist/runtime/androidHostProvider.js';

const bytes = new Uint8Array([65, 88, 79, 78]);
function fakeHost(overrides = {}) {
  return {
    async getCapabilities() { return { platform: 'android', apiLevel: 30, cpuAbi: 'arm64-v8a', persistedSafGrants: true, processProvider: false, pythonProvider: false, gradleProvider: false }; },
    async pickWorkspace() { return { grantId: 'grant-1', entries: [{ uriToken: 'content://tree/root', displayName: 'workspace', mimeType: 'vnd.android.document/directory', isDirectory: true }] }; },
    async listChildren() { return { entries: [{ uriToken: 'content://tree/root/document/root%3Afile.txt', displayName: 'file.txt', mimeType: 'text/plain', sizeBytes: 4, isDirectory: false }] }; },
    async readDocument() { return { bytesBase64: btoa('AXON'), sizeBytes: 4 }; },
    async writeDocument(input) { return { writtenBytes: input.expectedSizeBytes }; },
    async releaseGrant() { return { released: true }; },
    ...overrides
  };
}

test('C3 validates Android API/ABI capability contract', async () => {
  const host = fakeHost(); const capabilities = await host.getCapabilities(); validateAndroidCapabilities(capabilities); assert.equal(capabilities.apiLevel, 30);
});
test('C3 rejects malformed and below-floor Android host claims', () => {
  assert.throws(() => validateAndroidCapabilities({ platform: 'android', apiLevel: 25, cpuAbi: 'arm64-v8a', persistedSafGrants: true, processProvider: false, pythonProvider: false, gradleProvider: false }), /CAPABILITY_MISMATCH/);
  assert.throws(() => validateAndroidCapabilities({ platform: 'linux', apiLevel: 35, cpuAbi: 'x64', persistedSafGrants: true, processProvider: false, pythonProvider: false, gradleProvider: false }), /CAPABILITY_MISMATCH/);
});
test('C3 reads bytes only through a named persisted grant and bounded URI token', async () => {
  const result = await readAndroidDocument(fakeHost(), { grantId: 'grant-1', uriToken: 'content://tree/root', maxBytes: 16 }); assert.deepEqual([...result], [...bytes]);
});
test('C3 denies missing grants and invalid read limits', async () => {
  await assert.rejects(() => readAndroidDocument(fakeHost(), { grantId: '', uriToken: 'content://x', maxBytes: 10 }), /GRANT_REQUIRED/);
  await assert.rejects(() => readAndroidDocument(fakeHost(), { grantId: 'g', uriToken: 'content://x', maxBytes: 0 }), /INVALID_SIZE/);
});
test('C3 refuses forged byte count and over-limit host read', async () => {
  await assert.rejects(() => readAndroidDocument(fakeHost({ async readDocument() { return { bytesBase64: btoa('X'), sizeBytes: 2 }; } }), { grantId: 'g', uriToken: 'content://x', maxBytes: 16 }), /WRITE_SIZE_MISMATCH/);
  await assert.rejects(() => readAndroidDocument(fakeHost({ async readDocument() { return { bytesBase64: btoa('AXON'), sizeBytes: 17 }; } }), { grantId: 'g', uriToken: 'content://x', maxBytes: 16 }), /INVALID_SIZE/);
});
test('C3 writes exact bytes and rejects host byte-count mismatch', async () => {
  let received; const host = fakeHost({ async writeDocument(input) { received = input; return { writtenBytes: input.expectedSizeBytes }; } });
  await writeAndroidDocument(host, { grantId: 'grant-1', uriToken: 'content://tree/root', bytes }); assert.equal(received.expectedSizeBytes, 4); assert.equal(atob(received.bytesBase64), 'AXON');
  await assert.rejects(() => writeAndroidDocument(fakeHost({ async writeDocument() { return { writtenBytes: 1 }; } }), { grantId: 'g', uriToken: 'u', bytes }), /WRITE_SIZE_MISMATCH/);
});
test('C3 rejects unbounded or non-byte-array writes', async () => {
  await assert.rejects(() => writeAndroidDocument(fakeHost(), { grantId: 'g', uriToken: 'u', bytes: new Uint8Array(16 * 1024 * 1024 + 1) }), /INVALID_SIZE/);
  await assert.rejects(() => writeAndroidDocument(fakeHost(), { grantId: 'g', uriToken: 'u', bytes: 'bad' }), /INVALID_SIZE/);
});

test('C3 lists bounded child document entries under a persisted SAF grant', async () => { const result = await fakeHost().listChildren({ grantId: 'grant-1', uriToken: 'content://tree/root', maxEntries: 10 }); assert.equal(result.entries.length, 1); assert.equal(result.entries[0].displayName, 'file.txt'); });
