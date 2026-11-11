import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { 
  MemoryWorkspaceFileStore, MemoryKeyValueStore, ProjectSelectionManager, ProjectSelectionController,
  ProjectExportService, ProjectActionService, WorkspaceLifecycleManager, SafeZipExtractor,
  MemoryTransactionalExtractionSink, BrowserClipboardAdapter, BrowserShareAdapter, BrowserDownloadAdapter,
  copyProjectPayload, shareProjectPayload, isSensitiveProjectPath
} from '../dist/index.js';

function makeEnv(initial = {
  'src/main.ts': 'import { add } from "./math.js";\nconsole.log(add(20, 22));\n',
  'src/math.js': 'export const add = (a, b) => a + b;\n',
  'README.md': '# Demo\n',
  'tests/main.test.ts': 'test("works", () => {});\n',
  'node_modules/pkg/index.js': 'module.exports = 1;\n',
  'dist/bundle.js': 'generated();\n',
  'config/.env': 'TOKEN=secret-value\n',
  'keys/private.pem': 'PRIVATE KEY\n'
}, now = () => 1000) {
  const store = new MemoryWorkspaceFileStore();
  const kv = new MemoryKeyValueStore();
  const workspaceId = 'project-one';
  for (const [path, content] of Object.entries(initial)) awaitStoreWrite(store, workspaceId, path, content);
  const selection = new ProjectSelectionManager(store, {}, now);
  const exports = new ProjectExportService(selection);
  const lifecycle = new WorkspaceLifecycleManager(store, kv, selection, 300_000, now);
  const actions = new ProjectActionService(selection, exports, lifecycle);
  return { store, kv, workspaceId, selection, exports, lifecycle, actions };
}
function awaitStoreWrite(store, workspaceId, path, content) { store.write(workspaceId, path, content); }

// Selection coverage: explicit, whole-project and deterministic auto-selection.
test('R7-SEL-001 ALL selects the whole workspace and fingerprints exact contents', async () => {
  const env = makeEnv(); const result = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' });
  assert.equal(result.fileCount, 8);
  assert.ok(result.fingerprint.length === 64);
  assert.ok(result.sensitiveFiles.includes('config/.env'));
});
test('R7-SEL-002 AUTO selects source/config but excludes generated and dependency folders', async () => {
  const env = makeEnv(); const result = await env.selection.select({ workspaceId: env.workspaceId, mode: 'AUTO', includeTests: true });
  assert.ok(result.paths.includes('src/main.ts'));
  assert.ok(result.paths.includes('README.md'));
  assert.ok(!result.paths.some((path) => path.startsWith('node_modules/')));
  assert.ok(!result.paths.some((path) => path.startsWith('dist/')));
  assert.ok(!result.paths.includes('config/.env'));
});
test('R7-SEL-003 AUTO excludes tests by default and includes them only on request', async () => {
  const env = makeEnv();
  const defaultSelection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'AUTO' });
  assert.ok(!defaultSelection.paths.includes('tests/main.test.ts'));
  const withTests = await env.selection.select({ workspaceId: env.workspaceId, mode: 'AUTO', includeTests: true });
  assert.ok(withTests.paths.includes('tests/main.test.ts'));
});
test('R7-SEL-004 EXPLICIT selection preserves exact requested files and rejects unknown paths', async () => {
  const env = makeEnv();
  const picked = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['src/math.js', 'README.md'] });
  assert.deepEqual(picked.paths, ['README.md', 'src/math.js']);
  await assert.rejects(() => env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['nope.js'] }), /does not exist/);
});
test('R7-SEL-005 EXPLICIT selection rejects duplicate paths and traversal', async () => {
  const env = makeEnv();
  await assert.rejects(() => env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['src/main.ts', 'src/main.ts'] }), /duplicate/);
  await assert.rejects(() => env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['../outside'] }), /unsafe/);
});
test('R7-SEL-006 AUTO can select all supported text extensions deterministically', async () => {
  const env = makeEnv(); const picked = await env.selection.select({ workspaceId: env.workspaceId, mode: 'AUTO', preset: 'ALL_TEXT', includeTests: true });
  assert.ok(picked.paths.includes('src/main.ts'));
  assert.ok(picked.paths.includes('README.md'));
  assert.ok(!picked.paths.includes('node_modules/pkg/index.js'));
});
test('R7-SEL-007 sensitive-file recognition handles nested secret paths', () => {
  assert.equal(isSensitiveProjectPath('config/.env'), true);
  assert.equal(isSensitiveProjectPath('keys/private.pem'), true);
  assert.equal(isSensitiveProjectPath('config/.env.example'), false);
});
test('R7-SEL-008 explicit sensitive inclusion is visible and auto inclusion requires opt-in', async () => {
  const env = makeEnv();
  const auto = await env.selection.select({ workspaceId: env.workspaceId, mode: 'AUTO', includeSensitiveFiles: true });
  assert.ok(auto.sensitiveFiles.includes('config/.env'));
  const explicit = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['config/.env'] });
  assert.ok(explicit.warnings.length > 0);
});
test('R7-SEL-014 common credential stores are treated as sensitive paths', () => {
  for (const path of ['.npmrc', '.pypirc', '.netrc', '.aws/credentials', '.ssh/id_ed25519', 'deploy/token.secret']) {
    assert.equal(isSensitiveProjectPath(path), true, path);
  }
});
test('R7-SEL-015 export independently rechecks secret paths even if selection warnings are altered', async () => {
  const env = makeEnv(); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['config/.env'] });
  selection.sensitiveFiles = []; selection.warnings = [];
  await assert.rejects(() => env.exports.export(selection, 'txt'), /Sensitive-looking files require explicit export confirmation/);
});
test('R7-SEL-016 selection fingerprint is bound to its workspace identity', async () => {
  const store = new MemoryWorkspaceFileStore();
  await store.write('workspace-a', 'src/main.ts', 'same');
  await store.write('workspace-b', 'src/main.ts', 'same');
  const manager = new ProjectSelectionManager(store);
  const selection = await manager.select({ workspaceId: 'workspace-a', mode: 'ALL' });
  selection.workspaceId = 'workspace-b';
  await assert.rejects(() => manager.capture(selection), /changed after selection/);
});
test('R7-SEL-017 workspace identifiers reject control characters and excessive length', async () => {
  const env = makeEnv();
  await assert.rejects(() => env.selection.select({ workspaceId: 'bad\nworkspace', mode: 'ALL' }), /Workspace ID/);
  await assert.rejects(() => env.selection.select({ workspaceId: 'x'.repeat(201), mode: 'ALL' }), /Workspace ID/);
});
test('R7-SEL-009 selection snapshot becomes invalid after a file changes', async () => {
  const env = makeEnv(); const picked = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['src/main.ts'] });
  await env.store.write(env.workspaceId, 'src/main.ts', 'changed');
  await assert.rejects(() => env.selection.capture(picked), /changed after selection/);
});
test('R7-SEL-010 selection is bounded by file and total-byte limits', async () => {
  const store = new MemoryWorkspaceFileStore(); await store.write('big', 'a.txt', '123456789');
  const limited = new ProjectSelectionManager(store, { maxFileBytes: 8, maxTotalBytes: 16 });
  await assert.rejects(() => limited.select({ workspaceId: 'big', mode: 'ALL' }), /per-file|selection limit/i);
});
test('R7-SEL-011 case-insensitive collisions are refused', async () => {
  const store = new MemoryWorkspaceFileStore(); await store.write('case', 'A.ts', 'a'); await store.write('case', 'a.ts', 'b');
  const manager = new ProjectSelectionManager(store);
  await assert.rejects(() => manager.select({ workspaceId: 'case', mode: 'ALL' }), /collision/);
});
test('R7-SEL-012 non-portable Unicode bidi and reserved paths are refused', async () => {
  for (const bad of ['src/x\u202Egpj.ts', 'CON.ts', 'file.']) {
    const store = new MemoryWorkspaceFileStore(); await store.write('bad', bad, 'x');
    await assert.rejects(() => new ProjectSelectionManager(store).select({ workspaceId: 'bad', mode: 'ALL' }), /non-portable|unsafe/);
  }
});
test('R7-SEL-013 selection controller can select, toggle and clear without touching files', async () => {
  const env = makeEnv(); const controller = new ProjectSelectionController();
  controller.selectAll(['src/main.ts', 'src/math.js']); controller.toggle('src/math.js');
  assert.deepEqual(controller.list(), ['src/main.ts']); controller.clear();
  assert.deepEqual(controller.list(), []); assert.ok(await env.store.read(env.workspaceId, 'src/main.ts'));
});

// Export formats preserve source bytes where they claim to be source-preserving.
test('R7-EXP-001 TXT export includes every file path and exact contents', async () => {
  const env = makeEnv(); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['src/main.ts', 'src/math.js'] });
  const payload = await env.exports.export(selection, 'txt'); const text = new TextDecoder().decode(payload.bytes);
  assert.match(text, /===== FILE: src\/main.ts =====/); assert.match(text, /console\.log\(add\(20, 22\)\)/);
  assert.match(text, /===== FILE: src\/math\.js =====/);
});
test('R7-EXP-002 Markdown export expands fences to avoid code-content injection', async () => {
  const env = makeEnv({ 'src/quotes.ts': 'const sample = "```";\n' });
  const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' });
  const payload = await env.exports.export(selection, 'md'); const text = new TextDecoder().decode(payload.bytes);
  assert.match(text, /````ts/); assert.ok(text.includes('```"'));
});
test('R7-EXP-003 JSON export preserves all selected paths and text exactly', async () => {
  const env = makeEnv(); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['src/main.ts', 'README.md'] });
  const payload = await env.exports.export(selection, 'json'); const parsed = JSON.parse(new TextDecoder().decode(payload.bytes));
  assert.equal(parsed.files.length, 2); assert.equal(parsed.files.find((file) => file.path === 'src/main.ts').content, await env.store.read(env.workspaceId, 'src/main.ts'));
});
test('R7-EXP-004 ZIP export parses, extracts and CRC-verifies with independent readers', async (t) => {
  const env = makeEnv(); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['src/main.ts', 'src/math.js'] });
  const payload = await env.exports.export(selection, 'zip');
  const sink = new MemoryTransactionalExtractionSink(2 * 1024 * 1024);
  const result = await new SafeZipExtractor().extract(payload.bytes, sink, 'r7-export-roundtrip');
  assert.equal(result.success, true); assert.equal(result.filesWritten, 3);
  assert.equal(new TextDecoder().decode(sink.committed.get('src/main.ts')), await env.store.read(env.workspaceId, 'src/main.ts'));
  assert.ok(sink.committed.has('__AXON_EXPORT__/manifest.json'));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'axon-r7-zip-')); const file = path.join(dir, payload.filename);
  try {
    await writeFile(file, payload.bytes);
    const independent = spawnSync('unzip', ['-t', file], { encoding: 'utf8' });
    if (independent.error?.code === 'ENOENT') { t.skip('Info-ZIP unzip is not installed on this host.'); return; }
    assert.equal(independent.status, 0, independent.stderr || independent.stdout);
    const extracted = spawnSync('unzip', ['-p', file, 'src/main.ts'], { encoding: 'utf8' });
    assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout);
    assert.equal(extracted.stdout, await env.store.read(env.workspaceId, 'src/main.ts'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('R7-EXP-005 ZIP export refuses collision with reserved manifest path', async () => {
  const env = makeEnv({ '__AXON_EXPORT__/manifest.json': 'user data' });
  const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' });
  await assert.rejects(() => env.exports.export(selection, 'zip'), /reserved export manifest path/);
});
test('R7-EXP-005B ZIP export rejects case-insensitive collision with reserved manifest path', async () => {
  const env = makeEnv({ '__axon_export__/Manifest.json': 'user data' });
  const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' });
  await assert.rejects(() => env.exports.export(selection, 'zip'), /reserved export manifest path/);
});
test('R7-EXP-006 PDF export is accepted by independent PDF tools and preserves the file label', async (t) => {
  const env = makeEnv(); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['src/main.ts'] });
  const payload = await env.exports.export(selection, 'pdf'); const pdf = new TextDecoder().decode(payload.bytes);
  assert.ok(pdf.startsWith('%PDF-1.4')); assert.match(pdf, /\/Type \/Catalog/); assert.match(pdf, /startxref\n\d+\n%%EOF/);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'axon-r7-pdf-')); const file = path.join(dir, payload.filename);
  try {
    await writeFile(file, payload.bytes);
    const info = spawnSync('pdfinfo', [file], { encoding: 'utf8' });
    if (info.error?.code === 'ENOENT') { t.skip('Poppler pdfinfo/pdftotext are not installed on this host.'); return; }
    assert.equal(info.status, 0, info.stderr || info.stdout);
    const extracted = spawnSync('pdftotext', [file, '-'], { encoding: 'utf8' });
    assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout);
    assert.match(extracted.stdout, /FILE: src\/main\.ts/);
    assert.match(extracted.stdout, /console\.log/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('R7-EXP-007 PDF output makes non-base-font Unicode explicit instead of dropping it', async (t) => {
  const env = makeEnv({ 'unicode.txt': 'emoji 😀 and CJK 中文' }); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['unicode.txt'] });
  const payload = await env.exports.export(selection, 'pdf');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'axon-r7-pdf-unicode-')); const file = path.join(dir, payload.filename);
  try {
    await writeFile(file, payload.bytes);
    const extracted = spawnSync('pdftotext', [file, '-'], { encoding: 'utf8' });
    if (extracted.error?.code === 'ENOENT') { t.skip('Poppler pdftotext is not installed on this host.'); return; }
    assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout);
    assert.match(extracted.stdout, /\\u\{1F600\}/); assert.match(extracted.stdout, /\\u\{4E2D\}/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('R7-EXP-008 secret-bearing exports require explicit opt-in', async () => {
  const env = makeEnv(); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['config/.env'] });
  await assert.rejects(() => env.exports.export(selection, 'txt'), /Sensitive-looking files require explicit/);
  const payload = await env.exports.export(selection, 'txt', { allowSensitiveFiles: true });
  assert.equal(payload.includedFiles[0], 'config/.env');
});
test('R7-EXP-009 changed project cannot be exported using a stale selection fingerprint', async () => {
  const env = makeEnv(); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['README.md'] });
  await env.store.write(env.workspaceId, 'README.md', 'modified after selection');
  await assert.rejects(() => env.exports.export(selection, 'json'), /changed after selection/);
});
test('R7-EXP-010 huge output is refused before a download payload is returned', async () => {
  const env = makeEnv({ 'large.txt': 'x'.repeat(1000) }); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' });
  const limited = new ProjectExportService(env.selection, { maxOutputBytes: 100 });
  await assert.rejects(() => limited.export(selection, 'json'), /exceeds 100 bytes/);
});
test('R7-EXP-010B PDF Unicode is not split when a surrogate pair lies at a wrap boundary', async (t) => {
  const env = makeEnv({ 'unicode-long.txt': `${'a'.repeat(125)}😀` });
  const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['unicode-long.txt'] });
  const payload = await env.exports.export(selection, 'pdf');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'axon-r7-pdf-wrap-')); const file = path.join(dir, payload.filename);
  try {
    await writeFile(file, payload.bytes);
    const extracted = spawnSync('pdftotext', [file, '-'], { encoding: 'utf8' });
    if (extracted.error?.code === 'ENOENT') { t.skip('Poppler pdftotext is not installed on this host.'); return; }
    assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout);
    assert.match(extracted.stdout, /\\u\{1F600\}/);
    assert.doesNotMatch(extracted.stdout, /\\u\{D83D\}|\\u\{DE00\}/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('R7-EXP-011 filename generation strips path and control injection', async () => {
  const env = makeEnv(); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['README.md'] });
  const payload = await env.exports.export(selection, 'txt', { projectName: '../../evil\nname' });
  assert.ok(!payload.filename.includes('/')); assert.ok(!payload.filename.includes('\n')); assert.ok(!/[\u202a-\u202e\u2066-\u2069]/.test(payload.filename));
});
test('R7-EXP-012 output format type is validated', async () => {
  const env = makeEnv(); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['README.md'] });
  await assert.rejects(() => env.exports.export(selection, 'exe'), /Unsupported project export format/);
});

// Clipboard/share/download are host capabilities; tests use adapters and never claim a device UI test.
test('R7-HOST-001 clipboard writes complete TXT export through supplied adapter', async () => {
  const env = makeEnv(); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['README.md'] });
  const payload = await env.exports.export(selection, 'txt'); let copied = '';
  await copyProjectPayload({ async writeText(value) { copied = value; } }, payload);
  assert.equal(copied, new TextDecoder().decode(payload.bytes));
});
test('R7-HOST-002 clipboard byte cap directs large project to file export', async () => {
  const env = makeEnv({ 'a.txt': 'x'.repeat(500) }); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' });
  const payload = await env.exports.export(selection, 'txt');
  await assert.rejects(() => copyProjectPayload({ async writeText() {} }, payload, 100), /export the project as a file/);
});
test('R7-HOST-003 BrowserClipboardAdapter refuses insecure or unavailable clipboard APIs', async () => {
  await assert.rejects(() => new BrowserClipboardAdapter(undefined, false).writeText('x'), /unavailable/);
  await assert.rejects(() => new BrowserClipboardAdapter(undefined, true).writeText('x'), /unavailable/);
});
test('R7-HOST-004 BrowserClipboardAdapter calls host clipboard only after capability is supplied', async () => {
  let written = ''; const adapter = new BrowserClipboardAdapter({ async writeText(text) { written = text; } }, true);
  await adapter.writeText('AXON Code'); assert.equal(written, 'AXON Code');
});
test('R7-HOST-005 BrowserShareAdapter reports unsupported when share API is absent', async () => {
  const adapter = new BrowserShareAdapter(undefined, undefined);
  assert.equal(await adapter.share({ title: 'AXON' }), 'UNSUPPORTED');
});
test('R7-HOST-006 BrowserShareAdapter distinguishes cancellation from success', async () => {
  const host = { async share() { const error = new Error('cancelled'); error.name = 'AbortError'; throw error; }, canShare() { return true; } };
  const adapter = new BrowserShareAdapter(host, class FakeFile extends Blob { constructor(parts, name, options) { super(parts, options); this.name = name; } });
  assert.equal(await adapter.share({ title: 'AXON', text: 'body' }), 'CANCELLED');
});
test('R7-HOST-006B BrowserShareAdapter distinguishes denied permission from user cancellation', async () => {
  const denied = new BrowserShareAdapter({ async share() { const error = new Error('permission denied'); error.name = 'NotAllowedError'; throw error; } }, File);
  assert.equal(await denied.share({ title: 'AXON' }), 'DENIED');
});
test('R7-HOST-007 BrowserShareAdapter attaches a ZIP as a file when host permits it', async () => {
  let received;
  const host = { async share(data) { received = data; }, canShare(data) { return Array.isArray(data.files); } };
  const adapter = new BrowserShareAdapter(host, class FakeFile extends Blob { constructor(parts, name, options) { super(parts, options); this.name = name; } });
  const payload = { filename: 'demo.zip', mimeType: 'application/zip', bytes: new Uint8Array([1, 2]), sizeBytes: 2, format: 'zip', sourceFingerprint: 'fp', includedFiles: [], warnings: [] };
  assert.equal(await shareProjectPayload(adapter, payload, 'Demo'), 'SHARED');
  assert.equal(received.files[0].name, 'demo.zip');
});
test('R7-HOST-008 BrowserShareAdapter refuses file share when host says it cannot share files', async () => {
  const host = { async share() { throw new Error('must not be called'); }, canShare() { return false; } };
  const adapter = new BrowserShareAdapter(host, class FakeFile extends Blob { constructor(parts, name, options) { super(parts, options); this.name = name; } });
  const payload = { filename: 'demo.zip', mimeType: 'application/zip', bytes: new Uint8Array([1]), sizeBytes: 1, format: 'zip', sourceFingerprint: 'fp', includedFiles: [], warnings: [] };
  assert.equal(await adapter.share({ title: 'Demo', file: payload }), 'UNSUPPORTED');
});
test('R7-HOST-009 BrowserDownloadAdapter creates download URL and revokes it after click', async () => {
  const events = []; let clicked = false; let removed = false;
  const anchor = { href: '', download: '', rel: '', hidden: false, click() { clicked = true; }, remove() { removed = true; } };
  const doc = { body: { appendChild(value) { events.push(['append', value]); } }, createElement() { return anchor; } };
  const urls = { createObjectURL(blob) { events.push(['create', blob.type]); return 'blob:test'; }, revokeObjectURL(value) { events.push(['revoke', value]); } };
  const deferred = []; const adapter = new BrowserDownloadAdapter(doc, urls, Blob, (fn) => deferred.push(fn));
  const payload = { filename: 'safe.txt', mimeType: 'text/plain', bytes: new Uint8Array([65]), sizeBytes: 1, format: 'txt', sourceFingerprint: 'fp', includedFiles: [], warnings: [] };
  await adapter.download(payload); assert.equal(clicked, true); assert.equal(removed, true); assert.equal(anchor.download, 'safe.txt');
  deferred.forEach((fn) => fn()); assert.deepEqual(events.at(-1), ['revoke', 'blob:test']);
});
test('R7-HOST-010 BrowserDownloadAdapter refuses unsafe filename', async () => {
  const adapter = new BrowserDownloadAdapter({ body: { appendChild() {} }, createElement() { return { click() {}, remove() {} }; } }, { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} }, Blob, () => {});
  const payload = { filename: '../x.txt', mimeType: 'text/plain', bytes: new Uint8Array([1]), sizeBytes: 1, format: 'txt', sourceFingerprint: 'fp', includedFiles: [], warnings: [] };
  await assert.rejects(() => adapter.download(payload), /unsafe/);
});
test('R7-HOST-011 facade clearSelection clears only selection state', async () => {
  const env = makeEnv(); await env.actions.select({ workspaceId: env.workspaceId, mode: 'ALL' }); env.actions.clearSelection();
  assert.equal(env.actions.getSelection(), null); assert.ok(await env.store.read(env.workspaceId, 'src/main.ts'));
});
test('R7-HOST-012 facade refuses actions when no selection is active', async () => {
  const env = makeEnv(); await assert.rejects(() => env.actions.prepareExport('zip'), /No project files are selected/);
});

// Soft deletion is previewed, approved, durable, undoable and conflict-aware.
test('R7-LIFE-001 preview identifies whole-workspace removal and exact phrase', async () => {
  const env = makeEnv({ 'a.txt': 'a', 'b.txt': 'bb' }); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' });
  const preview = await env.lifecycle.previewRemove(selection);
  assert.equal(preview.confirmationPhrase, 'REMOVE ALL 2 FILES'); assert.equal(preview.totalBytes, 3);
});
test('R7-LIFE-002 preview identifies partial removal accurately', async () => {
  const env = makeEnv({ 'a.txt': 'a', 'b.txt': 'bb' }); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'EXPLICIT', paths: ['a.txt'] });
  const preview = await env.lifecycle.previewRemove(selection); assert.equal(preview.confirmationPhrase, 'REMOVE 1 SELECTED FILES');
});
test('R7-LIFE-003 removal cannot proceed without explicit approval reference', async () => {
  const env = makeEnv({ 'a.txt': 'a' }); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' });
  const preview = await env.lifecycle.previewRemove(selection);
  await assert.rejects(() => env.lifecycle.confirmRemove(preview.id, { approvedByUser: false, approvalReference: '', confirmationText: preview.confirmationPhrase }), /approval/);
});
test('R7-LIFE-004 removal requires exact confirmation phrase', async () => {
  const env = makeEnv({ 'a.txt': 'a' }); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' });
  const preview = await env.lifecycle.previewRemove(selection);
  await assert.rejects(() => env.lifecycle.confirmRemove(preview.id, { approvedByUser: true, approvalReference: 'tap-1', confirmationText: 'REMOVE EVERYTHING' }), /phrase/);
});
test('R7-LIFE-005 preview cannot remove files changed after preview', async () => {
  const env = makeEnv({ 'a.txt': 'a' }); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' });
  const preview = await env.lifecycle.previewRemove(selection); await env.store.write(env.workspaceId, 'a.txt', 'newer');
  await assert.rejects(() => env.lifecycle.confirmRemove(preview.id, { approvedByUser: true, approvalReference: 'tap-2', confirmationText: preview.confirmationPhrase }), /changed after selection/);
  assert.equal(await env.store.read(env.workspaceId, 'a.txt'), 'newer');
});
test('R7-LIFE-006 removal is soft and undo restores exact bytes', async () => {
  const env = makeEnv({ 'a.txt': 'alpha', 'b.txt': 'beta' }); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' });
  const preview = await env.lifecycle.previewRemove(selection);
  const result = await env.lifecycle.confirmRemove(preview.id, { approvedByUser: true, approvalReference: 'tap-3', confirmationText: preview.confirmationPhrase });
  assert.equal(result.status, 'REMOVED_TO_TRASH'); assert.equal(await env.store.read(env.workspaceId, 'a.txt'), null);
  const undo = await env.lifecycle.undoRemove(result.trashId); assert.equal(undo.status, 'RESTORED');
  assert.equal(await env.store.read(env.workspaceId, 'a.txt'), 'alpha'); assert.equal(await env.store.read(env.workspaceId, 'b.txt'), 'beta');
});
test('R7-LIFE-007 removal can be recovered after interrupted PREPARED journal state', async () => {
  const env = makeEnv({ 'a.txt': 'alpha', 'b.txt': 'beta' });
  await env.store.deleteIfContent(env.workspaceId, 'a.txt', 'alpha');
  await env.kv.put('workspace-trash/interrupted', { id: 'interrupted', workspaceId: env.workspaceId, createdAt: 1, status: 'PREPARED', fingerprint: 'fp', files: [
    { path: 'a.txt', content: 'alpha', sizeBytes: 5 }, { path: 'b.txt', content: 'beta', sizeBytes: 4 }
  ] });
  const results = await env.lifecycle.recoverInterruptedRemovals(env.workspaceId);
  assert.equal(results[0].status, 'RESTORED'); assert.equal(await env.store.read(env.workspaceId, 'a.txt'), 'alpha');
});
test('R7-LIFE-008 undo never overwrites a file recreated after removal', async () => {
  const env = makeEnv({ 'a.txt': 'original' }); const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' });
  const preview = await env.lifecycle.previewRemove(selection);
  const result = await env.lifecycle.confirmRemove(preview.id, { approvedByUser: true, approvalReference: 'tap-4', confirmationText: preview.confirmationPhrase });
  await env.store.write(env.workspaceId, 'a.txt', 'user-created-new-content');
  const undo = await env.lifecycle.undoRemove(result.trashId);
  assert.equal(undo.status, 'RECOVERY_REQUIRED'); assert.equal(await env.store.read(env.workspaceId, 'a.txt'), 'user-created-new-content');
});
test('R7-LIFE-009 removal preview expires and must be recreated', async () => {
  let now = 1000; const env = makeEnv({ 'a.txt': 'a' }, () => now);
  const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' }); const preview = await env.lifecycle.previewRemove(selection);
  now += 300_001;
  await assert.rejects(() => env.lifecycle.confirmRemove(preview.id, { approvedByUser: true, approvalReference: 'tap-5', confirmationText: preview.confirmationPhrase }), /expired/);
  assert.equal(await env.store.read(env.workspaceId, 'a.txt'), 'a');
});
test('R7-LIFE-010 injected second-file delete failure restores earlier deleted file', async () => {
  const env = makeEnv({ 'a.txt': 'A', 'b.txt': 'B' }); let calls = 0;
  const original = env.store.deleteIfContent.bind(env.store);
  env.store.deleteIfContent = async (...args) => { calls += 1; if (calls === 2) throw new Error('simulated storage failure'); return original(...args); };
  const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' }); const preview = await env.lifecycle.previewRemove(selection);
  await assert.rejects(() => env.lifecycle.confirmRemove(preview.id, { approvedByUser: true, approvalReference: 'tap-6', confirmationText: preview.confirmationPhrase }), /simulated storage failure/);
  assert.equal(await env.store.read(env.workspaceId, 'a.txt'), 'A'); assert.equal(await env.store.read(env.workspaceId, 'b.txt'), 'B');
});
test('R7-LIFE-011 separate lifecycle instances coordinate through durable workspace lease', async () => {
  const env = makeEnv({ 'a.txt': 'A' }); const other = new WorkspaceLifecycleManager(env.store, env.kv, env.selection);
  const selection = await env.selection.select({ workspaceId: env.workspaceId, mode: 'ALL' });
  const previewA = await env.lifecycle.previewRemove(selection); const previewB = await other.previewRemove(selection);
  // Simulate a held lease owned by another instance; the operation must fail closed.
  await env.kv.put(`workspace-lock/${env.workspaceId}`, { owner: 'external-owner', expiresAt: 999_999 });
  await assert.rejects(() => env.lifecycle.confirmRemove(previewA.id, { approvedByUser: true, approvalReference: 'tap-7a', confirmationText: previewA.confirmationPhrase }), /already running/);
  await env.kv.put(`workspace-lock/${env.workspaceId}`, { owner: '', expiresAt: 0 });
  const removed = await other.confirmRemove(previewB.id, { approvedByUser: true, approvalReference: 'tap-7b', confirmationText: previewB.confirmationPhrase });
  assert.equal(removed.status, 'REMOVED_TO_TRASH');
});
test('R7-LIFE-012 lifecycle rejects a store without atomic delete/restore primitives', async () => {
  const env = makeEnv({ 'a.txt': 'a' });
  const unsafeStore = { async read() { return 'a'; }, async write() {}, async delete() {}, async list() { return ['a.txt']; } };
  assert.throws(() => new WorkspaceLifecycleManager(unsafeStore, env.kv, env.selection), /atomic compare-and-delete/);
});
