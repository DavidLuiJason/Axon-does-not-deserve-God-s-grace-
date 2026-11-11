import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DirectUserWorkbenchGateway,
  DirectUserDocumentGateway,
  MemoryWorkspaceFileStore,
  DocumentBufferManager,
  WorkbenchCommandRegistry,
  BrainRequestGate
} from '../dist/index.js';

const NOW = 1_800_000_000_000;
const token = 'test-user-session-token';
const session = {
  sessionId: 'session-user-1', userId: 'user-1', expiresAt: NOW + 60_000,
  projectIds: ['project-1'],
  scopes: ['workspace:read', 'workspace:write', 'workspace:export', 'workspace:delete', 'execution:run', 'debug:use', 'terminal:use']
};
class SessionVerifier { async verify(value) { return value === token ? structuredClone(session) : null; } }
class ReplayStore {
  ids = new Set();
  async claim(id, expiresAt, now) { if (expiresAt <= now || this.ids.has(id)) return false; this.ids.add(id); return true; }
}
class AuditStore { events = []; async append(event) { this.events.push(structuredClone(event)); } }

function makeGateway() {
  const commands = new WorkbenchCommandRegistry();
  let calls = 0;
  commands.register({ id: 'run.project', label: 'Run', group: 'RUN', state: 'BOUND', requiresSelection: false, destructive: false, description: 'Run a project.' }, async input => {
    calls += 1; return { accepted: true, input };
  });
  commands.register({ id: 'project.remove-confirm', label: 'Remove', group: 'PROJECT', state: 'BOUND', requiresSelection: true, destructive: true, description: 'Remove selected files.' }, async input => {
    calls += 1; return { removed: true, input };
  });
  return { commands, calls: () => calls, audit: new AuditStore(), replay: new ReplayStore(), sessions: new SessionVerifier() };
}

test('R10-U01 direct user can use AXON Code command gateway without constructing or calling AXON Brain', async () => {
  const env = makeGateway();
  const gateway = new DirectUserWorkbenchGateway(env.commands, env.sessions, env.replay, env.audit, () => NOW);
  const result = await gateway.dispatch({ sessionToken: token, requestId: 'user-run-1', projectId: 'project-1', commandId: 'run.project', input: { mode: 'preview' } });
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.result.accepted, true);
  assert.equal(env.calls(), 1);
  assert.deepEqual(env.audit.events.map(item => item.phase), ['STARTED', 'COMPLETED']);
});

test('R10-U02 direct user access is not dependent on BrainRequestGate or a Brain result sink', async () => {
  const env = makeGateway();
  const gateway = new DirectUserWorkbenchGateway(env.commands, env.sessions, env.replay, env.audit, () => NOW);
  assert.equal(typeof BrainRequestGate, 'function'); // Brain component exists in the package.
  const result = await gateway.dispatch({ sessionToken: token, requestId: 'user-run-2', projectId: 'project-1', commandId: 'run.project' });
  assert.equal(result.status, 'COMPLETED');
});

test('R10-U03 expired or invalid user session blocks direct operation', async () => {
  const env = makeGateway();
  const verifier = { async verify() { return { ...session, expiresAt: NOW }; } };
  const gateway = new DirectUserWorkbenchGateway(env.commands, verifier, env.replay, env.audit, () => NOW);
  const result = await gateway.dispatch({ sessionToken: token, requestId: 'user-expired', projectId: 'project-1', commandId: 'run.project' });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(env.calls(), 0);
});

test('R10-U04 a user cannot operate on a project outside their verified session', async () => {
  const env = makeGateway();
  const gateway = new DirectUserWorkbenchGateway(env.commands, env.sessions, env.replay, env.audit, () => NOW);
  const result = await gateway.dispatch({ sessionToken: token, requestId: 'user-cross-project', projectId: 'other-project', commandId: 'run.project' });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(env.calls(), 0);
});

test('R10-U05 missing user scope blocks command before dispatch', async () => {
  const env = makeGateway();
  const verifier = { async verify() { return { ...session, scopes: ['workspace:read'] }; } };
  const gateway = new DirectUserWorkbenchGateway(env.commands, verifier, env.replay, env.audit, () => NOW);
  const result = await gateway.dispatch({ sessionToken: token, requestId: 'user-scope', projectId: 'project-1', commandId: 'run.project' });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(env.calls(), 0);
});

test('R10-U06 direct user requests are one-time and replay is rejected', async () => {
  const env = makeGateway();
  const gateway = new DirectUserWorkbenchGateway(env.commands, env.sessions, env.replay, env.audit, () => NOW);
  const request = { sessionToken: token, requestId: 'user-replay', projectId: 'project-1', commandId: 'run.project' };
  assert.equal((await gateway.dispatch(request)).status, 'COMPLETED');
  assert.equal((await gateway.dispatch(request)).status, 'BLOCKED');
  assert.equal(env.calls(), 1);
});

test('R10-U07 destructive direct-user command requires project-specific explicit confirmation', async () => {
  const env = makeGateway();
  const gateway = new DirectUserWorkbenchGateway(env.commands, env.sessions, env.replay, env.audit, () => NOW);
  const base = { sessionToken: token, projectId: 'project-1', commandId: 'project.remove-confirm', input: {} };
  const refused = await gateway.dispatch({ ...base, requestId: 'remove-no-confirm' });
  assert.equal(refused.status, 'BLOCKED');
  const accepted = await gateway.dispatch({ ...base, requestId: 'remove-confirm', confirmation: { approved: true, approvalReference: 'approval-42', confirmationText: 'REMOVE project-1' } });
  assert.equal(accepted.status, 'COMPLETED');
  assert.equal(env.calls(), 1);
});

test('R10-U08 unavailable UI command is reported instead of pretended operational', async () => {
  const env = makeGateway();
  const gateway = new DirectUserWorkbenchGateway(env.commands, env.sessions, env.replay, env.audit, () => NOW);
  const result = await gateway.dispatch({ sessionToken: token, requestId: 'unbound', projectId: 'project-1', commandId: 'project.save' });
  assert.equal(result.status, 'BLOCKED');
  assert.match(result.message, /not registered|not connected/i);
});

test('R10-U09 audit must record STARTED before any direct user side effect', async () => {
  const env = makeGateway();
  const failedAudit = { async append() { throw new Error('audit storage offline'); } };
  const gateway = new DirectUserWorkbenchGateway(env.commands, env.sessions, env.replay, failedAudit, () => NOW);
  const result = await gateway.dispatch({ sessionToken: token, requestId: 'audit-offline', projectId: 'project-1', commandId: 'run.project' });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(env.calls(), 0);
});

test('R10-U10 oversized or non-serialisable user command input is refused', async () => {
  const env = makeGateway();
  const gateway = new DirectUserWorkbenchGateway(env.commands, env.sessions, env.replay, env.audit, () => NOW, 16);
  const result = await gateway.dispatch({ sessionToken: token, requestId: 'oversize', projectId: 'project-1', commandId: 'run.project', input: { data: 'x'.repeat(100) } });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(env.calls(), 0);
});

test('R10-U11 user can open, type into, save and reopen a project document without Brain involvement', async () => {
  const store = new MemoryWorkspaceFileStore();
  await store.write('project-1', 'src/app.js', 'const oldValue = 1;');
  const buffers = new DocumentBufferManager(store);
  const gateway = new DirectUserDocumentGateway(buffers, new SessionVerifier(), () => NOW);
  const opened = await gateway.open(token, 'project-1', 'src/app.js');
  assert.equal(opened.bufferText, 'const oldValue = 1;');
  const staged = await gateway.stageTypedContent({ sessionToken: token, workspaceId: 'project-1', path: 'src/app.js', content: 'const newValue = 2;', approvalReference: 'user-edit-1' });
  assert.equal(staged.source, 'USER');
  assert.equal(staged.dirty, true);
  const saved = await gateway.save({ sessionToken: token, workspaceId: 'project-1', path: 'src/app.js', approved: true, approvalReference: 'user-save-1' });
  assert.equal(saved.dirty, false);
  assert.equal(await store.read('project-1', 'src/app.js'), 'const newValue = 2;');
  await gateway.close(token, 'project-1', 'src/app.js', false);
  const reopened = await gateway.open(token, 'project-1', 'src/app.js');
  assert.equal(reopened.bufferText, 'const newValue = 2;');
});

test('R10-U12 user cannot save a document without write scope and explicit save approval', async () => {
  const store = new MemoryWorkspaceFileStore();
  await store.write('project-1', 'src/app.js', 'const oldValue = 1;');
  const buffers = new DocumentBufferManager(store);
  const readOnly = { async verify() { return { ...session, scopes: ['workspace:read'] }; } };
  const gateway = new DirectUserDocumentGateway(buffers, readOnly, () => NOW);
  const opened = await gateway.open(token, 'project-1', 'src/app.js');
  assert.equal(opened.dirty, false);
  await assert.rejects(() => gateway.stageTypedContent({ sessionToken: token, workspaceId: 'project-1', path: 'src/app.js', content: 'const changed = 2;', approvalReference: 'x' }), /lacks project\/scope access/);
  assert.equal(await store.read('project-1', 'src/app.js'), 'const oldValue = 1;');
});
