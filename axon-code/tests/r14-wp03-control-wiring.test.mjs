import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { File as NodeFile } from 'node:buffer';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view';
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const wait = (ms = 25) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, message) {
  for (let i = 0; i < 80; i++) { if (await predicate()) return; await wait(10); }
  assert.fail(message);
}

// FAKE_BOUNDARY: jsdom does not implement browser dialog presentation, native file pickers,
// clipboard permissions, download navigation, or the operating-system share sheet.
// Those individual browser boundaries are recorded here; project data and UI commands remain real.
async function boot() {
  const html = (await import('node:fs/promises')).readFile(path.join(root, 'ui/index.html'), 'utf8');
  const dom = new JSDOM(await html, { url: 'https://axon-code.test/', pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom;
  const idb = new IDBFactory();
  const prior = new Map();
  const downloads = [];
  const objectUrls = new Map();
  let objectUrlSequence = 0;
  const shares = [];
  const clipboard = { value: '', async writeText(value) { this.value = value; }, async readText() { return this.value; } };
  const prompts = [];
  const confirmations = [];
  Object.defineProperty(window, 'indexedDB', { configurable: true, value: idb });
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: clipboard });
  Object.defineProperty(window.navigator, 'share', { configurable: true, value: async payload => { shares.push(payload); } });
  Object.defineProperty(window.navigator, 'canShare', { configurable: true, value: () => true });
  window.confirm = globalThis.confirm = message => confirmations.length ? confirmations.shift() : true;
  window.prompt = globalThis.prompt = message => prompts.length ? prompts.shift() : null;
  window.fetch = globalThis.fetch = async () => ({ ok: true, json: async () => ({ schemaVersion: 1, capabilities: [{ id: 'ui-test', status: 'TESTED' }] }) });
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.HTMLAnchorElement.prototype.click = function () { downloads.push({ href: this.href, filename: this.download }); };
  window.URL.createObjectURL = blob => { const url = `blob:axon-test-${++objectUrlSequence}`; objectUrls.set(url, blob); return url; };
  window.URL.revokeObjectURL = () => {};
  globalThis.URL.createObjectURL = window.URL.createObjectURL;
  globalThis.URL.revokeObjectURL = window.URL.revokeObjectURL;
  window.crypto.getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });
  Object.assign(globalThis, {
    window, document: window.document, Event: window.Event, CustomEvent: window.CustomEvent,
    HTMLElement: window.HTMLElement, Window: window.Window, Document: window.Document, MutationObserver: window.MutationObserver,
    getComputedStyle: window.getComputedStyle.bind(window), requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window), indexedDB: idb,
    Blob: globalThis.Blob, File: NodeFile, TextEncoder, TextDecoder,
    confirm: window.confirm, prompt: window.prompt
  });
  // Real CodeMirror 6 modules are imported from Vendor Pack V2 and mounted into the actual workbench DOM.
  const mountRealCodeMirror = ({ parent, initialText = '', onChange = () => {} }) => {
    const view = new EditorView({ state: EditorState.create({ doc: initialText, extensions: [lineNumbers(), highlightActiveLine(), history(), keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]), javascript({ typescript: true, jsx: true }), EditorView.updateListener.of(update => { if (update.docChanged) onChange(update.state.doc.toString()); })] }), parent });
    return { get value() { return view.state.doc.toString(); }, setValue(value) { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: String(value) } }); }, focus() { view.focus(); }, selectAll() { view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } }); }, clear() { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } }); }, replaceSelection(value) { view.dispatch(view.state.replaceSelection(value)); }, getSelection() { const selection = view.state.selection.main; return view.state.doc.sliceString(selection.from, selection.to); }, destroy() { view.destroy(); } };
  };
  window.AXONCodeEngines = {
    mountCodeMirror: mountRealCodeMirror,
    // FAKE_BOUNDARY: xterm drawing/ResizeObserver are not required for file-workbench acceptance.
    mountXterm: () => ({ dispose() {}, connect() { throw new Error('Terminal boundary is not part of P1.'); } })
  };
  await import(`${pathToFileURL(path.join(root, 'ui/workbench.js')).href}?p1=${Date.now()}-${Math.random()}`);
  await until(() => document.getElementById('outputText').textContent.includes('Workbench loaded'), 'workbench did not initialise');
  const view = () => EditorView.findFromDOM(document.querySelector('.cm-content'));
  const openFileInput = (id, files) => {
    const input = document.getElementById(id);
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  const store = async (storeName, key) => {
    const request = idb.open('axon-code-direct-workbench', 1);
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction(storeName, 'readonly');
    const resultPromise = new Promise((resolve, reject) => { const r = tx.objectStore(storeName).get(key); r.onsuccess = () => resolve(r.result ?? null); r.onerror = () => reject(r.error); });
    const completePromise = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
    const [result] = await Promise.all([resultPromise, completePromise]);
    db.close(); return result;
  };
  const put = async (storeName, value) => {
    const request = idb.open('axon-code-direct-workbench', 1);
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction(storeName, 'readwrite'); tx.objectStore(storeName).put(value);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); db.close();
  };
  const project = async () => {
    const request = idb.open('axon-code-direct-workbench', 1);
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction('projects', 'readonly');
    const rows = await new Promise((resolve, reject) => { const r = tx.objectStore('projects').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    db.close(); return rows[0];
  };
  return { dom, window, idb, view, openFileInput, store, put, project, clipboard, prompts, confirmations, downloads, objectUrls, shares, dispose() { const mounted = window.document.querySelector('.cm-content'); if (mounted) EditorView.findFromDOM(mounted)?.destroy(); dom.window.close(); } };
}

async function createProject(h, name = 'P1 UI Project') {
  h.window.document.getElementById('newProjectButton').click();
  h.window.document.getElementById('projectNameInput').value = name;
  h.window.document.getElementById('createProjectConfirm').click();
  await until(() => h.window.document.getElementById('projectName').textContent === name, 'project creation did not complete');
}
async function createFile(h, filePath) {
  h.window.document.getElementById('newFileButton').click();
  h.window.document.getElementById('newFilePath').value = filePath;
  h.window.document.getElementById('createFileConfirm').click();
  await until(() => h.window.document.getElementById('tabs').textContent.includes(filePath), `file ${filePath} did not open`);
}
async function edit(h, text) {
  const view = h.view(); assert.ok(view, 'real CodeMirror EditorView must be mounted');
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  await wait();
}

// Positive workflow: every requested workbench operation reaches the real IndexedDB project store.
test('WP3 real UI workflow: project, import, edit, save, reopen, file actions, clipboard, export/share/download', async t => {
  const h = await boot(); const d = h.window.document;
  await createProject(h);
  const project = await h.project();
  assert.equal((await h.store('files', [project.id, 'README.md'])).deleted, false);

  // Import uses the actual file-input change handler and actual IndexedDB writes.
  const imported = new NodeFile(['export const answer = 41;\n'], 'main.js', { type: 'text/javascript' });
  Object.defineProperty(imported, 'webkitRelativePath', { value: 'src/main.js' });
  h.openFileInput('fileInput', [imported]);
  await until(async () => (await h.store('files', [project.id, 'src/main.js']))?.content.includes('41'), 'imported file was not persisted');
  await wait();
  [...d.querySelectorAll('#fileTree button:not(:disabled)')].find(button => button.textContent.includes('main.js'))?.click();
  await wait();
  assert.equal(h.view().state.doc.toString(), 'export const answer = 41;\n');

  // Edit and save through the real CodeMirror update listener and Save button.
  await edit(h, 'export const answer = 42;\n');
  d.getElementById('saveButton').click();
  await until(async () => (await h.store('files', [project.id, 'src/main.js']))?.content.includes('42'), 'save did not persist CodeMirror content');
  assert.equal((await h.store('files', [project.id, 'src/main.js'])).revision, 2);

  // Create a second file, edit both open buffers, then Save all.
  await createFile(h, 'src/second.js');
  await edit(h, 'export const second = true;\n');
  [...d.querySelectorAll('#fileTree button:not(:disabled)')].find(button => button.textContent.includes('main.js'))?.click(); await wait();
  await edit(h, 'export const answer = 43;\n');
  d.getElementById('saveAllButton').click();
  await until(async () => (await h.store('files', [project.id, 'src/second.js']))?.content.includes('true'), 'save all did not persist second file');
  assert.match((await h.store('files', [project.id, 'src/main.js'])).content, /43/);

  // Reopen project through the visible Open / Import control, then reopen a stored file.
  h.prompts.push('1'); d.getElementById('openProjectButton').click(); await wait();
  [...d.querySelectorAll('#fileTree button:not(:disabled)')].find(button => button.textContent.includes('main.js')).click(); await wait();
  assert.match(h.view().state.doc.toString(), /answer = 43/);

  // Select all, copy, cut, and paste use the real CodeMirror selection and actual clipboard API boundary.
  d.getElementById('selectAllButton').click();
  assert.equal(h.view().state.sliceDoc(h.view().state.selection.main.from, h.view().state.selection.main.to), h.view().state.doc.toString());
  d.getElementById('copyButton').click(); await until(() => h.clipboard.value.includes('answer = 43'), 'copy did not write selected source');
  d.getElementById('cutButton').click(); await wait();
  assert.equal(h.view().state.doc.toString(), '');
  d.getElementById('pasteButton').click(); await wait();
  assert.match(h.view().state.doc.toString(), /answer = 43/);

  // Clear and persist an empty document.
  h.confirmations.push(true); d.getElementById('clearEditorButton').click(); await wait();
  assert.equal(h.view().state.doc.toString(), '');
  d.getElementById('saveButton').click();
  await until(async () => (await h.store('files', [project.id, 'src/main.js']))?.content === '', 'clear/save did not persist empty content');

  // Rename and move are real indexedDB transactions: destination row plus source tombstone.
  await edit(h, 'rename me'); d.getElementById('saveButton').click(); await wait();
  h.prompts.push('src/renamed.js'); d.getElementById('renameButton').click();
  await until(async () => (await h.store('files', [project.id, 'src/renamed.js']))?.content === 'rename me', 'rename destination missing');
  assert.equal((await h.store('files', [project.id, 'src/main.js'])).deleted, true);
  h.prompts.push('lib/renamed.js'); d.getElementById('moveButton').click();
  await until(async () => (await h.store('files', [project.id, 'lib/renamed.js']))?.content === 'rename me', 'move destination missing');
  assert.equal((await h.store('files', [project.id, 'src/renamed.js'])).deleted, true);

  // Delete and Undo operate on the project store.
  h.confirmations.push(true); d.getElementById('deleteButton').click();
  await until(async () => (await h.store('files', [project.id, 'lib/renamed.js']))?.deleted === true, 'delete did not tombstone file');
  d.getElementById('undoDeleteButton').click();
  await until(async () => (await h.store('files', [project.id, 'lib/renamed.js']))?.deleted === false, 'undo did not restore file');

  // Export, share and download hit the real content serializers with isolated browser-only boundaries.
  d.getElementById('exportButton').click(); d.getElementById('exportConfirm').click(); await wait();
  assert.ok(h.downloads.some(item => item.filename.endsWith('.zip')), 'project export did not trigger a ZIP download');
  d.getElementById('shareButton').click();
  await until(() => h.shares.length === 1, 'share sheet boundary was not called');
  assert.equal(h.shares[0].files[0].type, 'application/zip');
  d.getElementById('downloadButton').click(); await wait();
  assert.ok(h.downloads.some(item => item.filename === 'renamed.js'), 'active file download was not triggered');

  h.dispose();
});

// Negative cases exercise the actual UI command handlers and actual IndexedDB rows.
test('WP3 NEGATIVE: stale save conflict refuses to overwrite an externally changed file', async () => {
  const h = await boot(); const d = h.window.document;
  await createProject(h, 'Conflict Project'); const project = await h.project();
  await createFile(h, 'conflict.txt'); await edit(h, 'my unsaved version');
  const current = await h.store('files', [project.id, 'conflict.txt']);
  await h.put('files', { ...current, content: 'external newer version', revision: current.revision + 1 });
  d.getElementById('saveButton').click();
  await until(() => d.getElementById('toast').textContent.includes('Save conflict'), 'save conflict was not surfaced');
  assert.equal((await h.store('files', [project.id, 'conflict.txt'])).content, 'external newer version');
  h.dispose();
});

test('WP3 NEGATIVE: delete of a missing file reports failure and does not recreate it', async () => {
  const h = await boot(); const d = h.window.document;
  await createProject(h, 'Missing Delete Project'); const project = await h.project();
  await createFile(h, 'missing.txt');
  const current = await h.store('files', [project.id, 'missing.txt']);
  const request = h.idb.open('axon-code-direct-workbench', 1);
  const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').delete([project.id, 'missing.txt']);
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close();
  h.confirmations.push(true); d.getElementById('deleteButton').click();
  await until(() => d.getElementById('toast').textContent.includes('file no longer exists'), 'missing-file delete was not refused');
  assert.equal(await h.store('files', [project.id, 'missing.txt']), null);
  assert.ok(current);
  h.dispose();
});

test('WP3 NEGATIVE: rename onto an existing file is refused without changing either stored file', async () => {
  const h = await boot(); const d = h.window.document;
  await createProject(h, 'Rename Collision Project'); const project = await h.project();
  await createFile(h, 'src/one.txt'); await edit(h, 'one'); d.getElementById('saveButton').click(); await wait();
  await createFile(h, 'src/two.txt'); await edit(h, 'two'); d.getElementById('saveButton').click(); await wait();
  // Select the first file in the tree, then request a colliding rename.
  [...d.querySelectorAll('#fileTree button:not(:disabled)')].find(button => button.textContent.includes('one.txt')).click(); await wait();
  h.prompts.push('src/two.txt'); d.getElementById('renameButton').click();
  await until(() => d.getElementById('toast').textContent.includes('already exists'), 'rename collision was not refused');
  assert.equal((await h.store('files', [project.id, 'src/one.txt'])).content, 'one');
  assert.equal((await h.store('files', [project.id, 'src/two.txt'])).content, 'two');
  h.dispose();
});


test('WP3 real CodeMirror 6 editor is mounted in the actual workbench DOM', async () => {
  const h = await boot();
  await createProject(h, 'CodeMirror Mount');
  assert.ok(h.window.document.querySelector('.cm-editor'), 'real CodeMirror editor DOM is mounted');
  assert.ok(h.view() instanceof EditorView, 'DOM resolves to the real CodeMirror EditorView');
  h.dispose();
});

test('WP3 NEGATIVE: import skips traversal, binary content and oversize files', async () => {
  const h = await boot(); const d = h.window.document;
  await createProject(h, 'Import Safety'); const project = await h.project();
  const traversal = new NodeFile(['bad'], 'escape.txt'); Object.defineProperty(traversal, 'webkitRelativePath', { value: '../escape.txt' });
  const binary = new NodeFile(['\u0000binary'], 'binary.dat');
  const oversized = new NodeFile(['x'.repeat(2 * 1024 * 1024 + 1)], 'large.txt');
  const good = new NodeFile(['valid'], 'good.txt');
  h.openFileInput('fileInput', [traversal, binary, oversized, good]);
  await until(async () => (await h.store('files', [project.id, 'good.txt']))?.content === 'valid', 'valid import was not saved');
  assert.equal(await h.store('files', [project.id, 'escape.txt']), null);
  assert.equal(await h.store('files', [project.id, 'binary.dat']), null);
  assert.equal(await h.store('files', [project.id, 'large.txt']), null);
  assert.match(d.getElementById('outputText').textContent, /3 unsafe, binary-like or over-limit/);
  h.dispose();
});

test('WP3 NEGATIVE: clipboard denial is surfaced without changing source', async () => {
  const h = await boot(); const d = h.window.document;
  await createProject(h, 'Clipboard Denial'); await createFile(h, 'copy.txt'); await edit(h, 'keep this');
  Object.defineProperty(h.window.navigator, 'clipboard', { configurable: true, value: undefined });
  h.view().dispatch({ selection: { anchor: 0, head: h.view().state.doc.length } });
  d.getElementById('copyButton').click();
  await until(() => d.getElementById('toast').textContent.includes('Clipboard write access is unavailable'), 'clipboard denial was not shown');
  assert.equal(h.view().state.doc.toString(), 'keep this');
  h.dispose();
});

test('WP3 NEGATIVE: cancelling Clear leaves the real editor document unchanged', async () => {
  const h = await boot(); const d = h.window.document;
  await createProject(h, 'Clear Cancel'); await createFile(h, 'keep.txt'); await edit(h, 'preserve me');
  h.confirmations.push(false); d.getElementById('clearEditorButton').click(); await wait();
  assert.equal(h.view().state.doc.toString(), 'preserve me');
  h.dispose();
});

test('WP3 NEGATIVE: switching projects with dirty buffers is refused when confirmation is denied', async () => {
  const h = await boot(); const d = h.window.document;
  await createProject(h, 'Current Project'); await createFile(h, 'dirty.txt'); await edit(h, 'unsaved');
  const second = { id: 'other-project', name: 'Other Project', createdAt: Date.now() + 1000, updatedAt: Date.now() + 1000, schema: 'axon-direct-browser-project/v1' };
  await h.put('projects', second);
  h.prompts.push('2'); h.confirmations.push(false); d.getElementById('openProjectButton').click(); await wait(50);
  assert.equal(d.getElementById('projectName').textContent, 'Current Project');
  assert.equal(h.view().state.doc.toString(), 'unsaved');
  h.dispose();
});

test('WP3 NEGATIVE: editor size limit refuses oversized save and preserves stored version', async () => {
  const h = await boot(); const d = h.window.document;
  await createProject(h, 'Oversize Save'); const project = await h.project(); await createFile(h, 'bounded.txt');
  const before = await h.store('files', [project.id, 'bounded.txt']);
  await edit(h, 'x'.repeat(2 * 1024 * 1024 + 1));
  d.getElementById('saveButton').click();
  await until(() => d.getElementById('toast').textContent.includes('2 MiB editor limit'), 'oversize save was not refused');
  assert.equal((await h.store('files', [project.id, 'bounded.txt'])).revision, before.revision);
  h.dispose();
});

test('WP3 share falls back to the real ZIP exporter when the native share sheet is unavailable', async () => {
  const h = await boot(); const d = h.window.document;
  await createProject(h, 'Share Fallback'); await createFile(h, 'share.txt');
  Object.defineProperty(h.window.navigator, 'share', { configurable: true, value: undefined });
  d.getElementById('shareButton').click();
  await until(() => h.downloads.some(item => item.filename.endsWith('.zip')), 'share fallback did not invoke ZIP export');
  assert.equal(h.shares.length, 0);
  h.dispose();
});

test('WP3 export serializes the real project and file content to JSON', async () => {
  const h = await boot(); const d = h.window.document;
  await createProject(h, 'JSON Export'); await createFile(h, 'payload.txt'); await edit(h, 'export payload');
  d.getElementById('saveButton').click();
  await until(async () => (await h.store('files', [(await h.project()).id, 'payload.txt']))?.content === 'export payload', 'payload did not save');
  d.getElementById('exportButton').click(); d.getElementById('exportFormat').value = 'json'; d.getElementById('exportConfirm').click();
  await until(() => h.downloads.some(item => item.filename.endsWith('.json')), 'JSON export download did not occur');
  const download = h.downloads.find(item => item.filename.endsWith('.json'));
  const blob = h.objectUrls.get(download.href);
  assert.ok(blob);
  const exported = JSON.parse(await blob.text());
  assert.equal(exported.project.name, 'JSON Export');
  assert.ok(exported.files.some(file => file.path === 'payload.txt' && file.content === 'export payload'));
  h.dispose();
});
