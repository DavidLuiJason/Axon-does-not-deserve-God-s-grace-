import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { NpmPackageManagerAdapter } from '../dist/environment/npmPackageManagerAdapter.js';
import { PipPackageManagerAdapter } from '../dist/environment/pipPackageManagerAdapter.js';
import { PackagePlanService, MemoryPackageCache } from '../dist/environment/packageManager.js';
import { NodeNpmHost, makeNpmFixturePackage } from './helpers/npm-node-host.mjs';
import { startNpmRegistry } from './helpers/npm-local-registry.mjs';
import { NodePipHost } from './helpers/pip-node-host.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (exe, args, options) => new Promise((resolve, reject) => {
  const child = spawn(exe, args, options); let stdout = ''; let stderr = '';
  child.stdout?.on('data', b => stdout += b.toString()); child.stderr?.on('data', b => stderr += b.toString());
  child.on('error', reject); child.on('close', code => resolve({ code: code ?? 1, stdout, stderr }));
});

let root;
let npmFixture;
let rollbackFixture;
let pipWheelPath;
let pipWheelBytes;

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'axon-r14-wp06-'));
  npmFixture = await makeNpmFixturePackage(root, { script: true });
  rollbackFixture = await makeNpmFixturePackage(root, { name: 'axon-fail-fixture', version: '1.0.0' });
  pipWheelPath = path.join(root, 'wheelhouse', 'axon_pip_fixture-1.0.0-py3-none-any.whl');
  const helper = fileURLToPath(new URL('./helpers/create-pip-wheel.py', import.meta.url));
  const wheel = await run('python3', [helper, pipWheelPath], { cwd: root, env: { PATH: process.env.PATH ?? '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(wheel.code, 0, wheel.stderr);
  pipWheelBytes = new Uint8Array(await fs.readFile(pipWheelPath));
});

after(async () => { if (root) await fs.rm(root, { recursive: true, force: true }); });

async function makeNpmAdapter(registry, name = 'npm-env') {
  const host = new NodeNpmHost(root);
  const adapter = new NpmPackageManagerAdapter(host, registry.url);
  return { host, adapter, requirement: { ecosystem: 'node', name: npmFixture.packageJson.name, version: npmFixture.packageJson.version, source: registry.url, expectedSha256: registry.sha256 } };
}

test('WP6 real npm installs from a local registry and writes a verified package lock', async () => {
  const registry = await startNpmRegistry({ name: npmFixture.packageJson.name, version: npmFixture.packageJson.version, tarballPath: npmFixture.tarballPath });
  try {
    const { adapter, requirement } = await makeNpmAdapter(registry);
    const result = await adapter.install({ environmentId: 'npm-install', requirements: [requirement], allowedSources: [registry.url], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 2 * 1024 * 1024 });
    assert.equal(result.success, true, result.diagnostics.join('\n'));
    assert.deepEqual(result.installed, [`${requirement.name}@${requirement.version}`]);
    const lock = JSON.parse(await fs.readFile(path.join(root, 'environments', 'npm-install', 'package-lock.json'), 'utf8'));
    const entry = lock.packages[`node_modules/${requirement.name}`];
    assert.equal(entry.version, requirement.version);
    assert.equal(entry.integrity, registry.integrity);
    assert.ok(entry.resolved.startsWith(registry.url));
    assert.equal(await fs.readFile(path.join(root, 'environments', 'npm-install', 'node_modules', requirement.name, 'index.js'), 'utf8'), `module.exports = ${JSON.stringify(`${requirement.name}@${requirement.version}`)};\n`);
  } finally { await registry.close(); }
});

test('WP6 NEGATIVE: npm install scripts remain disabled even when a package declares preinstall', async () => {
  const registry = await startNpmRegistry({ name: npmFixture.packageJson.name, version: npmFixture.packageJson.version, tarballPath: npmFixture.tarballPath });
  try {
    const { adapter, requirement } = await makeNpmAdapter(registry);
    const result = await adapter.install({ environmentId: 'npm-no-scripts', requirements: [requirement], allowedSources: [registry.url], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 2 * 1024 * 1024 });
    assert.equal(result.success, true, result.diagnostics.join('\n'));
    await assert.rejects(fs.access(path.join(root, 'environments', 'npm-no-scripts', 'INSTALL_SCRIPT_RAN')));
  } finally { await registry.close(); }
});

test('WP6 real npm offline reinstall restores a clean environment from its local cache', async () => {
  const registry = await startNpmRegistry({ name: npmFixture.packageJson.name, version: npmFixture.packageJson.version, tarballPath: npmFixture.tarballPath });
  const { adapter, requirement } = await makeNpmAdapter(registry);
  const first = await adapter.install({ environmentId: 'npm-offline', requirements: [requirement], allowedSources: [registry.url], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 2 * 1024 * 1024 });
  assert.equal(first.success, true, first.diagnostics.join('\n'));
  await registry.close();
  await fs.rm(path.join(root, 'environments', 'npm-offline', 'node_modules'), { recursive: true, force: true });
  const offline = await adapter.reinstallOffline('npm-offline');
  assert.equal(offline.success, true, offline.diagnostics.join('\n'));
  await fs.access(path.join(root, 'environments', 'npm-offline', 'node_modules', requirement.name, 'index.js'));
});

test('WP6 real npm removes an installed package and updates package metadata', async () => {
  const registry = await startNpmRegistry({ name: npmFixture.packageJson.name, version: npmFixture.packageJson.version, tarballPath: npmFixture.tarballPath });
  try {
    const { adapter, requirement } = await makeNpmAdapter(registry);
    const first = await adapter.install({ environmentId: 'npm-remove', requirements: [requirement], allowedSources: [registry.url], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 2 * 1024 * 1024 });
    assert.equal(first.success, true, first.diagnostics.join('\n'));
    const removed = await adapter.remove('npm-remove', requirement.name);
    assert.equal(removed.success, true, removed.diagnostics.join('\n'));
    await assert.rejects(fs.access(path.join(root, 'environments', 'npm-remove', 'node_modules', requirement.name)));
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'environments', 'npm-remove', 'package.json'), 'utf8'));
    assert.equal(pkg.dependencies?.[requirement.name], undefined);
  } finally { await registry.close(); }
});


test('WP6 NEGATIVE: PackagePlanService blocks npm because the host has no OS process confinement', async () => {
  const registry = await startNpmRegistry({ name: npmFixture.packageJson.name, version: npmFixture.packageJson.version, tarballPath: npmFixture.tarballPath });
  try {
    const { adapter, requirement } = await makeNpmAdapter(registry);
    const probe = await adapter.probe();
    assert.equal(probe.available, true);
    assert.equal(probe.isolatedEnvironment, false);
    assert.equal(probe.childProcessConfinement, false);
    const planner = new PackagePlanService(new MemoryPackageCache());
    const key = `node:${requirement.name}@${requirement.version}`;
    const plan = await planner.plan([requirement], { allowedSources: [registry.url], allowNetwork: true, allowBuildFromSource: false, allowLifecycleScripts: false, maxInstallBytes: 2 * 1024 * 1024 }, new Map([[key, 4096]]));
    const result = await planner.execute(plan, adapter, { approved: true, approvalReference: 'owner-approved-npm-fixture', environmentId: 'npm-plan-gate' }, [registry.url]);
    assert.equal(result.status, 'BLOCKED');
    assert.match(result.diagnostics.join(' '), /lacks required isolation/);
  } finally { await registry.close(); }
});

test('WP6 NEGATIVE: npm refuses a tampered tarball before starting the package manager', async () => {
  const registry = await startNpmRegistry({ name: npmFixture.packageJson.name, version: npmFixture.packageJson.version, tarballPath: npmFixture.tarballPath, tamper: true });
  try {
    const host = new NodeNpmHost(root); let begun = 0;
    const begin = host.beginEnvironment.bind(host); host.beginEnvironment = async id => { begun++; return begin(id); };
    const adapter = new NpmPackageManagerAdapter(host, registry.url);
    const result = await adapter.install({ environmentId: 'npm-tamper', requirements: [{ ecosystem: 'node', name: npmFixture.packageJson.name, version: npmFixture.packageJson.version, source: registry.url, expectedSha256: registry.sha256 }], allowedSources: [registry.url], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 2 * 1024 * 1024 });
    assert.equal(result.success, false);
    assert.match(result.diagnostics.join(' '), /SHA-256 mismatch/);
    assert.equal(begun, 0);
  } finally { await registry.close(); }
});

test('WP6 NEGATIVE: npm refuses a tarball URL redirected outside the approved registry', async () => {
  const registry = await startNpmRegistry({ name: npmFixture.packageJson.name, version: npmFixture.packageJson.version, tarballPath: npmFixture.tarballPath, redirectTarball: true });
  try {
    const { adapter, requirement } = await makeNpmAdapter(registry);
    const result = await adapter.install({ environmentId: 'npm-redirect', requirements: [requirement], allowedSources: [registry.url], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 2 * 1024 * 1024 });
    assert.equal(result.success, false);
    assert.match(result.diagnostics.join(' '), /redirected outside/);
  } finally { await registry.close(); }
});

test('WP6 real npm rolls back an install when the registry serves a tampered tarball after preflight', async () => {
  const goodRegistry = await startNpmRegistry({ name: npmFixture.packageJson.name, version: npmFixture.packageJson.version, tarballPath: npmFixture.tarballPath });
  const { adapter, requirement } = await makeNpmAdapter(goodRegistry);
  const initial = await adapter.install({ environmentId: 'npm-rollback', requirements: [requirement], allowedSources: [goodRegistry.url], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 2 * 1024 * 1024 });
  assert.equal(initial.success, true, initial.diagnostics.join('\n'));
  const oldLock = await fs.readFile(path.join(root, 'environments', 'npm-rollback', 'package-lock.json'), 'utf8');
  await goodRegistry.close();
  const second = await startNpmRegistry({ name: rollbackFixture.packageJson.name, version: rollbackFixture.packageJson.version, tarballPath: rollbackFixture.tarballPath, tamperOnTarballRequest: 2 });
  try {
    const nextRequirement = { ecosystem: 'node', name: rollbackFixture.packageJson.name, version: rollbackFixture.packageJson.version, source: second.url, expectedSha256: second.sha256 };
    const secondAdapter = new NpmPackageManagerAdapter(new NodeNpmHost(root), second.url);
    const failed = await secondAdapter.install({ environmentId: 'npm-rollback', requirements: [nextRequirement], allowedSources: [second.url], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 2 * 1024 * 1024 });
    assert.equal(failed.success, false);
    assert.ok(second.tarballRequests >= 2, 'preflight received the original tarball and npm then received the tampered tarball');
    assert.match(failed.diagnostics.join(' '), /integrity|EINTEGRITY/i);
    const newLock = await fs.readFile(path.join(root, 'environments', 'npm-rollback', 'package-lock.json'), 'utf8');
    assert.equal(newLock, oldLock, 'failed staged install must not replace the prior committed lockfile');
    await fs.access(path.join(root, 'environments', 'npm-rollback', 'node_modules', npmFixture.packageJson.name, 'index.js'));
    await assert.rejects(fs.access(path.join(root, 'environments', 'npm-rollback', 'node_modules', rollbackFixture.packageJson.name)));
  } finally { await second.close(); }
});

test('WP6 NEGATIVE: npm rejects floating versions, unpinned hashes, duplicate requirements and foreign sources', async () => {
  const registry = await startNpmRegistry({ name: npmFixture.packageJson.name, version: npmFixture.packageJson.version, tarballPath: npmFixture.tarballPath });
  try {
    const { adapter, requirement } = await makeNpmAdapter(registry);
    const base = { environmentId: 'npm-invalid', requirements: [requirement], allowedSources: [registry.url], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 2 * 1024 * 1024 };
    const floating = await adapter.install({ ...base, requirements: [{ ...requirement, version: 'latest' }] });
    assert.equal(floating.success, false);
    const unhashed = await adapter.install({ ...base, requirements: [{ ...requirement, expectedSha256: undefined }] });
    assert.equal(unhashed.success, false);
    const foreign = await adapter.install({ ...base, requirements: [{ ...requirement, source: 'https://evil.invalid/' }], allowedSources: ['https://evil.invalid/'] });
    assert.equal(foreign.success, false);
    const duplicate = await adapter.install({ ...base, requirements: [requirement, requirement] });
    assert.equal(duplicate.success, false);
  } finally { await registry.close(); }
});

test('WP6 NEGATIVE (real mutant): removing the real compiled tarball SHA guard allows a tampered artifact into staging', async () => {
  const compiledUrl = new URL('../dist/environment/npmPackageManagerAdapter.js', import.meta.url);
  const compiled = await fs.readFile(compiledUrl, 'utf8');
  const guard = 'if ((await sha256Hex(tarball)).toLowerCase() !== expectedSha256.toLowerCase())';
  assert.ok(compiled.includes(guard));
  const mutantPath = path.join(path.dirname(fileURLToPath(compiledUrl)), `npmPackageManagerAdapter-mutant-${process.pid}.mjs`);
  await fs.writeFile(mutantPath, compiled.replace(guard, 'if (false)'));
  const metadata = { name: 'mutant-pkg', version: '1.0.0', dist: { tarball: 'http://127.0.0.1:1234/mutant.tgz', integrity: `sha512-${Buffer.from('valid-integrity').toString('base64')}` } };
  const tampered = new TextEncoder().encode('tampered artifact');
  const host = {
    async probe() { return { available: true, stagingTransactions: true, fixedNpmExecutable: true, scriptsCanBeDisabled: true, notes: [] }; },
    async fetchBytes(url) { return url.endsWith('/mutant-pkg') ? new TextEncoder().encode(JSON.stringify(metadata)) : tampered; },
    async beginEnvironment() { return { root: '/tmp/mutant-env', cacheDir: '/tmp/mutant-cache', async writeText() {}, async readText() { return JSON.stringify({ packages: { 'node_modules/mutant-pkg': { version: '1.0.0', resolved: 'http://127.0.0.1:1234/mutant.tgz', integrity: metadata.dist.integrity } } }); }, async runNpm() { return { exitCode: 0, stdout: '', stderr: '' }; }, async commit() {}, async rollback() {} }; }
  };
  try {
    const { NpmPackageManagerAdapter: MutantAdapter } = await import(`${pathToFileURL(mutantPath).href}?mutant=${process.pid}`);
    const req = { ecosystem: 'node', name: 'mutant-pkg', version: '1.0.0', source: 'http://127.0.0.1:1234/', expectedSha256: sha256(new TextEncoder().encode('original artifact')) };
    const real = new NpmPackageManagerAdapter(host, req.source);
    const refused = await real.install({ environmentId: 'mutant-env', requirements: [req], allowedSources: [req.source], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 1024 });
    assert.equal(refused.success, false);
    const mutant = new MutantAdapter(host, req.source);
    const accepted = await mutant.install({ environmentId: 'mutant-env', requirements: [req], allowedSources: [req.source], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 1024 });
    assert.equal(accepted.success, true, 'mutated real adapter must pass the tampered artifact through its package host');
  } finally { await fs.rm(mutantPath, { force: true }); }
});

async function createPipIndex(wheelPath, wheelBytes) {
  const filename = path.basename(wheelPath);
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    if (pathname === '/simple/axon-pip-fixture/') { response.writeHead(200, { 'content-type': 'text/html' }); response.end(`<a href="/packages/${filename}">${filename}</a>`); return; }
    if (pathname === `/packages/${filename}`) { response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': wheelBytes.byteLength }); response.end(wheelBytes); return; }
    response.writeHead(404); response.end('not found');
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}/simple/`, close: () => new Promise(resolve => server.close(resolve)) };
}

test('WP6 T2 real pip installs a hash-pinned wheel from a local PEP 503 index', async () => {
  const index = await createPipIndex(pipWheelPath, pipWheelBytes);
  try {
    const host = new NodePipHost(root);
    const adapter = new PipPackageManagerAdapter(host);
    const probe = await adapter.probe();
    assert.equal(probe.available, true, probe.notes.join(' '));
    assert.equal(probe.childProcessConfinement, false, 'T2 pip is not represented as OS-confined');
    const result = await adapter.install({ environmentId: 'pip-local', requirements: [{ ecosystem: 'python', name: 'axon-pip-fixture', version: '1.0.0', source: index.url, expectedSha256: sha256(pipWheelBytes) }], allowedSources: [index.url], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 2 * 1024 * 1024 });
    assert.equal(result.success, true, result.diagnostics.join('\n'));
    assert.equal(await fs.readFile(path.join(root, 'environments', 'pip-local', 'site-packages', 'axon_pip_fixture', '__init__.py'), 'utf8'), "VALUE = 'pip-local-index-ok'\n");
  } finally { await index.close(); }
});

test('WP6 NEGATIVE: real pip rejects a wheel whose hash does not match the approved requirement', async () => {
  const index = await createPipIndex(pipWheelPath, pipWheelBytes);
  try {
    const adapter = new PipPackageManagerAdapter(new NodePipHost(root));
    const result = await adapter.install({ environmentId: 'pip-tamper', requirements: [{ ecosystem: 'python', name: 'axon-pip-fixture', version: '1.0.0', source: index.url, expectedSha256: '0'.repeat(64) }], allowedSources: [index.url], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 2 * 1024 * 1024 });
    assert.equal(result.success, false);
    assert.match(result.diagnostics.join(' '), /hash|failed|ERROR/i);
    await assert.rejects(fs.access(path.join(root, 'environments', 'pip-tamper')));
  } finally { await index.close(); }
});

test('WP6 NEGATIVE: pip T2 adapter refuses a non-loopback index and malformed requirements', async () => {
  const adapter = new PipPackageManagerAdapter(new NodePipHost(root));
  const base = { environmentId: 'pip-refuse', requirements: [{ ecosystem: 'python', name: 'axon-pip-fixture', version: '1.0.0', source: 'https://pypi.org/simple/', expectedSha256: sha256(pipWheelBytes) }], allowedSources: ['https://pypi.org/simple/'], lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: 1024 };
  const foreign = await adapter.install(base);
  assert.equal(foreign.success, false);
  assert.match(foreign.diagnostics.join(' '), /loopback/);
  const floating = await adapter.install({ ...base, requirements: [{ ...base.requirements[0], version: '>=1.0' }] });
  assert.equal(floating.success, false);
});
