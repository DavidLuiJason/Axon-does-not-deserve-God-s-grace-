// Director test (Round 14 verification): a project can ship its own .git/config. Git runs programs named in some settings
// (core.fsmonitor on status, filter drivers on commit, ...), even with hooks and credential helpers disabled. The provider must
// BLOCK such a repository before any command and must still work on an ordinary one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { GitProvider } from '../dist/versionControl/gitProvider.js';
import { GitNodeHost } from './helpers/git-node-host.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
const exists = async (file) => Boolean(await fs.stat(file).catch(() => null));

async function makeRepo(label) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `axon-git-director-${label}-`));
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'a@example.test');
  git(dir, 'config', 'user.name', 'Tester');
  await fs.writeFile(path.join(dir, 'a.txt'), 'one\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'init');
  const marker = path.join(os.tmpdir(), `axon-git-pwned-${label}-${process.pid}`);
  await fs.rm(marker, { force: true });
  return { dir, marker };
}

const attacks = {
  fsmonitor: { setup: ({ dir, marker }) => git(dir, 'config', 'core.fsmonitor', `touch ${marker}; echo`), act: (p) => p.status() },
  filterOnCommit: { setup: async ({ dir, marker }) => { git(dir, 'config', 'filter.x.clean', `sh -c "touch ${marker}; cat"`); await fs.writeFile(path.join(dir, '.gitattributes'), '* filter=x\n'); await fs.writeFile(path.join(dir, 'b.txt'), 'hi\n'); }, act: (p, dir) => p.commit(dir, 'm', ['b.txt']) },
  externalDiff: { setup: async ({ dir, marker }) => { git(dir, 'config', 'diff.external', `sh -c "touch ${marker}" #`); await fs.writeFile(path.join(dir, 'a.txt'), 'two\n'); }, act: (p) => p.diff() },
  includedFile: { setup: async ({ dir, marker }) => { const extra = path.join(dir, '..', `extra-${process.pid}.cfg`); await fs.writeFile(extra, `[core]\n\tfsmonitor = touch ${marker}; echo\n`); git(dir, 'config', 'include.path', extra); }, act: (p) => p.status() },
  worktreeConfig: { setup: ({ dir }) => git(dir, 'config', 'extensions.worktreeConfig', 'true'), act: (p) => p.status() },
  editor: { setup: ({ dir, marker }) => git(dir, 'config', 'core.editor', `touch ${marker}`), act: (p) => p.log() }
};

for (const [name, attack] of Object.entries(attacks)) {
  test(`NEGATIVE: a repository with ${name} configuration is blocked and no command runs`, async () => {
    const repo = await makeRepo(name);
    await attack.setup(repo);
    const result = await attack.act(new GitProvider(new GitNodeHost(), repo.dir), repo.dir);
    assert.equal(result.status, 'BLOCKED');
    assert.match(result.stderr, /^BLOCKED: /);
    assert.equal(await exists(repo.marker), false, 'no program named by the repository may run');
  });
}

test('an ordinary repository (user, remote, branch settings) still works: status, commit, log', async () => {
  const repo = await makeRepo('ordinary');
  git(repo.dir, 'config', 'remote.origin.url', 'https://example.test/x.git');
  git(repo.dir, 'config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
  git(repo.dir, 'config', 'branch.main.remote', 'origin');
  const provider = new GitProvider(new GitNodeHost(), repo.dir);
  await fs.writeFile(path.join(repo.dir, 'c.txt'), 'new\n');
  assert.equal((await provider.status()).status, 'OK');
  assert.equal((await provider.commit(repo.dir, 'add c', ['c.txt'])).status, 'OK');
  assert.match((await provider.log()).stdout, /add c/);
});

test('NEGATIVE (real mutant): the compiled provider with the audit removed lets the repository run its program', async () => {
  const compiledUrl = new URL('../dist/versionControl/gitProvider.js', import.meta.url);
  const compiled = await fs.readFile(compiledUrl, 'utf8');
  const guard = 'unsafeKeys.length > 0';
  assert.ok(compiled.includes(guard), 'the mutant must alter the real compiled module');
  const mutantFile = path.join(path.dirname(new URL(compiledUrl).pathname), `gitProvider-mutant-${process.pid}.mjs`);
  await fs.writeFile(mutantFile, compiled.replace(guard, 'false'));
  try {
    const { GitProvider: Mutant } = await import(`${pathToFileURL(mutantFile).href}?m=${process.pid}`);
    const repo = await makeRepo('mutant');
    await attacks.fsmonitor.setup(repo);
    await new Mutant(new GitNodeHost(), repo.dir).status();
    assert.equal(await exists(repo.marker), true, 'the mutant must let the attack succeed, proving this suite can fail');
  } finally { await fs.rm(mutantFile, { force: true }); }
});
