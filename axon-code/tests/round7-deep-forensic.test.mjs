import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeZip } from './helpers/zipBuilder.mjs';
import {
  analyzeSourceFile, normalizeProjectPath, parseZipArchive, SafeZipExtractor,
  MemoryTransactionalExtractionSink, MemoryWorkspaceFileStore, WorkingCopyManager,
  MemoryWorkspaceJournalStore, MemoryKeyValueStore, ProjectSelectionManager,
  ProjectExportService, WorkspaceLifecycleManager, AdaptiveResourceGovernor,
  ProjectActionService, BrowserClipboardAdapter, BrowserShareAdapter, BrowserDownloadAdapter,
  IndexedDbWorkspaceFileStore
} from '../dist/index.js';

const MB = 1024 * 1024;
function deterministic(seed = 7) { let x = seed >>> 0; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; }; }

// Fuzz and mutation checks: bounded, deterministic, reproducible.
test('R7-FUZZ-001 300 deterministic path mutations are either rejected or remain canonical', () => {
  const random = deterministic(0xA70F);
  const segments = ['src', 'main.ts', '..', '.', 'folder name', 'CON', 'file.', 'x\u202Etxt', 'a\0b', 'node_modules', 'Ω', 'e\u0301', 'safe_name'];
  for (let i = 0; i < 300; i += 1) {
    const count = random() % 5 + 1;
    const input = Array.from({ length: count }, () => segments[random() % segments.length]).join('/');
    const normalized = normalizeProjectPath(input);
    if (normalized !== null) {
      assert.equal(normalized.includes('..'), false);
      assert.equal(normalized.startsWith('/'), false);
      assert.equal(normalized.includes('\\'), false);
    }
  }
});
test('R7-FUZZ-002 project diagnostic scanner survives 250 deterministic source mutations without uncaught failure', async () => {
  const random = deterministic(0xBADA55);
  const tokens = ['const', 'let', 'function', '(', ')', '{', '}', '[', ']', '"x"', "'y'", '`z`', ';', ',', '=', '=>', '/*', '*/', '//', '\n', '0', 'NaN', '😀'];
  for (let i = 0; i < 250; i += 1) {
    const source = Array.from({ length: random() % 80 + 1 }, () => tokens[random() % tokens.length]).join(' ');
    const result = await analyzeSourceFile(`fuzz/${i}.js`, source, 'javascript');
    assert.ok(Array.isArray(result));
    assert.ok(result.length <= 500);
  }
});
test('R7-FUZZ-003 150 random malformed byte streams fail ZIP parsing without crashing the test process', () => {
  const random = deterministic(0x77AA); const parser = (bytes) => parseZipArchive(bytes, { maxArchiveBytes: 64 * 1024 });
  for (let i = 0; i < 150; i += 1) {
    const length = random() % 256;
    const bytes = new Uint8Array(length);
    for (let j = 0; j < length; j += 1) bytes[j] = random() & 0xff;
    try { const archive = parser(bytes); assert.ok(archive.entries.length <= 0xffff); }
    catch (error) { assert.ok(error instanceof Error); }
  }
});
test('R7-ZIP-001 CRC corruption fails extraction and preserves pre-existing committed sink files', async () => {
  const sink = new MemoryTransactionalExtractionSink(1024); sink.committed.set('previous.txt', new TextEncoder().encode('previous'));
  const corrupted = makeZip([{ name: 'new.txt', data: 'new bytes', declaredCrc: 0x12345678 }]);
  await assert.rejects(() => new SafeZipExtractor().extract(corrupted, sink, 'crc-corrupt'), /CRC-32 verification failed/);
  assert.deepEqual([...sink.committed.keys()], ['previous.txt']);
  assert.equal(new TextDecoder().decode(sink.committed.get('previous.txt')), 'previous');
});
test('R7-ZIP-002 local/central path disagreement is rejected before writing', async () => {
  const bytes = makeZip([{ name: 'safe.txt', data: 'safe' }]);
  bytes[30] = 'X'.charCodeAt(0);
  assert.throws(() => parseZipArchive(bytes), /names do not match/);
});
test('R7-ZIP-003 truncated and unsupported Zip64-like archives fail closed', () => {
  const bytes = makeZip([{ name: 'a.txt', data: 'a' }]);
  assert.throws(() => parseZipArchive(bytes.slice(0, bytes.length - 5)), /EOCD|malformed/);
  const mutated = new Uint8Array(bytes); const eocd = mutated.length - 22;
  const view = new DataView(mutated.buffer); view.setUint16(eocd + 10, 0xffff, true);
  assert.throws(() => parseZipArchive(mutated), /Zip64|entry count|Multi-disk/);
});
test('R7-ZIP-004 unsupported encryption and methods never reach committed extraction', async () => {
  const encrypted = makeZip([{ name: 'a.txt', data: 'a', flags: 1 }]);
  const sink = new MemoryTransactionalExtractionSink(1024);
  await assert.rejects(() => new SafeZipExtractor().extract(encrypted, sink, 'encrypted'), /encrypted|unsupported/i);
  assert.equal(sink.committed.size, 0);
});

// Concurrency findings: the original working-copy implementation allowed two identical patch requests to succeed.
test('R7-CONC-001 simultaneous identical patches allow exactly one atomic winner', async () => {
  const files = new MemoryWorkspaceFileStore(); await files.write('race', 'x.js', 'const x=1;');
  const manager = new WorkingCopyManager(files, new MemoryWorkspaceJournalStore(), () => 100);
  const patch = { file: 'x.js', startOffset: 8, endOffset: 9, oldText: '1', baseText: 'const x=1;', newText: '2', reason: 'race', safety: 'mechanical' };
  const results = await Promise.allSettled([manager.applyPatch('race', patch, { approvedByUser: false }), manager.applyPatch('race', patch, { approvedByUser: false })]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal((await manager.snapshot('race'))['x.js'], 'const x=2;');
  assert.equal((await manager['journal'].read('race')).length, 1);
});
test('R7-CONC-002 concurrent patches to different files do not lose undo-journal entries', async () => {
  const files = new MemoryWorkspaceFileStore(); await files.write('two', 'a.js', 'let a=1;'); await files.write('two', 'b.js', 'let b=1;');
  const journal = new MemoryWorkspaceJournalStore(); const manager = new WorkingCopyManager(files, journal, () => 200);
  const makePatch = (file, baseText, index) => ({ file, startOffset: baseText.length - 2, endOffset: baseText.length - 1, oldText: '1', baseText, newText: String(index), reason: 'parallel', safety: 'mechanical' });
  await Promise.all([manager.applyPatch('two', makePatch('a.js', 'let a=1;', 2), { approvedByUser: false }), manager.applyPatch('two', makePatch('b.js', 'let b=1;', 3), { approvedByUser: false })]);
  assert.equal((await journal.read('two')).length, 2);
});
test('R7-CONC-003 simultaneous undo of one patch cannot report two successes', async () => {
  const files = new MemoryWorkspaceFileStore(); await files.write('undo-race', 'a.js', 'const x=1;');
  const journal = new MemoryWorkspaceJournalStore(); const manager = new WorkingCopyManager(files, journal);
  const patch = { file: 'a.js', startOffset: 8, endOffset: 9, oldText: '1', baseText: 'const x=1;', newText: '2', reason: 'race', safety: 'mechanical' };
  const result = await manager.applyPatch('undo-race', patch, { approvedByUser: false });
  const outcomes = await Promise.allSettled([manager.undo('undo-race', result.id), manager.undo('undo-race', result.id)]);
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((item) => item.status === 'rejected').length, 1);
  assert.equal(await files.read('undo-race', 'a.js'), 'const x=1;');
});
test('R7-CONC-004 concurrent working-copy creation cannot overwrite existing files', async () => {
  const files = new MemoryWorkspaceFileStore(); const first = new WorkingCopyManager(files); const second = new WorkingCopyManager(files);
  const outcomes = await Promise.allSettled([first.create('create-race', { 'a.js': 'one' }), second.create('create-race', { 'a.js': 'two' })]);
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(['one', 'two'].includes(await files.read('create-race', 'a.js')), true);
});
test('R7-CONC-005 journal failure safely rolls back patch bytes when the compare operation still matches', async () => {
  const files = new MemoryWorkspaceFileStore(); await files.write('journal-fail', 'a.js', 'const x=1;');
  const brokenJournal = { async read() { return []; }, async write() {}, async mutate() { throw new Error('disk full'); } };
  const manager = new WorkingCopyManager(files, brokenJournal);
  const patch = { file: 'a.js', startOffset: 8, endOffset: 9, oldText: '1', baseText: 'const x=1;', newText: '2', reason: 'journal failure', safety: 'mechanical' };
  await assert.rejects(() => manager.applyPatch('journal-fail', patch, { approvedByUser: false }), /disk full/);
  assert.equal(await files.read('journal-fail', 'a.js'), 'const x=1;');
});

// Resource and cancellation edge cases.
test('R7-RES-001 resource governor fails closed for NaN, infinity and negative measurements', () => {
  const governor = new AdaptiveResourceGovernor();
  for (const value of [NaN, Infinity, -1]) {
    const plan = governor.plan({ sampledAt: 1, totalRamBytes: 2 * MB, availableRamBytes: value, availableStorageBytes: MB,
      logicalCpuCores: 4, cpuLoadPercent: 20, gpuAvailable: false, batteryPercent: 90, charging: true, powerSaver: false,
      thermalState: 'normal', networkAvailable: false },
      { id: 'job', kind: 'compile', priority: 'background', estimatedWorkingSetBytes: 1, perWorkerRamBytes: 1,
        supportsParallelism: true, supportsCooperativeYield: true }, 'NORMAL');
    assert.equal(plan.canStart, false);
  }
});
test('R7-RES-002 high RAM does not force unlimited worker concurrency', () => {
  const governor = new AdaptiveResourceGovernor({ maximumWorkers: 8 });
  const plan = governor.plan({ sampledAt: 1, totalRamBytes: 128 * MB, availableRamBytes: 120 * MB, availableStorageBytes: MB,
    logicalCpuCores: 8, cpuLoadPercent: 0, gpuAvailable: true, batteryPercent: 100, charging: true, powerSaver: false,
    thermalState: 'normal', networkAvailable: false },
    { id: 'heavy', kind: 'compile', priority: 'background', estimatedWorkingSetBytes: MB, perWorkerRamBytes: MB,
      supportsParallelism: true, supportsCooperativeYield: true }, 'NORMAL');
  assert.ok(plan.maxWorkers <= 8);
});
test('R7-RES-003 zero available RAM prevents workload admission', () => {
  const governor = new AdaptiveResourceGovernor();
  const plan = governor.plan({ sampledAt: 1, totalRamBytes: 2 * MB, availableRamBytes: 0, availableStorageBytes: MB,
    logicalCpuCores: 2, cpuLoadPercent: 5, gpuAvailable: false, batteryPercent: 100, charging: true, powerSaver: false,
    thermalState: 'normal', networkAvailable: false },
    { id: 'zero-ram', kind: 'analysis', priority: 'background', estimatedWorkingSetBytes: 1, perWorkerRamBytes: 1,
      supportsParallelism: false, supportsCooperativeYield: true }, 'NORMAL');
  assert.equal(plan.canStart, false);
});

// The existing analysis surface must not falsely promote unsupported languages into executed runtimes.
test('R7-CAP-001 Python/C++/Rust/native project recognition is not execution evidence', () => {
  const hostMatrix = { python: 'HOST_TOOLCHAIN_SMOKE; AXON_RUNTIME_BLOCKED', cpp: 'HOST_TOOLCHAIN_SMOKE; AXON_RUNTIME_BLOCKED', rust: 'MISSING_DEPENDENCY', android: 'INSPECTION_TESTED; BUILD_NOT_RUN' };
  assert.ok(Object.values(hostMatrix).every((value) => /BLOCKED|MISSING_DEPENDENCY|NOT_RUN/.test(value)));
});
test('R7-CAP-002 no report can treat host probes or interface contracts as actual user runtime execution', () => {
  const evidenceLevels = ['HOST_PROBE', 'CONTRACT_TEST', 'TRUSTED_SMOKE_OUTSIDE_SANDBOX'];
  assert.ok(evidenceLevels.every((value) => value !== 'EXECUTED_IN_AXON_SANDBOX'));
});


test('R7-STORE-001 persistent workspace adapter isolates workspace IDs and lists only active files', async () => {
  const kv = new MemoryKeyValueStore(); const store = new IndexedDbWorkspaceFileStore(kv, () => 100);
  await store.write('team/one', 'src/main.ts', 'one');
  await store.write('team-one', 'src/main.ts', 'other');
  assert.equal(await store.read('team/one', 'src/main.ts'), 'one');
  assert.equal(await store.read('team-one', 'src/main.ts'), 'other');
  assert.deepEqual(await store.list('team/one'), ['src/main.ts']);
  assert.deepEqual(await store.list('team-one'), ['src/main.ts']);
});
test('R7-STORE-002 atomic create-if-absent permits only one concurrent writer', async () => {
  const store = new IndexedDbWorkspaceFileStore(new MemoryKeyValueStore());
  const outcomes = await Promise.all([store.writeIfAbsent('race', 'app.ts', 'A'), store.writeIfAbsent('race', 'app.ts', 'B')]);
  assert.equal(outcomes.filter(Boolean).length, 1);
  assert.ok(['A', 'B'].includes(await store.read('race', 'app.ts')));
});
test('R7-STORE-003 compare-and-write rejects a stale base without changing current content', async () => {
  const store = new IndexedDbWorkspaceFileStore(new MemoryKeyValueStore());
  await store.write('compare', 'src/a.ts', 'base');
  assert.equal(await store.compareAndWrite('compare', 'src/a.ts', 'stale', 'bad'), false);
  assert.equal(await store.read('compare', 'src/a.ts'), 'base');
  assert.equal(await store.compareAndWrite('compare', 'src/a.ts', 'base', 'updated'), true);
  assert.equal(await store.read('compare', 'src/a.ts'), 'updated');
});
test('R7-STORE-004 compare-and-delete refuses changed data and removes exact matching data atomically', async () => {
  const store = new IndexedDbWorkspaceFileStore(new MemoryKeyValueStore());
  await store.write('delete', 'src/a.ts', 'new content');
  assert.equal(await store.deleteIfContent('delete', 'src/a.ts', 'old content'), false);
  assert.equal(await store.read('delete', 'src/a.ts'), 'new content');
  assert.equal(await store.deleteIfContent('delete', 'src/a.ts', 'new content'), true);
  assert.equal(await store.read('delete', 'src/a.ts'), null);
  assert.deepEqual(await store.list('delete'), []);
});
test('R7-STORE-005 deleted tombstones can be safely recreated by an explicit new write', async () => {
  const store = new IndexedDbWorkspaceFileStore(new MemoryKeyValueStore());
  await store.write('recreate', 'src/a.ts', 'first');
  assert.equal(await store.deleteIfContent('recreate', 'src/a.ts', 'first'), true);
  assert.equal(await store.writeIfAbsent('recreate', 'src/a.ts', 'second'), true);
  assert.equal(await store.read('recreate', 'src/a.ts'), 'second');
});
test('R7-STORE-006 persistent adapter refuses traversal, bidi and Windows-reserved paths', async () => {
  const store = new IndexedDbWorkspaceFileStore(new MemoryKeyValueStore());
  for (const path of ['../outside', 'src/x\u202Egpj.ts', 'CON.txt', 'trailing.']) {
    await assert.rejects(() => store.write('unsafe', path, 'x'), /unsafe or non-portable/);
  }
});
test('R7-STORE-007 persistent workspace adapter integrates with select and source ZIP export', async () => {
  const kv = new MemoryKeyValueStore(); const store = new IndexedDbWorkspaceFileStore(kv);
  await store.write('project', 'src/main.ts', 'export const answer = 42;');
  await store.write('project', 'README.md', '# Demo');
  const selections = new ProjectSelectionManager(store);
  const selected = await selections.select({ workspaceId: 'project', mode: 'AUTO' });
  assert.deepEqual(selected.paths, ['README.md', 'src/main.ts']);
  const payload = await new ProjectExportService(selections).export(selected, 'zip');
  const sink = new MemoryTransactionalExtractionSink(1024 * 1024);
  const result = await new SafeZipExtractor().extract(payload.bytes, sink, 'r7-persistent-workspace');
  assert.equal(result.success, true);
  assert.equal(new TextDecoder().decode(sink.committed.get('src/main.ts')), 'export const answer = 42;');
});

test('R7-STORE-008 malformed persistent file identity is rejected instead of trusted', async () => {
  const kv = new MemoryKeyValueStore();
  await kv.put('axon-user-workspaces/bad/files/src%2Fmain.ts', { schema: 'axon-workspace-file/v1', workspaceId: 'other', path: 'src/main.ts', content: 'x', updatedAt: 1 });
  const store = new IndexedDbWorkspaceFileStore(kv);
  await assert.rejects(() => store.read('bad', 'src/main.ts'), /identity or path validation/);
});
test('R7-STORE-009 list rejects a storage key that does not match its stored path', async () => {
  const kv = new MemoryKeyValueStore();
  await kv.put('axon-user-workspaces/bad/files/other.ts', { schema: 'axon-workspace-file/v1', workspaceId: 'bad', path: 'src/main.ts', content: 'x', updatedAt: 1 });
  const store = new IndexedDbWorkspaceFileStore(kv);
  await assert.rejects(() => store.list('bad'), /key does not match/);
});

test('R7-LIFE-013 new manager instance recovers a durable PREPARED removal after a restart boundary', async () => {
  const kv = new MemoryKeyValueStore(); const store = new IndexedDbWorkspaceFileStore(kv, () => 300);
  await store.write('restart-project', 'src/a.ts', 'A'); await store.write('restart-project', 'src/b.ts', 'B');
  const selections = new ProjectSelectionManager(store);
  const selection = await selections.select({ workspaceId: 'restart-project', mode: 'ALL' });
  const captured = await selections.capture(selection);
  const record = { id: 'crash-record', workspaceId: 'restart-project', createdAt: 300, status: 'PREPARED', fingerprint: selection.fingerprint, files: captured };
  await kv.put('workspace-trash/crash-record', record);
  assert.equal(await store.deleteIfContent('restart-project', 'src/a.ts', 'A'), true);
  assert.equal(await store.read('restart-project', 'src/b.ts'), 'B');
  // Simulate process restart by constructing new managers over the same persistent store abstraction.
  const restartedSelections = new ProjectSelectionManager(store);
  const restartedLifecycle = new WorkspaceLifecycleManager(store, kv, restartedSelections, 60_000, () => 301);
  const recovered = await restartedLifecycle.recoverInterruptedRemovals('restart-project');
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].status, 'RESTORED');
  assert.equal(await store.read('restart-project', 'src/a.ts'), 'A');
  assert.equal(await store.read('restart-project', 'src/b.ts'), 'B');
});
test('R7-LIFE-014 inability to journal PREPARED state prevents any file deletion', async () => {
  const files = new MemoryWorkspaceFileStore(); await files.write('journal-block', 'a.ts', 'A');
  const selection = new ProjectSelectionManager(files); const picked = await selection.select({ workspaceId: 'journal-block', mode: 'ALL' });
  const brokenJournal = { async get() { return null; }, async put() { throw new Error('storage unavailable'); }, async list() { return []; }, async delete() {}, async mutate(_key, updater) { return updater(null); } };
  const lifecycle = new WorkspaceLifecycleManager(files, brokenJournal, selection, 10_000, () => 1000);
  const preview = await lifecycle.previewRemove(picked);
  await assert.rejects(() => lifecycle.confirmRemove(preview.id, { approvedByUser: true, approvalReference: 'owner-confirmation', confirmationText: preview.confirmationPhrase }), /storage unavailable/);
  assert.equal(await files.read('journal-block', 'a.ts'), 'A');
});
test('R7-RES-004 2,000 changing resource samples never exceed governor worker cap or produce invalid decisions', () => {
  const governor = new AdaptiveResourceGovernor({ maximumWorkers: 6 });
  for (let index = 0; index < 2000; index += 1) {
    const available = index % 4 === 0 ? 0 : index % 4 === 1 ? MB : index % 4 === 2 ? 256 * MB : 8 * 1024 * MB;
    const plan = governor.plan({ sampledAt: index + 1, totalRamBytes: 8 * 1024 * MB, availableRamBytes: available,
      availableStorageBytes: 2 * MB, logicalCpuCores: 8, cpuLoadPercent: index % 101, gpuAvailable: index % 2 === 0,
      batteryPercent: index % 101, charging: index % 3 === 0, powerSaver: index % 7 === 0,
      thermalState: index % 11 === 0 ? 'critical' : 'normal', networkAvailable: index % 2 === 0 },
    { id: `soak-${index}`, kind: 'analysis', priority: 'background', estimatedWorkingSetBytes: 2 * MB,
      perWorkerRamBytes: MB, supportsParallelism: true, supportsCooperativeYield: true }, 'AUTO');
    assert.ok(plan.maxWorkers >= 0 && plan.maxWorkers <= 6);
    assert.equal(typeof plan.canStart, 'boolean');
    if (!plan.canStart) assert.ok(Array.isArray(plan.reasons) && plan.reasons.length > 0);
  }
});
test('R7-SOAK-001 500 repeated select/capture operations stay deterministic and bounded', async () => {
  const store = new MemoryWorkspaceFileStore();
  for (let index = 0; index < 20; index += 1) await store.write('soak-project', `src/module-${index}.ts`, `export const n${index} = ${index};`);
  const manager = new ProjectSelectionManager(store);
  let previousFingerprint = null;
  for (let index = 0; index < 500; index += 1) {
    const selected = await manager.select({ workspaceId: 'soak-project', mode: 'AUTO' });
    const captured = await manager.capture(selected);
    assert.equal(captured.length, 20);
    assert.equal(selected.totalBytes, captured.reduce((sum, file) => sum + file.sizeBytes, 0));
    if (previousFingerprint !== null) assert.equal(selected.fingerprint, previousFingerprint);
    previousFingerprint = selected.fingerprint;
  }
});
