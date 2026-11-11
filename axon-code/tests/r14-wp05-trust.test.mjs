import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveWorkspaceTrust,
  SingleUseExecutionApprovalVault,
  authorizeWorkspaceAction,
} from '../dist/security/workspaceTrust.js';

const NOW = 1_800_000_000_000;
const record = { projectFingerprint: 'fp-1', status: 'TRUSTED', approvedAt: NOW - 100, expiresAt: NOW + 10_000, approvalReference: 'user-trust-1' };

test('R14 WP5 unknown projects open Restricted by default', () => {
  assert.equal(resolveWorkspaceTrust({ projectFingerprint: 'new-project', now: NOW }), 'RESTRICTED');
});

test('R14 WP5 a current fingerprint-matched trust record is accepted', () => {
  assert.equal(resolveWorkspaceTrust({ projectFingerprint: 'fp-1', record, now: NOW }), 'TRUSTED');
});

test('R14 WP5 trust records do not transfer across project fingerprints', () => {
  assert.equal(resolveWorkspaceTrust({ projectFingerprint: 'fp-2', record, now: NOW }), 'RESTRICTED');
});

test('R14 WP5 expired and future-dated trust records are restricted', () => {
  assert.equal(resolveWorkspaceTrust({ projectFingerprint: 'fp-1', record: { ...record, expiresAt: NOW }, now: NOW }), 'RESTRICTED');
  assert.equal(resolveWorkspaceTrust({ projectFingerprint: 'fp-1', record: { ...record, approvedAt: NOW + 1 }, now: NOW }), 'RESTRICTED');
});

test('R14 WP5 reading and editing remain available in Restricted Mode', async () => {
  const vault = new SingleUseExecutionApprovalVault();
  for (const action of ['read', 'edit']) {
    const result = await authorizeWorkspaceAction({ trustStatus: 'RESTRICTED', projectFingerprint: 'fp-1',
      action, request: { path: 'README.md' }, vault });
    assert.equal(result.allowed, true);
  }
});

test('R14 WP5 script execution is blocked without a single-use approval', async () => {
  const result = await authorizeWorkspaceAction({ trustStatus: 'RESTRICTED', projectFingerprint: 'fp-1',
    action: 'script', request: { command: 'npm test' }, vault: new SingleUseExecutionApprovalVault() });
  assert.equal(result.allowed, false);
});

test('R14 WP5 exact approved request is accepted once', async () => {
  const vault = new SingleUseExecutionApprovalVault();
  const request = { command: 'npm test', cwd: 'project' };
  const approval = await vault.issue({ projectFingerprint: 'fp-1', action: 'task', request,
    approvalReference: 'user-tap-1', expiresAt: NOW + 1000, now: NOW });
  const result = await authorizeWorkspaceAction({ trustStatus: 'RESTRICTED', projectFingerprint: 'fp-1',
    action: 'task', request, approval: { token: approval.token }, vault, now: NOW });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, 'Exact approved request accepted once.');
});

test('R14 WP5 replayed approval tokens are rejected', async () => {
  const vault = new SingleUseExecutionApprovalVault();
  const request = { command: 'npm test' };
  const approval = await vault.issue({ projectFingerprint: 'fp-1', action: 'task', request,
    approvalReference: 'user-tap-2', expiresAt: NOW + 1000, now: NOW });
  await vault.consume({ token: approval.token, projectFingerprint: 'fp-1', action: 'task', request, now: NOW });
  const replay = await vault.consume({ token: approval.token, projectFingerprint: 'fp-1', action: 'task', request, now: NOW });
  assert.equal(replay.approved, false);
});

test('R14 WP5 approvals reject cross-project and cross-action use', async () => {
  for (const [projectFingerprint, action] of [['fp-2', 'task'], ['fp-1', 'debugger']]) {
    const vault = new SingleUseExecutionApprovalVault();
    const approval = await vault.issue({ projectFingerprint: 'fp-1', action: 'task', request: { x: 1 },
      approvalReference: 'user-tap-3', expiresAt: NOW + 1000, now: NOW });
    const result = await vault.consume({ token: approval.token, projectFingerprint, action, request: { x: 1 }, now: NOW });
    assert.equal(result.approved, false);
  }
});

test('R14 WP5 request tampering invalidates approval', async () => {
  const vault = new SingleUseExecutionApprovalVault();
  const approval = await vault.issue({ projectFingerprint: 'fp-1', action: 'package-hook',
    request: { package: 'safe-package', version: '1.0.0' }, approvalReference: 'user-tap-4', expiresAt: NOW + 1000, now: NOW });
  const result = await vault.consume({ token: approval.token, projectFingerprint: 'fp-1', action: 'package-hook',
    request: { package: 'different-package', version: '1.0.0' }, now: NOW });
  assert.equal(result.approved, false);
  assert.match(result.reason, /changed/);
});

test('R14 WP5 expired one-time approvals are rejected', async () => {
  const vault = new SingleUseExecutionApprovalVault();
  const approval = await vault.issue({ projectFingerprint: 'fp-1', action: 'extension', request: { id: 'x' },
    approvalReference: 'user-tap-5', expiresAt: NOW + 100, now: NOW });
  const result = await vault.consume({ token: approval.token, projectFingerprint: 'fp-1', action: 'extension',
    request: { id: 'x' }, now: NOW + 101 });
  assert.equal(result.approved, false);
});

test('R14 WP5 catches a deliberately broken approval-bypass mutant', async () => {
  const brokenMutant = async () => ({ allowed: true, reason: 'bypass' });
  const vault = new SingleUseExecutionApprovalVault();
  const actual = await authorizeWorkspaceAction({ trustStatus: 'RESTRICTED', projectFingerprint: 'fp-1',
    action: 'script', request: { command: 'untrusted' }, vault });
  assert.equal(actual.allowed, false);
  const mutantResult = await brokenMutant();
  assert.throws(() => assert.equal(mutantResult.allowed, false), { name: 'AssertionError' });
});
