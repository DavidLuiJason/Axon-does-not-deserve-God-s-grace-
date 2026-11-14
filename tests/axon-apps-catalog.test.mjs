import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApps, searchApps, resolveApp, sensitiveApps, CATEGORY_NAMES } from '../src/axon-apps/app-catalog.mjs';
import { createAppsSource } from '../src/axon-apps/apps-source.mjs';

const raw = [
  { packageName: 'com.android.chrome', label: 'Chrome', category: 4, versionName: '120' },
  { packageName: 'com.example.notes', label: 'Notes', system: false },
  { packageName: 'com.example.bankapp', label: 'Bank App' },
  { packageName: 'com.calc.one', label: 'Calculator' }, { packageName: 'com.calc.two', label: 'Calculator' },
  { packageName: 'com.example.notes', label: 'Notes again' },
  { packageName: '', label: 'No package' }, { label: 'x' }, null,
  { packageName: 'com.android.settings', label: 'Settings', system: true },
  { packageName: 'com.axon.app', label: 'AXON', self: true },
];
const apps = normalizeApps(raw);

test('normalizeApps cleans, de-duplicates and sorts', () => {
  assert.deepEqual(apps.map((a) => a.label), ['AXON', 'Bank App', 'Calculator', 'Calculator', 'Chrome', 'Notes', 'Settings']);
  assert.equal(apps.find((a) => a.label === 'Chrome').category, 'social'); assert.equal(apps.find((a) => a.label === 'Settings').system, true);
  assert.deepEqual(normalizeApps(undefined), []); assert.equal(CATEGORY_NAMES[0], 'game');
});
test('search ranks exact, prefix, contains, package and similar spelling', () => {
  assert.equal(searchApps(apps, 'chrome')[0].why, 'exact name');
  assert.equal(searchApps(apps, 'cal')[0].app.label, 'Calculator');
  assert.equal(searchApps(apps, 'chrme')[0].app.label, 'Chrome');
  assert.equal(searchApps(apps, 'bankapp')[0].app.packageName, 'com.example.bankapp');
  assert.equal(searchApps(apps, 'com.android.settings')[0].why, 'exact package');
  assert.deepEqual(searchApps(apps, '   '), []); assert.equal(searchApps(apps, 'zzzzq').length, 0);
});
test('resolveApp never guesses between equally good matches', () => {
  assert.equal(resolveApp(apps, 'Notes').status, 'found');
  const amb = resolveApp(apps, 'calculator');
  assert.equal(amb.status, 'ambiguous'); assert.equal(amb.candidates.length, 2);
  assert.equal(resolveApp(apps, 'nothing here').status, 'none');
  assert.equal(resolveApp(apps, 'com.calc.two').app.packageName, 'com.calc.two');
});
test('money, wallet and password apps are flagged, ordinary apps are not', () => {
  const s = sensitiveApps([...apps, { packageName: 'com.x.opay', label: 'OPay' }, { packageName: 'com.x.keepass', label: 'KeePass' }]).map((a) => a.label);
  assert.ok(s.includes('Bank App') && s.includes('OPay') && s.includes('KeePass'));
  assert.ok(!s.includes('Notes') && !s.includes('Chrome') && !s.includes('Settings'));
});
test('apps source fails safe and shapes results', async () => {
  const none = createAppsSource(undefined);
  assert.equal((await none.listApps()).code, 'no-native-plugin'); assert.equal((await none.openApp('x')).ok, false);
  const src = createAppsSource({ listApps: async () => ({ apps: [1] }), openApp: async ({ packageName }) => ({ opened: packageName === 'ok' }), getAppIcon: async () => ({ png: 'AAA' }), openAppSettings: async () => ({ opened: true }) });
  assert.deepEqual(await src.listApps(), { ok: true, apps: [1] }); assert.equal((await src.openApp('ok')).ok, true); assert.equal((await src.openApp('no')).ok, false);
  assert.equal((await src.getAppIcon('p')).png, 'AAA'); assert.equal((await src.openAppSettings('p')).ok, true);
  const bad = createAppsSource({ listApps: async () => { throw new Error('boom'); }, openApp: async () => { throw new Error('not-launchable'); } });
  assert.deepEqual(await bad.listApps(), { ok: false, code: 'boom' }); assert.equal((await bad.openApp('x')).code, 'not-launchable');
  assert.equal((await createAppsSource({ listApps: async () => ({}) }).listApps()).code, 'no-result');
});
