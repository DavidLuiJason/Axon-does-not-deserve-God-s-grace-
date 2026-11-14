import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AxonCodeJobGateway, MemoryGatewayStore } from '../src/gateway/jobGateway.mjs';
import { LinuxChildProcessHost } from '../src/jobs/linuxChildProcessHost.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractExamples(markdown) {
  const match = /```json\s*([\s\S]*?)\s*```/.exec(markdown);
  assert.ok(match, 'integration contract must contain an executable JSON example block');
  return JSON.parse(match[1]).examples;
}

async function approvedCall(gateway, template, jobId, workspaceRoot) {
  const request = structuredClone(template);
  delete request.approvalReference;
  const replace = (value) => {
    if (typeof value === 'string') {
      if (value === '$jobId') return jobId;
      if (value === '$NODE_EXECUTABLE') return process.execPath;
      if (value === '$WORKSPACE_ROOT') return workspaceRoot;
      return value;
    }
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
    return value;
  };
  const resolved = replace(request);
  const approvalReference = await gateway.approve(resolved, resolved.scope);
  return gateway.call({ ...resolved, approvalReference });
}

test('Q5 every documented gateway example executes against the real gateway and matches its result contract', async () => {
  const markdown = await readFile(path.join(root, 'docs/AXON_CODE_APP_INTEGRATION.md'), 'utf8');
  const examples = extractExamples(markdown);
  assert.deepEqual(examples.map((row) => row.name), [
    'capabilities.read', 'project.inspect', 'job.submit', 'job.status', 'job.pause', 'job.resume', 'job.cancel', 'job.results', 'workspace.export',
  ]);
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'axon-q5-contract-workspace-'));
  const processHost = new LinuxChildProcessHost({ workspaceRoot, allowedExecutables: [process.execPath], maxTimeMs: 25_000 });
  const store = new MemoryGatewayStore();
  const gateway = new AxonCodeJobGateway({ store, processHost, maxTimeMs: 25_000 });
  let jobId;
  try {
    for (const example of examples) {
      if (example.name === 'job.status' || example.name === 'job.pause' || example.name === 'job.resume' || example.name === 'job.cancel' || example.name === 'job.results') {
        assert.ok(jobId, `${example.name} requires the preceding submit example`);
      }
      if (example.name === 'job.status' || example.name === 'job.pause' || example.name === 'job.resume' || example.name === 'job.cancel') {
        await waitForJob(store, jobId, ['running', 'paused']);
        if (example.name === 'job.pause') await waitForProcess(processHost, jobId);
      }
      const response = await approvedCall(gateway, example.request, jobId, workspaceRoot);
      assert.equal(response.status, example.expectedOuterStatus, `${example.name} outer status`);
      switch (example.expectedResult) {
        case 'capabilities-array':
          assert.ok(response.result.capabilities.includes('job.submit'));
          assert.ok(response.result.capabilities.includes('job.cancel'));
          break;
        case 'provider-blocked-result':
          assert.equal(response.result.status, 'BLOCKED');
          assert.match(response.result.reason, /provider is configured/);
          break;
        case 'job-id-queued':
          assert.equal(response.result.state, 'queued');
          assert.equal(response.result.origin, 'user');
          jobId = response.result.jobId;
          assert.ok(jobId);
          break;
        case 'job-record-running':
          assert.equal(response.result.state, 'running');
          break;
        case 'job-record-paused':
          assert.equal(response.result.state, 'paused');
          break;
        case 'job-record-cancelled':
          assert.equal(response.result.state, 'cancelled');
          break;
        case 'job-results-cancelled':
          assert.equal(response.result.state, 'cancelled');
          assert.equal(typeof response.result.outputBytes, 'number');
          break;
        default: throw new Error(`Unknown expected result: ${example.expectedResult}`);
      }
    }
    assert.equal(store.audit.length, examples.length);
  } finally {
    await processHost.stopAll();
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

async function waitForProcess(processHost, id) {
  const until = Date.now() + 4000;
  while (Date.now() < until) {
    if (processHost.children.has(id)) return;
    await delay(10);
  }
  throw new Error(`PROCESS_START_TIMEOUT:${id}`);
}

async function waitForJob(store, id, states) {
  const until = Date.now() + 4000;
  while (Date.now() < until) {
    const job = await store.get(`job/${id}`);
    if (job && states.includes(job.state)) return job;
    await delay(10);
  }
  throw new Error(`JOB_STATE_TIMEOUT:${id}`);
}

test('Q5 screen contract includes every source and built UI element id and all status states', async () => {
  const contract = JSON.parse(await readFile(path.join(root, 'docs/AXON_CODE_SCREEN_CONTRACT.json'), 'utf8'));
  const source = await readFile(path.join(root, 'ui/index.html'), 'utf8');
  const built = await readFile(path.join(root, 'build/ui/index.html'), 'utf8');
  const ids = new Set([...source.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  const builtIds = new Set([...built.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  const contractIds = contract.elements.map((row) => row.id);
  assert.equal(new Set(contractIds).size, contractIds.length, 'contract element IDs must be unique');
  assert.deepEqual([...ids].sort(), [...contractIds].sort(), 'contract must enumerate every source HTML id');
  for (const row of contract.elements) {
    assert.ok(builtIds.has(row.id), `built UI is missing ${row.id}`);
    assert.equal(typeof row.command, 'string');
    for (const status of ['TESTED', 'BUILT', 'BLOCKED', 'NOT RUN', 'NOT IMPLEMENTED']) {
      assert.ok(row.states[status], `${row.id} lacks a ${status} state`);
      assert.ok(['enabled', 'disabled', 'hidden'].includes(row.states[status].state));
      if (row.states[status].state !== 'enabled') assert.ok(row.states[status].reason);
    }
  }
  for (const command of contract.commands) assert.ok(ids.has(command.elementId), `command ${command.id} references a missing element`);
});

test('Q5 integration contract documents all lifecycle states, errors and OPEN capability mappings', async () => {
  const markdown = await readFile(path.join(root, 'docs/AXON_CODE_APP_INTEGRATION.md'), 'utf8');
  for (const state of ['queued', 'running', 'paused', 'completed', 'failed', 'cancelled', 'interrupted']) assert.match(markdown, new RegExp(`\\b${state}\\b`));
  for (const code of ['INVALID_REQUEST', 'UNKNOWN_OPERATION', 'APPROVAL_INVALID', 'APPROVAL_SCOPE_MISMATCH', 'PERMISSION_DENIED', 'QUOTA_EXCEEDED', 'JOB_QUEUE_FULL', 'JOB_NOT_FOUND', 'OWNER_MISMATCH', 'INVALID_STATE', 'GATEWAY_ERROR', 'NO_EXECUTION_PROVIDER', 'TIME_LIMIT', 'OUTPUT_LIMIT', 'EXECUTABLE_NOT_ALLOWED', 'PROCESS_CWD_OUTSIDE_WORKSPACE', 'INVALID_PROCESS_ARGUMENTS', 'DUPLICATE_PROCESS_JOB']) assert.match(markdown, new RegExp(code));
  assert.match(markdown, /\| OPEN \|/);
  assert.match(markdown, /single-use|one-use/);
});

test('Q5 integration examples cannot replay an approval or alter a documented request payload', async () => {
  const store = new MemoryGatewayStore();
  const gateway = new AxonCodeJobGateway({ store });
  const base = {
    protocolVersion: '1', requestId: 'q5-replay', auditId: 'q5-audit',
    callerContext: { callerId: 'alice', sessionId: 'session', authority: 'USER' },
    scope: { projectId: 'p1', workspaceId: 'w1', permissions: ['project.inspect'] },
    operation: 'project.inspect', payload: {},
  };
  const approvalReference = await gateway.approve(base, base.scope);
  const approved = { ...base, approvalReference };
  assert.equal((await gateway.call(approved)).status, 'COMPLETED');
  assert.equal((await gateway.call(approved)).code, 'APPROVAL_INVALID');
  const second = await gateway.approve(base, base.scope);
  assert.equal((await gateway.call({ ...base, payload: { changed: true }, approvalReference: second })).code, 'APPROVAL_INVALID');
});

test('Q5 real compiled gateway mutant removing approval scope binding is caught', async () => {
  const { compileRealModuleMutant } = await import('./helpers/r14-mutant.mjs');
  const needle = 'return approval.scope.projectId === request.scope.projectId && approval.scope.workspaceId === request.scope.workspaceId;';
  const mutant = await compileRealModuleMutant('src/gateway/jobGateway.mjs', needle, 'return true;');
  try {
    const gateway = new mutant.module.AxonCodeJobGateway({ store: new mutant.module.MemoryGatewayStore() });
    const base = {
      protocolVersion: '1', requestId: 'q5-scope-mutant', auditId: 'q5-audit',
      callerContext: { callerId: 'alice', sessionId: 'session', authority: 'USER' },
      scope: { projectId: 'p2', workspaceId: 'w2', permissions: ['project.inspect'] },
      operation: 'project.inspect', payload: {},
    };
    const approvalReference = await gateway.approve(base, { projectId: 'p1', workspaceId: 'w1' });
    let detected = false;
    try { assert.equal((await gateway.call({ ...base, approvalReference })).code, 'APPROVAL_SCOPE_MISMATCH'); }
    catch { detected = true; }
    assert.equal(detected, true, 'the project/workspace approval-binding assertion must fail against the mutant');
  } finally { await mutant.cleanup(); }
});
