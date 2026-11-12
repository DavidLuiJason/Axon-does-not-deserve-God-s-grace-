import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { GitProvider } from '../dist/versionControl/gitProvider.js';
import { GitNodeHost, rawGit } from './helpers/git-node-host.mjs';

let root;
before(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'axon-r14-wp13-')); });
after(async () => { if (root) await fs.rm(root, { recursive: true, force: true }); });

async function makeRepo(name) {
  const directory = path.join(root, name);
  await fs.mkdir(directory, { recursive: true });
  const init = await rawGit(directory, ['init', '-b', 'main']); assert.equal(init.exitCode, 0, init.stderr);
  assert.equal((await rawGit(directory, ['config', 'user.name', 'AXON Git Test'])).exitCode, 0);
  assert.equal((await rawGit(directory, ['config', 'user.email', 'axon-git-test@example.invalid'])).exitCode, 0);
  return directory;
}
function provider(directory, maxFileBytes = 3 * 1024 * 1024) { return { host: new GitNodeHost(), adapter: new GitProvider(new GitNodeHost(), directory, maxFileBytes) }; }

// Each test creates a real local Git repository and invokes the real git executable through GitProvider.
test('WP13 real Git status, diff, log and branch queries report repository state', async () => {
  const repo = await makeRepo('queries'); const host = new GitNodeHost(); const git = new GitProvider(host, repo);
  await fs.writeFile(path.join(repo, 'hello.txt'), 'first\n');
  const initial = await git.status(); assert.equal(initial.status, 'OK'); assert.match(initial.stdout, /\?\? hello\.txt/);
  assert.equal((await git.commit(repo, 'initial file', ['hello.txt'])).status, 'OK');
  await fs.writeFile(path.join(repo, 'hello.txt'), 'first\nsecond\n');
  const status = await git.status(); assert.match(status.stdout, / M hello\.txt/);
  const diff = await git.diff(); assert.match(diff.stdout, /\+second/);
  const log = await git.log(repo, 5); assert.match(log.stdout, /initial file/);
  const branch = await git.currentBranch(); assert.equal(branch.stdout.trim(), 'main');
  const branches = await git.branches(); assert.match(branches.stdout, /main/);
});

test('WP13 real Git commit creates a commit, branch creation and checkout use the real repository', async () => {
  const repo = await makeRepo('branching'); const git = new GitProvider(new GitNodeHost(), repo);
  await fs.writeFile(path.join(repo, 'app.js'), 'module.exports = 1;\n');
  const committed = await git.commit(repo, 'add app', ['app.js']); assert.equal(committed.status, 'OK', committed.stderr);
  assert.equal((await git.createBranch(repo, 'feature/ui')).status, 'OK');
  assert.equal((await git.checkout(repo, 'feature/ui')).status, 'OK');
  assert.equal((await git.currentBranch()).stdout.trim(), 'feature/ui');
  assert.equal((await git.checkout(repo, 'main')).status, 'OK');
  assert.match((await git.log()).stdout, /add app/);
});

test('WP13 real Git reports an actual merge conflict without inventing a resolution', async () => {
  const repo = await makeRepo('conflict'); const git = new GitProvider(new GitNodeHost(), repo);
  await fs.writeFile(path.join(repo, 'shared.txt'), 'base\n');
  assert.equal((await git.commit(repo, 'base', ['shared.txt'])).status, 'OK');
  assert.equal((await git.createBranch(repo, 'feature/conflict')).status, 'OK');
  assert.equal((await git.checkout(repo, 'feature/conflict')).status, 'OK');
  await fs.writeFile(path.join(repo, 'shared.txt'), 'feature version\n');
  assert.equal((await git.commit(repo, 'feature change', ['shared.txt'])).status, 'OK');
  assert.equal((await git.checkout(repo, 'main')).status, 'OK');
  await fs.writeFile(path.join(repo, 'shared.txt'), 'main version\n');
  assert.equal((await git.commit(repo, 'main change', ['shared.txt'])).status, 'OK');
  const merged = await git.merge(repo, 'feature/conflict');
  assert.equal(merged.status, 'CONFLICT');
  assert.match((await git.status()).stdout, /UU shared\.txt/);
});

test('WP13 real Git check-ignore identifies ignored files using the repository .gitignore', async () => {
  const repo = await makeRepo('ignored'); const git = new GitProvider(new GitNodeHost(), repo);
  await fs.writeFile(path.join(repo, '.gitignore'), '*.secret\n');
  assert.equal((await git.commit(repo, 'add ignore rule', ['.gitignore'])).status, 'OK');
  await fs.writeFile(path.join(repo, 'local.secret'), 'not for git\n');
  const ignored = await git.isIgnored(repo, 'local.secret');
  assert.equal(ignored.ignored, true);
  assert.match(ignored.detail, /\.gitignore/);
  assert.equal((await git.isIgnored(repo, 'visible.txt')).ignored, false);
});

test('WP13 real Git commits a bounded large file and records it in the real object database', async () => {
  const repo = await makeRepo('large'); const git = new GitProvider(new GitNodeHost(), repo, 3 * 1024 * 1024);
  const content = 'L'.repeat(2 * 1024 * 1024);
  await fs.writeFile(path.join(repo, 'large.bin'), content);
  const committed = await git.commit(repo, 'add large fixture', ['large.bin']);
  assert.equal(committed.status, 'OK', committed.stderr);
  const listed = await rawGit(repo, ['ls-tree', '-r', '--long', 'HEAD']);
  assert.match(listed.stdout, /2097152\s+large\.bin/);
});

test('WP13 NEGATIVE: Git commit refuses files above the configured size budget', async () => {
  const repo = await makeRepo('oversize'); const git = new GitProvider(new GitNodeHost(), repo, 1024);
  await fs.writeFile(path.join(repo, 'huge.bin'), 'x'.repeat(1025));
  const result = await git.commit(repo, 'too large', ['huge.bin']);
  assert.equal(result.status, 'BLOCKED'); assert.match(result.stderr, /file limit/);
  assert.equal((await rawGit(repo, ['rev-list', '--count', 'HEAD'])).exitCode, 128, 'no commit was created');
});

test('WP13 NEGATIVE: repository outside the approved workspace is refused before Git runs', async () => {
  const allowed = await makeRepo('allowed'); const outside = await makeRepo('outside');
  const git = new GitProvider(new GitNodeHost(), allowed);
  await assert.rejects(() => git.status(outside), /outside the approved workspace/);
});

test('WP13 NEGATIVE: Git hooks are disabled by default during commit', async () => {
  const repo = await makeRepo('hooks'); const git = new GitProvider(new GitNodeHost(), repo);
  const marker = path.join(repo, 'HOOK_RAN');
  const hook = path.join(repo, '.git', 'hooks', 'pre-commit');
  await fs.writeFile(hook, `#!/bin/sh\nprintf ran > '${marker}'\n`);
  await fs.chmod(hook, 0o755);
  await fs.writeFile(path.join(repo, 'file.txt'), 'safe\n');
  const result = await git.commit(repo, 'hooks disabled', ['file.txt']);
  assert.equal(result.status, 'OK', result.stderr);
  await assert.rejects(fs.access(marker));
});

test('WP13 NEGATIVE: Git host does not forward askpass, SSH-agent or credential environment values', async () => {
  const repo = await makeRepo('credentials');
  const previous = { GIT_ASKPASS: process.env.GIT_ASKPASS, SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK, GIT_CREDENTIAL: process.env.GIT_CREDENTIAL };
  process.env.GIT_ASKPASS = 'secret-askpass-sentinel'; process.env.SSH_AUTH_SOCK = '/tmp/secret-agent.sock'; process.env.GIT_CREDENTIAL = 'secret-token-sentinel';
  try {
    const host = new GitNodeHost(); const git = new GitProvider(host, repo);
    assert.equal((await git.status()).status, 'OK');
    assert.ok(!host.forwardedEnvKeys.includes('GIT_ASKPASS'));
    assert.ok(!host.forwardedEnvKeys.includes('SSH_AUTH_SOCK'));
    assert.ok(!host.forwardedEnvKeys.includes('GIT_CREDENTIAL'));
    assert.ok(host.forwardedEnvKeys.includes('GIT_CONFIG_GLOBAL'));
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('WP13 NEGATIVE: Git checkout refuses dirty workspaces and unsafe branch names', async () => {
  const repo = await makeRepo('dirty-checkout'); const git = new GitProvider(new GitNodeHost(), repo);
  await fs.writeFile(path.join(repo, 'dirty.txt'), 'uncommitted\n');
  const dirty = await git.checkout(repo, 'main'); assert.equal(dirty.status, 'BLOCKED');
  const unsafe = await git.checkout(repo, '--upload-pack=evil'); assert.equal(unsafe.status, 'BLOCKED');
  const unsafeCreate = await git.createBranch(repo, '../outside'); assert.equal(unsafeCreate.status, 'BLOCKED');
});

test('WP13 NEGATIVE: Git refuses traversal paths and invalid log limits', async () => {
  const repo = await makeRepo('path-checks'); const git = new GitProvider(new GitNodeHost(), repo);
  const result = await git.commit(repo, 'bad path', ['../outside.txt']);
  assert.equal(result.status, 'BLOCKED');
  assert.equal((await git.log(repo, 101)).status, 'BLOCKED');
});

test('WP13 NEGATIVE (real mutant): removing the compiled workspace-boundary guard lets Git inspect an outside repository', async () => {
  const allowed = await makeRepo('mutant-allowed'); const outside = await makeRepo('mutant-outside');
  const compiledUrl = new URL('../dist/versionControl/gitProvider.js', import.meta.url);
  const compiled = await fs.readFile(compiledUrl, 'utf8');
  const guard = /if \(workspacePath !== this\.workspaceRoot \|\| !\(await this\.host\.isWithinWorkspace\(this\.workspaceRoot, workspacePath\)\)\)\s*throw new Error\('Git repository is outside the approved workspace\.'\);/;
  assert.match(compiled, guard, 'mutant must remove the real compiled workspace boundary check');
  const mutantPath = path.join(path.dirname(fileURLToPath(compiledUrl)), `gitProvider-mutant-${process.pid}.mjs`);
  await fs.writeFile(mutantPath, compiled.replace(guard, 'if (false) throw new Error(\'mutant boundary\');'));
  try {
    const { GitProvider: MutantGitProvider } = await import(`${pathToFileURL(mutantPath).href}?mutant=${process.pid}`);
    const host = new GitNodeHost(); const real = new GitProvider(host, allowed); const mutant = new MutantGitProvider(host, allowed);
    await assert.rejects(() => real.status(outside), /outside the approved workspace/);
    const bypass = await mutant.status(outside);
    assert.equal(bypass.status, 'OK', bypass.stderr);
  } finally { await fs.rm(mutantPath, { force: true }); }
});
