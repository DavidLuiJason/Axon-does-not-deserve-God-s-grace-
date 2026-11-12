import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStructureSource } from '../src/screen-intelligence/structure-source.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const snapshot = { packageName: 'com.example', nodes: [{ className: 'android.widget.Button', text: 'Pay now', clickable: true },
  { className: 'android.widget.EditText', text: 'typed secret', editable: true, hint: 'Note' }] };
const plugin = (over = {}) => ({ getStatus: async () => ({ serviceEnabled: true }), readScreen: async () => ({ snapshot }), openSettings: async () => ({ opened: true }), ...over });

test('reads a screen through the plugin and applies redaction and ask-first flags', async () => {
  const r = await createStructureSource(plugin()).readScreen();
  assert.equal(r.ok, true); assert.equal(r.elements[0].risk, 'ask');
  assert.ok(!JSON.stringify(r).includes('typed secret'));
});
test('service off gives a plain help message and never calls readScreen', async () => {
  let called = false;
  const r = await createStructureSource(plugin({ getStatus: async () => ({ serviceEnabled: false }), readScreen: async () => { called = true; return { snapshot }; } })).readScreen();
  assert.equal(r.ok, false); assert.equal(r.reason, 'accessibility-service-off'); assert.match(r.help, /Accessibility/); assert.equal(called, false);
});
test('missing plugin, thrown errors and empty results fail safe', async () => {
  assert.equal((await createStructureSource(undefined).getStatus()).serviceEnabled, false);
  assert.equal((await createStructureSource(undefined).openSettings()).opened, false);
  const thrown = await createStructureSource(plugin({ readScreen: async () => { throw new Error('no-active-window'); } })).readScreen();
  assert.deepEqual([thrown.ok, thrown.reason], [false, 'no-active-window']);
  assert.equal((await createStructureSource(plugin({ readScreen: async () => ({}) })).readScreen()).reason, 'no-snapshot');
  assert.equal((await createStructureSource(plugin({ getStatus: async () => { throw new Error('boom'); } })).readScreen()).ok, false);
});
test('options pass through: blocked apps return nothing, maxNodes reaches the plugin', async () => {
  let seen;
  const src = createStructureSource(plugin({ readScreen: async (a) => { seen = a; return { snapshot }; } }), { blockedPackages: ['com.example'] });
  const r = await src.readScreen({ maxNodes: 50 });
  assert.equal(r.blocked, true); assert.equal(seen.maxNodes, 50);
});
test('Java stage is read-only and never sends password text', () => {
  const svc = read('android-overlay/app/src/main/java/com/axon/app/screenstructure/AxonAccessibilityService.java');
  const plug = read('android-overlay/app/src/main/java/com/axon/app/screenstructure/ScreenStructurePlugin.java');
  for (const bad of ['performAction', 'dispatchGesture', 'performGlobalAction', 'ACTION_CLICK', 'ACTION_SET_TEXT']) {
    assert.ok(!svc.includes(bad) && !plug.includes(bad), `no ${bad}`);
  }
  assert.match(svc, /if \(!password && text != null\)/);
  assert.match(plug, /name = "ScreenStructure"/);
});
test('wiring: plugin registered, service declared with the bind permission, files copied', () => {
  assert.match(read('android-overlay/app/src/main/java/com/axon/app/MainActivity.java'), /registerPlugin\(ScreenStructurePlugin\.class\)/);
  const sh = read('scripts/apply-android-overlay.sh');
  for (const f of ['AxonAccessibilityService.java', 'ScreenStructurePlugin.java', 'axon_accessibility_service.xml', 'axon_accessibility_strings.xml']) assert.ok(sh.includes(f), f);
  assert.ok(sh.includes('android.permission.BIND_ACCESSIBILITY_SERVICE'));
  const cfg = read('android-overlay/app/src/main/res/xml/axon_accessibility_service.xml');
  assert.match(cfg, /canRetrieveWindowContent="true"/); assert.match(cfg, /axon_accessibility_description/);
  assert.match(read('android-overlay/app/src/main/res/values/axon_accessibility_strings.xml'), /name="axon_accessibility_description"/);
});
