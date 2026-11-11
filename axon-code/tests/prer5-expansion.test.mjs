import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MultiFileProjectBundler,
  BundledProjectEntrySourceProvider,
  typeCheckTypeScriptProject,
  validatePureWasmModule,
  createPureWasmWorkerSource,
  StrictSandboxBridge,
  createSandboxedLanguageRuntimes,
  NativeProjectBuildService,
  inspectAndroidProject,
  inspectGameEngineProject,
  remoteExecutionPolicy,
  verifyRemoteExecutionAttestation,
  rootExecutionAllowed,
  AndroidApkBuildService,
  AndroidApplicationService,
  GameEngineBuildService,
  HostProcessRuntimeAdapter,
  createBundledJavaScriptWorkerRuntime,
  probeBrowserHost
} from '../dist/index.js';

class MemoryProject {
  constructor(files) { this.files = new Map(Object.entries(files)); }
  async listFiles() { return [...this.files.keys()]; }
  async readText(_projectId, path) { return this.files.get(path) ?? null; }
}

const wasm42 = new Uint8Array([
  0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00,
  0x01,0x05,0x01,0x60,0x00,0x01,0x7f,
  0x03,0x02,0x01,0x00,
  0x07,0x08,0x01,0x04,0x6d,0x61,0x69,0x6e,0x00,0x00,
  0x0a,0x06,0x01,0x04,0x00,0x41,0x2a,0x0b
]);

// TYPED PROJECTS / JSX / MODULES

test('R5P-001 TypeScript entry transpiles and resolves a multi-file relative import', async () => {
  const project = new MemoryProject({
    'src/main.ts': `import { multiply } from './math';\nconsole.log(multiply(6, 7));`,
    'src/math.ts': `export function multiply(a: number, b: number): number { return a * b; }`
  });
  const bundle = await new MultiFileProjectBundler(project).bundle('p', 'src/main.ts');
  assert.equal(bundle.diagnostics.filter(x => x.severity === 'error').length, 0);
  assert.deepEqual(bundle.includedFiles.sort(), ['src/main.ts', 'src/math.ts']);
  assert.match(bundle.source, /__axonLoad/);
  assert.match(bundle.source, /multiply/);
});

test('R5P-002 TSX JSX transforms through the declared local React package', async () => {
  const project = new MemoryProject({
    'src/view.tsx': `import React from 'react';\nconst view = <div data-kind="axon">hello</div>;\nconsole.log(view.type, view.props.children);`,
    'node_modules/react/package.json': JSON.stringify({ main: 'index.js' }),
    'node_modules/react/index.js': `module.exports = { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children[0] } }), Fragment: 'fragment' };`
  });
  const bundle = await new MultiFileProjectBundler(project).bundle('p', 'src/view.tsx');
  assert.equal(bundle.diagnostics.filter(x => x.severity === 'error').length, 0);
  assert.ok(bundle.includedFiles.includes('node_modules/react/index.js'));
  assert.match(bundle.source, /createElement/);
});

test('R5P-003 JSX file is transpiled and package exports browser condition is resolved', async () => {
  const project = new MemoryProject({
    'src/main.jsx': `import marker from 'tiny-marker'; console.log(marker);`,
    'node_modules/tiny-marker/package.json': JSON.stringify({ exports: { '.': { browser: './browser.js', default: './index.js' } } }),
    'node_modules/tiny-marker/browser.js': `export default 'browser-build';`,
    'node_modules/tiny-marker/index.js': `export default 'node-build';`
  });
  const bundle = await new MultiFileProjectBundler(project).bundle('p', 'src/main.jsx');
  assert.deepEqual(bundle.includedFiles.sort(), ['node_modules/tiny-marker/browser.js', 'src/main.jsx']);
  assert.match(bundle.source, /browser-build/);
  assert.doesNotMatch(bundle.source, /node-build/);
});

test('R5P-004 JSON module is included as data without evaluating source text', async () => {
  const project = new MemoryProject({
    'src/main.ts': `import data from './settings.json'; console.log(data.name);`,
    'src/settings.json': JSON.stringify({ name: 'AXON' })
  });
  const bundle = await new MultiFileProjectBundler(project).bundle('p', 'src/main.ts');
  assert.equal(bundle.diagnostics.length, 0);
  assert.ok(bundle.includedFiles.includes('src/settings.json'));
  assert.match(bundle.source, /JSON\.parse/);
});

test('R5P-005 missing external packages are refused instead of installed from the network', async () => {
  const project = new MemoryProject({ 'src/main.ts': `import x from 'not-installed'; console.log(x);` });
  const bundle = await new MultiFileProjectBundler(project).bundle('p', 'src/main.ts');
  assert.ok(bundle.diagnostics.some(x => x.code === 'PROJECT_MODULE_NOT_RESOLVED'));
  assert.ok(bundle.externalPackages.includes('not-installed'));
});

test('R5P-006 Node built-in imports are not exposed to browser bundles', async () => {
  const project = new MemoryProject({ 'src/main.ts': `import fs from 'node:fs'; console.log(fs);` });
  const bundle = await new MultiFileProjectBundler(project).bundle('p', 'src/main.ts');
  assert.ok(bundle.diagnostics.some(x => x.code === 'PROJECT_MODULE_NOT_RESOLVED'));
});

test('R5P-007 import traversal outside the project is rejected', async () => {
  const project = new MemoryProject({ 'src/main.ts': `import x from '../../outside'; console.log(x);`, 'outside.ts': `export default 1;` });
  const bundle = await new MultiFileProjectBundler(project).bundle('p', 'src/main.ts');
  assert.ok(bundle.diagnostics.some(x => x.code === 'PROJECT_MODULE_NOT_RESOLVED'));
  assert.ok(!bundle.includedFiles.includes('outside.ts'));
});

test('R5P-008 package.json invalid JSON is surfaced accurately', async () => {
  const project = new MemoryProject({ 'src/main.js': `const x = require('bad-pkg');`, 'node_modules/bad-pkg/package.json': '{bad' });
  const bundle = await new MultiFileProjectBundler(project).bundle('p', 'src/main.js');
  assert.ok(bundle.diagnostics.some(x => x.code === 'INVALID_PACKAGE_JSON'));
});

test('R5P-009 bundled entry source provider preserves the canonical entry path', async () => {
  const project = new MemoryProject({ 'main.ts': `console.log('ok');` });
  const provider = new BundledProjectEntrySourceProvider(project);
  const item = await provider.readSingleEntry({ projectId: 'p', entryFiles: ['main.ts'] });
  assert.equal(item.path, 'main.ts');
  assert.match(item.source, /console\.log/);
});

test('R5P-010 bundle file count and byte limits fail closed', async () => {
  const project = new MemoryProject({ 'a.js': 'console.log(1);', 'b.js': 'console.log(2);' });
  await assert.rejects(() => new MultiFileProjectBundler(project, { maxFiles: 1 }).bundle('p', 'a.js'), /bundle limit/);
  await assert.rejects(() => new MultiFileProjectBundler(project, { maxSingleFileBytes: 4 }).bundle('p', 'a.js'), /per-file/);
});

test('R5P-011 TypeScript compiler reports semantic type errors with source location', async () => {
  const project = new MemoryProject({ 'src/main.ts': `const count: number = 'wrong';\nconsole.log(count);` });
  const result = await typeCheckTypeScriptProject(project, 'p');
  const finding = result.diagnostics.find(x => x.code === 'TS2322');
  assert.equal(result.success, false);
  assert.equal(finding.file, 'src/main.ts');
  assert.equal(finding.line, 1);
  assert.ok(finding.column > 0);
});

test('R5P-012 TypeScript checker reports a clean small project', async () => {
  const project = new MemoryProject({ 'src/main.ts': `export const answer: number = 42;` });
  const result = await typeCheckTypeScriptProject(project, 'p');
  assert.equal(result.success, true);
  assert.equal(result.checkedFiles, 1);
});

// WEBASSEMBLY POLICY

test('R5P-013 pure WebAssembly module validates with bounded policy and exports executable entry', () => {
  const result = validatePureWasmModule(wasm42);
  assert.equal(result.valid, true);
  assert.equal(result.imports, 0);
  assert.match(createPureWasmWorkerSource(wasm42), /WebAssembly\.instantiate/);
  assert.match(createPureWasmWorkerSource(wasm42), /main/);
});

test('R5P-014 malformed WebAssembly magic is rejected', () => {
  assert.equal(validatePureWasmModule(new Uint8Array([1, 2, 3])).valid, false);
});

test('R5P-015 WebAssembly imports are denied', () => {
  const withImport = new Uint8Array([0,97,115,109,1,0,0,0,2,1,1]);
  const result = validatePureWasmModule(withImport);
  assert.equal(result.valid, false);
  assert.match(result.reason, /imported.*blocked/i);
});

test('R5P-016 WebAssembly memory without an explicit maximum is rejected', () => {
  const noMaximum = new Uint8Array([0,97,115,109,1,0,0,0,5,3,1,0,1]);
  const result = validatePureWasmModule(noMaximum);
  assert.equal(result.valid, false);
  assert.match(result.reason, /explicit maximum/i);
});

test('R5P-017 WebAssembly memory maximum above policy is rejected', () => {
  const tooLarge = new Uint8Array([0,97,115,109,1,0,0,0,5,5,1,1,1,0xac,0x02]);
  const result = validatePureWasmModule(tooLarge, 256);
  assert.equal(result.valid, false);
  assert.match(result.reason, /exceeds policy/i);
});

test('R5P-018 WebAssembly invalid policy is rejected', () => {
  assert.equal(validatePureWasmModule(wasm42, -1).valid, false);
});

// OS SANDBOX AND RUNTIME ADMISSION

function goodProbe(overrides = {}) {
  return { available: true, platform: 'linux', executable: 'sandbox-host', isolationConfirmed: true, networkBlocked: true,
    filesystemIsolated: true, memoryLimitEnforced: true, timeLimitEnforced: true, unprivilegedIdentity: true, notes: [], ...overrides };
}

test('R5P-019 process execution remains blocked without network isolation attestation', async () => {
  const bridge = new StrictSandboxBridge({ async probe() { return goodProbe({ networkBlocked: false }); }, async run() { throw new Error('must not run'); } });
  const report = await bridge.probe();
  assert.equal(report.available, false);
  assert.match(report.notes.join(' '), /network denial/);
});

test('R5P-020 process execution remains blocked without filesystem isolation', async () => {
  const bridge = new StrictSandboxBridge({ async probe() { return goodProbe({ filesystemIsolated: false }); }, async run() { throw new Error('must not run'); } });
  assert.equal((await bridge.probe()).available, false);
});

test('R5P-021 process execution remains blocked without memory and time limits', async () => {
  const bridge = new StrictSandboxBridge({ async probe() { return goodProbe({ memoryLimitEnforced: false, timeLimitEnforced: false }); }, async run() { throw new Error('must not run'); } });
  assert.equal((await bridge.probe()).available, false);
});

test('R5P-022 process execution remains blocked without unprivileged identity', async () => {
  const bridge = new StrictSandboxBridge({ async probe() { return goodProbe({ unprivilegedIdentity: false }); }, async run() { throw new Error('must not run'); } });
  assert.equal((await bridge.probe()).available, false);
});

test('R5P-023 strict process bridge permits only policy-compliant host requests', async () => {
  let runCount = 0;
  const bridge = new StrictSandboxBridge({ async probe() { return goodProbe(); }, async run(request) {
    runCount++; assert.equal(request.runAs, 'UNPRIVILEGED_ONLY'); assert.equal(request.allowPrivilegeEscalation, false);
    return { exitCode: 0, stdout: 'ok', stderr: '', elapsedMs: 4, timedOut: false, cancelled: false, outputTruncated: false };
  } });
  assert.equal((await bridge.probe()).available, true);
  const result = await bridge.run({ executable: 'python3', args: ['-I', 'main.py'], workingDirectoryToken: 'p', timeoutMs: 1000,
    maxOutputBytes: 4096, networkAllowed: false, filesystemScope: 'PROJECT_READ_ONLY', environmentAllowList: [],
    runAs: 'UNPRIVILEGED_ONLY', allowPrivilegeEscalation: false });
  assert.equal(result.stdout, 'ok'); assert.equal(runCount, 1);
});

test('R5P-024 language runtime suite is not advertised until strict bridge is initialized', () => {
  const bridge = new StrictSandboxBridge({ async probe() { return goodProbe({ available: false }); }, async run() { throw new Error('must not run'); } });
  const runtimes = createSandboxedLanguageRuntimes(bridge);
  assert.equal(runtimes.python.descriptor.available, false);
  assert.equal(runtimes.cpp.descriptor.available, false);
  assert.equal(runtimes.rust.descriptor.available, false);
  assert.equal(runtimes.desktopProcess.descriptor.available, false);
});

test('R5P-025 arbitrary root/administrator execution is always denied', () => {
  assert.equal(rootExecutionAllowed({ requiresRoot: true }), false);
  assert.equal(rootExecutionAllowed({ requiresRoot: false }), false);
});

// ANDROID, UNITY, UNREAL PROJECT INSPECTION

test('R5P-026 Android project recognizer finds app module and manifest identity', async () => {
  const project = new MemoryProject({
    'settings.gradle': `include ':app'`,
    'build.gradle': `plugins { id 'com.android.application' version '8.7.0' apply false }`,
    'gradlew': '#!/bin/sh\n',
    'gradle/wrapper/gradle-wrapper.properties': 'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.9-bin.zip',
    'app/build.gradle': `plugins { id 'com.android.application' }`,
    'app/src/main/AndroidManifest.xml': `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.example.axon"><uses-sdk android:minSdkVersion="23" android:targetSdkVersion="35" /></manifest>`,
    'app/src/main/java/Main.java': 'class Main {}'
  });
  const result = await inspectAndroidProject(project, 'p');
  assert.equal(result.detected, true);
  assert.equal(result.packageId, 'com.example.axon');
  assert.equal(result.buildableByInspection, true);
});

test('R5P-027 Android missing manifest is blocked', async () => {
  const project = new MemoryProject({ 'settings.gradle': "include ':app'", 'app/build.gradle': 'plugins {}' });
  const result = await inspectAndroidProject(project, 'p');
  assert.equal(result.detected, false);
  assert.ok(result.blockers.some(x => /Manifest/i.test(x)));
});

test('R5P-028 Android inspection does not claim a build toolchain is available', async () => {
  const project = new MemoryProject({ 'settings.gradle': "include ':app'", 'build.gradle': 'plugins {}', 'gradlew': '#!/bin/sh',
    'gradle/wrapper/gradle-wrapper.properties': 'distributionUrl=x', 'app/build.gradle': 'plugins {}',
    'app/src/main/AndroidManifest.xml': '<manifest package="com.example.axon"/>', 'app/src/main/java/Main.java': 'class Main{}' });
  const result = await inspectAndroidProject(project, 'p');
  assert.ok(result.notes.some(x => /Android SDK/i.test(x)));
});

test('R5P-029 Unity project is identified from project, package and assets markers', async () => {
  const project = new MemoryProject({ 'ProjectSettings/ProjectVersion.txt': 'm_EditorVersion: 6000.0.1f1',
    'Packages/manifest.json': '{}', 'Assets/Scenes/Main.unity': 'scene' });
  const result = await inspectGameEngineProject(project, 'p');
  assert.equal(result.engine, 'unity');
  assert.equal(result.executionReady, false);
});

test('R5P-030 Unreal project is identified without claiming engine execution', async () => {
  const project = new MemoryProject({ 'Game.uproject': '{}', 'Source/Game.Target.cs': 'class GameTarget {}', 'Content/Map.umap': 'data', 'Config/DefaultEngine.ini': '' });
  const result = await inspectGameEngineProject(project, 'p');
  assert.equal(result.engine, 'unreal');
  assert.equal(result.executionReady, false);
});

// REMOTE EXECUTION TRUST AND APK ARTIFACT VERIFICATION

test('R5P-031 remote execution requires HTTPS', () => {
  assert.equal(remoteExecutionPolicy('http://worker.example/run', true).allowed, false);
});

test('R5P-032 remote execution requires explicit owner approval', () => {
  assert.equal(remoteExecutionPolicy('https://worker.example/run', false).allowed, false);
});

test('R5P-033 remote execution rejects URL-embedded credentials', () => {
  assert.equal(remoteExecutionPolicy('https://user:secret@worker.example/run', true).allowed, false);
});

test('R5P-034 remote execution accepts HTTPS only as a preliminary policy check', () => {
  const result = remoteExecutionPolicy('https://worker.example/run', true);
  assert.equal(result.allowed, true);
  assert.match(result.reason, /authenticated worker verification is still required/i);
});

test('R5P-035 remote attestation rejects nonce, hash and expiry mismatches', async () => {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const expected = { requestId: 'r', nonce: 'n', projectSha256: 'a'.repeat(64), createdAt: 100, expiresAt: 500 };
  const attestation = { workerId: 'worker-1', requestId: 'r', nonce: 'n', projectSha256: 'a'.repeat(64), issuedAt: 120, expiresAt: 400, resultSha256: 'b'.repeat(64), signature: new Uint8Array() };
  const payload = new TextEncoder().encode(JSON.stringify({ workerId: attestation.workerId, requestId: attestation.requestId, nonce: attestation.nonce,
    projectSha256: attestation.projectSha256, issuedAt: attestation.issuedAt, expiresAt: attestation.expiresAt, resultSha256: attestation.resultSha256 }));
  attestation.signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, payload));
  assert.equal(await verifyRemoteExecutionAttestation(attestation, expected, keyPair.publicKey, 200), true);
  assert.equal(await verifyRemoteExecutionAttestation({ ...attestation, nonce: 'wrong' }, expected, keyPair.publicKey, 200), false);
  assert.equal(await verifyRemoteExecutionAttestation(attestation, expected, keyPair.publicKey, 600), false);
});

test('R5P-036 Android APK build is blocked when toolchain is absent', async () => {
  const service = new AndroidApkBuildService({
    async probeAndroidBuildTools() { return { available: false, notes: ['SDK missing'] }; },
    async buildApk() { throw new Error('must not build'); }, async verifyApk() { return { valid: false, notes: [] }; }
  });
  const result = await service.build({ projectId: 'p', workingDirectoryToken: 'w', timeoutMs: 1000, outputLimitBytes: 1000, userApproved: true });
  assert.equal(result.status, 'BLOCKED');
});

test('R5P-037 Native C++/Rust build refuses unsafe source paths and privilege escalation', async () => {
  const service = new NativeProjectBuildService({
    async probeToolchain() { return { available: true, isolated: true, notes: [] }; },
    async build() { throw new Error('must not build'); }, async verify() { return { valid: false, notes: [] }; }
  });
  const result = await service.build({ projectId: 'p', workingDirectoryToken: 'w', sourceFiles: ['../outside.cpp'], target: 'cpp', profile: 'debug',
    timeoutMs: 1000, outputLimitBytes: 1000, networkAllowed: false, runAs: 'UNPRIVILEGED_ONLY', userApproved: true });
  assert.equal(result.status, 'BLOCKED');
});


// ADDITIONAL BOUNDARY, PACKAGE, AND HOST-SERVICE VERIFICATION

test('R5P-038 circular local imports are included once and do not recurse indefinitely', async () => {
  const project = new MemoryProject({
    'src/a.ts': `import { b } from './b'; export const a = () => 'a' + b(); console.log(a());`,
    'src/b.ts': `import { a } from './a'; export const b = () => 'b';`
  });
  const bundle = await new MultiFileProjectBundler(project).bundle('p', 'src/a.ts');
  assert.equal(bundle.complete, true);
  assert.deepEqual(bundle.includedFiles.sort(), ['src/a.ts', 'src/b.ts']);
});

test('R5P-039 a non-literal require is reported and bundle completeness is false', async () => {
  const project = new MemoryProject({ 'src/main.js': `const name = getName(); const dep = require('./' + name); console.log(dep);` });
  const bundle = await new MultiFileProjectBundler(project).bundle('p', 'src/main.js');
  assert.equal(bundle.complete, false);
  assert.equal(bundle.source, '');
  assert.ok(bundle.diagnostics.some(x => x.code === 'DYNAMIC_MODULE_SPECIFIER_UNRESOLVED'));
});

test('R5P-040 wildcard package exports are not guessed or expanded unsafely', async () => {
  const project = new MemoryProject({
    'src/main.js': `const part = require('pkg/feature'); console.log(part);`,
    'node_modules/pkg/package.json': JSON.stringify({ exports: { './*': './src/*.js' } }),
    'node_modules/pkg/src/feature.js': `module.exports = 1;`
  });
  const bundle = await new MultiFileProjectBundler(project).bundle('p', 'src/main.js');
  assert.equal(bundle.complete, false);
  assert.ok(bundle.diagnostics.some(x => x.code === 'PROJECT_MODULE_NOT_RESOLVED'));
});

test('R5P-041 total source byte cap covers transitive project files', async () => {
  const project = new MemoryProject({ 'main.ts': `import './large';`, 'large.ts': `export const text = '${'x'.repeat(400)}';` });
  await assert.rejects(() => new MultiFileProjectBundler(project, { maxTotalSourceBytes: 100 }).bundle('p', 'main.ts'), /bundle limit/);
});

test('R5P-042 package metadata cannot point outside the project root', async () => {
  const project = new MemoryProject({
    'src/main.js': `const x = require('bad-pkg'); console.log(x);`,
    'node_modules/bad-pkg/package.json': JSON.stringify({ main: '../../outside.js' }),
    'outside.js': `module.exports = 'escape';`
  });
  const bundle = await new MultiFileProjectBundler(project).bundle('p', 'src/main.js');
  assert.equal(bundle.complete, false);
  assert.ok(!bundle.includedFiles.includes('outside.js'));
});

test('R5P-043 host runtime fails closed when security probe throws', async () => {
  const adapter = new HostProcessRuntimeAdapter('test-runtime', {
    async probe() { throw new Error('probe unavailable'); }, async run() { throw new Error('must not run'); }
  }, 'fixed-launcher', ['python'], ['linux'], 'process');
  const report = await adapter.initialize();
  assert.equal(report.state, 'BLOCKED');
  assert.equal(adapter.descriptor.available, false);
});

test('R5P-044 Android build requires explicit user approval before probing', async () => {
  let probed = false;
  const service = new AndroidApkBuildService({
    async probeAndroidBuildTools() { probed = true; return { available: false, notes: [] }; },
    async buildApk() { throw new Error('must not build'); }, async verifyApk() { throw new Error('must not verify'); }
  });
  const result = await service.build({ projectId: 'p', workingDirectoryToken: 'w', timeoutMs: 1000, outputLimitBytes: 1000, userApproved: false });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(probed, false);
});

test('R5P-045 Android build bridge requires isolation, network denial and bounded execution', async () => {
  let built = false;
  const service = new AndroidApkBuildService({
    async probeAndroidBuildTools() { return { available: true, isolated: false, networkBlocked: true, filesystemIsolated: true,
      timeLimitEnforced: true, outputLimitEnforced: true, unprivilegedIdentity: true, notes: [] }; },
    async buildApk() { built = true; throw new Error('must not build'); }, async verifyApk() { throw new Error('must not verify'); }
  });
  const result = await service.build({ projectId: 'p', workingDirectoryToken: 'w', timeoutMs: 1000, outputLimitBytes: 1000, userApproved: true });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(built, false);
});

test('R5P-046 Android device installation requires approval, verified hash and package identity', async () => {
  let installs = 0;
  const service = new AndroidApplicationService({
    async probe() { return { available: true, deviceId: 'android-test', apiLevel: 35, abi: 'arm64-v8a', notes: [] }; },
    async install(input) { installs++; return { installed: true, packageId: input.packageId, artifactSha256: input.artifactSha256, notes: [] }; },
    async launch() { return { launched: true, notes: [] }; }
  });
  const denied = await service.installAndLaunch({ artifactToken: 'apk', artifactSha256: 'a'.repeat(64), packageId: 'com.example.axon', userApproved: false });
  assert.equal(denied.status, 'BLOCKED');
  assert.equal(installs, 0);
  const allowed = await service.installAndLaunch({ artifactToken: 'apk', artifactSha256: 'a'.repeat(64), packageId: 'com.example.axon', userApproved: true });
  assert.equal(allowed.status, 'LAUNCHED');
  assert.equal(installs, 1);
});

test('R5P-047 Android device bridge hash mismatch is rejected', async () => {
  const service = new AndroidApplicationService({
    async probe() { return { available: true, deviceId: 'android-test', notes: [] }; },
    async install(input) { return { installed: true, packageId: input.packageId, artifactSha256: 'b'.repeat(64), notes: [] }; },
    async launch() { throw new Error('must not launch'); }
  });
  const result = await service.installAndLaunch({ artifactToken: 'apk', artifactSha256: 'a'.repeat(64), packageId: 'com.example.axon', userApproved: true });
  assert.equal(result.status, 'INSTALL_FAILED');
});

test('R5P-048 Unity/Unreal build is blocked unless all strict host controls are attested', async () => {
  let builds = 0;
  const service = new GameEngineBuildService({
    async probe() { return { available: true, engineVersion: 'test', targetPlatforms: ['windows'], isolated: true,
      networkBlocked: false, filesystemIsolated: true, memoryLimitEnforced: true, timeLimitEnforced: true, unprivilegedIdentity: true, notes: [] }; },
    async build() { builds++; throw new Error('must not build'); }, async verify() { throw new Error('must not verify'); }
  });
  const result = await service.build({ engine: 'unity', projectId: 'p', workingDirectoryToken: 'w', targetPlatform: 'windows',
    timeoutMs: 1000, outputLimitBytes: 1000, userApproved: true });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(builds, 0);
});

test('R5P-049 native C++ build requires every isolation guarantee', async () => {
  let builds = 0;
  const service = new NativeProjectBuildService({
    async probeToolchain() { return { available: true, isolated: true, networkBlocked: true, filesystemIsolated: true,
      memoryLimitEnforced: false, timeLimitEnforced: true, unprivilegedIdentity: true, notes: [] }; },
    async build() { builds++; throw new Error('must not build'); }, async verify() { throw new Error('must not verify'); }
  });
  const result = await service.build({ projectId: 'p', workingDirectoryToken: 'w', sourceFiles: ['main.cpp'], target: 'cpp', profile: 'debug',
    timeoutMs: 1000, outputLimitBytes: 1000, networkAllowed: false, runAs: 'UNPRIVILEGED_ONLY', userApproved: true });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(builds, 0);
});

test('R5P-050 native source list must match the requested compiler family', async () => {
  let probed = false;
  const service = new NativeProjectBuildService({
    async probeToolchain() { probed = true; return { available: true, isolated: true, networkBlocked: true, filesystemIsolated: true,
      memoryLimitEnforced: true, timeLimitEnforced: true, unprivilegedIdentity: true, notes: [] }; },
    async build() { throw new Error('must not build'); }, async verify() { return { valid: false, notes: [] }; }
  });
  const result = await service.build({ projectId: 'p', workingDirectoryToken: 'w', sourceFiles: ['main.rs'], target: 'cpp', profile: 'debug',
    timeoutMs: 1000, outputLimitBytes: 1000, networkAllowed: false, runAs: 'UNPRIVILEGED_ONLY', userApproved: true });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(probed, false);
});


test('R5P-051 factory connects TypeScript/JSX workspace bundling to the guarded Worker adapter', () => {
  const project = new MemoryProject({ 'main.tsx': `const view = <section />;` });
  const provider = { attest() { return { providerId: 'test', isolatedOrigin: true, networkBlockedByHostPolicy: true,
    filesystemBridgeAbsent: true, restrictiveCspConfirmed: true, noPrivilegedHostBridge: true }; }, createWorker() { throw new Error('not run in admission test'); } };
  const adapter = createBundledJavaScriptWorkerRuntime(project, provider);
  assert.equal(adapter.canHandle({ requestId: 'r', projectId: 'p', entryFiles: ['main.tsx'], runtimeId: 'javascript-worker-ac2',
    mode: 'FULL_LOCAL', timeoutMs: 1000, outputLimitBytes: 4096, networkAllowed: false, fileAccess: 'none' }), true);
});

test('R5P-052 raw JavaScript adapter still rejects TypeScript when no compiler/bundler provider is attached', async () => {
  const provider = { attest() { return { providerId: 'test', isolatedOrigin: true, networkBlockedByHostPolicy: true,
    filesystemBridgeAbsent: true, restrictiveCspConfirmed: true, noPrivilegedHostBridge: true }; }, createWorker() { throw new Error('not run'); } };
  // Raw JavaScript runtime's extension allow-list remains intentionally narrow.
  const { JavaScriptWorkerExecutionAdapter } = await import('../dist/runtime/javascriptWorker.js');
  const adapter = new JavaScriptWorkerExecutionAdapter({ async readSingleEntry() { return null; } }, provider);
  assert.equal(adapter.canHandle({ requestId: 'r', projectId: 'p', entryFiles: ['main.ts'], runtimeId: 'javascript-worker-ac2',
    mode: 'FULL_LOCAL', timeoutMs: 1000, outputLimitBytes: 4096, networkAllowed: false, fileAccess: 'none' }), false);
});

test('R5P-053 browser host probe classifies an Android WebView user agent as provisional', async () => {
  const fakeWindow = {
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel) AppleWebKit/537.36 Version/4.0 Chrome/120.0 Mobile Safari/537.36; wv)' },
    Worker: function Worker() {}, Blob: function Blob() {}, URL: { createObjectURL() { return 'blob:test'; } },
    indexedDB: {}, WebAssembly: {}, MessageChannel: function MessageChannel() {}, AbortController: function AbortController() {},
    isSecureContext: true
  };
  const report = await probeBrowserHost(fakeWindow);
  assert.equal(report.hostKind, 'android-webview');
  assert.equal(report.workerExecutionEligible, true);
  assert.ok(report.notes.some(note => /actual WebView conformance run is still required/i.test(note)));
});

test('R5P-054 remote attestation rejects a signature after result digest tampering', async () => {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const expected = { requestId: 'r2', nonce: 'n2', projectSha256: 'c'.repeat(64), createdAt: 10, expiresAt: 500 };
  const attestation = { workerId: 'worker-2', requestId: 'r2', nonce: 'n2', projectSha256: 'c'.repeat(64), issuedAt: 20,
    expiresAt: 400, resultSha256: 'd'.repeat(64), signature: new Uint8Array() };
  const payload = new TextEncoder().encode(JSON.stringify({ workerId: attestation.workerId, requestId: attestation.requestId, nonce: attestation.nonce,
    projectSha256: attestation.projectSha256, issuedAt: attestation.issuedAt, expiresAt: attestation.expiresAt, resultSha256: attestation.resultSha256 }));
  attestation.signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, payload));
  assert.equal(await verifyRemoteExecutionAttestation(attestation, expected, keyPair.publicKey, 100), true);
  assert.equal(await verifyRemoteExecutionAttestation({ ...attestation, resultSha256: 'e'.repeat(64) }, expected, keyPair.publicKey, 100), false);
});


test('R5P-055 TypeScript semantic checker enforces per-file and aggregate source limits', async () => {
  const project = new MemoryProject({ 'a.ts': 'export const a = 1;', 'b.ts': 'export const b = 2;' });
  await assert.rejects(() => typeCheckTypeScriptProject(project, 'p', { maxSingleFileBytes: 4 }), /per-file/);
  await assert.rejects(() => typeCheckTypeScriptProject(project, 'p', { maxTotalSourceBytes: 10 }), /total type-check/);
});

test('R5P-056 Android APK build forwards approval and verifies manifest, signature, digest and size', async () => {
  const expectedHash = 'a'.repeat(64);
  let requestSeen = null;
  const service = new AndroidApkBuildService({
    async probeAndroidBuildTools() { return { available: true, isolated: true, networkBlocked: true, filesystemIsolated: true,
      timeLimitEnforced: true, outputLimitEnforced: true, unprivilegedIdentity: true, notes: [] }; },
    async buildApk(input) { requestSeen = input; return { success: true, artifactToken: 'apk-token', packageId: 'com.example.axon', sha256: expectedHash, diagnostics: [] }; },
    async verifyApk() { return { valid: true, manifestParsed: true, signatureValid: true, packageId: 'com.example.axon',
      sha256: expectedHash, sizeBytes: 4096, minSdk: 23, targetSdk: 35, permissions: [], notes: [] }; }
  });
  const result = await service.build({ projectId: 'p', workingDirectoryToken: 'w', timeoutMs: 30000, outputLimitBytes: 1024 * 1024, userApproved: true });
  assert.equal(result.status, 'BUILT_AND_VERIFIED');
  assert.equal(requestSeen.userApproved, true);
  assert.equal(requestSeen.networkAllowed, false);
  assert.equal(requestSeen.runAs, 'UNPRIVILEGED_ONLY');
});

test('R5P-057 native C++ build service verifies a bounded artifact under strict host policy', async () => {
  const hash = 'f'.repeat(64);
  const service = new NativeProjectBuildService({
    async probeToolchain() { return { available: true, isolated: true, networkBlocked: true, filesystemIsolated: true,
      memoryLimitEnforced: true, timeLimitEnforced: true, unprivilegedIdentity: true, notes: [] }; },
    async build(request) { assert.equal(request.networkAllowed, false); assert.equal(request.runAs, 'UNPRIVILEGED_ONLY'); return { success: true, artifactToken: 'bin-token', diagnostics: [] }; },
    async verify() { return { valid: true, sha256: hash, sizeBytes: 4096, notes: [] }; }
  });
  const result = await service.build({ projectId: 'p', workingDirectoryToken: 'w', sourceFiles: ['src/main.cpp'], target: 'cpp', profile: 'release',
    timeoutMs: 30000, outputLimitBytes: 1024 * 1024, networkAllowed: false, runAs: 'UNPRIVILEGED_ONLY', userApproved: true });
  assert.equal(result.status, 'BUILT_AND_VERIFIED');
  assert.equal(result.artifactToken, 'bin-token');
});

test('R5P-058 Unity build service requires approval and forwards non-root/network-denied policy', async () => {
  const hash = '1'.repeat(64);
  let forwarded = null;
  const service = new GameEngineBuildService({
    async probe() { return { available: true, engineVersion: '6000', targetPlatforms: ['windows'], isolated: true, networkBlocked: true,
      filesystemIsolated: true, memoryLimitEnforced: true, timeLimitEnforced: true, unprivilegedIdentity: true, notes: [] }; },
    async build(input) { forwarded = input; return { success: true, artifactToken: 'unity-build', sha256: hash, diagnostics: [] }; },
    async verify() { return { valid: true, sha256: hash, sizeBytes: 4096, notes: [] }; }
  });
  const result = await service.build({ engine: 'unity', projectId: 'game', workingDirectoryToken: 'w', targetPlatform: 'windows',
    timeoutMs: 60000, outputLimitBytes: 1024 * 1024, userApproved: true });
  assert.equal(result.status, 'BUILT_AND_VERIFIED');
  assert.equal(forwarded.networkAllowed, false);
  assert.equal(forwarded.runAs, 'UNPRIVILEGED_ONLY');
});

test('R5P-059 remote endpoint query tokens are refused', () => {
  assert.equal(remoteExecutionPolicy('https://worker.example/run?access_token=secret', true).allowed, false);
});
