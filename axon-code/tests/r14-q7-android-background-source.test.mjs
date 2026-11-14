import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { exerciseAndroidBackgroundHostContract, validateAndroidBackgroundSourceCapabilities } from '../src/hosts/androidBackgroundJobContract.mjs';
import { compileRealModuleMutant } from './helpers/r14-mutant.mjs';

class FakeAndroidHost {
  constructor() { this.hostType = 'FAKE_HOST'; this.calls = []; }
  async createNotificationChannel(value) { this.calls.push(['channel', value]); return true; }
  async startForeground(value) { this.calls.push(['start', value]); return true; }
  async pauseFromNotification(value) { this.calls.push(['pause', value]); return true; }
  async cancelFromNotification(value) { this.calls.push(['cancel', value]); return true; }
  async selectWorkspace() { this.calls.push(['pick']); return { grantId: 'fake-grant', uriToken: 'content://fake/tree' }; }
  async releaseWorkspaceGrant(value) { this.calls.push(['release', value]); return true; }
}

test('Q7 Kotlin source declares a foreground job service and notification action intents', async () => {
  const source = await readFile('android/app/src/main/java/com/axoncode/host/AxonCodeForegroundJobService.kt', 'utf8');
  for (const marker of ['class AxonCodeForegroundJobService', 'NotificationChannel', 'startForeground(', 'ACTION_PAUSE', 'ACTION_CANCEL', 'JobActionDispatcher.current?.pause', 'JobActionDispatcher.current?.cancel', 'Notification.Action.Builder']) {
    assert.ok(source.includes(marker), `Android service source missing ${marker}`);
  }
});

test('Q7 manifest declares foreground-service permissions and a non-exported service', async () => {
  const manifest = await readFile('android/app/src/main/AndroidManifest.xml', 'utf8');
  assert.match(manifest, /android\.permission\.FOREGROUND_SERVICE/);
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(manifest, /android:name="\.AxonCodeForegroundJobService"/);
  assert.match(manifest, /android:exported="false"/);
  assert.match(manifest, /android:foregroundServiceType="dataSync"/);
});

test('Q7 SAF source retains persistable workspace grants and scoped document operations', async () => {
  const source = await readFile('android/src/main/java/com/axoncode/host/AxonCodeHostPlugin.kt', 'utf8');
  assert.match(source, /ACTION_OPEN_DOCUMENT_TREE/);
  assert.match(source, /takePersistableUriPermission/);
  assert.match(source, /DocumentsContract\.isChildDocument/);
  assert.match(source, /releasePersistableUriPermission/);
});

test('Q7 FAKE_HOST exercises notification pause/cancel and SAF grant lifecycle without claiming provider proof', async () => {
  const host = new FakeAndroidHost();
  const result = await exerciseAndroidBackgroundHostContract(host);
  assert.equal(result.contract, 'PASS');
  assert.equal(result.evidence, 'FAKE_HOST_ONLY');
  assert.equal(result.providerStatus, 'NOT RUN');
  assert.deepEqual(host.calls.map((row) => row[0]), ['channel', 'start', 'pause', 'cancel', 'pick', 'release']);
});

test('Q7 contract refuses a missing host and missing required methods', async () => {
  await assert.rejects(exerciseAndroidBackgroundHostContract(null), /ANDROID_HOST_REQUIRED/);
  await assert.rejects(exerciseAndroidBackgroundHostContract({ hostType: 'FAKE_HOST' }), /ANDROID_HOST_METHODS_MISSING/);
});

test('Q7 malformed SAF grants and absent capabilities remain NOT RUN', async () => {
  const host = new FakeAndroidHost();
  host.selectWorkspace = async () => ({ grantId: '', uriToken: '' });
  await assert.rejects(exerciseAndroidBackgroundHostContract(host), /ANDROID_SAF_GRANT_INVALID/);
  assert.deepEqual(validateAndroidBackgroundSourceCapabilities({}), {
    foregroundJobs: 'NOT RUN', notificationPause: 'NOT RUN', notificationCancel: 'NOT RUN',
    storageAccessFramework: 'NOT RUN', deviceVerification: 'NOT RUN',
  });
});

test('Q7 real compiled contract mutant removing required-method validation is caught', async () => {
  const needle = 'const missing = REQUIRED_METHODS.filter((method) => typeof host[method] !== "function");';
  const mutant = await compileRealModuleMutant('src/hosts/androidBackgroundJobContract.mjs', needle, 'const missing = [];');
  try {
    let detected = false;
    try { await assert.rejects(mutant.module.exerciseAndroidBackgroundHostContract({ hostType: 'FAKE_HOST' }), /ANDROID_HOST_METHODS_MISSING/); }
    catch { detected = true; }
    assert.equal(detected, true, 'the normal host-interface assertion must fail against the mutant');
  } finally { await mutant.cleanup(); }
});
