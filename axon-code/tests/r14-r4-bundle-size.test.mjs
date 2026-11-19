import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const report = JSON.parse(await readFile(new URL('../build/ui/size-report.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../build/ui/index.html', import.meta.url), 'utf8');
test('R4 reports measured initial JavaScript, lazy xterm, Pyodide and total bundle bytes', () => {
  const initial = report.assets.filter(x => ['ui/engineBootstrap.js','ui/workbench.js'].includes(x.entryPoint) && x.file.endsWith('.js')).reduce((n,x)=>n+x.bytes,0);
  const pyodide = report.assets.filter(x => ['pyodide.js','pyodide.asm.mjs','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json'].includes(x.file)).reduce((n,x)=>n+x.bytes,0);
  assert.ok(initial > 0 && pyodide > 0 && report.totalBytes > initial + pyodide);
  console.log(`R4 measured bytes: initial JavaScript=${initial}; Pyodide pack=${pyodide}; total=${report.totalBytes}`);
});
test('R4 xterm and Pyodide are not eagerly loaded by the built HTML', () => {
  assert.doesNotMatch(html, /<script[^>]+xterm-/);
  assert.doesNotMatch(html, /<script[^>]+pyodide/);
  assert.match(html, /engineBootstrap-/);
  assert.match(html, /workbench-/);
});
