import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { TypeScriptProjectDiagnostics } from '../dist/analysis/typescriptProjectDiagnostics.js';
import { NodeInspectorDebugAdapter } from '../dist/debug/nodeInspectorAdapter.js';
import { RealNodeInspectorHost } from './helpers/node-inspector-host.mjs';

const corpus = JSON.parse(await fs.readFile(new URL('./fixtures/r14/typescript-golden-corpus.json', import.meta.url), 'utf8'));
const diagnostics = new TypeScriptProjectDiagnostics();

for (const project of corpus.projects) {
  test(`WP10 TypeScript golden project ${project.id}`, () => {
    const result = diagnostics.analyzeProject({ projectId: project.id, files: project.files, ...(project.tsconfig !== undefined ? { tsconfig: project.tsconfig } : {}) });
    assert.equal(result.projectId, project.id);
    assert.equal(result.compilerVersion, '5.8.3');
    if (project.expectedCodes.length === 0) {
      assert.equal(result.success, true, JSON.stringify(result.diagnostics));
      assert.equal(result.diagnostics.length, 0);
    } else {
      assert.equal(result.success, false, `expected a compiler diagnostic for ${project.id}`);
      const actualCodes = new Set(result.diagnostics.map(item => item.code));
      assert.ok(project.expectedCodes.some(code => actualCodes.has(code)), `expected one of ${project.expectedCodes}; received ${[...actualCodes]}`);
    }
  });
}

test('WP10 NEGATIVE: virtual TypeScript compiler refuses path traversal', () => {
  assert.throws(() => diagnostics.analyzeProject({ projectId: 'traversal', files: { '../host.ts': 'export {}' } }), /unsafe path/);
});

test('WP10 NEGATIVE: virtual TypeScript compiler refuses more than 256 files', () => {
  const files = Object.fromEntries(Array.from({ length: 257 }, (_, index) => [`src/${index}.ts`, 'export {};']));
  assert.throws(() => diagnostics.analyzeProject({ projectId: 'too-many', files }), /256-file limit/);
});

test('WP10 NEGATIVE: virtual TypeScript compiler refuses a source file above 2 MiB', () => {
  assert.throws(() => diagnostics.analyzeProject({ projectId: 'too-large', files: { 'main.ts': `//${'x'.repeat(2 * 1024 * 1024 + 1)}` } }), /8 MiB source limit/);
});

test('WP10 NEGATIVE: virtual TypeScript compiler refuses oversized tsconfig', () => {
  assert.throws(() => diagnostics.analyzeProject({ projectId: 'large-config', files: { 'main.ts': 'export {}' }, tsconfig: ' '.repeat(64 * 1024 + 1) }), /64 KiB limit/);
});

test('WP10 NEGATIVE (real mutant): removing the compiled source-size guard accepts oversized project input', async () => {
  const compiledUrl = new URL('../dist/analysis/typescriptProjectDiagnostics.js', import.meta.url);
  const compiled = await fs.readFile(compiledUrl, 'utf8');
  const guard = 'if (size > MAX_FILE_BYTES || (totalBytes += size) > MAX_TOTAL_BYTES)';
  assert.ok(compiled.includes(guard), 'the mutant must alter the real compiled TypeScript diagnostics module');
  const mutantPath = path.join(path.dirname(fileURLToPath(compiledUrl)), `typescriptProjectDiagnostics-mutant-${process.pid}.mjs`);
  await fs.writeFile(mutantPath, compiled.replace(guard, 'if (false)'));
  try {
    const { TypeScriptProjectDiagnostics: MutantDiagnostics } = await import(`${pathToFileURL(mutantPath).href}?mutant=${process.pid}`);
    const large = { projectId: 'large-mutant', files: { 'main.ts': `//${'x'.repeat(2 * 1024 * 1024 + 1)}` } };
    assert.throws(() => diagnostics.analyzeProject(large), /8 MiB source limit/);
    const mutantResult = new MutantDiagnostics().analyzeProject(large);
    assert.equal(mutantResult.success, true);
  } finally { await fs.rm(mutantPath, { force: true }); }
});

function targetScript() {
  return [
    'const add = (x) => {',
    '  const y = x + 1;',
    '  return y;',
    '};',
    'function main() {',
    '  const input = 40;',
    '  const result = add(input);',
    '  const final = result + 1;',
    "  console.log('final', final);",
    '}',
    'main();',
    ''
  ].join('\n');
}

// Real Node child process + real WebSocket Inspector Protocol. No fake debugger or protocol simulator.
test('WP10 real Node Inspector: breakpoint, step over/in/out, stack, variables, evaluate and stop', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'axon-node-inspector-'));
  const programPath = path.join(directory, 'target.js');
  await fs.writeFile(programPath, targetScript());
  const adapter = new NodeInspectorDebugAdapter(new RealNodeInspectorHost(), 10_000);
  try {
    const initial = await adapter.start({ programPath, cwd: directory, workspaceRoot: directory });
    assert.equal(adapter.state, 'PAUSED');
    assert.equal(initial.reason, 'Break on start');
    assert.equal(initial.callFrames.length, 0);
    const breakpoint = await adapter.setBreakpoint(7);
    assert.ok(breakpoint.breakpointId);

    const atCall = await adapter.resume();
    assert.ok(atCall);
    assert.equal(atCall.callFrames[0].functionName, 'main');
    assert.equal(atCall.callFrames[0].location.lineNumber + 1, 7);

    const insideAdd = await adapter.stepInto();
    assert.ok(insideAdd);
    assert.equal(insideAdd.callFrames[0].functionName, 'add');
    assert.equal(insideAdd.callFrames[0].location.lineNumber + 1, 2);

    const afterStepOver = await adapter.stepOver();
    assert.ok(afterStepOver);
    assert.equal(afterStepOver.callFrames[0].location.lineNumber + 1, 3);
    const vars = await adapter.variables(0);
    assert.equal(vars.find(item => item.name === 'x')?.value, '40');
    assert.equal(vars.find(item => item.name === 'y')?.value, '41');
    const evaluated = await adapter.evaluate('x + y');
    assert.equal(evaluated.value, 81);

    const backInMain = await adapter.stepOut();
    assert.ok(backInMain);
    assert.equal(backInMain.callFrames[0].functionName, 'main');
    assert.equal(backInMain.callFrames[0].location.lineNumber + 1, 8);
    const nextLine = await adapter.stepOver();
    assert.ok(nextLine);
    assert.equal(nextLine.callFrames[0].location.lineNumber + 1, 9);
    const stack = await adapter.stack();
    assert.ok(stack.some(frame => frame.functionName === 'main'));
    await adapter.stop();
    assert.equal(adapter.state, 'STOPPED');
  } finally { await adapter.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('WP10 real Node Inspector reports a crashed target process', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'axon-node-crash-'));
  const programPath = path.join(directory, 'crash.js');
  await fs.writeFile(programPath, "throw new Error('target crashed intentionally');\n");
  const adapter = new NodeInspectorDebugAdapter(new RealNodeInspectorHost(), 10_000);
  try {
    await adapter.start({ programPath, cwd: directory, workspaceRoot: directory });
    const pause = await adapter.resume();
    assert.equal(pause, null);
    const exit = await adapter.waitForExit(5_000);
    assert.notEqual(exit.code, 0);
    assert.equal(adapter.state, 'CRASHED');
    assert.match(adapter.crashedWith ?? '', /target crashed intentionally/);
  } finally { await adapter.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('WP10 NEGATIVE: Node Inspector refuses a target path outside the approved workspace', async () => {
  const adapter = new NodeInspectorDebugAdapter(new RealNodeInspectorHost());
  await assert.rejects(() => adapter.start({ programPath: '/tmp/outside.js', cwd: '/tmp', workspaceRoot: '/tmp/axon-workspace' }), /inside the approved workspace root/);
  assert.equal(adapter.state, 'STOPPED');
});

test('WP10 NEGATIVE: Node Inspector refuses invalid breakpoint lines and evaluation payloads', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'axon-node-invalid-'));
  const programPath = path.join(directory, 'target.js'); await fs.writeFile(programPath, targetScript());
  const adapter = new NodeInspectorDebugAdapter(new RealNodeInspectorHost(), 10_000);
  try {
    await adapter.start({ programPath, cwd: directory, workspaceRoot: directory });
    await assert.rejects(() => adapter.setBreakpoint(0), /positive one-based line/);
    await assert.rejects(() => adapter.evaluate('x'.repeat(4097)), /4 KiB/);
    await adapter.stop();
  } finally { await adapter.close(); await fs.rm(directory, { recursive: true, force: true }); }
});
