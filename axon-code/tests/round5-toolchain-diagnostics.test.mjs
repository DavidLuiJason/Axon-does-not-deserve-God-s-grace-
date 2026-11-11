import test from 'node:test';
import assert from 'node:assert/strict';
import { parseToolchainDiagnostics, assessRuntimeReadiness } from '../dist/index.js';

const completeSandbox = {
  available: true, platform: 'linux', executable: '/opt/axon/sandbox-host',
  isolationConfirmed: true, networkBlocked: true, filesystemIsolated: true,
  memoryLimitEnforced: true, timeLimitEnforced: true, unprivilegedIdentity: true, notes: ['verified test fixture']
};

test('R5-DIAG-001 parses a Python NameError traceback and preserves a known source line', () => {
  const output = 'Traceback (most recent call last):\n  File "/tmp/job/src/main.py", line 7, in <module>\n    print(missing)\nNameError: name \'missing\' is not defined\n';
  const [d] = parseToolchainDiagnostics({ language: 'python', requestedFile: 'src/main.py', output });
  assert.equal(d.code, 'PYTHON_NAMEERROR');
  assert.equal(d.location.file, 'src/main.py');
  assert.equal(d.location.line, 7);
  assert.equal(d.confidence, 'high');
});

test('R5-DIAG-002 does not invent a column for a Python runtime traceback', () => {
  const [d] = parseToolchainDiagnostics({ language: 'python', requestedFile: 'app.py', output: 'File "app.py", line 3, in <module>\nValueError: bad value' });
  assert.equal(d.location.line, 3);
  assert.equal(d.location.column, undefined);
});

test('R5-DIAG-003 parses a Python SyntaxError position when a caret is supplied', () => {
  const output = '  File "app.py", line 2\n    print(\n         ^\nSyntaxError: unexpected EOF while parsing';
  const [d] = parseToolchainDiagnostics({ language: 'python', requestedFile: 'app.py', output });
  assert.equal(d.code, 'PYTHON_SYNTAX_ERROR');
  assert.equal(d.location.line, 2);
  assert.equal(d.location.column, 10);
});

test('R5-DIAG-004 maps Python module import failures to a runtime error', () => {
  const [d] = parseToolchainDiagnostics({ language: 'python', requestedFile: 'main.py', output: 'ModuleNotFoundError: No module named \'not_installed\'' });
  assert.equal(d.code, 'PYTHON_MODULENOTFOUNDERROR');
  assert.equal(d.stage, 'runtime');
});

test('R5-DIAG-005 does not expose an absolute host path from Python traceback output', () => {
  const [d] = parseToolchainDiagnostics({ language: 'python', requestedFile: 'main.py', output: 'File "/home/private/user/main.py", line 3, in <module>\nNameError: x' });
  assert.equal(d.location.file, 'main.py');
  assert.equal(JSON.stringify(d).includes('/home/private'), false);
});

test('R5-DIAG-006 rejects a requested path traversal before parsing', () => {
  assert.throws(() => parseToolchainDiagnostics({ language: 'python', requestedFile: '../secret.py', output: 'NameError: x' }), /safe project-relative path/);
});

test('R5-DIAG-007 parses GCC error code location and severity', () => {
  const [d] = parseToolchainDiagnostics({ language: 'cpp', requestedFile: 'src/main.cpp', output: 'src/main.cpp:4:12: error: \'unknown_symbol\' was not declared in this scope' });
  assert.equal(d.code, 'CPP_COMPILER_ERROR');
  assert.equal(d.severity, 'error');
  assert.deepEqual(d.location, { file: 'src/main.cpp', line: 4, column: 12 });
});

test('R5-DIAG-008 parses GCC warnings distinctly from errors', () => {
  const [d] = parseToolchainDiagnostics({ language: 'cpp', requestedFile: 'main.cpp', output: 'main.cpp:9:2: warning: unused variable \'x\' [-Wunused-variable]' });
  assert.equal(d.severity, 'warning');
  assert.equal(d.code, 'CPP_COMPILER_WARNING');
});

test('R5-DIAG-009 parses compiler fatal errors', () => {
  const [d] = parseToolchainDiagnostics({ language: 'cpp', requestedFile: 'main.cpp', output: 'main.cpp:1:1: fatal error: missing.hpp: No such file or directory' });
  assert.equal(d.severity, 'error');
  assert.equal(d.code, 'CPP_COMPILER_ERROR');
});

test('R5-DIAG-010 ignores GCC locations that cannot be mapped to the requested workspace file', () => {
  const [d] = parseToolchainDiagnostics({ language: 'cpp', requestedFile: 'src/main.cpp', output: '/etc/passwd:2:3: error: invalid input' });
  assert.equal(d.location, undefined);
  assert.equal(JSON.stringify(d).includes('/etc/passwd'), false);
});

test('R5-DIAG-011 parses rustc diagnostic code and source position', () => {
  const output = 'error[E0425]: cannot find value `missing` in this scope\n --> src/main.rs:8:9\n';
  const [d] = parseToolchainDiagnostics({ language: 'rust', requestedFile: 'src/main.rs', output });
  assert.equal(d.code, 'RUSTC_E0425');
  assert.equal(d.location.line, 8);
  assert.equal(d.location.column, 9);
});

test('R5-DIAG-012 parses Rust warnings as warnings', () => {
  const [d] = parseToolchainDiagnostics({ language: 'rust', requestedFile: 'src/lib.rs', output: 'warning: unused variable: `x`\n --> src/lib.rs:3:5' });
  assert.equal(d.severity, 'warning');
  assert.equal(d.location.line, 3);
});

test('R5-DIAG-013 handles Rust diagnostics without location without inventing one', () => {
  const [d] = parseToolchainDiagnostics({ language: 'rust', requestedFile: 'src/lib.rs', output: 'error: could not compile `sample` due to previous error' });
  assert.equal(d.location, undefined);
  assert.equal(d.confidence, 'medium');
});

test('R5-DIAG-014 bounds diagnostic output input', () => {
  assert.throws(() => parseToolchainDiagnostics({ language: 'cpp', requestedFile: 'main.cpp', output: '', maxOutputChars: 0 }), /between 1 byte and 2 MiB/);
});

test('R5-DIAG-015 caps output before parsing and does not return unbounded content', () => {
  const d = parseToolchainDiagnostics({ language: 'cpp', requestedFile: 'main.cpp', output: 'x'.repeat(10000), maxOutputChars: 64 });
  assert.equal(d.length, 0);
});

test('R5-DIAG-016 diagnostic IDs are stable for the same compiler finding', () => {
  const input = { language: 'cpp', requestedFile: 'main.cpp', output: 'main.cpp:2:4: error: bad token' };
  assert.equal(parseToolchainDiagnostics(input)[0].id, parseToolchainDiagnostics(input)[0].id);
});

test('R5-DIAG-017 deduplicates repeated compiler diagnostics', () => {
  const output = 'main.cpp:2:4: error: bad token\nmain.cpp:2:4: error: bad token';
  assert.equal(parseToolchainDiagnostics({ language: 'cpp', requestedFile: 'main.cpp', output }).length, 1);
});

test('R5-READY-001 blocks Python when toolchain is absent', () => {
  const report = assessRuntimeReadiness({ runtimeId: 'python', host: 'linux', implementationPresent: true, toolchainAvailable: false, providerConnected: true, sandboxProbe: completeSandbox, endToEndEvidence: true });
  assert.equal(report.state, 'MISSING_DEPENDENCY');
  assert.equal(report.canExecuteUserProject, false);
});

test('R5-READY-002 blocks C++ when the compiler exists but no execution provider is connected', () => {
  const report = assessRuntimeReadiness({ runtimeId: 'cpp', host: 'linux', implementationPresent: true, toolchainAvailable: true, providerConnected: false, sandboxProbe: completeSandbox, endToEndEvidence: true });
  assert.equal(report.state, 'ADAPTER_REQUIRED');
  assert.equal(report.canExecuteUserProject, false);
});

test('R5-READY-003 blocks Rust even with a provider when no rustc is available', () => {
  const report = assessRuntimeReadiness({ runtimeId: 'rust', host: 'linux', implementationPresent: true, toolchainAvailable: false, providerConnected: true, sandboxProbe: completeSandbox, endToEndEvidence: false });
  assert.equal(report.state, 'MISSING_DEPENDENCY');
});

test('R5-READY-004 blocks execution when network denial is not attested', () => {
  const report = assessRuntimeReadiness({ runtimeId: 'python', host: 'linux', implementationPresent: true, toolchainAvailable: true, providerConnected: true, sandboxProbe: { ...completeSandbox, networkBlocked: false }, endToEndEvidence: true });
  assert.equal(report.state, 'BLOCKED');
});

test('R5-READY-005 blocks execution when filesystem isolation is not attested', () => {
  const report = assessRuntimeReadiness({ runtimeId: 'python', host: 'linux', implementationPresent: true, toolchainAvailable: true, providerConnected: true, sandboxProbe: { ...completeSandbox, filesystemIsolated: false }, endToEndEvidence: true });
  assert.equal(report.state, 'BLOCKED');
});

test('R5-READY-006 blocks execution when RAM and time limits are not both enforced', () => {
  for (const patch of [{ memoryLimitEnforced: false }, { timeLimitEnforced: false }]) {
    const report = assessRuntimeReadiness({ runtimeId: 'cpp', host: 'linux', implementationPresent: true, toolchainAvailable: true, providerConnected: true, sandboxProbe: { ...completeSandbox, ...patch }, endToEndEvidence: true });
    assert.equal(report.state, 'BLOCKED');
  }
});

test('R5-READY-007 distinguishes ready-for-validation from available', () => {
  const report = assessRuntimeReadiness({ runtimeId: 'python', host: 'linux', implementationPresent: true, toolchainAvailable: true, providerConnected: true, sandboxProbe: completeSandbox, endToEndEvidence: false });
  assert.equal(report.state, 'READY_FOR_VALIDATION');
  assert.equal(report.canExecuteUserProject, false);
});

test('R5-READY-008 requires implementation and all gates before availability', () => {
  const report = assessRuntimeReadiness({ runtimeId: 'android', host: 'android', implementationPresent: false, toolchainAvailable: true, providerConnected: true, sandboxProbe: completeSandbox, endToEndEvidence: true });
  assert.equal(report.state, 'NOT_IMPLEMENTED');
  assert.equal(report.canExecuteUserProject, false);
});

test('R5-READY-009 only complete isolated end-to-end provider can become available', () => {
  const report = assessRuntimeReadiness({ runtimeId: 'python', host: 'linux', implementationPresent: true, toolchainAvailable: true, providerConnected: true, sandboxProbe: completeSandbox, endToEndEvidence: true });
  assert.equal(report.state, 'AVAILABLE');
  assert.equal(report.canExecuteUserProject, true);
});

test('R5-READY-010 rejects empty runtime identity', () => {
  assert.throws(() => assessRuntimeReadiness({ runtimeId: ' ', host: 'linux', implementationPresent: true, toolchainAvailable: true, providerConnected: true, sandboxProbe: completeSandbox, endToEndEvidence: true }), /Runtime identity/);
});
