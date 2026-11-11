import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAxonCodeGatewayRequest, readCapabilityRegistry } from '../dist/gateway/axonCodeGateway.js';

const valid = {
  protocolVersion: '1',
  requestId: 'req-1',
  callerContext: { callerId: 'axon-brain', sessionId: 'session-1', authority: 'AXON_BRAIN' },
  scope: { projectId: 'project-1', workspaceId: 'workspace-1', permissions: ['project.inspect'] },
  approvalReference: 'approval-1',
  auditId: 'audit-1',
  operation: 'project.inspect',
  payload: { include: ['summary'] },
};

test('R14 WP1 accepts a complete JSON gateway envelope', () => {
  assert.equal(validateAxonCodeGatewayRequest(valid), true);
});

test('R14 WP1 rejects missing approval references', () => {
  const value = { ...valid, approvalReference: '' };
  assert.equal(validateAxonCodeGatewayRequest(value), false);
});

test('R14 WP1 rejects unknown operations', () => {
  const value = { ...valid, operation: 'write-main-axon-source' };
  assert.equal(validateAxonCodeGatewayRequest(value), false);
});

test('R14 WP1 rejects malformed caller identity and scope', () => {
  assert.equal(validateAxonCodeGatewayRequest({ ...valid, callerContext: null }), false);
  assert.equal(validateAxonCodeGatewayRequest({ ...valid, scope: { ...valid.scope, permissions: [''] } }), false);
});

test('R14 WP1 rejects requests without an explicit payload property', () => {
  const { payload, ...value } = valid;
  assert.equal(validateAxonCodeGatewayRequest(value), false);
});

test('R14 WP1 catches the deliberately broken approval-bypass mutant', () => {
  const brokenMutant = (value) => value && typeof value === 'object' && value.protocolVersion === '1';
  const unapproved = { ...valid, approvalReference: '' };
  assert.equal(validateAxonCodeGatewayRequest(unapproved), false);
  assert.throws(() => assert.equal(brokenMutant(unapproved), false), { name: 'AssertionError' });
});

test('R14 WP1 gateway source has no import into the AXON main application', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const source = fs.readFileSync(path.join(root, 'src/gateway/axonCodeGateway.ts'), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /from\s+['"][^'"]*axon-main/i);
});


test('R14 WP1 gateway returns capability status only from the supplied registry', () => {
  const request = { ...valid, operation: 'capabilities.read',
    scope: { ...valid.scope, permissions: ['capabilities.read'] } };
  const registry = { schemaVersion: 1, capabilities: [
    { id: 'linux-pty-provider', status: 'TESTED', evidenceIds: ['R14-PTY-1'], resultFiles: ['results/pty.json'] },
    { id: 'android-native-host', status: 'NOT RUN', evidenceIds: ['R14-ANDROID'], resultFiles: ['results/android.json'] },
  ] };
  const response = readCapabilityRegistry(request, registry);
  assert.equal(response.status, 'COMPLETED');
  assert.deepEqual(response.result, registry);
});

test('R14 WP1 gateway refuses malformed registry and missing read scope', () => {
  const request = { ...valid, operation: 'capabilities.read' };
  assert.throws(() => readCapabilityRegistry(request, { schemaVersion: 1, capabilities: [] }));
  const scoped = { ...request, scope: { ...valid.scope, permissions: ['project.inspect'] } };
  assert.throws(() => readCapabilityRegistry(scoped, { schemaVersion: 1, capabilities: [] }));
});

test('R14 WP1 UI reads the generated registry instead of hardcoding capability statuses', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const ui = fs.readFileSync(path.join(root, 'ui/workbench.js'), 'utf8');
  assert.ok(ui.includes("fetch('../docs/CAPABILITY_REGISTRY.json'"));
  assert.match(ui, /status\.textContent\s*=\s*item\.status/);
  assert.doesNotMatch(ui, /linux-pty-provider.{0,30}TESTED/);
});
