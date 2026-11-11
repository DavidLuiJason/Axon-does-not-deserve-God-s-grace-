import { writeFile } from 'node:fs/promises';
import { MultiFileProjectBundler, typeCheckTypeScriptProject } from '../dist/runtime/projectBundler.js';

class MemoryProject {
  constructor(files) { this.files = new Map(Object.entries(files)); }
  async listFiles() { return [...this.files.keys()]; }
  async readText(_projectId, path) { return this.files.get(path) ?? null; }
}

const project = new MemoryProject({
  'src/main.ts': `import { double } from './math';\nimport { label } from 'axon-label';\nconst answer: number = double(21);\nconsole.log('R6_APP', answer, label('AXON'));\nexport default { answer };`,
  'src/math.ts': `export function double(value: number): number { return value * 2; }`,
  'node_modules/axon-label/package.json': JSON.stringify({ exports: { '.': { browser: './browser.js', default: './index.js' } } }),
  'node_modules/axon-label/browser.js': `exports.label = (value) => value + ' browser';`,
  'node_modules/axon-label/index.js': `exports.label = (value) => value + ' node';`
});
const bundle = await new MultiFileProjectBundler(project).bundle('r6-project', 'src/main.ts');
if (!bundle.complete || bundle.diagnostics.some((item) => item.severity === 'error')) throw new Error('R6 happy-path fixture did not bundle.');

const badRuntime = new MemoryProject({
  'src/failure.ts': `console.log('BEFORE_FAILURE');\nthrow new Error('R6_INJECTED_RUNTIME_FAILURE');`
});
const badRuntimeBundle = await new MultiFileProjectBundler(badRuntime).bundle('r6-error', 'src/failure.ts');
if (!badRuntimeBundle.complete) throw new Error('R6 injected runtime failure fixture did not bundle.');

const badSyntax = new MemoryProject({
  'src/type-error.ts': `const valid: number = 4;\nconst broken: number = 'not-a-number';\nconsole.log(valid, broken);`
});
const typeCheck = await typeCheckTypeScriptProject(badSyntax, 'r6-type-error');

const blockedPackage = new MemoryProject({ 'src/main.ts': `import unavailable from 'r6-package-not-installed'; console.log(unavailable);` });
const blockedBundle = await new MultiFileProjectBundler(blockedPackage).bundle('r6-blocked', 'src/main.ts');

const outputLimit = new MemoryProject({ 'src/output.ts': `for (let i = 0; i < 500; i++) console.log('R6_OUTPUT_LIMIT', i, 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');` });
const outputBundle = await new MultiFileProjectBundler(outputLimit).bundle('r6-output', 'src/output.ts');

const timeout = new MemoryProject({ 'src/timeout.ts': `while (true) { /* deliberate infinite loop */ }` });
const timeoutBundle = await new MultiFileProjectBundler(timeout).bundle('r6-timeout', 'src/timeout.ts');

const results = {
  bundle: { source: bundle.source, complete: bundle.complete, includedFiles: bundle.includedFiles, diagnostics: bundle.diagnostics, externalPackages: bundle.externalPackages },
  runtimeErrorBundle: { source: badRuntimeBundle.source, complete: badRuntimeBundle.complete },
  typeCheck: { success: typeCheck.success, diagnostics: typeCheck.diagnostics, checkedFiles: typeCheck.checkedFiles },
  blockedBundle: { complete: blockedBundle.complete, diagnostics: blockedBundle.diagnostics, externalPackages: blockedBundle.externalPackages },
  outputLimitBundle: { source: outputBundle.source, complete: outputBundle.complete },
  timeoutBundle: { source: timeoutBundle.source, complete: timeoutBundle.complete }
};
await writeFile(new URL('./round6-browser-fixtures.json', import.meta.url), JSON.stringify(results), 'utf8');
console.log(JSON.stringify({
  bundleComplete: bundle.complete,
  includedFiles: bundle.includedFiles,
  sourceBytes: new TextEncoder().encode(bundle.source).byteLength,
  injectedTypeErrorCaught: !typeCheck.success && typeCheck.diagnostics.some((item) => item.code === 'TS2322' && item.file === 'src/type-error.ts' && item.line === 2),
  typeDiagnostics: typeCheck.diagnostics,
  blockedBundleComplete: blockedBundle.complete,
  blockedDiagnostics: blockedBundle.diagnostics,
  outputLimitBundleComplete: outputBundle.complete,
  timeoutBundleComplete: timeoutBundle.complete
}));
