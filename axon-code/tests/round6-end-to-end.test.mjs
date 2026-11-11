import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeProject,
  MultiFileProjectBundler,
  typeCheckTypeScriptProject,
  inspectAndroidProject,
  inspectGameEngineProject,
  assessRuntimeReadiness,
  StrictSandboxBridge,
  remoteExecutionPolicy,
  rootExecutionAllowed,
  AndroidApplicationService,
  GameEngineBuildService,
  NativeProjectBuildService,
  verifyRemoteExecutionAttestation
} from '../dist/index.js';

class MemoryProject {
  constructor(files) { this.files = new Map(Object.entries(files)); }
  async listFiles() { return [...this.files.keys()]; }
  async readText(_projectId, path) { return this.files.get(path) ?? null; }
  async listFilesForAnalysis() { return [...this.files.entries()].map(([path, source]) => ({ path, source, sizeBytes: Buffer.byteLength(source), kind: 'text' })); }
  async listFilesForAnalyzer() { return [...this.files.entries()].map(([path, source]) => ({ path, sizeBytes: Buffer.byteLength(source), kind: 'text' })); }
  async readTextFile(path, maxBytes) { const source = this.files.get(path); return source === undefined || Buffer.byteLength(source) > maxBytes ? null : source; }
}

const typedFiles = {
  'src/main.ts': `import { double } from './math';\nimport { label } from 'axon-label';\nconst answer: number = double(21);\nconsole.log('R6_APP', answer, label('AXON'));\nexport default { answer };`,
  'src/math.ts': `export function double(value: number): number { return value * 2; }`,
  'node_modules/axon-label/package.json': JSON.stringify({ exports: { '.': { browser: './browser.js', default: './index.js' } } }),
  'node_modules/axon-label/browser.js': `exports.label = (value) => value + ' browser';`,
  'node_modules/axon-label/index.js': `exports.label = (value) => value + ' node';`
};

function goodSandbox(overrides = {}) {
  return { available: true, platform: 'linux', executable: 'r6-host', isolationConfirmed: true, networkBlocked: true,
    filesystemIsolated: true, memoryLimitEnforced: true, timeLimitEnforced: true, unprivilegedIdentity: true, notes: [], ...overrides };
}

test('R6-E2E-001 project analysis identifies entry point and complete local dependency edges', async () => {
  const project = new MemoryProject(typedFiles);
  const analysisSource = {
    async listFiles() { return [...project.files.entries()].map(([path, source]) => ({ path, source, sizeBytes: Buffer.byteLength(source), kind: 'text' })); },
    async readTextFile(path, maxBytes) { const source = project.files.get(path); return source === undefined || Buffer.byteLength(source) > maxBytes ? null : source; }
  };
  const result = await analyzeProject('R6 sample app', analysisSource);
  assert.ok(result.outline.entryPoints.includes('src/main.ts'));
  assert.ok(result.outline.localDependencies >= 1);
  const main = result.files.find((file) => file.path === 'src/main.ts');
  assert.ok(main);
  assert.ok(main.imports.some((item) => item.specifier === './math' && item.resolvedFile === 'src/math.ts'));
});

test('R6-E2E-002 TypeScript semantic checker accepts the complete typed entry and helper', async () => {
  const project = new MemoryProject({
    'src/main.ts': `import { double } from './math';\nconst answer: number = double(21);\nexport { answer };`,
    'src/math.ts': `export function double(value: number): number { return value * 2; }`
  });
  const result = await typeCheckTypeScriptProject(project, 'r6-clean');
  assert.equal(result.success, true);
  assert.equal(result.checkedFiles, 2);
  assert.equal(result.diagnostics.filter((item) => item.severity === 'error').length, 0);
});

test('R6-E2E-003 semantic type error is attributed to the correct project file and source line', async () => {
  const project = new MemoryProject({ 'src/broken.ts': `const okay: number = 1;\nconst broken: number = 'bad';\nconsole.log(okay, broken);` });
  const result = await typeCheckTypeScriptProject(project, 'r6-broken');
  const finding = result.diagnostics.find((item) => item.code === 'TS2322');
  assert.equal(result.success, false);
  assert.equal(finding?.file, 'src/broken.ts');
  assert.equal(finding?.line, 2);
  assert.ok(Number.isInteger(finding?.column) && finding.column > 0);
});

test('R6-E2E-004 multi-file bundler includes only the reachable project and browser package export', async () => {
  const project = new MemoryProject({ ...typedFiles, 'src/unreachable.ts': `export const ignored = true;` });
  const result = await new MultiFileProjectBundler(project).bundle('r6', 'src/main.ts');
  assert.equal(result.complete, true);
  assert.deepEqual(result.includedFiles.sort(), ['node_modules/axon-label/browser.js', 'src/main.ts', 'src/math.ts'].sort());
  assert.match(result.source, /axon-label\/browser\.js/);
  assert.doesNotMatch(result.source, /axon-label\/index\.js/);
  assert.ok(!result.includedFiles.includes('src/unreachable.ts'));
});

test('R6-E2E-005 unresolved package fails closed and records a dependency diagnostic', async () => {
  const project = new MemoryProject({ 'src/main.ts': `import x from 'missing-r6-package'; console.log(x);` });
  const result = await new MultiFileProjectBundler(project).bundle('r6', 'src/main.ts');
  assert.equal(result.complete, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'PROJECT_MODULE_NOT_RESOLVED' && item.file === 'src/main.ts'));
});

test('R6-E2E-006 dynamic module specifier prevents a false claim of complete bundle', async () => {
  const project = new MemoryProject({ 'src/main.ts': `const name = './' + 'part'; const value = require(name); console.log(value);` });
  const result = await new MultiFileProjectBundler(project).bundle('r6', 'src/main.ts');
  assert.equal(result.complete, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'DYNAMIC_MODULE_SPECIFIER_UNRESOLVED'));
});

test('R6-E2E-007 malformed local package metadata is reported, not silently ignored', async () => {
  const project = new MemoryProject({ 'src/main.ts': `const marker = require('broken-metadata'); console.log(marker);`, 'node_modules/broken-metadata/package.json': '{bad json' });
  const result = await new MultiFileProjectBundler(project).bundle('r6', 'src/main.ts');
  assert.equal(result.complete, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'INVALID_PACKAGE_JSON'));
});

test('R6-E2E-008 project path attack is rejected before bundle work', async () => {
  const project = new MemoryProject({ '../outside.ts': `export default 7;`, 'src/main.ts': `console.log('safe');` });
  await assert.rejects(() => new MultiFileProjectBundler(project).bundle('r6', 'src/main.ts'), /unsafe or duplicate path/);
});

test('R6-E2E-009 Android application inspection detects project metadata without claiming a build', async () => {
  const project = new MemoryProject({
    'settings.gradle': `pluginManagement { repositories { google(); mavenCentral() } }`,
    'build.gradle': `plugins { id 'com.android.application' version '8.7.0' apply false }`,
    'app/build.gradle': `plugins { id 'com.android.application' }`,
    'gradlew': '#!/bin/sh\nexit 0',
    'gradle/wrapper/gradle-wrapper.properties': 'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.9-bin.zip',
    'app/src/main/AndroidManifest.xml': `<manifest package="com.example.axon"><uses-sdk android:minSdkVersion="23" android:targetSdkVersion="35" /></manifest>`,
    'app/src/main/java/com/example/axon/MainActivity.java': 'package com.example.axon; class MainActivity {}'
  });
  const result = await inspectAndroidProject(project, 'r6-android');
  assert.equal(result.detected, true);
  assert.equal(result.packageId, 'com.example.axon');
  assert.equal(result.buildableByInspection, true);
  assert.ok(result.notes.some((note) => /does not execute Gradle/i.test(note)));
});

test('R6-E2E-010 incomplete Android project is identified with explicit blockers', async () => {
  const project = new MemoryProject({ 'AndroidManifest.xml': '<manifest package="com.example.axon" />' });
  const result = await inspectAndroidProject(project, 'r6-android-broken');
  assert.equal(result.detected, false);
  assert.equal(result.buildableByInspection, false);
  assert.ok(result.blockers.length >= 2);
});

test('R6-E2E-011 Unity project structure is recognized but execution remains unready', async () => {
  const project = new MemoryProject({
    'ProjectSettings/ProjectVersion.txt': 'm_EditorVersion: 2022.3.10f1',
    'Packages/manifest.json': JSON.stringify({ dependencies: { 'com.unity.test-framework': '1.1.33' } }),
    'Assets/Scripts/Main.cs': 'public class Main {}'
  });
  const result = await inspectGameEngineProject(project, 'r6-unity');
  assert.equal(result.engine, 'unity');
  assert.equal(result.detected, true);
  assert.equal(result.executionReady, false);
  assert.ok(result.blockers.length > 0);
});

test('R6-E2E-012 Unreal project structure is recognized but execution remains unready', async () => {
  const project = new MemoryProject({
    'AxonDemo.uproject': JSON.stringify({ FileVersion: 3, EngineAssociation: '5.4' }),
    'Source/AxonDemo/AxonDemo.Build.cs': 'using UnrealBuildTool;',
    'Content/Maps/Main.umap': 'placeholder',
    'Config/DefaultEngine.ini': '[/Script/EngineSettings.GameMapsSettings]'
  });
  const result = await inspectGameEngineProject(project, 'r6-unreal');
  assert.equal(result.engine, 'unreal');
  assert.equal(result.detected, true);
  assert.equal(result.executionReady, false);
  assert.ok(result.blockers.length > 0);
});

test('R6-E2E-013 toolchain presence without a strict sandbox never marks Python available', () => {
  const result = assessRuntimeReadiness({ runtimeId: 'python-sandboxed', host: 'linux', implementationPresent: true,
    toolchainAvailable: true, providerConnected: false, endToEndEvidence: false,
    missingComponents: ['strict process sandbox provider'] });
  assert.equal(result.state, 'ADAPTER_REQUIRED');
  assert.equal(result.canExecuteUserProject, false);
});

test('R6-E2E-014 compiler plus connected bridge remains blocked if network isolation is not attested', () => {
  const result = assessRuntimeReadiness({ runtimeId: 'cpp-sandboxed', host: 'linux', implementationPresent: true,
    toolchainAvailable: true, providerConnected: true, endToEndEvidence: true,
    sandboxProbe: goodSandbox({ networkBlocked: false }) });
  assert.equal(result.state, 'BLOCKED');
  assert.equal(result.canExecuteUserProject, false);
});

test('R6-E2E-015 runtime stays READY_FOR_VALIDATION without end-to-end proof', () => {
  const result = assessRuntimeReadiness({ runtimeId: 'native-linux', host: 'linux', implementationPresent: true,
    toolchainAvailable: true, providerConnected: true, endToEndEvidence: false, sandboxProbe: goodSandbox() });
  assert.equal(result.state, 'READY_FOR_VALIDATION');
  assert.equal(result.canExecuteUserProject, false);
});

test('R6-E2E-016 runtime can become AVAILABLE only with strict host gates and end-to-end evidence', () => {
  const result = assessRuntimeReadiness({ runtimeId: 'verified-example', host: 'linux', implementationPresent: true,
    toolchainAvailable: true, providerConnected: true, endToEndEvidence: true, sandboxProbe: goodSandbox() });
  assert.equal(result.state, 'AVAILABLE');
  assert.equal(result.canExecuteUserProject, true);
});

test('R6-E2E-017 arbitrary root or administrator execution is always denied', () => {
  assert.equal(rootExecutionAllowed({ requiresRoot: true }), false);
  assert.equal(rootExecutionAllowed({ requiresRoot: false }), false);
});

test('R6-E2E-018 remote execution requires HTTPS and explicit user approval', () => {
  assert.equal(remoteExecutionPolicy('http://worker.example', true).allowed, false);
  assert.equal(remoteExecutionPolicy('https://worker.example', false).allowed, false);
  assert.equal(remoteExecutionPolicy('https://worker.example', true).allowed, true);
});

test('R6-E2E-019 remote execution rejects endpoint credentials and query strings', () => {
  assert.equal(remoteExecutionPolicy('https://user:pass@worker.example', true).allowed, false);
  assert.equal(remoteExecutionPolicy('https://worker.example?token=secret', true).allowed, false);
});

test('R6-E2E-020 native build bridge is never invoked when strict isolation is absent', async () => {
  let buildCalls = 0;
  const service = new NativeProjectBuildService({
    async probeToolchain() { return { available: true, compiler: 'g++', isolated: false, networkBlocked: false,
      filesystemIsolated: false, memoryLimitEnforced: false, timeLimitEnforced: false, unprivilegedIdentity: false, notes: ['sandbox absent'] }; },
    async build() { buildCalls++; return { success: true, artifactToken: 'untrusted', diagnostics: [] }; },
    async verify() { return { valid: false, notes: [] }; }
  });
  const result = await service.build({ projectId: 'r6', workingDirectoryToken: 'work:r6', sourceFiles: ['main.cpp'], target: 'cpp',
    profile: 'debug', timeoutMs: 1000, outputLimitBytes: 1000, networkAllowed: false, runAs: 'UNPRIVILEGED_ONLY', userApproved: true });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(buildCalls, 0);
});

test('R6-E2E-021 Android installation fails closed when no authorized device bridge is connected', async () => {
  let installCalls = 0;
  const service = new AndroidApplicationService({
    async probe() { return { available: false, notes: ['No device.'] }; },
    async install() { installCalls++; return { installed: true, packageId: 'com.example.axon', artifactSha256: 'a'.repeat(64), notes: [] }; },
    async launch() { return { launched: true, notes: [] }; }
  });
  const result = await service.installAndLaunch({ artifactToken: 'artifact:r6', artifactSha256: 'a'.repeat(64), packageId: 'com.example.axon', userApproved: true });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(installCalls, 0);
});

test('R6-E2E-022 Unity and Unreal build bridge refuses missing strict isolation', async () => {
  let calls = 0;
  const service = new GameEngineBuildService({
    async probe() { return { available: true, targetPlatforms: ['linux'], isolated: false, networkBlocked: false,
      filesystemIsolated: false, memoryLimitEnforced: false, timeLimitEnforced: false, unprivilegedIdentity: false, notes: [] }; },
    async build() { calls++; return { success: true, artifactToken: 'bad', sha256: 'a'.repeat(64), diagnostics: [] }; },
    async verify() { return { valid: false, notes: [] }; }
  });
  const result = await service.build({ engine: 'unity', projectId: 'r6-unity', workingDirectoryToken: 'work:r6-unity', targetPlatform: 'linux',
    timeoutMs: 1000, outputLimitBytes: 1000, userApproved: true });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(calls, 0);
});

test('R6-E2E-023 remote attestation mismatch is rejected before any result is trusted', async () => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) { assert.ok(true, 'WebCrypto is not available in this Node host; browser persistence suite verifies the browser cryptographic path.'); return; }
  const keys = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const expected = { requestId: 'r6-req', nonce: 'n1', projectSha256: 'b'.repeat(64), createdAt: 100, expiresAt: 10_000 };
  const wrong = { workerId: 'worker', requestId: 'wrong', nonce: 'n1', projectSha256: expected.projectSha256, issuedAt: 200,
    expiresAt: 9000, resultSha256: 'c'.repeat(64), signature: new Uint8Array([1, 2, 3]) };
  assert.equal(await verifyRemoteExecutionAttestation(wrong, expected, keys.publicKey, 300), false);
});

test('R6-E2E-024 file analysis ignores untrusted absolute paths instead of normalizing them into the workspace', async () => {
  const project = {
    async listFiles() { return [
      { path: 'src/main.ts', sizeBytes: 20, kind: 'text' },
      { path: '/etc/passwd', sizeBytes: 20, kind: 'text' }
    ]; },
    async readTextFile(path) { return path === 'src/main.ts' ? `console.log('safe');` : null; }
  };
  const result = await analyzeProject('r6-paths', project);
  assert.ok(result.diagnostics.some((item) => item.code === 'UNSAFE_PROJECT_PATH'));
  assert.equal(result.files.some((item) => item.path === '/etc/passwd'), false);
});

test('R6-E2E-025 Android/WebView or desktop host label alone cannot be used as runtime evidence', () => {
  const targets = ['android', 'ios', 'windows', 'macos', 'server'];
  for (const host of targets) {
    const result = assessRuntimeReadiness({ runtimeId: `unvalidated-${host}`, host, implementationPresent: false,
      toolchainAvailable: false, providerConnected: false, endToEndEvidence: false });
    assert.equal(result.state, 'NOT_IMPLEMENTED');
    assert.equal(result.canExecuteUserProject, false);
  }
});
