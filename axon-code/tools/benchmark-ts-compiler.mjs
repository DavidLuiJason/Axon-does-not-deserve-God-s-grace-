#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { stat, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenize } from '../dist/lexer.js';

const root = dirname(fileURLToPath(import.meta.url));
const pkgEntry = fileURLToPath(import.meta.resolve('typescript'));
const pkgRoot = dirname(dirname(pkgEntry));
async function treeBytes(dir) {
  let total = 0;
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) total += await treeBytes(path);
    else if (item.isFile()) total += (await stat(path)).size;
  }
  return total;
}
const packageBytes = await treeBytes(pkgRoot);
const before = process.memoryUsage();
const importStart = performance.now();
const ts = await import('typescript');
const compilerImportMs = performance.now() - importStart;
const after = process.memoryUsage();
const sample = Array.from({ length: 20 }, (_, i) => `export interface Item${i} { id: number; label: string }\nexport const value${i}: number = ${i} * 2;\nconsole.log(value${i});\n`).join('\n');
const iterations = 100;
const scanStart = performance.now();
for (let i = 0; i < iterations; i++) tokenize(sample);
const scannerMs = performance.now() - scanStart;
const transpileStart = performance.now();
for (let i = 0; i < iterations; i++) ts.transpileModule(sample, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const transpileMs = performance.now() - transpileStart;
const report = {
  measuredAt: new Date().toISOString(),
  nodeVersion: process.version,
  typescriptVersion: ts.version,
  typescriptPackageBytes: packageBytes,
  typescriptPackageMiB: Number((packageBytes / 1024 / 1024).toFixed(2)),
  thisCandidateLexerSourceBytes: (await stat(join(root, '../src/lexer.ts'))).size,
  thisCandidateLexerBuiltBytes: (await stat(join(root, '../dist/lexer.js'))).size,
  sampleBytes: Buffer.byteLength(sample), sampleFilesEquivalent: 20, iterations,
  compilerImportMs: Number(compilerImportMs.toFixed(2)),
  scanner100RunsMs: Number(scannerMs.toFixed(2)),
  transpile100RunsMs: Number(transpileMs.toFixed(2)),
  heapUsedDeltaBytes: after.heapUsed - before.heapUsed,
  rssDeltaBytes: after.rss - before.rss,
  caveat: 'Single-host microbenchmark; not an Android/WebView measurement and not a parser-accuracy comparison. Tokenizer is a lightweight outline scanner, not a TypeScript compiler.'
};
console.log(JSON.stringify(report, null, 2));
