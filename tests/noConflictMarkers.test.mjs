// D321 guard: no leftover git conflict markers in any text file of the repository. A conflicted merge or rebase leaves
// lines such as "<<<<<<< name" and ">>>>>>> name"; the Android compiler then fails on them ten minutes into a run.
// This test fails in a second and names the file and line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'android', 'ios', '.gradle', 'coverage']);
const TEXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.java', '.kt', '.xml', '.sh', '.py', '.yml', '.yaml', '.gradle', '.html', '.css']);

export function conflictLines(source) {
  const lines = source.split('\n');
  const hits = [];
  lines.forEach((line, i) => { if (line.startsWith('<<<<<<< ') || line.startsWith('>>>>>>> ')) hits.push(i + 1); });
  return hits;
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  if (statSync(full).isDirectory()) return SKIP_DIRS.has(name) ? [] : walk(full);
  return TEXT.has(extname(name)) && statSync(full).size < 3_000_000 ? [full] : [];
});

test('the scanner sees markers and ignores look-alikes', () => {
  assert.deepEqual(conflictLines('a\n<<<<<<< HEAD\nb\n=======\nc\n>>>>>>> bd3435b (message)\n'), [2, 6]);
  assert.deepEqual(conflictLines('Title\n=======\nconst a = 1 << 2;\n  <<<<<<< indented is not a marker\n'), []);
});

test('no conflict markers in the repository', () => {
  const files = walk(root);
  assert.ok(files.length > 100, 'the repository files are found');
  const bad = [];
  for (const file of files) for (const line of conflictLines(readFileSync(file, 'utf8'))) bad.push(`${file.slice(root.length)}:${line}`);
  assert.deepEqual(bad, [], `git conflict markers left in: ${bad.slice(0, 10).join(', ')}`);
});
