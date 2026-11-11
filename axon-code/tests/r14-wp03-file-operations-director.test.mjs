// Director test (Round 14 verification): the REAL planFileOperation function, hostile and good inputs.
// Found by the Director: encoded traversal such as %2e%2e and names that differ only in letter case were accepted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planFileOperation as plan } from '../dist/workbench/fileOperations.js';

const files = ['src/a.ts', 'src/b.ts', 'README.md', 'docs/Guide.md', 'docs/notes.md'];
const refused = (operation, source, destination, pattern) => assert.throws(() => plan(operation, source, destination, files), pattern);

test('good rename and move are planned', () => {
  assert.deepEqual({ ...plan('rename', 'src/a.ts', 'src/c.ts', files) }, { operation: 'rename', source: 'src/a.ts', destination: 'src/c.ts' });
  assert.equal(plan('move', 'src/a.ts', 'lib/a.ts', files).destination, 'lib/a.ts');
  assert.equal(plan('rename', 'README.md', 'LÉEME.md', files).destination, 'LÉEME.md');
});
test('a case-only rename of the file itself is allowed', () => { assert.equal(plan('rename', 'src/a.ts', 'src/A.ts', files).destination, 'src/A.ts'); });
test('NEGATIVE: traversal, absolute, drive, backslash, encoded and control characters are refused', () => {
  for (const bad of ['../x.ts', 'lib/../../x.ts', '/etc/x', 'C:\\x', 'lib\\x', '%2e%2e/x.ts', 'lib/%2E%2E/x.ts', 'a%2Fb.ts', 'a\u0000.ts', 'a\n.ts', '.', 'dir/', 'lib//x.ts', '']) refused('move', 'src/a.ts', bad, /unsafe|identical|Use rename/);
});
test('NEGATIVE: non-string and oversize destinations are refused', () => {
  for (const bad of [null, undefined, 42, {}, [], 'x'.repeat(100000)]) refused('rename', 'src/a.ts', bad, /unsafe/);
});
test('NEGATIVE: collisions, including letter-case-only collisions, are refused', () => {
  refused('rename', 'src/a.ts', 'src/b.ts', /already exists/);
  refused('rename', 'docs/notes.md', 'docs/guide.md', /already exists/);
  refused('move', 'src/a.ts', 'docs/GUIDE.MD', /already exists/);
});
test('NEGATIVE: missing source, identical paths and unknown operations are refused', () => {
  refused('rename', 'src/zzz.ts', 'src/y.ts', /does not exist/);
  refused('rename', 'src/a.ts', 'src/a.ts', /identical/);
  refused('delete', 'src/a.ts', 'src/q.ts', /Unsupported/);
});
test('NEGATIVE (real mutant): the real compiled module with the case check removed lets the collision through', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const source = fs.readFileSync(new URL('../dist/workbench/fileOperations.js', import.meta.url), 'utf8');
  assert.ok(source.includes('path.toLowerCase() === lowerDestination'), 'the check this mutant removes must exist in the real code');
  const file = path.join(os.tmpdir(), `fileOperations-mutant-${process.pid}.mjs`);
  fs.writeFileSync(file, source.replace('path.toLowerCase() === lowerDestination', 'false'));
  const mutant = await import(pathToFileURL(file).href);
  assert.doesNotThrow(() => mutant.planFileOperation('rename', 'docs/notes.md', 'docs/guide.md', files), 'the mutant must accept the collision, proving this suite can fail');
  fs.rmSync(file, { force: true });
});
