import test from 'node:test';
import assert from 'node:assert/strict';
import { planFileOperation } from '../dist/workbench/fileOperations.js';
const files = ['src/main.ts', 'src/util.ts', 'README.md'];
test('WP3 accepts same-directory rename', () => assert.deepEqual(planFileOperation('rename','src/main.ts','src/app.ts',files), {operation:'rename',source:'src/main.ts',destination:'src/app.ts'}));
test('WP3 accepts directory move preserving filename', () => assert.equal(planFileOperation('move','src/main.ts','lib/main.ts',files).destination,'lib/main.ts'));
test('WP3 rejects unsafe traversal destination', () => assert.throws(()=>planFileOperation('move','src/main.ts','../main.ts',files),/unsafe/));
test('WP3 rejects absolute destination', () => assert.throws(()=>planFileOperation('move','src/main.ts','/tmp/main.ts',files),/unsafe/));
test('WP3 rejects backslash paths', () => assert.throws(()=>planFileOperation('move','src/main.ts','lib\\main.ts',files),/unsafe/));
test('WP3 rejects a missing source', () => assert.throws(()=>planFileOperation('rename','missing.ts','new.ts',files),/does not exist/));
test('WP3 rejects destination collision', () => assert.throws(()=>planFileOperation('rename','src/main.ts','src/util.ts',files),/already exists/));
test('WP3 rejects no-op rename', () => assert.throws(()=>planFileOperation('rename','src/main.ts','src/main.ts',files),/identical/));
test('WP3 rejects cross-directory rename', () => assert.throws(()=>planFileOperation('rename','src/main.ts','lib/main.ts',files),/same directory/));
test('WP3 rejects unsupported operation (negative mutant guard)', () => {
  const unsafeMutant = (op, from, to, paths) => ({operation:op,source:from,destination:to});
  assert.throws(()=>planFileOperation('copy','src/main.ts','src/copy.ts',files),/Unsupported/);
  assert.notDeepEqual(unsafeMutant('copy','../secret','/tmp/secret',files), planFileOperation('rename','src/main.ts','src/new.ts',files));
});
