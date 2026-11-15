// Runs scripts/apply-android-overlay.sh against a mock Capacitor android project (twice) and checks what really
// arrives in android/: every plugin MainActivity registers, every resource, one ML Kit and one WebKit line,
// the accessibility service and the launcher query once. Catches "the script forgot to copy a new overlay file".
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((n) => { const f = join(d, n); return statSync(f).isDirectory() ? walk(f) : [f]; });
const count = (text, needle) => text.split(needle).length - 1;

const tmp = mkdtempSync(join(tmpdir(), 'axon-overlay-'));
mkdirSync(join(tmp, 'scripts')); cpSync(join(root, 'scripts'), join(tmp, 'scripts'), { recursive: true });
cpSync(join(root, 'android-overlay'), join(tmp, 'android-overlay'), { recursive: true });
const app = join(tmp, 'android/app'); const main = join(app, 'src/main');
mkdirSync(join(main, 'java/com/axon/app'), { recursive: true });
writeFileSync(join(main, 'AndroidManifest.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application android:label="AXON">\n        <activity android:name=".MainActivity" android:exported="true"></activity>\n    </application>\n    <uses-permission android:name="android.permission.INTERNET" />\n</manifest>\n');
writeFileSync(join(app, 'build.gradle'), "apply plugin: 'com.android.application'\ndependencies {\n    implementation fileTree(include: ['*.jar'], dir: 'libs')\n}\n");
const run = () => spawnSync('bash', [join(tmp, 'scripts/apply-android-overlay.sh')], { encoding: 'utf8' });
const first = run();
const manifestAfterFirst = existsSync(join(main, 'AndroidManifest.xml')) ? readFileSync(join(main, 'AndroidManifest.xml'), 'utf8') : '';
const gradleAfterFirst = readFileSync(join(app, 'build.gradle'), 'utf8');
const second = run();
test.after(() => rmSync(tmp, { recursive: true, force: true }));

test('the script succeeds twice on a fresh project', () => {
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(second.status, 0, second.stdout + second.stderr);
});
test('every overlay Java file and resource arrives in the generated android project', () => {
  const ov = join(root, 'android-overlay/app/src/main');
  const missing = [...walk(join(ov, 'java')), ...walk(join(ov, 'res')), ...walk(join(ov, 'assets'))]
    .map((f) => f.slice(ov.length + 1)).filter((rel) => !existsSync(join(main, rel)));
  assert.deepEqual(missing, [], 'not installed: ' + missing.join(', '));
});
test('every plugin MainActivity registers or imports exists in the installed project', () => {
  const ma = readFileSync(join(main, 'java/com/axon/app/MainActivity.java'), 'utf8');
  const imports = [...ma.matchAll(/^import com\.axon\.app\.([a-z]+)\.([A-Za-z]+);/gm)];
  assert.ok(imports.length >= 6);
  for (const [, pkg, cls] of imports) assert.ok(existsSync(join(main, `java/com/axon/app/${pkg}/${cls}.java`)), `${pkg}.${cls} is imported but not installed`);
  for (const [, cls] of ma.matchAll(/registerPlugin\((\w+)\.class\)/g)) assert.ok(imports.some((i) => i[2] === cls), `${cls} is registered but not imported`);
});
test('a second run changes nothing and nothing is duplicated', () => {
  const manifest = readFileSync(join(main, 'AndroidManifest.xml'), 'utf8'); const gradle = readFileSync(join(app, 'build.gradle'), 'utf8');
  assert.equal(manifest, manifestAfterFirst); assert.equal(gradle, gradleAfterFirst);
  for (const [needle, n] of [['AxonAccessibilityService', 1], ['BackgroundJobService"', 1], ['ScreenCaptureService"', 1], ['.browser.BrowserActivity"', 1], ['AXON_APPS_QUERY', 1], ['<queries>', 1], ['BIND_ACCESSIBILITY_SERVICE', 1]]) assert.equal(count(manifest, needle), n, needle);
  assert.equal(count(gradle, 'com.google.mlkit:text-recognition:'), 1); assert.equal(count(gradle, 'androidx.webkit:webkit:'), 1);
});
