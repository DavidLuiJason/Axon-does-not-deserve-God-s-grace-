import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('AXON Apps native side lists and launches only, with a narrow package query', () => {
  const plug = read('android-overlay/app/src/main/java/com/axon/app/apps/AppsPlugin.java');
  assert.match(plug, /name = "AxonApps"/); assert.match(plug, /CATEGORY_LAUNCHER/); assert.match(plug, /getLaunchIntentForPackage/);
  for (const bad of ['QUERY_ALL_PACKAGES', 'getInstalledApplications', 'getInstalledPackages', 'deleteApplicationCacheFiles', 'ACTION_DELETE', 'ACTION_UNINSTALL', 'performAction', 'dispatchGesture']) assert.ok(!plug.includes(bad), `no ${bad}`);
  for (const m of ['listApps', 'openApp', 'openAppSettings', 'getAppIcon']) assert.match(plug, new RegExp(`public void ${m}\\(`));
  assert.match(plug, /size > 192/);
});
test('wiring: plugin registered, launcher query inserted once by the script, service accessor public', () => {
  assert.match(read('android-overlay/app/src/main/java/com/axon/app/MainActivity.java'), /registerPlugin\(AppsPlugin\.class\)/);
  const sh = read('scripts/apply-android-overlay.sh');
  assert.ok(sh.includes('AppsPlugin.java')); assert.ok(sh.includes('AXON_APPS_QUERY')); assert.ok(sh.includes('android.intent.category.LAUNCHER'));
  assert.ok(!sh.includes('QUERY_ALL_PACKAGES'));
  assert.match(read('android-overlay/app/src/main/java/com/axon/app/screenstructure/AxonAccessibilityService.java'), /public static AxonAccessibilityService current\(\)/);
});
