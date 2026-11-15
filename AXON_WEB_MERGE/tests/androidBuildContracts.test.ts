import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const workflow = fs.readFileSync('.github/workflows/axon-web-android.yml', 'utf8');
const buildScript = fs.readFileSync('scripts/build-axon-web-android.sh', 'utf8');
const buildDoc = fs.readFileSync('BUILD.md', 'utf8');
const nvmrc = fs.readFileSync('.nvmrc', 'utf8').trim();

test('Capacitor runtime and plugin versions are exactly pinned in manifest and lock', () => {
  const expected = { '@capacitor/core': '7.6.9', '@capacitor/cli': '7.6.9', '@capacitor/android': '7.6.9', '@capacitor/app': '7.1.2', '@capacitor/filesystem': '7.1.9', '@capacitor/share': '7.0.4' };
  for (const [name, version] of Object.entries(expected)) {
    assert.equal(pkg.dependencies[name], version);
    assert.equal(lock.packages[''].dependencies[name], version);
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
  }
});
test('Node pin, package engines and CI Node agree', () => {
  assert.equal(nvmrc, '22.16.0');
  assert.match(pkg.engines.node, /22/);
  assert.match(workflow, /node-version: 22\.16\.0/);
});
test('dedicated CI builds without repository write permission or ZIP unpack/commit steps', () => {
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /npm ci/);
  assert.match(buildScript, /node_modules\/\.bin\/cap/);
  assert.match(buildScript, /refusing npx package fallback/);
  assert.match(workflow, /bash scripts\/build-axon-web-android\.sh/);
  assert.match(buildScript, /compileDebugJavaWithJavac/);
  assert.match(buildScript, /assembleDebug/);
  assert.match(workflow, /upload-artifact@v4/);
  assert.doesNotMatch(workflow, /git push|git commit|unpack.*zip/i);
});
test('build script fails closed on unexpected Capacitor and generated Android toolchain versions', () => {
  for (const value of ['7.6.9', 'gradle-8.11.1-', 'com.android.tools.build:gradle:8.7.2', 'minSdkVersion', 'compileSdkVersion', 'targetSdkVersion', 'compileDebugJavaWithJavac', 'assembleDebug']) assert.ok(buildScript.includes(value));
});
test('build documentation distinguishes Android build lane from cross-device product boundary', () => {
  assert.match(buildDoc, /not designed only for Android 11/i);
  assert.match(buildDoc, /API 23/);
  assert.match(buildDoc, /does not certify other operating systems/i);
});
