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
test('WP3 NEGATIVE (real mutant): removing the real compiled operation guard is detected', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const compiled = fs.readFileSync(new URL('../dist/workbench/fileOperations.js', import.meta.url), 'utf8');
  const guard = "if (operation !== 'rename' && operation !== 'move')";
  assert.ok(compiled.includes(guard), 'mutated guard must exist in the real compiled module');
  const mutantPath = path.join(os.tmpdir(), `axon-wp3-operation-mutant-${process.pid}.mjs`);
  fs.writeFileSync(mutantPath, compiled.replace(guard, 'if (false)'));
  try {
    const mutant = await import(pathToFileURL(mutantPath).href);
    assert.doesNotThrow(() => mutant.planFileOperation('copy', 'src/main.ts', 'src/copy.ts', files), 'mutant should accept an operation the real module refuses');
    assert.throws(() => planFileOperation('copy', 'src/main.ts', 'src/copy.ts', files), /Unsupported/);
  } finally { fs.rmSync(mutantPath, { force: true }); }
});
