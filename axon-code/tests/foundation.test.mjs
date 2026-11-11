import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeProject, analyzeSourceFile, applyPatch, chooseExecutionPlan,
  classifyResources, normalizeProjectPath, planSelectiveExecution,
  proposeSafeFixes, RuntimeRegistry
} from '../dist/index.js';

function memorySource(entries) {
  const files = new Map(Object.entries(entries));
  return {
    async listFiles() {
      return [...files.entries()].map(([path, content]) => ({ path, sizeBytes: Buffer.byteLength(content), kind: 'text' }));
    },
    async readTextFile(path, maxBytes) {
      const value = files.get(path);
      if (value === undefined || Buffer.byteLength(value) > maxBytes) return null;
      return value;
    }
  };
}

test('project analysis finds local dependency links and entry points', async () => {
  const result = await analyzeProject('demo', memorySource({
    'src/main.ts': "import { add } from './math';\nexport function start() { return add(2, 3); }\n",
    'src/math.ts': 'export function add(a: number, b: number) { return a + b; }\n'
  }));
  assert.equal(result.outline.inspectedFiles, 2);
  assert.equal(result.outline.localDependencies, 1);
  assert.deepEqual(result.outline.entryPoints, ['src/main.ts']);
  assert.equal(result.files[0].imports[0].resolvedFile, 'src/math.ts');
});

test('JSON diagnostics report a source location', async () => {
  const result = await analyzeSourceFile('settings.json', '{\n  "enabled": true,\n  "count": }', 'json');
  assert.equal(result.length, 1);
  assert.equal(result[0].code, 'JSON_PARSE_ERROR');
  assert.ok(result[0].location.line >= 1);
  assert.ok(result[0].location.column >= 1);
});

test('structural scanner locates unclosed delimiters', async () => {
  const result = await analyzeSourceFile('bad.js', 'function run() {\n  return [1, 2;\n}', 'javascript');
  assert.ok(result.some((item) => item.code === 'UNCLOSED_DELIMITER'));
});

test('unsafe project paths are rejected', () => {
  assert.equal(normalizeProjectPath('../secret.txt'), null);
  assert.equal(normalizeProjectPath('/etc/passwd'), null);
  assert.equal(normalizeProjectPath('src/main.ts'), 'src/main.ts');
});

test('selective execution refuses unproven isolation', async () => {
  const analysis = await analyzeProject('demo', memorySource({
    'src/main.js': "import './side-effect.js';\n",
    'src/side-effect.js': 'globalThis.ready = true;\n',
    'src/other.js': 'export const spare = 1;\n'
  }));
  const plan = planSelectiveExecution(analysis, {
    id: 'main', entryFiles: ['src/main.js'], sideEffectFree: false, dynamicDependenciesDeclared: true
  });
  assert.equal(plan.canRunInIsolation, false);
  assert.equal(plan.status, 'FULL_PROJECT_REQUIRED');
  assert.ok(plan.omittedFiles.includes('src/other.js'));
});

test('selective execution can plan a declared, complete, side-effect-free component', async () => {
  const analysis = await analyzeProject('demo', memorySource({
    'src/main.js': "import { f } from './lib.js'; export { f };\n",
    'src/lib.js': 'export function f() { return 1; }\n',
    'src/other.js': 'export const unused = 2;\n'
  }));
  const plan = planSelectiveExecution(analysis, {
    id: 'small-component', entryFiles: ['src/main.js'], sideEffectFree: true, dynamicDependenciesDeclared: true
  });
  assert.equal(plan.canRunInIsolation, true);
  assert.deepEqual(plan.selectedFiles, ['src/lib.js', 'src/main.js']);
  assert.deepEqual(plan.omittedFiles, ['src/other.js']);
});

test('runtime planner prefers declared streaming before refusing for memory', () => {
  const plan = chooseExecutionPlan({
    runtimeId: 'native-game', estimatedPeakRamBytes: 2_000_000_000, requiredStorageBytes: 100,
    canStreamAssets: true, streamingWorkingSetBytes: 500_000_000
  }, { availableRamBytes: 700_000_000, availableStorageBytes: 1_000, networkAllowed: false, gpuAvailable: true }, [
    { id: 'native-game', label: 'Native Game', languages: ['unknown'], platforms: ['android'], available: true, supportsStreaming: true, supportsCheckpoint: true, isolation: 'process' }
  ]);
  assert.equal(plan.mode, 'STREAMED_LOCAL');
  assert.equal(plan.canStart, true);
});

test('resource classifier identifies thermal pressure and low memory', () => {
  assert.equal(classifyResources({ timestamp: 1, resources: { availableRamBytes: 1, availableStorageBytes: 10, networkAllowed: false, thermalState: 'hot' } }, 100, 5), 'THERMAL_PRESSURE');
  assert.equal(classifyResources({ timestamp: 1, resources: { availableRamBytes: 1, availableStorageBytes: 10, networkAllowed: false } }, 100, 5), 'LOW_MEMORY');
});

test('auto-fix modes are non-mutating and patch application checks its base', () => {
  const suggestion = proposeSafeFixes('a.js', 'const a = 1;', 'SUGGEST');
  assert.equal(suggestion.applied, false);
  assert.equal(suggestion.patches.length, 1);
  assert.equal(applyPatch('const a = 1;', suggestion.patches[0]), 'const a = 1;\n');
  assert.throws(() => applyPatch('different', suggestion.patches[0]), /base does not match/);
  assert.equal(proposeSafeFixes('a.js', 'x\n', 'OFF').patches.length, 0);
});

test('runtime registry refuses duplicate ids and resolves only available adapters', () => {
  const registry = new RuntimeRegistry();
  const adapter = {
    descriptor: { id: 'js', label: 'JavaScript', languages: ['javascript'], platforms: ['web'], available: true, supportsStreaming: false, supportsCheckpoint: false, isolation: 'worker' },
    canHandle: () => true,
    execute: async (request) => ({ requestId: request.requestId, status: 'not-implemented', stdout: '', stderr: '', diagnostics: [], elapsedMs: 0, artifacts: [], evidence: 'UNKNOWN', notes: ['test adapter'] })
  };
  registry.register(adapter);
  assert.equal(registry.resolve({ requestId: 'r', projectId: 'p', entryFiles: ['index.js'], runtimeId: 'js', mode: 'FULL_LOCAL', timeoutMs: 100, outputLimitBytes: 100, networkAllowed: false, fileAccess: 'none' }), adapter);
  assert.throws(() => registry.register(adapter), /already registered/);
});
