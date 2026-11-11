import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EnvironmentIntelligence, EnvironmentCompatibilityService,
  PackagePlanService, MemoryPackageCache, VerifiedPackageCache, sha256Hex,
  EnvironmentLockService, EnvironmentManager, MemoryEnvironmentRecordStore,
  TOOLCHAIN_CATALOG, getToolchainProfile
} from '../dist/index.js';

const digest = (text) => sha256Hex(new TextEncoder().encode(text));
const packageRequirement = async (overrides = {}) => ({ ecosystem: 'node', name: 'sample', version: '1.2.3', source: 'https://registry.example', expectedSha256: await digest('package artifact'), ...overrides });
const packagePolicy = () => ({ allowedSources: ['https://registry.example'], allowNetwork: true, allowBuildFromSource: false, allowLifecycleScripts: false, maxInstallBytes: 1024 * 1024 });

 test('R9 EnvironmentIntelligence detects mixed Node, Python, C++, Rust, Android, Unity and Unreal projects', () => {
  const profile = new EnvironmentIntelligence().inspect('mixed-project', [
    { path: 'package.json', content: JSON.stringify({ engines: { node: '>=20' }, dependencies: { express: '4.18.2' }, scripts: { test: 'node test.js' } }) },
    { path: 'package-lock.json', content: '{}' }, { path: 'requirements.txt', content: 'requests==2.32.0\n#comment\n' },
    { path: 'src/main.py', content: 'print(1)' }, { path: 'CMakeLists.txt', content: 'project(a)' },
    { path: 'src/main.cpp', content: 'int main(){}' }, { path: 'Cargo.toml', content: '[package]' },
    { path: 'ProjectSettings/ProjectVersion.txt', content: '2022.3' }, { path: 'Assets/scene.txt', content: 'scene' },
    { path: 'Game.uproject', content: '{}' }, { path: 'app/src/MainActivity.kt', content: 'class MainActivity' },
    { path: 'index.html', content: '<html></html>' },
    { path: 'app/src/main/AndroidManifest.xml', content: '<manifest package=\"example.app\" />' },
    { path: 'app/build.gradle', content: 'plugins { id \"com.android.application\" }' }
  ]);
  assert.ok(profile.ecosystems.includes('MIXED'));
  for (const ecosystem of ['NODE', 'PYTHON', 'CPP', 'RUST', 'UNITY', 'UNREAL', 'KOTLIN', 'WEB', 'ANDROID']) assert.ok(profile.ecosystems.includes(ecosystem), ecosystem);
  assert.ok(profile.requirements.some((item) => item.component === 'node' && item.version === '>=20'));
  assert.ok(profile.scripts.some((item) => item.name === 'test'));
  assert.ok(profile.packages.some((item) => item.name === 'express'));
});

test('R9 EnvironmentIntelligence reads manifests without executing scripts', () => {
  const profile = new EnvironmentIntelligence().inspect('p', [{ path: 'package.json', content: '{"scripts":{"postinstall":"touch /tmp/pwned"}}' }]);
  assert.equal(profile.scripts[0].command, 'touch /tmp/pwned');
  assert.equal(profile.warnings.length, 1);
  assert.ok(profile.warnings[0].includes('lockfile'));
});

test('R9 EnvironmentIntelligence rejects malformed entries, duplicate paths and case collisions', () => {
  const analyser = new EnvironmentIntelligence();
  assert.throws(() => analyser.inspect('p', [{ path: '../x', content: 'x' }]), /unsafe/i);
  assert.throws(() => analyser.inspect('p', [{ path: 'a.ts', content: 'x' }, { path: 'a.ts', content: 'y' }]), /duplicate/i);
  assert.throws(() => analyser.inspect('p', [{ path: 'A.ts', content: 'x' }, { path: 'a.ts', content: 'y' }]), /case-insensitive/i);
  assert.throws(() => analyser.inspect('p', [{ path: 'a', content: 7 }]), /string paths and contents/i);
});

test('R9 EnvironmentIntelligence bounds project files and aggregate content size', () => {
  const byCount = new EnvironmentIntelligence({ maxFiles: 1, maxTotalBytes: 100 });
  assert.throws(() => byCount.inspect('p', [{ path: 'a', content: 'a' }, { path: 'b', content: 'b' }]), /file limit/);
  const byBytes = new EnvironmentIntelligence({ maxFiles: 5, maxTotalBytes: 4 });
  assert.throws(() => byBytes.inspect('p', [{ path: 'a', content: 'hello' }]), /byte limit/);
});

test('R9 EnvironmentCompatibilityService reports missing host toolchains and conservative resources', () => {
  const profile = new EnvironmentIntelligence().inspect('p', [{ path: 'requirements.txt', content: 'requests==2.0' }]);
  const result = new EnvironmentCompatibilityService().evaluate(profile, { platform: 'android', architecture: 'arm64', availableRuntimes: [], availableToolchains: [], availableStorageBytes: 1, availableMemoryBytes: 1, networkAvailable: false, offlineCacheAvailable: false });
  assert.equal(result.compatible, false);
  assert.ok(result.missing.includes('python'));
  assert.ok(result.warnings.some((message) => message.includes('offline cache')));
  assert.throws(() => new EnvironmentCompatibilityService().evaluate(profile, { platform: 'android', architecture: 'arm64', availableRuntimes: [], availableToolchains: [], availableStorageBytes: -1, availableMemoryBytes: 1, networkAvailable: false, offlineCacheAvailable: false }), /invalid/i);
});

test('R9 package planning pins versions, sources, hashes and bounded download sizes', async () => {
  const service = new PackagePlanService(new MemoryPackageCache());
  const req = await packageRequirement();
  const key = 'node:sample@1.2.3';
  const plan = await service.plan([req], packagePolicy(), new Map([[key, 100]]));
  assert.equal(plan.blocked, false);
  assert.equal(plan.items[0].action, 'INSTALL_LOCKED_ARTIFACT');
  assert.equal(plan.requiresApproval, true);
  assert.match(plan.planSha256, /^[a-f0-9]{64}$/);
});

test('R9 package planner blocks floating versions, missing hashes, unapproved sources and no size estimate', async () => {
  const service = new PackagePlanService(new MemoryPackageCache());
  const base = await packageRequirement();
  const reqs = [
    { ...base, name: 'floating', version: '^1.0.0' },
    { ...base, name: 'unhashed', expectedSha256: undefined },
    { ...base, name: 'bad-source', source: 'https://evil.example' },
    { ...base, name: 'no-size' }
  ];
  const plan = await service.plan(reqs, packagePolicy(), new Map([[`node:floating@^1.0.0`, 1], [`node:unhashed@1.2.3`, 1], [`node:bad-source@1.2.3`, 1]]));
  assert.equal(plan.blocked, true);
  assert.equal(plan.items.length, 4);
  assert.ok(plan.items.every((item) => item.action === 'BLOCKED'));
});

test('R9 package planner rejects install-time lifecycle scripts and invalid budgets', async () => {
  const service = new PackagePlanService(new MemoryPackageCache());
  await assert.rejects(service.plan([], { ...packagePolicy(), allowLifecycleScripts: true }), /lifecycle scripts/);
  await assert.rejects(service.plan([], { ...packagePolicy(), maxInstallBytes: -1 }), /policy/);
});

test('R9 verified package cache checks bytes and content-addressed digest', async () => {
  const cache = new MemoryPackageCache();
  const verified = new VerifiedPackageCache(cache, 100);
  const bytes = new TextEncoder().encode('trusted artifact');
  const hash = await sha256Hex(bytes);
  await verified.put(hash, bytes);
  assert.deepEqual(await verified.get(hash), bytes);
  await assert.rejects(verified.put(hash, new TextEncoder().encode('different')), /does not match/);
  await assert.rejects(verified.get('not-a-hash'), /invalid/i);
});

test('R9 package execution rejects tampered plans and missing approval before host access', async () => {
  const service = new PackagePlanService(new MemoryPackageCache());
  const req = await packageRequirement();
  const plan = await service.plan([req], packagePolicy(), new Map([['node:sample@1.2.3', 100]]));
  let probed = false;
  const adapter = { id: 'npm-safe', probe: async () => { probed = true; return {}; } };
  const noApproval = await service.execute(plan, adapter, { approved: false, approvalReference: '', environmentId: 'e' }, packagePolicy().allowedSources);
  assert.equal(noApproval.status, 'BLOCKED'); assert.equal(probed, false);
  const tampered = { ...plan, totalExpectedBytes: 10_000 };
  const result = await service.execute(tampered, adapter, { approved: true, approvalReference: 'a', environmentId: 'e' }, packagePolicy().allowedSources);
  assert.equal(result.status, 'BLOCKED'); assert.equal(probed, false);
});

test('R9 package execution installs only through an attested manager with scripts disabled', async () => {
  const bytes = new TextEncoder().encode('package artifact');
  const hash = await sha256Hex(bytes);
  const cache = new MemoryPackageCache(); await cache.put(hash, bytes);
  const service = new PackagePlanService(cache);
  const req = { ecosystem: 'node', name: 'sample', version: '1.2.3', source: 'https://registry.example', expectedSha256: hash };
  const plan = await service.plan([req], { ...packagePolicy(), allowNetwork: false }, new Map());
  assert.equal(plan.items[0].action, 'REUSE_VERIFIED_CACHE');
  let installInput;
  const adapter = { id: 'cache-adapter', probe: async () => ({ available: true, isolatedEnvironment: true, verifiedSources: ['https://registry.example'], lifecycleScriptsCanBeDisabled: true, childProcessConfinement: true, notes: [] }),
    installFromCache: async (input) => { installInput = input; return { success: true, installed: ['sample@1.2.3'], diagnostics: [] }; } };
  const result = await service.execute(plan, adapter, { approved: true, approvalReference: 'approved', environmentId: 'env-1' }, ['https://registry.example']);
  assert.equal(result.status, 'INSTALLED');
  assert.equal(installInput.lifecycleScripts, false);
  assert.equal(installInput.networkAllowed, false);
});

test('R9 environment locks are deterministic and detect tampering', async () => {
  const locks = new EnvironmentLockService();
  const lock = await locks.create({ projectId: 'p', ecosystem: 'node', runtimeVersion: '22', hostConstraint: 'linux-x64', now: 100, packages: [await packageRequirement()] });
  assert.equal(await locks.verify(lock), true);
  assert.equal(await locks.verify({ ...lock, runtimeVersion: '18' }), false);
  await assert.rejects(locks.create({ projectId: 'p', ecosystem: 'node', runtimeVersion: '22', hostConstraint: 'linux', packages: [{ name: 'x', version: '1', source: 's', expectedSha256: 'bad' }] }), /sha-256/i);
});

test('R9 EnvironmentManager blocks missing child-process confinement', async () => {
  const locks = new EnvironmentLockService();
  const lock = await locks.create({ projectId: 'p', ecosystem: 'node', runtimeVersion: '22', hostConstraint: 'linux', packages: [] });
  const manager = new EnvironmentManager(new MemoryEnvironmentRecordStore(), locks);
  const result = await manager.prepare({ projectId: 'p', platform: 'linux', ecosystem: 'node', lock, compatibility: { compatible: true, missing: [], warnings: [], estimatedMinimumStorageBytes: 1, estimatedMinimumMemoryBytes: 1 }, approved: true,
    provider: { id: 'weak-provider', probe: async () => ({ available: true, isolated: true, filesystemScoped: true, networkBlocked: true, memoryLimited: true, timeLimited: true, unprivileged: true, childProcessConfinement: false, notes: [] }), create: async () => ({ success: true, diagnostics: [] }), destroy: async () => {} } });
  assert.equal(result.state, 'BLOCKED');
});

test('R9 EnvironmentManager prepares and records an approved, attested environment', async () => {
  const locks = new EnvironmentLockService();
  const lock = await locks.create({ projectId: 'p', ecosystem: 'node', runtimeVersion: '22', hostConstraint: 'linux', packages: [] });
  const store = new MemoryEnvironmentRecordStore();
  const manager = new EnvironmentManager(store, locks, () => 123);
  const provider = { id: 'safe-provider', probe: async () => ({ available: true, isolated: true, filesystemScoped: true, networkBlocked: true, memoryLimited: true, timeLimited: true, unprivileged: true, childProcessConfinement: true, notes: [] }), create: async () => ({ success: true, diagnostics: ['prepared'] }), destroy: async () => {} };
  const result = await manager.prepare({ projectId: 'p', platform: 'linux', ecosystem: 'node', lock, compatibility: { compatible: true, missing: [], warnings: [], estimatedMinimumStorageBytes: 1, estimatedMinimumMemoryBytes: 1 }, approved: true, provider });
  assert.equal(result.state, 'READY');
  assert.equal((await manager.list('p')).length, 1);
  await manager.destroy(result.environment.id, provider, true);
  assert.equal((await store.get(result.environment.id)).state, 'DESTROYED');
});

test('R9 EnvironmentManager rolls back a created environment when persistence fails', async () => {
  const locks = new EnvironmentLockService();
  const lock = await locks.create({ projectId: 'p', ecosystem: 'node', runtimeVersion: '22', hostConstraint: 'linux', packages: [] });
  const store = { get: async () => null, list: async () => [], put: async () => { throw new Error('disk-full'); } };
  const calls = [];
  const provider = { id: 'safe', probe: async () => ({ available: true, isolated: true, filesystemScoped: true, networkBlocked: true, memoryLimited: true, timeLimited: true, unprivileged: true, childProcessConfinement: true, notes: [] }), create: async () => ({ success: true, diagnostics: [] }), destroy: async (id) => calls.push(id) };
  const manager = new EnvironmentManager(store, locks);
  const result = await manager.prepare({ projectId: 'p', platform: 'linux', ecosystem: 'node', lock, compatibility: { compatible: true, missing: [], warnings: [], estimatedMinimumStorageBytes: 1, estimatedMinimumMemoryBytes: 1 }, approved: true, provider });
  assert.equal(result.state, 'FAILED');
  assert.equal(calls.length, 1);
  assert.ok(result.diagnostics[0].includes('rolled back'));
});

test('R9 toolchain catalogue explicitly marks provider-required and unavailable game engines', () => {
  assert.equal(getToolchainProfile('python').status, 'PROVIDER_REQUIRED');
  assert.equal(getToolchainProfile('unity').status, 'NOT_IMPLEMENTED');
  assert.equal(getToolchainProfile('unreal').status, 'NOT_IMPLEMENTED');
  assert.ok(TOOLCHAIN_CATALOG.length >= 10);
});
