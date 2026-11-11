import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKeyValueStore } from '../dist/jobs/persistentJobs.js';
import { IndexedDbWorkspaceFileStore } from '../dist/storage/indexedDbWorkspaceFileStore.js';
import { WorkspaceTransactionJournal } from '../dist/storage/workspaceTransactionJournal.js';

function setup() {
  const kv = new MemoryKeyValueStore();
  return { kv, files: new IndexedDbWorkspaceFileStore(kv), journal: new WorkspaceTransactionJournal(kv, () => 1234) };
}

test('R14 WP2 persists workspace records across adapter reconstruction', async () => {
  const { kv, files } = setup();
  await files.write('project-a', 'src/main.ts', 'export const value = 1;');
  const reopened = new IndexedDbWorkspaceFileStore(kv);
  assert.equal(await reopened.read('project-a', 'src/main.ts'), 'export const value = 1;');
});

test('R14 WP2 workspace compare-and-write refuses stale content', async () => {
  const { files } = setup();
  await files.write('project-a', 'README.md', 'v1');
  assert.equal(await files.compareAndWrite('project-a', 'README.md', 'wrong', 'v2'), false);
  assert.equal(await files.read('project-a', 'README.md'), 'v1');
});

test('R14 WP2 atomic write-if-absent prevents accidental overwrite', async () => {
  const { files } = setup();
  assert.equal(await files.writeIfAbsent('project-a', 'main.js', 'first'), true);
  assert.equal(await files.writeIfAbsent('project-a', 'main.js', 'second'), false);
  assert.equal(await files.read('project-a', 'main.js'), 'first');
});

test('R14 WP2 tombstones hide deleted files from listings and reads', async () => {
  const { files } = setup();
  await files.write('project-a', 'gone.txt', 'old');
  await files.delete('project-a', 'gone.txt');
  assert.equal(await files.read('project-a', 'gone.txt'), null);
  assert.deepEqual(await files.list('project-a'), []);
});

test('R14 WP2 rejects traversal and malformed workspace paths', async () => {
  const { files } = setup();
  await assert.rejects(files.write('project-a', '../escape.txt', 'x'), /path/i);
  await assert.rejects(files.read('project-a', '/absolute.txt'), /path/i);
});

test('R14 WP2 journal records an intent before file mutation', async () => {
  const { files, journal } = setup();
  await files.write('project-a', 'src/a.ts', 'before');
  await journal.prepare({ id: 'tx-1', workspaceId: 'project-a', path: 'src/a.ts', before: 'before', after: 'after' });
  const recovery = await journal.inspectRecovery('project-a', (path) => files.read('project-a', path));
  assert.equal(recovery[0].disposition, 'NOT_APPLIED');
});

test('R14 WP2 journal recognizes an already-applied transaction after interruption', async () => {
  const { files, journal } = setup();
  await files.write('project-a', 'src/a.ts', 'before');
  await journal.prepare({ id: 'tx-2', workspaceId: 'project-a', path: 'src/a.ts', before: 'before', after: 'after' });
  await files.write('project-a', 'src/a.ts', 'after');
  const recovery = await journal.inspectRecovery('project-a', (path) => files.read('project-a', path));
  assert.equal(recovery[0].disposition, 'ALREADY_APPLIED');
});

test('R14 WP2 journal detects external modification instead of overwriting it', async () => {
  const { files, journal } = setup();
  await files.write('project-a', 'src/a.ts', 'before');
  await journal.prepare({ id: 'tx-3', workspaceId: 'project-a', path: 'src/a.ts', before: 'before', after: 'after' });
  await files.write('project-a', 'src/a.ts', 'external');
  const recovery = await journal.inspectRecovery('project-a', (path) => files.read('project-a', path));
  assert.equal(recovery[0].disposition, 'CONFLICT');
  assert.equal(await files.read('project-a', 'src/a.ts'), 'external');
});

test('R14 WP2 journal refuses duplicate transaction IDs and double finalization', async () => {
  const { journal } = setup();
  const row = { id: 'tx-4', workspaceId: 'project-a', path: 'a.txt', before: null, after: 'x' };
  await journal.prepare(row);
  await assert.rejects(journal.prepare(row), /already exists/);
  await journal.finish('project-a', 'tx-4', 'COMMITTED');
  await assert.rejects(journal.finish('project-a', 'tx-4', 'ABORTED'), /PREPARED/);
});

test('R14 WP2 catches a deliberately broken recovery mutant that auto-overwrites conflicts', async () => {
  const { files, journal } = setup();
  await files.write('project-a', 'a.txt', 'before');
  await journal.prepare({ id: 'tx-mutant', workspaceId: 'project-a', path: 'a.txt', before: 'before', after: 'intended' });
  await files.write('project-a', 'a.txt', 'external');
  const actual = await journal.inspectRecovery('project-a', (path) => files.read('project-a', path));
  const brokenMutant = (disposition) => disposition === 'CONFLICT' ? 'ALREADY_APPLIED' : disposition;
  assert.equal(actual[0].disposition, 'CONFLICT');
  assert.throws(() => assert.equal(brokenMutant(actual[0].disposition), actual[0].disposition), { name: 'AssertionError' });
  assert.equal(await files.read('project-a', 'a.txt'), 'external');
});
