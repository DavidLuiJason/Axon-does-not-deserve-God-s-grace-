import { MultiFileProjectBundler } from '../dist/runtime/projectBundler.js';
import { createPureWasmWorkerSource } from '../dist/runtime/webAssemblyWorker.js';

class MemoryProject {
  constructor(files) { this.files = new Map(Object.entries(files)); }
  async listFiles() { return [...this.files.keys()]; }
  async readText(_projectId, path) { return this.files.get(path) ?? null; }
}

const typedProject = new MemoryProject({
  'src/main.ts': `import { multiply } from './math';\nimport answer from 'tiny-answer';\nconsole.log('TS_RUN', multiply(6, 7), answer);`,
  'src/math.ts': `export function multiply(a: number, b: number): number { return a * b; }`,
  'node_modules/tiny-answer/package.json': JSON.stringify({ exports: { '.': { browser: './browser.js', default: './index.js' } } }),
  'node_modules/tiny-answer/browser.js': `export default 7;`,
  'node_modules/tiny-answer/index.js': `export default 9;`
});
const jsxProject = new MemoryProject({
  'src/view.tsx': `import React from 'react';\nconst view = <div data-kind="axon">hello</div>;\nconsole.log('JSX_RUN', view.type, view.props.children);`,
  'node_modules/react/package.json': JSON.stringify({ main: 'index.js' }),
  'node_modules/react/index.js': `module.exports = { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children[0] } }), Fragment: 'fragment' };`
});
const [typed, jsx] = await Promise.all([
  new MultiFileProjectBundler(typedProject).bundle('p', 'src/main.ts'),
  new MultiFileProjectBundler(jsxProject).bundle('p', 'src/view.tsx')
]);
const wasm42 = [0,97,115,109,1,0,0,0,1,5,1,96,0,1,127,3,2,1,0,7,8,1,4,109,97,105,110,0,0,10,6,1,4,0,65,42,11];
console.log(JSON.stringify({ typed, jsx, wasm42 }));
