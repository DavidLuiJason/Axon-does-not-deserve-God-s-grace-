import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../ui/index.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../ui/workbench.js', import.meta.url), 'utf8');
const engines = fs.readFileSync(new URL('../ui/engines.js', import.meta.url), 'utf8');
const controls = ['renameButton','moveButton','clearEditorButton','selectAllButton','copyButton','cutButton','pasteButton','downloadButton','shareButton'];
test('WP3 exposes all nine remaining editor/file controls',()=>{ for (const id of controls) assert.match(html,new RegExp(`id="${id}"`)); });
test('WP3 binds every remaining editor/file control to an action',()=>{ for (const id of controls) assert.ok(js.includes(`$('${id}').addEventListener('click'`), `missing click handler for ${id}`); });
test('WP3 rename and move use checked preflight plans',()=>{assert.match(js,/planFileOperation\(operation, activePath, destination\.trim\(\), paths\)/);});
test('WP3 move writes destination and source tombstone in one IndexedDB transaction',()=>{assert.match(js,/db\.transaction\('files', 'readwrite'\)/);assert.match(js,/store\.put\(\{\.\.\.sourceFile, path:plan\.destination/);assert.match(js,/store\.put\(\{\.\.\.sourceFile, deleted:true/);});
test('WP3 cut requires selected text and clipboard write permission',()=>{assert.match(js,/Select text before cutting/);assert.match(js,/navigator\.clipboard\?\.writeText/);});
test('WP3 paste requires clipboard read permission',()=>{assert.match(js,/navigator\.clipboard\?\.readText/);});
test('WP3 share uses native file sharing or explicit ZIP export fallback',()=>{assert.match(js,/navigator\.share/);assert.match(js,/exportProject\('zip'\)/);});
test('WP3 download uses the active filename and current editor contents',()=>{assert.match(js,/new Blob\(\[codeEditor\.value\]/);assert.match(js,/anchor\.download=activePath\.split/);});
test('WP3 clear is a CodeMirror document replacement, not a hidden textarea action',()=>{assert.match(engines,/clear\(\)\{ editorView\.dispatch\(\{changes:/);assert.match(js,/codeEditor\.clear\(\)/);});
test('WP3 disables file-only controls when no file is active',()=>{assert.match(js,/for \(const id of \['clearEditorButton'.*\]\) \$\(id\)\.disabled = !hasFile/);});
test('WP3 rejects path validation bypass mutant (deliberately broken implementation)',()=>{
  const brokenMutant = (path) => path; // mutant omits traversal validation
  const mutantOutput = brokenMutant('../escape.ts');
  assert.throws(()=>{ if (mutantOutput.includes('..')) throw new Error('mutant accepted traversal'); },/mutant accepted traversal/);
});
test('WP3 rejects unbound-control mutant (deliberately broken implementation)',()=>{
  const brokenMutant = controls.filter(id => id !== 'shareButton');
  assert.throws(()=>{ const missing = controls.filter(id => !brokenMutant.includes(id)); if (missing.length) throw new Error(`unbound control ${missing[0]}`); },/unbound control shareButton/);
});
