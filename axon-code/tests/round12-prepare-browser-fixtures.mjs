import fs from 'node:fs/promises';
import { MultiFileProjectBundler, typeCheckTypeScriptProject } from '../dist/runtime/projectBundler.js';

class MemoryProject {
  constructor(files) { this.files = new Map(Object.entries(files)); }
  async listFiles() { return [...this.files.keys()].sort(); }
  async readText(_projectId, path) { return this.files.get(path) ?? null; }
}

const workloads = {
  topLevelAwait: {
    'src/main.ts': `import { value } from './math.js';\nexport const answer = await Promise.resolve(value + 1);\nconsole.log('R12_TLA_EXECUTED', answer);`,
    'src/math.ts': `export const value = 41;`
  },
  mappedRuntimeError: {
    'src/main.ts': `import { helper } from './helper.js';\nconst result = helper();\nthrow new Error('R12_RUNTIME_SOURCE_MAP');`,
    'src/helper.ts': `export function helper(){ return 7; }`
  }
};

const output = {};
for (const [name, files] of Object.entries(workloads)) {
  const project = new MemoryProject(files);
  const checked = await typeCheckTypeScriptProject(project, `r12-${name}`);
  const bundle = await new MultiFileProjectBundler(project).bundle(`r12-${name}`, 'src/main.ts');
  output[name] = { checked, bundle: { complete: bundle.complete, source: bundle.source, sourceMap: bundle.sourceMap,
    includedFiles: bundle.includedFiles, diagnostics: bundle.diagnostics } };
}
await fs.writeFile(new URL('./round12-browser-fixtures.json', import.meta.url), JSON.stringify(output, null, 2));
console.log(JSON.stringify({prepared:Object.keys(output), topLevelAwait:output.topLevelAwait.checked.success,
  mappedRuntimeError:output.mappedRuntimeError.checked.success, sourceMaps:Object.values(output).every(x=>Boolean(x.bundle.sourceMap))},null,2));
