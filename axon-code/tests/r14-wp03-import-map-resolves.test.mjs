// Director test (Round 14 verification): the browser import map in ui/index.html must be valid JSON and every module the editor and terminal need must resolve to a real file.
// Found by the Director: four targets (find-cluster-break, crelt, style-mod, w3c-keyname) pointed at files that do not exist, so CodeMirror could not load in a browser even though the static tests passed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = path.join(root, 'ui');

function readMap(html) {
  const match = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  assert.ok(match, 'ui/index.html has an import map');
  return JSON.parse(match[1]).imports;
}

function unresolved(imports, entries) {
  const seen = new Set();
  const missing = [];
  const resolve = (spec, from) => {
    if (spec.startsWith('.') || spec.startsWith('/')) return path.resolve(path.dirname(from), spec);
    return imports[spec] ? path.resolve(ui, imports[spec]) : null;
  };
  const crawl = (file, via) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!fs.existsSync(file)) { missing.push(`${path.relative(root, file)} (needed by ${via})`); return; }
    if (!/\.m?js$/.test(file)) return;
    const source = fs.readFileSync(file, 'utf8');
    const pattern = /(?:^|[;\s}])(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|(?:^|[;\s])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm;
    const specs = new Set();
    let found;
    while ((found = pattern.exec(source))) specs.add(found[1] || found[2] || found[3]);
    for (const spec of specs) {
      if (/[\s:]/.test(spec)) continue; // not a module name (text inside code)
      const target = resolve(spec, file);
      if (!target) missing.push(`unmapped '${spec}' (needed by ${path.relative(root, file)})`);
      else crawl(target, `${path.relative(root, file)} -> ${spec}`);
    }
  };
  for (const entry of entries) crawl(path.join(ui, entry), 'entry');
  return { missing, modules: seen.size };
}

const imports = readMap(fs.readFileSync(path.join(ui, 'index.html'), 'utf8'));
const entries = ['engines.js', 'engineBootstrap.js'];

test('the editor and terminal module graph resolves completely through the import map', () => {
  assert.ok(fs.existsSync(path.join(root, 'node_modules', '@codemirror', 'view')), 'node_modules (the vendor pack) must be installed');
  const result = unresolved(imports, entries);
  assert.deepEqual(result.missing, []);
  assert.ok(result.modules >= 15, `expected the full graph, crawled ${result.modules}`);
});

test('every import map target exists on disk', () => {
  const absent = Object.entries(imports).filter(([, target]) => !fs.existsSync(path.resolve(ui, target))).map(([name]) => name);
  assert.deepEqual(absent, []);
});

test('NEGATIVE: a broken import map target is detected (mutant)', () => {
  const broken = { ...imports, crelt: '../node_modules/crelt/dist/index.js' };
  const result = unresolved(broken, entries);
  assert.ok(result.missing.some((line) => line.includes('crelt')), 'the crawl must report the missing crelt file');
});

test('NEGATIVE: a missing mapping is detected (mutant)', () => {
  const { 'style-mod': _removed, ...without } = imports;
  const result = unresolved(without, entries);
  assert.ok(result.missing.some((line) => line.includes("style-mod")), 'the crawl must report the unmapped style-mod');
});
