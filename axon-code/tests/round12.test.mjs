import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProject } from '../dist/projectAnalyzer.js';
import { MultiFileProjectBundler, typeCheckTypeScriptProject } from '../dist/runtime/projectBundler.js';
import { mapGeneratedPosition } from '../dist/runtime/sourceMaps.js';

class MemoryProject {
  constructor(files) { this.files = new Map(Object.entries(files)); }
  async listFiles() { return [...this.files.keys()].sort(); }
  async readText(_projectId, path) { return this.files.get(path) ?? null; }
  async listFilesForAnalyzer() { return [...this.files.entries()].map(([path, content]) => ({ path, sizeBytes: Buffer.byteLength(content), kind: 'text' })); }
}
async function analyse(files) {
  const project = new MemoryProject(files);
  return analyzeProject('R12 parser fixtures', {
    async listFiles() { return [...project.files.entries()].map(([path, content]) => ({ path, sizeBytes: Buffer.byteLength(content), kind: 'text' })); },
    async readTextFile(path, maxBytes) { const content = project.files.get(path); return content === undefined || Buffer.byteLength(content) > maxBytes ? null : content; }
  });
}

test('R12-A01 compiler AST does not report delimiters inside regex, template strings, comments or nested expressions', async () => {
  const result = await analyse({ 'src/main.ts': "const pattern = /[{}()[\\]]/g;\nconst sample = `text ${(() => ({ answer: 42 }))().answer}`; // } ) ]\nexport const output = pattern.test(sample);" });
  assert.deepEqual(result.diagnostics, []);
});

test('R12-A02 TypeScript NodeNext .js import specifier resolves to the .ts source file', async () => {
  const result = await analyse({ 'src/main.ts': `import { value } from './helper.js'; export const result = value;`, 'src/helper.ts': `export const value = 42;` });
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.files.find((row) => row.path === 'src/main.ts').imports[0].resolvedFile, 'src/helper.ts');
  assert.equal(result.outline.dependencyGraphComplete, true);
});

test('R12-A03 JSX, generic types and nested delimiters are parsed without heuristic errors', async () => {
  const result = await analyse({ 'src/view.tsx': `type Box<T> = { value: T };\nconst data: Box<Array<{x:number}>> = { value: [{x:1}] };\nexport const View = () => <section>{data.value.map((v) => <b key={v.x}>{v.x}</b>)}</section>;` });
  assert.deepEqual(result.diagnostics, []);
});

test('R12-A04 genuine malformed TypeScript receives a compiler parser diagnostic and source location', async () => {
  const result = await analyse({ 'src/broken.ts': `const count: number = 3;\nfunction missing( { return count; }` });
  const finding = result.diagnostics.find((item) => item.severity === 'error');
  assert.ok(finding);
  assert.match(finding.code, /^TS\d+$/);
  assert.equal(finding.location.file, 'src/broken.ts');
  assert.ok(finding.location.line >= 2);
});

test('R12-A05 dynamic nonliteral imports remain explicitly uncertain', async () => {
  const result = await analyse({ 'src/main.ts': `const path = './' + name; void import(path);` });
  assert.equal(result.outline.dynamicImportPresent, true);
  assert.equal(result.outline.dependencyGraphComplete, false);
});

test('R12-B01 bundler supports top-level await and NodeNext .js-to-.ts module substitution', async () => {
  const project = new MemoryProject({
    'src/main.ts': `import { value } from './math.js';\nexport const answer = await Promise.resolve(value + 1);\nconsole.log('R12_TLA', answer);`,
    'src/math.ts': `export const value = 41;`
  });
  const checked = await typeCheckTypeScriptProject(project, 'r12-tla');
  const bundle = await new MultiFileProjectBundler(project).bundle('r12-tla', 'src/main.ts');
  assert.equal(checked.success, true);
  assert.equal(bundle.complete, true);
  assert.ok(bundle.includedFiles.includes('src/math.ts'));
  assert.match(bundle.source, /await factory\(module, module\.exports, localRequire\)/);
  assert.match(bundle.source, /const __axonEntry = await __axonLoad/);
  assert.ok(bundle.sourceMap);
});

test('R12-B02 composed source map maps a generated source line back to its original file and line', async () => {
  const project = new MemoryProject({
    'src/main.ts': `import { helper } from './helper.js';\nconst start = helper();\nthrow new Error('MAPPED_LOCATION_R12');`,
    'src/helper.ts': `export function helper(){ return 7; }`
  });
  const bundle = await new MultiFileProjectBundler(project).bundle('r12-map', 'src/main.ts');
  assert.equal(bundle.complete, true);
  assert.ok(bundle.sourceMap);
  const generatedLine = bundle.source.split('\n').findIndex((line) => line.includes("MAPPED_LOCATION_R12")) + 1;
  const generatedColumn = bundle.source.split('\n')[generatedLine - 1].indexOf('throw') + 1;
  const mapped = mapGeneratedPosition(bundle.sourceMap, generatedLine, generatedColumn);
  assert.equal(mapped?.source, 'src/main.ts');
  assert.equal(mapped?.line, 3);
  assert.ok(mapped.column >= 1);
});

test('R12-B03 invalid and out-of-range source map positions are not fabricated', () => {
  const map = { version: 3, sources: ['src/a.ts'], names: [], mappings: 'AAAA' };
  assert.equal(mapGeneratedPosition(map, 0, 1), null);
  assert.equal(mapGeneratedPosition(map, 5, 1), null);
  assert.equal(mapGeneratedPosition(map, 1, 1)?.source, 'src/a.ts');
});
