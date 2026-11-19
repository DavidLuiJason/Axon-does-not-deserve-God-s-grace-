import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
const workbench = await readFile(new URL('../ui/workbench.js', import.meta.url), 'utf8');
const provider = await readFile(new URL('../src/runtime/browserOpaqueWorkerProvider.ts', import.meta.url), 'utf8');

test('R1 adds new Run, Stop, stdin and output status elements to the workbench', () => {
  for (const id of ['runButton', 'stopButton', 'stdinInput', 'runStatus', 'outputText']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(workbench, /runBrowserJavaScript/);
  assert.match(workbench, /stopBrowserRun/);
});

test('R1 routes execution through the attested opaque-origin worker provider', () => {
  assert.match(workbench, /BrowserOpaqueWorkerProvider/);
  assert.match(workbench, /browserWorkerProvider\.initialize\(\)/);
  assert.match(provider, /frame\.setAttribute\('sandbox', 'allow-scripts'\)/);
  assert.match(provider, /event\.origin !== 'null'/);
  assert.match(provider, /connect-src 'none'/);
});

test('R1 worker protocol bounds source, output and execution time and accepts bounded stdin', () => {
  assert.match(workbench, /1024 \* 1024/);
  assert.match(workbench, /256 \* 1024/);
  assert.match(workbench, /5000/);
  assert.match(workbench, /stdin: \$\('stdinInput'\)/);
  assert.match(provider, /req\.stdin\.slice\(0, 128\)/);
  assert.match(provider, /new AsyncFunction\('console', 'readline'/);
});

test('R1 NEGATIVE: unsupported file types are refused instead of executed', () => {
  assert.match(workbench, /supports JavaScript \(\.js, \.mjs, \.cjs\) only/);
  assert.match(workbench, /if \(!\['\.js', '\.mjs', '\.cjs'\]\.includes\(extension\)\) throw/);
});

test('R1 NEGATIVE: worker termination and no-network policy remain mandatory', () => {
  assert.match(workbench, /worker\.terminate\(\)/);
  assert.match(provider, /connect-src 'none'/);
  assert.match(provider, /'fetch','XMLHttpRequest','WebSocket'/);
});
