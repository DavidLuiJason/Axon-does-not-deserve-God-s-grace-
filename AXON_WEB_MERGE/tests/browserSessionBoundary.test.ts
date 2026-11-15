import test from 'node:test';
import assert from 'node:assert/strict';
import { AXON_BROWSER_SESSION_ENABLED, evaluateBrowserSessionBoundary } from '../src/web/browserSessionBoundary.ts';

const owner = Object.freeze({ owner: 'OWNER' as const, sessionId: 'owner-default', engineContextId: 'android-webview-owner', cookiePartitionId: 'owner-cookies', storagePartitionId: 'owner-storage', credentialStoreId: 'owner-credentials', isolationKind: 'SHARED_WEBVIEW_PROCESS' as const, isolationVerified: false });
const axonIsolated = Object.freeze({ owner: 'AXON' as const, sessionId: 'axon-task-17', engineContextId: 'android-webview-axon-process', cookiePartitionId: 'axon-cookie-store', storagePartitionId: 'axon-storage', credentialStoreId: null, isolationKind: 'ANDROID_WEBVIEW_DATA_SUFFIX' as const, isolationVerified: true });

test('AXON session route remains disabled in current implementation', () => assert.equal(AXON_BROWSER_SESSION_ENABLED, false));
test('distinct labels alone do not establish isolation', () => {
  const fake = { ...axonIsolated, isolationKind: 'SHARED_WEBVIEW_PROCESS' as const, isolationVerified: false };
  const result = evaluateBrowserSessionBoundary(owner, fake);
  assert.equal(result.allowed, false); assert.equal(result.mayAccessOwnerCredentials, false);
});
test('same cookie or storage partition is rejected even if session ID differs', () => {
  for (const requested of [{ ...axonIsolated, cookiePartitionId: owner.cookiePartitionId }, { ...axonIsolated, storagePartitionId: owner.storagePartitionId }]) {
    assert.equal(evaluateBrowserSessionBoundary(owner, requested).allowed, false);
  }
});
test('shared credential store is rejected', () => {
  const result = evaluateBrowserSessionBoundary(owner, { ...axonIsolated, credentialStoreId: 'owner-credentials' });
  assert.equal(result.allowed, false); assert.match(result.reason, /credential-store/);
});
test('AXON identity may not be mislabelled as OWNER', () => {
  const result = evaluateBrowserSessionBoundary(owner, { ...axonIsolated, owner: 'OWNER' });
  assert.equal(result.allowed, false);
});
test('hypothetical distinct and verified partitions pass the boundary contract without granting credentials', () => {
  const result = evaluateBrowserSessionBoundary(owner, axonIsolated);
  assert.equal(result.allowed, true); assert.equal(result.mayAccessOwnerCredentials, false);
});
