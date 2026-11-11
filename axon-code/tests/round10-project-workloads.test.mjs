import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  EnvironmentIntelligence,
  analyzeProject,
  inspectAndroidProject,
  inspectGameEngineProject,
  typeCheckTypeScriptProject,
  MultiFileProjectBundler
} from '../dist/index.js';

const fixtures = JSON.parse(await readFile(new URL('./round10-browser-fixtures.json', import.meta.url), 'utf8'));
class MemoryProject {
  constructor(files) { this.files = new Map(Object.entries(files)); }
  async listFiles() { return [...this.files.keys()].sort(); }
  async readText(_projectId, file) { return this.files.get(file) ?? null; }
  async listFilesForAnalysis() { return [...this.files.entries()].map(([path, source]) => ({ path, source, sizeBytes: Buffer.byteLength(source), kind: 'text' })); }
  async listFilesForAnalyzer() { return [...this.files.entries()].map(([path, source]) => ({ path, sizeBytes: Buffer.byteLength(source), kind: 'text' })); }
  async readTextFile(path, maxBytes) { const value = this.files.get(path); return value === undefined || Buffer.byteLength(value) > maxBytes ? null : value; }
}

async function analyze(files, name) {
  const project = new MemoryProject(files);
  return analyzeProject(name, {
    async listFiles() { return [...project.files.entries()].map(([path, source]) => ({ path, sizeBytes: Buffer.byteLength(source), kind: 'text' })); },
    async readTextFile(path) { return project.files.get(path) ?? null; }
  });
}

test('R10-P01 website environment intelligence identifies a mixed Node/Web project', () => {
  // Use a reconstructed portable snapshot so the test does not depend on a host filesystem.
  const websiteFiles = {
    'package.json': JSON.stringify({ name: 'round10-commerce-site', engines: { node: '>=20' }, scripts: { build: 'tsc' } }),
    'index.html': fixtures.website.html,
    'site.css': fixtures.website.css,
    'site.js': fixtures.website.javascript,
    'src/main.ts': `import { checkout } from './catalog'; console.log(checkout(10));`,
    'src/catalog.ts': `export function checkout(discount: number) { return 27; }`
  };
  const inspected = new EnvironmentIntelligence().inspect('r10-website', Object.entries(websiteFiles).map(([path, content]) => ({ path, content })));
  assert.ok(inspected.ecosystems.includes('NODE'));
  assert.ok(inspected.ecosystems.includes('WEB'));
  assert.ok(inspected.manifests.includes('package.json'));
  assert.ok(inspected.entryPoints.includes('src/main.ts'));
});

test('R10-P02 website source is analysed with no diagnostics and a complete static dependency graph', async () => {
  const projectFiles = {
    'index.html': fixtures.website.html,
    'site.css': fixtures.website.css,
    'site.js': fixtures.website.javascript,
    'src/main.ts': `import { checkout } from './catalog'; console.log(checkout(10));`,
    'src/catalog.ts': `export function checkout(discount: number) { return 27; }`
  };
  const result = await analyze(projectFiles, 'R10 website');
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.outline.dependencyGraphComplete, true);
  assert.ok(result.outline.languages.html >= 1);
  assert.ok(result.outline.languages.typescript >= 2);
});

test('R10-P03 multi-file commerce logic type-checks and bundles for the supported JavaScript Worker runtime', async () => {
  const websiteFiles = {
    'src/main.ts': `import { checkout, items } from './catalog'; const receipt = checkout(10); console.log('R10_WEBSITE_APP', JSON.stringify({ names: items.map(x => x.name), ...receipt }));`,
    'src/catalog.ts': `import { subtotal, applyDiscount } from './math'; export const items = [{id:'book',name:'Notebook',price:12},{id:'pens',name:'Pen set',price:18}]; export function checkout(discount:number){const before=subtotal(items.map(x=>x.price)); return {itemCount:items.length,before,total:applyDiscount(before,discount)}};`,
    'src/math.ts': `export function subtotal(values: readonly number[]): number { return values.reduce((a,b)=>a+b,0); } export function applyDiscount(value:number, percentage:number):number { if(percentage<0||percentage>100) throw new RangeError('bad discount'); return Math.round(value*(100-percentage))/100; }`
  };
  const project = new MemoryProject(websiteFiles);
  const checked = await typeCheckTypeScriptProject(project, 'r10-website');
  const bundled = await new MultiFileProjectBundler(project).bundle('r10-website', 'src/main.ts');
  assert.equal(checked.success, true);
  assert.equal(bundled.complete, true);
  assert.deepEqual(bundled.includedFiles.sort(), ['src/catalog.ts', 'src/main.ts', 'src/math.ts']);
  assert.match(bundled.source, /R10_WEBSITE_APP/);
});

test('R10-P04 deterministic AI-tool integration fixture is typed and bundleable but clearly marked as a test double', async () => {
  const files = {
    'src/provider.ts': `export class DeterministicTestProvider { readonly providerKind = 'TEST_DOUBLE'; async complete(prompt:string){const count=(prompt.match(/ERROR:/g)||[]).length;return JSON.stringify({summary: count + ' error marker(s) supplied'})} }`,
    'src/main.ts': `import { DeterministicTestProvider } from './provider'; export async function run(){const provider=new DeterministicTestProvider(); const answer=await provider.complete('ERROR: one\\nERROR: two'); console.log('R10_AI_TOOL_SIMULATION',provider.providerKind,answer)}; void run();`
  };
  const project = new MemoryProject(files);
  const checked = await typeCheckTypeScriptProject(project, 'r10-ai-tool');
  const bundle = await new MultiFileProjectBundler(project).bundle('r10-ai-tool', 'src/main.ts');
  assert.equal(checked.success, true);
  assert.equal(bundle.complete, true);
  assert.match(bundle.source, /TEST_DOUBLE/);
  assert.doesNotMatch(bundle.source, /openai|anthropic|gemini/i);
});

test('R10-P05 actual AXON Code source subset can be analysed and bundled for execution by its own JS runtime', () => {
  const subset = fixtures.selfhost;
  assert.equal(subset.bundle.complete, true);
  assert.ok(subset.bundle.includedFiles.includes('src/pathSafety.ts'));
  assert.ok(subset.bundle.includedFiles.includes('src/lexer.ts')); // selected source modules: path safety + real lexer
  assert.equal(subset.analysis.outline.dependencyGraphComplete, true);
  assert.match(subset.bundle.source, /R10_SELF_HOST/);
});

test('R10-P06 full AXON Code TypeScript source self-checks with the trusted toolchain declaration provider', () => {
  assert.equal(fixtures.fullSource.typecheck.success, true);
  assert.equal(fixtures.fullSource.typecheck.checkedFiles, fixtures.fullSource.fileCount);
  assert.equal(fixtures.fullSource.typecheck.diagnostics.length, 0);
});

test('R10-P07 superseded parser findings are absent after Round 12 compiler-backed analysis', () => {
  const codes = fixtures.fullSource.analysis.diagnosticCodes;
  const falsePositiveFamilies = ['UNCLOSED_STRING', 'UNEXPECTED_CLOSING_DELIMITER', 'UNCLOSED_DELIMITER'];
  const detected = falsePositiveFamilies.reduce((sum, code) => sum + (codes[code] ?? 0), 0);
  assert.equal(detected, 0, 'The old lexical false-positive families must no longer be emitted for the source snapshot.');
  assert.equal(codes.LOCAL_IMPORT_NOT_RESOLVED ?? 0, 0, 'NodeNext .js-to-.ts imports must resolve through the updated TypeScript-aware resolver.');
  assert.equal(fixtures.fullSource.typecheck.success, true, 'The retained full-source compiler verification remains green.');
});

test('R10-P08 game project HTML and script are recognised as a Web project without claiming a game engine', () => {
  const files = Object.entries(fixtures.game.files).map(([path, content]) => ({ path, content }));
  const profile = new EnvironmentIntelligence().inspect('r10-game', files);
  assert.ok(profile.ecosystems.includes('WEB'));
  assert.equal(profile.ecosystems.includes('UNITY'), false);
  assert.equal(profile.ecosystems.includes('UNREAL'), false);
});

test('R10-P09 malformed TypeScript fixture is diagnosed at the injected type mismatch', async () => {
  const project = new MemoryProject({ 'src/broken.ts': `const good: number = 3;\nconst broken: number = 'not a number';\nconsole.log(good, broken);` });
  const checked = await typeCheckTypeScriptProject(project, 'r10-injected-error');
  const finding = checked.diagnostics.find(item => item.code === 'TS2322');
  assert.equal(checked.success, false);
  assert.equal(finding.file, 'src/broken.ts');
  assert.equal(finding.line, 2);
});

test('R10-P10 Unity and Unreal inspection reports engine execution not ready in this host', async () => {
  const unity = { async listFiles() { return ['Assets/Scenes/Main.unity', 'Packages/manifest.json', 'ProjectSettings/ProjectVersion.txt']; } };
  const unreal = { async listFiles() { return ['Game.uproject', 'Source/Game/Game.cpp', 'Content/Map.umap', 'Config/DefaultEngine.ini']; } };
  const unityResult = await inspectGameEngineProject(unity, 'unity-demo');
  const unrealResult = await inspectGameEngineProject(unreal, 'unreal-demo');
  assert.equal(unityResult.engine, 'unity');
  assert.equal(unrealResult.engine, 'unreal');
  assert.equal(unityResult.executionReady, false);
  assert.equal(unrealResult.executionReady, false);
});

test('R10-P11 Android project inspection does not claim an APK build solely from manifest presence', async () => {
  const files = {
    'settings.gradle': 'pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }',
    'build.gradle': 'plugins { id "com.android.application" version "8.6.1" apply false }',
    'app/build.gradle': 'plugins { id "com.android.application" } android { namespace "com.example.demo"; compileSdk 35 }',
    'app/src/main/AndroidManifest.xml': '<manifest package="com.example.demo"><application/></manifest>',
    'gradlew': '#!/bin/sh\nexit 0\n',
    'gradle/wrapper/gradle-wrapper.properties': 'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.7-bin.zip'
  };
  const reader = { async listFiles() { return Object.keys(files); }, async readText(projectId, path) { return files[path] ?? null; } };
  const result = await inspectAndroidProject(reader, 'android-demo');
  assert.equal(result.detected, true);
  assert.equal(result.buildableByInspection, true);
  assert.ok(result.notes.some(item => /does not execute Gradle/i.test(item)));
  assert.ok(result.notes.some(item => /Android SDK/i.test(item)));
});
