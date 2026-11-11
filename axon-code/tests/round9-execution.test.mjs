import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TerminalSessionManager, BuildOrchestrator, DebugSessionManager,
  SandboxedLanguageRuntimeAdapter, SANDBOXED_LANGUAGE_PROFILES
} from '../dist/index.js';

const safeProcessProbe = () => ({ available: true, platform: 'linux', executable: '/usr/bin/provider', isolationConfirmed: true, networkBlocked: true, filesystemIsolated: true, memoryLimitEnforced: true, timeLimitEnforced: true, unprivilegedIdentity: true, childProcessConfinement: true, notes: [] });
const safePtyProbe = () => ({ available: true, isolationConfirmed: true, filesystemIsolated: true, networkPolicyEnforced: true, memoryLimitEnforced: true, timeLimitEnforced: true, outputLimitEnforced: true, unprivilegedIdentity: true, processTreeConfinement: true, notes: [] });
const processResult = (overrides = {}) => ({ exitCode: 0, stdout: 'ok', stderr: '', elapsedMs: 5, timedOut: false, cancelled: false, outputTruncated: false, ...overrides });

 test('R9 TerminalSessionManager requires all host isolation guarantees before launch', async () => {
  let starts = 0;
  const host = { probe: async () => ({ ...safePtyProbe(), processTreeConfinement: false }), start: async () => { starts++; return { sessionToken: 't' }; }, write: async () => {}, resize: async () => {}, close: async () => {} };
  const manager = new TerminalSessionManager(host, { maxSessions: 2, maxSessionMs: 10_000, maxOutputBytes: 1024, allowedShells: ['bash'], allowedEnvironment: ['PATH'] });
  await assert.rejects(manager.open({ projectId: 'p', shellId: 'bash', workingDirectoryToken: 'cwd', approval: { approved: true, approvalReference: 'ok', allowNetwork: false } }), /isolation/i);
  assert.equal(starts, 0);
});

test('R9 TerminalSessionManager controls approved PTY sessions, input, resize and close', async () => {
  const calls = [];
  const host = { probe: async () => safePtyProbe(), start: async (input) => { calls.push(input); return { sessionToken: 'terminal-token', processId: '44' }; }, write: async (_token, input) => calls.push(input), resize: async (_token, c, r) => calls.push([c, r]), close: async () => { calls.push('closed'); } };
  const manager = new TerminalSessionManager(host, { maxSessions: 1, maxSessionMs: 10000, maxOutputBytes: 1024, allowedShells: ['bash'], allowedEnvironment: ['PATH'] });
  const session = await manager.open({ projectId: 'p', shellId: 'bash', workingDirectoryToken: 'cwd-token', environment: { PATH: '/usr/bin' }, approval: { approved: true, approvalReference: 'user-ok', allowNetwork: false } });
  assert.equal(session.state, 'OPEN');
  assert.equal(session.outputStreamingAvailable, false);
  await assert.rejects(manager.open({ projectId: 'p', shellId: 'bash', workingDirectoryToken: 'cwd', approval: { approved: true, approvalReference: 'x', allowNetwork: false } }), /limit/);
  await manager.write(session.id, 'pwd\n');
  await manager.resize(session.id, 100, 30);
  await assert.rejects(manager.write(session.id, '\0'), /NUL/);
  await assert.rejects(manager.resize(session.id, 2, 2), /dimensions/);
  await manager.close(session.id);
  assert.equal(manager.list()[0].state, 'CLOSED');
  assert.ok(calls.includes('closed'));
});

test('R9 TerminalSessionManager streams bounded output and records process exit', async () => {
  let emit;
  let unsubscribed = false;
  const host = { probe: async () => safePtyProbe(), start: async () => ({ sessionToken: 't' }), write: async () => {}, resize: async () => {}, close: async () => {}, subscribe: (_token, handler) => { emit = handler; return () => { unsubscribed = true; }; } };
  const manager = new TerminalSessionManager(host, { maxSessions: 1, maxSessionMs: 5000, maxOutputBytes: 5, allowedShells: ['bash'], allowedEnvironment: [] });
  const session = await manager.open({ projectId: 'p', shellId: 'bash', workingDirectoryToken: 'cwd', approval: { approved: true, approvalReference: 'ok', allowNetwork: false } });
  emit({ type: 'output', data: 'hello🌍' });
  const snapshot = manager.readOutput(session.id);
  assert.equal(snapshot.outputBytes, 5);
  assert.equal(snapshot.text, 'hello');
  assert.equal(snapshot.truncated, true);
  emit({ type: 'exit', exitCode: 0 });
  assert.equal(manager.list()[0].state, 'CLOSED');
  assert.equal(manager.readOutput(session.id).exitCode, 0);
  assert.equal(unsubscribed, true);
});

test('R9 TerminalSessionManager rejects unapproved shell, forbidden environment and excess sessions', async () => {
  const host = { probe: async () => safePtyProbe(), start: async () => ({ sessionToken: 't' }), write: async () => {}, resize: async () => {}, close: async () => {} };
  const manager = new TerminalSessionManager(host, { maxSessions: 1, maxSessionMs: 5000, maxOutputBytes: 1024, allowedShells: ['bash'], allowedEnvironment: ['PATH'] });
  await assert.rejects(manager.open({ projectId: 'p', shellId: 'sh', workingDirectoryToken: 'cwd', approval: { approved: true, approvalReference: 'ok', allowNetwork: false } }), /not allowed/);
  await assert.rejects(manager.open({ projectId: 'p', shellId: 'bash', workingDirectoryToken: 'cwd', environment: { EVIL: 'x' }, approval: { approved: true, approvalReference: 'ok', allowNetwork: false } }), /not permitted/);
  await assert.rejects(manager.open({ projectId: 'p', shellId: 'bash', workingDirectoryToken: 'cwd', approval: { approved: false, approvalReference: '', allowNetwork: false } }), /approv/i);
});

test('R9 BuildOrchestrator runs a dependency DAG using exact toolchain identity and verifies artifacts', async () => {
  const calls = [];
  const hash = 'a'.repeat(64);
  const host = { probe: async () => safeProcessProbe(), probeExecutable: async () => ({ available: true, approved: true, sha256: hash, version: '1.0.0' }), run: async (input) => { calls.push(input); return processResult(); } };
  const artifacts = { verify: async (id) => ({ valid: true, sizeBytes: 20, sha256: 'b'.repeat(64), notes: [] }) };
  const build = new BuildOrchestrator(host, artifacts);
  build.registerToolchain({ id: 'tsc', executable: '/opt/tsc', host: 'linux', purpose: 'BUILD', languages: ['typescript'], available: true, hostApproved: true, version: '1.0.0', executableSha256: hash });
  build.registerToolchain({ id: 'node-test', executable: '/opt/node', host: 'linux', purpose: 'TEST', languages: ['typescript'], available: true, hostApproved: true, version: '1.0.0', executableSha256: hash });
  const result = await build.run({ id: 'profile', projectId: 'p', workingDirectoryToken: 'work-token', networkAllowed: false, fileAccess: 'WORKING_COPY_ONLY', tasks: [
    { id: 'compile', toolchainId: 'tsc', args: ['--build'], dependsOn: [], timeoutMs: 1000, maxOutputBytes: 1024, expectedArtifactIds: ['dist-main'] },
    { id: 'test', toolchainId: 'node-test', args: ['--test'], dependsOn: ['compile'], timeoutMs: 1000, maxOutputBytes: 1024 }
  ] }, true);
  assert.equal(result.status, 'BUILT_AND_VERIFIED');
  assert.equal(calls.length, 2);
  assert.equal(result.verifiedArtifacts.length, 1);
  assert.equal(calls[0].networkAllowed, false);
});

test('R9 BuildOrchestrator blocks missing sandbox, executable mismatch, version mismatch and output truncation', async () => {
  const hash = 'a'.repeat(64);
  const artifacts = { verify: async () => ({ valid: true, sizeBytes: 1, sha256: 'b'.repeat(64), notes: [] }) };
  const baseHost = { probe: async () => safeProcessProbe(), probeExecutable: async () => ({ available: true, approved: true, sha256: hash, version: '2.0' }), run: async () => processResult({ outputTruncated: true }) };
  const build = new BuildOrchestrator(baseHost, artifacts);
  build.registerToolchain({ id: 'gcc', executable: '/usr/bin/gcc', host: 'linux', purpose: 'TEST', languages: ['cpp'], available: true, hostApproved: true, version: '1.0', executableSha256: hash });
  const profile = { id: 'p', projectId: 'p', workingDirectoryToken: 'w', networkAllowed: false, fileAccess: 'WORKING_COPY_ONLY', tasks: [{ id: 'test1', toolchainId: 'gcc', args: [], dependsOn: [], timeoutMs: 100, maxOutputBytes: 10 }] };
  const mismatch = await build.run(profile, true);
  assert.equal(mismatch.status, 'BLOCKED');
  const versionCorrectHost = { ...baseHost, probeExecutable: async () => ({ available: true, approved: true, sha256: hash, version: '1.0' }) };
  const build2 = new BuildOrchestrator(versionCorrectHost, artifacts);
  build2.registerToolchain({ id: 'gcc', executable: '/usr/bin/gcc', host: 'linux', purpose: 'TEST', languages: ['cpp'], available: true, hostApproved: true, version: '1.0', executableSha256: hash });
  const truncated = await build2.run(profile, true);
  assert.equal(truncated.status, 'BUILD_FAILED');
});

test('R9 BuildOrchestrator rejects cycles, missing dependencies, unsafe artifact identifiers and unapproved tasks', async () => {
  const host = { probe: async () => safeProcessProbe(), probeExecutable: async () => ({ available: true, approved: true, sha256: 'a'.repeat(64), version: '1' }), run: async () => processResult() };
  const build = new BuildOrchestrator(host, { verify: async () => ({ valid: true, sizeBytes: 1, sha256: 'b'.repeat(64), notes: [] }) });
  const cycle = await build.run({ projectId: 'p', workingDirectoryToken: 'w', networkAllowed: false, fileAccess: 'WORKING_COPY_ONLY', tasks: [ { id: 'a', toolchainId: 'x', args: [], dependsOn: ['b'], timeoutMs: 1, maxOutputBytes: 1 }, { id: 'b', toolchainId: 'x', args: [], dependsOn: ['a'], timeoutMs: 1, maxOutputBytes: 1 } ] }, true);
  assert.equal(cycle.status, 'BLOCKED');
  const invalid = await build.run({ projectId: 'p', workingDirectoryToken: 'w', networkAllowed: false, fileAccess: 'WORKING_COPY_ONLY', tasks: [ { id: 'a', toolchainId: 'x', args: [], dependsOn: [], timeoutMs: 1, maxOutputBytes: 1, expectedArtifactIds: ['../escape'] } ] }, true);
  assert.equal(invalid.status, 'BLOCKED');
  const unapproved = await build.run({ projectId: 'p', workingDirectoryToken: 'w', networkAllowed: false, fileAccess: 'WORKING_COPY_ONLY', tasks: [{ id: 'a', toolchainId: 'x', args: [], dependsOn: [], timeoutMs: 1, maxOutputBytes: 1 }] }, false);
  assert.equal(unapproved.status, 'BLOCKED');
});

test('R9 Python, C++ and Rust runtime profiles remain blocked without concrete strict host providers', async () => {
  const host = { probe: async () => ({ ...safeProcessProbe(), childProcessConfinement: false }), probeExecutable: async () => ({ available: false, approved: false, sha256: '', version: '' }), run: async () => processResult() };
  const overlays = { createIsolatedOverlay: async () => ({ workingDirectoryToken: 'overlay', cleanup: async () => {} }) };
  for (const profile of SANDBOXED_LANGUAGE_PROFILES) {
    const runtime = new SandboxedLanguageRuntimeAdapter(profile, host, overlays);
    assert.equal(await runtime.initialize(), false);
    assert.equal(runtime.descriptor.available, false);
  }
});

test('R9 Python runtime adapter uses a per-run isolated overlay and enforces cleanup', async () => {
  const calls = [];
  const host = { probe: async () => safeProcessProbe(), probeExecutable: async (executable) => ({ available: true, approved: true, sha256: 'a'.repeat(64), version: '3.12' }), run: async (request) => { calls.push(request); return processResult({ stdout: '42' }); } };
  let cleaned = 0;
  const overlays = { createIsolatedOverlay: async () => ({ workingDirectoryToken: 'ephemeral-overlay', cleanup: async () => { cleaned++; } }) };
  const profile = SANDBOXED_LANGUAGE_PROFILES.find((item) => item.id === 'python-cpython');
  const runtime = new SandboxedLanguageRuntimeAdapter(profile, host, overlays);
  assert.equal(await runtime.initialize(), true);
  const result = await runtime.execute({ requestId: 'run-1', projectId: 'p', entryFiles: ['main.py'], runtimeId: profile.id, mode: 'FULL_LOCAL', timeoutMs: 5000, outputLimitBytes: 1000, networkAllowed: false, fileAccess: 'working-copy' });
  assert.equal(result.status, 'completed');
  assert.deepEqual(calls[0].args.slice(0, 3), ['-I', '-B', 'main.py']);
  assert.equal(calls[0].workingDirectoryToken, 'ephemeral-overlay');
  assert.equal(cleaned, 1);
});

test('R9 C++ runtime does not execute after failed or truncated compilation', async () => {
  let count = 0;
  const host = { probe: async () => safeProcessProbe(), probeExecutable: async () => ({ available: true, approved: true, sha256: 'a'.repeat(64), version: '18' }), run: async () => { count++; return processResult({ exitCode: 1, stderr: 'compile error' }); } };
  const overlays = { createIsolatedOverlay: async () => ({ workingDirectoryToken: 'overlay', cleanup: async () => {} }) };
  const profile = SANDBOXED_LANGUAGE_PROFILES.find((item) => item.id === 'cpp-clang');
  const runtime = new SandboxedLanguageRuntimeAdapter(profile, host, overlays);
  assert.equal(await runtime.initialize(), true);
  const result = await runtime.execute({ requestId: 'cpp-1', projectId: 'p', entryFiles: ['main.cpp'], runtimeId: profile.id, mode: 'FULL_LOCAL', timeoutMs: 5000, outputLimitBytes: 100, networkAllowed: false, fileAccess: 'working-copy' });
  assert.equal(result.status, 'failed');
  assert.equal(count, 1);
});

test('R9 DebugSessionManager requires an isolated adapter and validates command sequence', async () => {
  const bridge = { probe: async () => ({ available: true, sandboxed: true, filesystemScoped: true, networkBlocked: true, memoryLimited: true, timeLimited: true, unprivileged: true, processTreeConfinement: true, notes: [] }),
    start: async () => ({ sessionToken: 'debug-token', capabilities: ['supportsStepIn'] }), request: async (_token, input) => ({ requestSeq: input.seq, success: true, body: { ok: true } }), close: async () => {} };
  const manager = new DebugSessionManager(bridge, ['python']);
  const session = await manager.start({ debugType: 'python', programToken: 'program', cwdToken: 'cwd', approved: true });
  assert.equal(session.state, 'STOPPED');
  const result = await manager.command(session.id, 'stackTrace', { threadId: 1 });
  assert.equal(result.success, true);
  await manager.setBreakpoints(session.id, { sourceToken: 'main.py', lines: [1, 4] });
  await manager.close(session.id);
  assert.equal(manager.get(session.id).state, 'CLOSED');
});

test('R9 DebugSessionManager blocks unregistered, unapproved and non-isolated debug providers', async () => {
  const bridge = { probe: async () => ({ available: true, sandboxed: true, filesystemScoped: true, networkBlocked: true, memoryLimited: true, timeLimited: true, unprivileged: true, processTreeConfinement: false, notes: [] }), start: async () => ({ sessionToken: 't', capabilities: [] }), request: async (_t, i) => ({ requestSeq: i.seq, success: true }), close: async () => {} };
  const manager = new DebugSessionManager(bridge, ['python']);
  await assert.rejects(manager.start({ debugType: 'python', programToken: 'p', cwdToken: 'c', approved: true }), /isolat/i);
  await assert.rejects(manager.start({ debugType: 'rust', programToken: 'p', cwdToken: 'c', approved: true }), /not registered/);
  await assert.rejects(manager.start({ debugType: 'python', programToken: 'p', cwdToken: 'c', approved: false }), /approv/i);
});

test('R9 DebugSessionManager marks a session failed when adapter sequence is inconsistent', async () => {
  const bridge = { probe: async () => ({ available: true, sandboxed: true, filesystemScoped: true, networkBlocked: true, memoryLimited: true, timeLimited: true, unprivileged: true, processTreeConfinement: true, notes: [] }), start: async () => ({ sessionToken: 't', capabilities: [] }), request: async () => ({ requestSeq: 999, success: true }), close: async () => {} };
  const manager = new DebugSessionManager(bridge, ['cpp']);
  const session = await manager.start({ debugType: 'cpp', programToken: 'p', cwdToken: 'c', approved: true });
  await assert.rejects(manager.command(session.id, 'next', { threadId: 1 }), /sequence/);
  assert.equal(manager.get(session.id).state, 'FAILED');
});
