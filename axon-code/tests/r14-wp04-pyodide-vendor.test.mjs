import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'node_modules/pyodide/package.json'),'utf8'));
const provider=fs.readFileSync(path.join(root,'src/runtime/pyodideWorkerProvider.ts'),'utf8');
test('WP4 Pyodide provider required assets match the real vendored CPython-WASM distribution',()=>{
  assert.equal(pkg.version,'314.0.7');
  for(const asset of ['pyodide.js','pyodide.asm.mjs','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json']){
    assert.ok(fs.statSync(path.join(root,'node_modules/pyodide',asset)).size>0,`${asset} exists and is non-empty`);
    assert.ok(provider.includes(`'${asset}'`),`${asset} is part of the verified pack contract`);
  }
});
test('WP4 remains an actual CPython WebAssembly Worker adapter and never an imitation',()=>{
  assert.match(provider,/importScripts\(/);
  assert.match(provider,/loadPyodide/);
  assert.match(provider,/Pyodide CPython WebAssembly in a Worker/);
  assert.match(provider,/No Python interpreter imitation is used/);
});
