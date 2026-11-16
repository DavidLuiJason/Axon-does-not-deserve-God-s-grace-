import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const dir = 'android-overlay/app/src/main/java/com/axon/app/screenstructure/';

test('every phone action checks the kill switch first; gestures also re-check the app in front', () => {
  const svc = read(`${dir}AxonAccessibilityService.java`);
  assert.ok((svc.match(/if \(stopRequested\) return reply\(false, "stopped-by-owner"\)/g) ?? []).length >= 2);
  const g = svc.slice(svc.indexOf('public static JSONObject performGesture'));
  assert.ok(g.indexOf('stopRequested') < g.indexOf('getRootInActiveWindow')); assert.ok(g.indexOf('"screen-changed"') < g.indexOf('dispatchGesture('));
  assert.match(g, /x > 10000/);
});
test('the STOP control is an accessibility overlay, not a draw-over-apps permission', () => {
  const svc = read(`${dir}AxonAccessibilityService.java`);
  assert.match(svc, /TYPE_ACCESSIBILITY_OVERLAY/); assert.match(svc, /stopRequested = true;\s*removeStopNow\(\)/);
  for (const f of [svc, read('scripts/apply-android-overlay.sh'), read('android-overlay/manifest-additions.xml')]) { assert.ok(!f.includes('SYSTEM_ALERT_WINDOW')); assert.ok(!f.includes('TYPE_APPLICATION_OVERLAY')); }
});
test('the recorder never records typed text, passwords, blocked apps, or text-change events', () => {
  const svc = read(`${dir}AxonAccessibilityService.java`);
  const ev = svc.slice(svc.indexOf('public void onAccessibilityEvent'), svc.indexOf('private static String firstText'));
  assert.ok(!ev.includes('TEXT_CHANGED')); assert.match(ev, /if \(source\.isPassword\(\)\) return;/); assert.match(ev, /recordBlocked\.contains\(pkg\)/);
  assert.ok(ev.indexOf('source.isEditable()') < ev.indexOf('source.getText()')); assert.match(ev, /contains\("EditText"\)/);
  assert.match(ev, /if \(!recording/); assert.match(svc, /MAX_RECORDED = 500/);
});
test('config, description and plugin expose exactly the auto-clicker pieces', () => {
  const cfg = read('android-overlay/app/src/main/res/xml/axon_accessibility_service.xml');
  assert.match(cfg, /canPerformGestures="true"/); assert.match(cfg, /typeViewClicked\|typeViewLongClicked\|typeViewScrolled/); assert.ok(!/TextChanged/i.test(cfg));
  assert.match(read('android-overlay/app/src/main/res/values/axon_accessibility_strings.xml'), /red STOP button/);
  const plug = read(`${dir}ScreenStructurePlugin.java`);
  for (const m of ['performGesture', 'getKillState', 'requestStop', 'clearStop', 'showStopControl', 'hideStopControl', 'startRecording', 'stopRecording']) assert.match(plug, new RegExp(`public void ${m}\\(`));
});
