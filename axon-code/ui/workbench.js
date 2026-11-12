import {planFileOperation} from '../dist/workbench/fileOperations.js';
const DB_NAME = 'axon-code-direct-workbench';
const DB_VERSION = 1;
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const $ = (id) => document.getElementById(id);
const dialogs = ['projectDialog', 'newFileDialog', 'paletteDialog', 'exportDialog', 'infoDialog'];
let db;
let activeProject = null;
let activePath = null;
let openTabs = [];
let buffers = new Map();
let deletedFile = null;
let toastTimer;
const legacyEditor = $('editor');
let codeEditor;
let terminalEngine;
function setEditorValue(value) {
  legacyEditor.value = String(value ?? '');
  codeEditor?.setValue(legacyEditor.value);
  updateCursorStatus();
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2600);
}
const engineAdapters = window.AXONCodeEngines;
if (!engineAdapters || typeof engineAdapters.mountCodeMirror !== 'function' || typeof engineAdapters.mountXterm !== 'function') {
  throw new Error('Required CodeMirror 6 and xterm.js engine bootstrap is unavailable; no editor or terminal fallback is provided.');
}
codeEditor = engineAdapters.mountCodeMirror({
  parent: $('editorHost'),
  initialText: '',
  onChange(text) {
    legacyEditor.value = text;
    legacyEditor.dispatchEvent(new Event('input', {bubbles:true}));
    updateCursorStatus();
  }
});
legacyEditor.hidden = true;
legacyEditor.setAttribute('aria-hidden','true');
terminalEngine = engineAdapters.mountXterm($('terminalHost'), {onStatus: message => {
  $('terminalStatus').textContent = message;
}});
window.axonCodeWorkbench = {
  connectTerminal(session) {
    const host = window.axonCodeHost;
    if (!host || typeof host.startTerminal !== 'function') throw new Error('Trusted host terminal service is not connected.');
    return Promise.resolve(host.startTerminal(session)).then(connection => terminalEngine.connect(connection));
  }
};

function safePath(raw) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 240 || raw.includes('\\') || raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) return null;
  const parts = raw.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || /[\u0000-\u001f\u007f]/.test(part))) return null;
  if (parts.some((part) => part.endsWith('.') || part.endsWith(' ') || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(part))) return null;
  return parts.join('/');
}
function makeId() { return `user-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`; }
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('projects')) database.createObjectStore('projects', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('files')) database.createObjectStore('files', { keyPath: ['projectId', 'path'] });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'));
  });
}
function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}
async function storePut(store, value) {
  const transaction = db.transaction(store, 'readwrite');
  const result = requestResult(transaction.objectStore(store).put(value));
  await result;
  await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });
}
async function listProjects() {
  const transaction = db.transaction('projects', 'readonly');
  const rows = await requestResult(transaction.objectStore('projects').getAll());
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}
async function listFiles(projectId = activeProject?.id) {
  if (!projectId) return [];
  const transaction = db.transaction('files', 'readonly');
  const rows = await requestResult(transaction.objectStore('files').getAll());
  return rows.filter((row) => row.projectId === projectId && !row.deleted).sort((a, b) => a.path.localeCompare(b.path));
}
async function readFile(projectId, path) {
  const transaction = db.transaction('files', 'readonly');
  return (await requestResult(transaction.objectStore('files').get([projectId, path]))) ?? null;
}
async function writeFile(path, content, expectedRevision) {
  if (!activeProject) throw new Error('Create or open a project first.');
  const canonical = safePath(path);
  if (!canonical) throw new Error('File path is unsafe or non-portable.');
  if (new TextEncoder().encode(content).byteLength > MAX_TEXT_FILE_BYTES) throw new Error('Text file exceeds the 2 MiB editor limit.');
  const projectId = activeProject.id;
  const transaction = db.transaction('files', 'readwrite');
  const store = transaction.objectStore('files');
  const request = store.get([projectId, canonical]);
  const saved = await new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const previous = request.result ?? null;
      if (expectedRevision !== undefined && (previous?.revision ?? 0) !== expectedRevision) {
        const error = new Error('Save conflict: this file changed outside the current editor. Reopen it before saving again.');
        try { transaction.abort(); } catch {}
        reject(error);
        return;
      }
      const record = { projectId, path: canonical, content, sizeBytes: new TextEncoder().encode(content).byteLength, updatedAt: Date.now(), revision: (previous?.revision ?? 0) + 1, deleted: false };
      store.put(record);
      resolve(record);
    };
    request.onerror = () => reject(request.error ?? new Error('File save read failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('File save transaction aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('File save transaction failed.'));
  });
  await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error ?? new Error('File save transaction aborted.')); });
  activeProject = { ...activeProject, updatedAt: Date.now() };
  await storePut('projects', activeProject);
  return saved;
}
async function createProject(name) {
  const cleaned = name.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80);
  if (!cleaned) throw new Error('Project name is required.');
  const project = { id: makeId(), name: cleaned, createdAt: Date.now(), updatedAt: Date.now(), schema: 'axon-direct-browser-project/v1' };
  await storePut('projects', project);
  await storePut('files', { projectId: project.id, path: 'README.md', content: `# ${cleaned}\n\nCreated in the direct-user AXON Code Workbench.\n`, sizeBytes: new TextEncoder().encode(`# ${cleaned}`).byteLength, updatedAt: Date.now(), revision: 1, deleted: false });
  await openProject(project.id);
}
async function openProject(projectId) {
  const projects = await listProjects();
  const project = projects.find((row) => row.id === projectId);
  if (!project) throw new Error('Project could not be found in this browser profile.');
  if (buffers.size && [...buffers.values()].some((buffer) => buffer.dirty)) {
    if (!confirm('There are unsaved changes. Discard them and open another project?')) return;
  }
  activeProject = project;
  activePath = null;
  openTabs = [];
  buffers = new Map();
  deletedFile = null;
  $('projectName').textContent = project.name;
  $('explorerProject').textContent = project.name;
  $('trustBadge').textContent = 'UNTRUSTED';
  await renderExplorer();
  renderTabs();
  updateButtons();
  updateOutput(`Opened project "${project.name}".\nProject trust: UNTRUSTED. Viewing and editing files is allowed; no project scripts are run automatically.`);
}
async function renderExplorer() {
  const tree = $('fileTree');
  tree.replaceChildren();
  const files = await listFiles();
  if (!files.length) { tree.innerHTML = '<div class="empty-state">This project has no files yet. Use + to create one or Add files to import.</div>'; return; }
  const folders = new Set();
  for (const file of files) {
    const segments = file.path.split('/');
    for (let index = 1; index < segments.length; index++) folders.add(segments.slice(0, index).join('/'));
  }
  const rows = [...folders].map((path) => ({ path, directory: true })).concat(files.map((file) => ({ path: file.path, directory: false })));
  rows.sort((a, b) => a.path.localeCompare(b.path) || Number(b.directory) - Number(a.directory));
  for (const row of rows) {
    const button = document.createElement('button');
    button.className = `tree-row${!row.directory && row.path === activePath ? ' active' : ''}`;
    button.style.paddingLeft = `${9 + Math.max(0, row.path.split('/').length - 1) * 12}px`;
    button.innerHTML = `<span class="tree-icon">${row.directory ? '▸' : '◇'}</span><span></span>`;
    button.lastElementChild.textContent = row.directory ? row.path.split('/').at(-1) : row.path.split('/').at(-1);
    if (!row.directory) {
      const buffer = buffers.get(row.path);
      if (buffer?.dirty) { const dot = document.createElement('span'); dot.className = 'dirty-dot'; dot.textContent = '●'; button.append(dot); }
      button.addEventListener('click', () => openFile(row.path));
    } else button.disabled = true;
    tree.append(button);
  }
}
async function openFile(path) {
  if (!activeProject) return;
  const file = await readFile(activeProject.id, path);
  if (!file || file.deleted) { toast('File no longer exists.'); return; }
  if (!buffers.has(path)) buffers.set(path, { content: file.content, savedContent: file.content, dirty: false, revision: file.revision });
  if (!openTabs.includes(path)) openTabs.push(path);
  activePath = path;
  $('editor').disabled = false;
  setEditorValue(buffers.get(path).content);
  updateLanguage(path);
  updateCursorStatus();
  renderTabs();
  await renderExplorer();
  updateButtons();
  $('editorStatus').textContent = 'Opened from this browser workspace';
}
function renderTabs() {
  const tabs = $('tabs'); tabs.replaceChildren();
  if (!openTabs.length) { const placeholder = document.createElement('div'); placeholder.className = 'tab-placeholder'; placeholder.textContent = 'No open files'; tabs.append(placeholder); return; }
  for (const path of openTabs) {
    const button = document.createElement('div'); button.className = `tab${path === activePath ? ' active' : ''}`;
    const label = document.createElement('span'); label.textContent = path;
    const buffer = buffers.get(path);
    if (buffer?.dirty) label.textContent += ' •';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', `Close ${path}`);
    close.addEventListener('click', (event) => { event.stopPropagation(); closeTab(path); });
    button.append(label, close); button.addEventListener('click', () => openFile(path)); tabs.append(button);
  }
}
function closeTab(path) {
  const buffer = buffers.get(path);
  if (buffer?.dirty && !confirm(`Close ${path} with unsaved changes?`)) return;
  buffers.delete(path); openTabs = openTabs.filter((item) => item !== path);
  if (activePath === path) {
    activePath = openTabs.at(-1) ?? null;
    if (activePath) void openFile(activePath);
    else { setEditorValue(''); $('editor').disabled = true; }
  }
  renderTabs(); updateButtons();
}
function updateButtons() {
  const hasProject = Boolean(activeProject); const hasFile = Boolean(activePath);
  $('newFileButton').disabled = !hasProject; $('saveButton').disabled = !hasFile; $('saveAllButton').disabled = !hasProject;
  $('deleteButton').disabled = !hasFile; $('renameButton').disabled = !hasFile; $('moveButton').disabled = !hasFile; $('undoDeleteButton').disabled = !deletedFile; $('previewButton').disabled = !hasProject; $('exportButton').disabled = !hasProject;
  for (const id of ['clearEditorButton','selectAllButton','copyButton','cutButton','pasteButton','downloadButton','shareButton']) $(id).disabled = !hasFile;
}
function updateLanguage(path) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const names = { js: 'JavaScript', mjs: 'JavaScript module', cjs: 'CommonJS', ts: 'TypeScript', tsx: 'TypeScript JSX', jsx: 'JavaScript JSX', py: 'Python', cpp: 'C++', c: 'C', rs: 'Rust', java: 'Java', html: 'HTML', css: 'CSS', json: 'JSON', md: 'Markdown' };
  $('languageStatus').textContent = names[ext] ?? 'Plain text';
}
function updateCursorStatus() {
  const text = codeEditor?.value ?? $('editor').value;
  const count = text.split('\n').length;
  $('cursorStatus').textContent = `Ln ${count}, CodeMirror 6`;
  $('lineNumbers').textContent = Array.from({ length: count }, (_, index) => index + 1).join('\n');
}
function updateOutput(message, append = false) {
  if (append) $('outputText').textContent += `\n${message}`; else $('outputText').textContent = message;
  $('outputText').scrollTop = $('outputText').scrollHeight;
}
async function saveActive() {
  if (!activePath) return;
  const buffer = buffers.get(activePath); if (!buffer) return;
  const stored = await writeFile(activePath, buffer.content, buffer.revision);
  buffer.savedContent = buffer.content; buffer.dirty = false;
  buffer.revision = stored.revision;
  $('editorStatus').textContent = 'Saved'; renderTabs(); await renderExplorer(); updateButtons();
  updateOutput(`Saved ${activePath}.`);
}
async function saveAll() {
  for (const [path, buffer] of buffers) if (buffer.dirty) { const stored = await writeFile(path, buffer.content, buffer.revision); buffer.savedContent = buffer.content; buffer.dirty = false; buffer.revision = stored.revision; }
  renderTabs(); await renderExplorer(); updateButtons(); $('editorStatus').textContent = 'All open files saved'; updateOutput('All open files saved.');
}
async function newFile(path) {
  const canonical = safePath(path);
  if (!canonical) throw new Error('The file path is unsafe or non-portable.');
  const existing = await readFile(activeProject.id, canonical);
  if (existing && !existing.deleted) throw new Error('A file already exists at that path.');
  await writeFile(canonical, ''); await openFile(canonical); codeEditor.focus(); toast(`Created ${canonical}`);
}
async function deleteActive() {
  if (!activePath || !activeProject) return;
  const path = activePath;
  if (!confirm(`Move ${path} to the temporary undo area?`)) return;
  const file = await readFile(activeProject.id, path); if (!file || file.deleted) throw new Error('Cannot delete: the file no longer exists in the project store.');
  deletedFile = { ...file, deleted: false };
  await storePut('files', { ...file, deleted: true, deletedAt: Date.now() });
  closeTab(path); activePath = openTabs.at(-1) ?? null;
  if (activePath) await openFile(activePath); else { setEditorValue(''); $('editor').disabled = true; }
  await renderExplorer(); updateButtons(); toast(`Moved ${path} to undo area.`);
}
async function undoDelete() {
  if (!deletedFile || !activeProject) return;
  const current = await readFile(activeProject.id, deletedFile.path);
  if (current && !current.deleted) throw new Error('Cannot restore: another file now occupies this path.');
  await storePut('files', { ...deletedFile, deleted: false, revision: (current?.revision ?? 0) + 1, updatedAt: Date.now() });
  const restored = deletedFile.path; deletedFile = null; await openFile(restored); updateButtons(); toast(`Restored ${restored}`);
}
async function relocateActive(operation) {
  if (!activeProject || !activePath) throw new Error('Open a file first.');
  const currentBuffer = buffers.get(activePath);
  if (currentBuffer?.dirty) await saveActive();
  const destination = prompt(operation === 'rename' ? 'New filename in the same directory:' : 'New project-relative path:');
  if (destination === null) return;
  const paths = (await listFiles()).map(file => file.path);
  const plan = planFileOperation(operation, activePath, destination.trim(), paths);
  const sourceFile = await readFile(activeProject.id, plan.source);
  if (!sourceFile || sourceFile.deleted) throw new Error('Source file no longer exists.');
  const tx = db.transaction('files', 'readwrite'); const store = tx.objectStore('files');
  const destinationRequest = store.get([activeProject.id, plan.destination]);
  await new Promise((resolve, reject) => {
    destinationRequest.onsuccess = () => {
      const occupied = destinationRequest.result;
      if (occupied && !occupied.deleted) { tx.abort(); reject(new Error('Destination already exists.')); return; }
      const now = Date.now();
      store.put({...sourceFile, path:plan.destination, updatedAt:now, revision:(occupied?.revision ?? 0)+1, deleted:false});
      store.put({...sourceFile, deleted:true, deletedAt:now});
    };
    destinationRequest.onerror = () => reject(destinationRequest.error);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('File operation aborted.'));
  });
  const oldBuffer = buffers.get(plan.source);
  buffers.delete(plan.source);
  if (oldBuffer) buffers.set(plan.destination, {...oldBuffer, revision:(oldBuffer.revision ?? 0)+1});
  openTabs = openTabs.map(path => path === plan.source ? plan.destination : path);
  activePath = plan.destination;
  await openFile(plan.destination); await renderExplorer(); updateButtons();
  toast(`${operation === 'rename' ? 'Renamed' : 'Moved'} ${plan.source} → ${plan.destination}`);
}
async function copySelection() {
  const selected = codeEditor.getSelection();
  if (!selected) throw new Error('Select text before copying.');
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard write access is unavailable in this browser context.');
  await navigator.clipboard.writeText(selected); toast('Selection copied.');
}
async function cutSelection() {
  const selected = codeEditor.getSelection();
  if (!selected) throw new Error('Select text before cutting.');
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard write access is unavailable in this browser context.');
  await navigator.clipboard.writeText(selected); codeEditor.replaceSelection(''); codeEditor.focus();
}
async function pasteClipboard() {
  if (!navigator.clipboard?.readText) throw new Error('Clipboard read access is unavailable in this browser context.');
  const text = await navigator.clipboard.readText(); codeEditor.replaceSelection(text); codeEditor.focus();
}
function downloadActive() {
  if (!activePath) throw new Error('Open a file first.');
  const blob = new Blob([codeEditor.value], {type:'text/plain;charset=utf-8'}); const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href=url; anchor.download=activePath.split('/').at(-1); document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  updateOutput(`Downloaded ${activePath}.`);
}
async function shareProject() {
  if (!activeProject) throw new Error('Open a project first.');
  const files = await listFiles();
  if (!navigator.share || typeof File === 'undefined') { await exportProject('zip'); toast('Native sharing is unavailable; project ZIP download started.'); return; }
  const file = new File([makeStoredZip(files)], `${activeProject.name}.zip`, {type:'application/zip'});
  if (navigator.canShare && !navigator.canShare({files:[file]})) throw new Error('This browser cannot share project files. Use Export instead.');
  await navigator.share({title:`AXON Code: ${activeProject.name}`, files:[file]});
}
async function importFiles(fileList) {
  if (!activeProject) throw new Error('Create or open a project first.');
  let added = 0, skipped = 0;
  for (const file of fileList) {
    const rawPath = file.webkitRelativePath || file.name;
    const canonical = safePath(rawPath);
    if (!canonical || file.size > MAX_TEXT_FILE_BYTES) { skipped += 1; continue; }
    const content = await file.text();
    if (content.includes('\u0000')) { skipped += 1; continue; }
    await writeFile(canonical, content); added += 1;
  }
  await renderExplorer(); updateOutput(`Import complete: ${added} text file(s) added; ${skipped} unsafe, binary-like or over-limit file(s) skipped.`);
  toast(`Imported ${added} file(s)`);
}
function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ -1) >>> 0;
}
function makeStoredZip(files) {
  const enc = new TextEncoder(); const locals = []; const centrals = []; let offset = 0;
  const u16 = (view, at, value) => view.setUint16(at, value, true); const u32 = (view, at, value) => view.setUint32(at, value, true);
  for (const file of files) {
    const name = enc.encode(file.path); const data = enc.encode(file.content); const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length); const lv = new DataView(local.buffer);
    u32(lv,0,0x04034b50); u16(lv,4,20); u16(lv,6,0x0800); u16(lv,8,0); u32(lv,14,crc); u32(lv,18,data.length); u32(lv,22,data.length); u16(lv,26,name.length); u16(lv,28,0); local.set(name,30); local.set(data,30+name.length); locals.push(local);
    const central = new Uint8Array(46 + name.length); const cv = new DataView(central.buffer);
    u32(cv,0,0x02014b50); u16(cv,4,20); u16(cv,6,20); u16(cv,8,0x0800); u16(cv,10,0); u32(cv,16,crc); u32(cv,20,data.length); u32(cv,24,data.length); u16(cv,28,name.length); u16(cv,30,0); u16(cv,32,0); u32(cv,42,offset); central.set(name,46); centrals.push(central); offset += local.length;
    if (offset > 256 * 1024 * 1024) throw new Error('ZIP export exceeds 256 MiB.');
  }
  const centralLength = centrals.reduce((sum,item) => sum + item.length,0); const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  u32(ev,0,0x06054b50); u16(ev,8,files.length); u16(ev,10,files.length); u32(ev,12,centralLength); u32(ev,16,offset);
  return new Blob([...locals,...centrals,end],{type:'application/zip'});
}
async function exportProject(format) {
  const files = await listFiles();
  if (!files.length) throw new Error('There are no files to export.');
  const sensitive = files.filter((file) => /(^|\/)(\.env(?:\.|$)|id_rsa|id_ed25519|credentials?\.|secrets?\.)/i.test(file.path));
  if (sensitive.length && !confirm(`Sensitive-looking files are included:\n${sensitive.map((file) => file.path).join('\n')}\nContinue with export?`)) return;
  let blob, filename;
  if (format === 'zip') { blob = makeStoredZip(files); filename = `${activeProject.name.replace(/[^a-z0-9_-]+/gi,'-')}.zip`; }
  else if (format === 'json') { blob = new Blob([JSON.stringify({schema:'axon-direct-export/v1',project:activeProject,files:files.map(({path,content})=>({path,content}))},null,2)],{type:'application/json'}); filename = `${activeProject.name}.json`; }
  else { const body = files.map((file) => `===== ${file.path} =====\n${file.content}`).join('\n\n'); blob = new Blob([format === 'md' ? `# ${activeProject.name}\n\n${body}` : body],{type:format==='md'?'text/markdown':'text/plain'}); filename = `${activeProject.name}.${format}`; }
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href=url; anchor.download=filename; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  updateOutput(`Exported ${files.length} file(s) as ${filename}. Review the exported contents before sharing.`); toast('Export started');
}
function installPreviewErrorBridge() {
  window.addEventListener('message', (event) => {
    if (event.source !== $('previewFrame').contentWindow || !event.data || event.data.__axonPreviewError !== true) return;
    $('problemsText').textContent = `${event.data.message || 'Preview error'}\n${event.data.source || ''}:${event.data.line || '?'}:${event.data.column || '?'}`;
    updateOutput(`Preview error: ${event.data.message || 'Unknown error'}`, true);
  });
}
async function previewProject() {
  const files = await listFiles(); const byPath = new Map(files.map((file) => [file.path, file.content]));
  let htmlPath = byPath.has('index.html') ? 'index.html' : files.find((file) => /\.html?$/i.test(file.path))?.path;
  if (!htmlPath) throw new Error('No HTML entry file was found. Web preview is not available for this project.');
  let html = byPath.get(htmlPath); const base = htmlPath.includes('/') ? htmlPath.slice(0, htmlPath.lastIndexOf('/') + 1) : '';
  const resolveAsset = (raw) => { if (/^(?:[a-z]+:|\/|#|data:)/i.test(raw)) return null; const joined = `${base}${raw.replace(/^\.\//,'')}`.split('/'); const output=[]; for (const part of joined) { if (part==='..') { if (!output.length) return null; output.pop(); } else if (part && part!=='.') output.push(part); } const path=safePath(output.join('/')); return path ? byPath.get(path) : null; };
  html = html.replace(/<link\b([^>]*?)href=["']([^"']+)["']([^>]*)>/gi, (whole, before, href, after) => {
    if (!/stylesheet/i.test(`${before} ${after}`)) return '<!-- external/non-style resource omitted by AXON preview -->';
    const css = resolveAsset(href); return css === null ? '<!-- blocked external or missing stylesheet -->' : `<style>\n${css.replace(/<\/style/gi,'<\\/style')}\n</style>`;
  });
  html = html.replace(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi, (_whole, before, src, after) => {
    const js = resolveAsset(src); return js === null ? '<!-- blocked external or missing script -->' : `<script>${js.replace(/<\/script/gi,'<\\/script')}<\/script>`;
  });
  html = html.replace(/<script\b(?![^>]*\bsrc=)/gi, '<script');
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
  const bridge = `<script>addEventListener('error',function(e){parent.postMessage({__axonPreviewError:true,message:String(e.message||'Preview error'),source:String(e.filename||''),line:e.lineno||0,column:e.colno||0},'*')});addEventListener('unhandledrejection',function(e){parent.postMessage({__axonPreviewError:true,message:String(e.reason&&e.reason.message||e.reason||'Unhandled rejection')},'*')});<\/script>`;
  html = html.replace(/<head\b[^>]*>/i, (match) => `${match}${csp}${bridge}`);
  if (!/<head\b/i.test(html)) html = `<!doctype html><html><head>${csp}${bridge}</head><body>${html}</body></html>`;
  $('previewFrame').srcdoc = html; switchPanel('preview'); updateOutput(`Preview loaded from ${htmlPath}. Only local linked CSS/JS were inlined. Network access is blocked by the preview CSP.`);
}
function switchPanel(name) {
  for (const panel of ['output','problems','preview','resources','terminal','capabilities']) {
    $(`${panel}Panel`).classList.toggle('hidden', panel !== name);
    document.querySelector(`[data-panel="${panel}"]`).classList.toggle('active', panel === name);
  }
}
async function loadCapabilities() {
  const target = $('capabilityList');
  target.replaceChildren();
  try {
    let registry = window.__AXON_CAPABILITY_REGISTRY__ ?? null;
    if (!registry) {
      const response = await fetch('../docs/CAPABILITY_REGISTRY.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Registry request failed (${response.status}).`);
      registry = await response.json();
    }
    if (registry.schemaVersion !== 1 || !Array.isArray(registry.capabilities)) throw new Error('Registry schema is not recognised.');
    if (!registry.capabilities.length) throw new Error('No capability result records are available.');
    for (const item of registry.capabilities) {
      const row = document.createElement('div');
      row.className = 'capability-row';
      const name = document.createElement('strong');
      name.textContent = item.id;
      const status = document.createElement('span');
      status.textContent = item.status;
      status.className = `capability-status status-${String(item.status).toLowerCase().replace(/[^a-z]+/g, '-')}`;
      row.append(name, status);
      target.append(row);
    }
  } catch (error) {
    target.textContent = `NOT RUN — capability registry unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}
function allCommands() {
  return [
    ['New project', () => $('newProjectButton').click()], ['Open / import files', () => $('openProjectButton').click()], ['Create file', () => $('newFileButton').click()],
    ['Save current file', () => saveActive()], ['Save all open files', () => saveAll()], ['Rename active file', () => relocateActive('rename')], ['Move active file', () => relocateActive('move')], ['Clear editor', () => codeEditor.clear()], ['Select all source text', () => codeEditor.selectAll()], ['Copy source text', () => copySelection()], ['Cut source text', () => cutSelection()], ['Paste clipboard', () => pasteClipboard()], ['Download active file', () => downloadActive()], ['Share project', () => shareProject()], ['Preview web project', () => previewProject()], ['Export project', () => $('exportButton').click()],
    ['Show output panel', () => switchPanel('output')], ['Show problems panel', () => switchPanel('problems')], ['Show preview panel', () => switchPanel('preview')],
    ['Show resources panel', () => switchPanel('resources')], ['Show terminal status', () => switchPanel('terminal')], ['Show capability registry', () => { switchPanel('capabilities'); return loadCapabilities(); }]
  ];
}
function showPalette() {
  const dialog = $('paletteDialog'); const input = $('paletteSearch'); const list = $('paletteCommands');
  const draw = () => { list.replaceChildren(); for (const [name, action] of allCommands().filter(([name]) => name.toLowerCase().includes(input.value.toLowerCase()))) { const button=document.createElement('button'); button.className='palette-command'; button.textContent=name; button.addEventListener('click',()=>{dialog.close();Promise.resolve(action()).catch((error)=>toast(error.message));}); list.append(button); } };
  input.value=''; input.oninput=draw; draw(); dialog.showModal(); input.focus();
}
async function refreshResources() {
  const rows = [];
  const memory = performance.memory?.usedJSHeapSize;
  rows.push(`<div><strong>Browser memory</strong><span>${Number.isFinite(memory) ? `${(memory/1048576).toFixed(1)} MiB JS heap` : 'Not exposed'}</span></div>`);
  let storage = 'Not exposed';
  try { const estimate = await navigator.storage?.estimate?.(); if (estimate) storage = `${((estimate.usage||0)/1048576).toFixed(1)} / ${((estimate.quota||0)/1048576).toFixed(1)} MiB`; } catch {}
  rows.push(`<div><strong>Storage</strong><span>${storage}</span></div><div><strong>Host runtime</strong><span>Not connected</span></div><div><strong>Thermal / battery</strong><span>Unavailable in browser</span></div>`);
  $('resourceText').innerHTML = rows.join('');
}

$('editor').addEventListener('input', () => {
  if (!activePath) return;
  const buffer = buffers.get(activePath); if (!buffer) return;
  buffer.content = $('editor').value; buffer.dirty = buffer.content !== buffer.savedContent;
  $('editorStatus').textContent = buffer.dirty ? 'Unsaved changes' : 'Saved'; updateCursorStatus(); renderTabs(); void renderExplorer(); updateButtons();
});
$('editor').addEventListener('click', updateCursorStatus); $('editor').addEventListener('keyup', updateCursorStatus);
$('editor').addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveActive().catch((error)=>toast(error.message)); }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); showPalette(); }
  if (event.key === 'Tab') { event.preventDefault(); codeEditor.replaceSelection('  '); }
});
document.querySelectorAll('[data-insert]').forEach((button) => button.addEventListener('click', () => {
  const value = button.dataset.insert.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('\\n','\n');
  if ($('editor').disabled) return; codeEditor.replaceSelection(value); codeEditor.focus();
}));
$('newProjectButton').addEventListener('click', () => $('projectDialog').showModal());
$('createProjectConfirm').addEventListener('click', (event) => { event.preventDefault(); $('projectDialog').close(); void createProject($('projectNameInput').value).then(()=>toast('Project created')).catch((error)=>toast(error.message)); });
$('openProjectButton').addEventListener('click', async () => {
  const projects=await listProjects(); if (projects.length) { const choice=prompt(`Enter a project number to open, or leave blank to import files:\n${projects.map((project,index)=>`${index+1}. ${project.name}`).join('\n')}`); if (choice?.trim()) { const index=Number(choice)-1; if (projects[index]) return openProject(projects[index].id); } }
  if (!activeProject) { $('importProjectInput').click(); return; } $('fileInput').click();
});
$('importProjectInput').addEventListener('change', async (event) => {
  const files=[...event.target.files]; if (!files.length) return; const defaultName=files[0].webkitRelativePath?.split('/')[0] || files[0].name.replace(/\.[^.]+$/,'');
  await createProject(defaultName); await importFiles(files); event.target.value='';
});
$('fileInput').addEventListener('change', (event)=>void importFiles([...event.target.files]).catch((error)=>toast(error.message)).finally(()=>event.target.value=''));
$('importFilesButton').addEventListener('click', ()=>$('fileInput').click());
$('newFileButton').addEventListener('click', ()=>$('newFileDialog').showModal());
$('createFileConfirm').addEventListener('click',(event)=>{event.preventDefault();$('newFileDialog').close();void newFile($('newFilePath').value).catch((error)=>toast(error.message));});
$('saveButton').addEventListener('click',()=>void saveActive().catch((error)=>toast(error.message)));
$('saveAllButton').addEventListener('click',()=>void saveAll().catch((error)=>toast(error.message)));
$('renameButton').addEventListener('click',()=>void relocateActive('rename').catch((error)=>toast(error.message)));
$('moveButton').addEventListener('click',()=>void relocateActive('move').catch((error)=>toast(error.message)));
$('clearEditorButton').addEventListener('click',()=>{if(activePath && confirm('Clear the entire editor contents?')) codeEditor.clear();});
$('selectAllButton').addEventListener('click',()=>{codeEditor.selectAll();codeEditor.focus();});
$('copyButton').addEventListener('click',()=>void copySelection().catch(error=>toast(error.message)));
$('cutButton').addEventListener('click',()=>void cutSelection().catch(error=>toast(error.message)));
$('pasteButton').addEventListener('click',()=>void pasteClipboard().catch(error=>toast(error.message)));
$('downloadButton').addEventListener('click',()=>{try{downloadActive();}catch(error){toast(error.message);}});
$('shareButton').addEventListener('click',()=>void shareProject().catch(error=>toast(error.message)));
$('deleteButton').addEventListener('click',()=>void deleteActive().catch((error)=>toast(error.message)));
$('undoDeleteButton').addEventListener('click',()=>void undoDelete().catch((error)=>toast(error.message)));
$('refreshButton').addEventListener('click',()=>void renderExplorer());
$('previewButton').addEventListener('click',()=>void previewProject().catch((error)=>{switchPanel('problems');$('problemsText').textContent=error.message;}));
$('exportButton').addEventListener('click',()=>$('exportDialog').showModal());
$('exportConfirm').addEventListener('click',(event)=>{event.preventDefault();$('exportDialog').close();void exportProject($('exportFormat').value).catch((error)=>toast(error.message));});
$('paletteButton').addEventListener('click',showPalette);
$('settingsButton').addEventListener('click',()=>$('infoDialog').showModal());
document.querySelectorAll('[data-panel]').forEach((button)=>button.addEventListener('click',()=>{switchPanel(button.dataset.panel);if(button.dataset.panel==='resources')void refreshResources();if(button.dataset.panel==='capabilities')void loadCapabilities();}));
window.addEventListener('beforeunload',(event)=>{if ([...buffers.values()].some((buffer)=>buffer.dirty)) {event.preventDefault();event.returnValue='';}});
window.addEventListener('keydown',(event)=>{if ((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='p'){event.preventDefault();showPalette();}});

try {
  db = await openDatabase(); installPreviewErrorBridge(); await refreshResources(); await loadCapabilities();
  const projects = await listProjects();
  if (projects.length) await openProject(projects[0].id);
  updateOutput(`AXON Code direct-user Workbench loaded.\n${projects.length} local project(s) found.\nThe browser workbench does not depend on AXON Brain. Native execution and terminal remain host-provider capabilities.`);
} catch (error) {
  updateOutput(`Workbench initialisation failed: ${error instanceof Error ? error.message : String(error)}`);
  toast('Local workspace could not initialise.');
}
