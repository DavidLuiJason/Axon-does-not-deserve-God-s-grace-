import test from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  createObservation,
  createTimestamp,
  createCaptureConsentReceipt,
  validateObservation,
  MemoryPreservationStore,
  StoragePressureError,
  CaptureCoordinator,
  createAndroidMediaProjectionAdapter,
  createCompositeCaptureAdapter,
  captureDocumentSnapshot,
} from '../src/screen-intelligence/index.mjs';

const fixedClock = {
  wallNow: () => new Date('2026-11-11T10:20:30.456Z'),
  monotonicNow: () => 1234.5,
};

function event(kind = 'screen-transition', payload = {}) {
  return { source: 'test-fixture', kind, payload };
}

test('timestamps preserve UTC, local offset, timezone and monotonic time', () => {
  const stamp = createTimestamp(fixedClock);
  assert.equal(stamp.utc, '2026-11-11T10:20:30.456Z');
  assert.match(stamp.local, /^2026-11-11T/);
  assert.equal(stamp.monotonicMs, 1234.5);
  assert.equal(stamp.monotonicClock, 'injected-monotonic');
  assert.equal(typeof stamp.timeZone, 'string');
  assert.match(stamp.utcOffset, /^[+-]\d{2}:\d{2}$/);
});

test('observation envelope is versioned, sequenced, timestamped and validated', () => {
  const observation = createObservation({ sessionId: 's-1', sequence: 1, source: 'test-fixture', kind: 'screenshot', payload: { label: 'home' }, clock: fixedClock });
  assert.equal(validateObservation(observation).ok, true);
  assert.equal(observation.timestamp.utc, '2026-11-11T10:20:30.456Z');
  assert.equal(Object.isFrozen(observation), true);
  assert.equal(Object.isFrozen(observation.payload), true);
  assert.equal(observation.sourceSequence, null);
  assert.equal(validateObservation({ ...observation, schemaVersion: 99 }).reason, 'schema-version');
  assert.throws(() => createObservation({ sessionId: 's', sequence: 0, source: 'test-fixture', kind: 'gap' }), /sequence/);
});

test('capture cannot start without explicit user initiation and consent', async () => {
  const coordinator = new CaptureCoordinator({ store: new MemoryPreservationStore(), clock: fixedClock });
  const adapter = { source: 'test-fixture', start: async () => ({ granted: true }), stop: async () => ({ stopped: true }) };
  await assert.rejects(coordinator.startSession({ adapter, consent: createCaptureConsentReceipt({ accepted: true, scope: 'screen-capture' }) }), /explicitly initiated/);
  await assert.rejects(coordinator.startSession({ adapter, userInitiated: true, consent: { granted: true, scope: 'other' } }), /disclosure/);
  await assert.rejects(Promise.resolve().then(() => createCaptureConsentReceipt({ accepted: false, scope: 'screen-capture' })), /disclosure/);
  assert.equal(coordinator.getStatus().state, 'idle');
});

test('preservation continues when the analysis queue is full', async () => {
  const store = new MemoryPreservationStore();
  const coordinator = new CaptureCoordinator({ store, clock: fixedClock, analysisQueueLimit: 1 });
  const adapter = { source: 'test-fixture', start: async () => ({ granted: true }), stop: async () => ({ stopped: true }) };
  const { sessionId } = await coordinator.startSession({ adapter, userInitiated: true, consent: createCaptureConsentReceipt({ accepted: true, scope: 'screen-capture' }) });
  const first = await coordinator.ingest(event('screen-transition', { n: 1 }));
  const second = await coordinator.ingest(event('video-segment', { n: 2 }));
  assert.equal(first.preserved, true);
  assert.equal(first.analysisQueued, true);
  assert.equal(second.preserved, true);
  assert.equal(second.analysisQueued, false);
  assert.equal((await store.list(sessionId)).length, 2);
  assert.equal(coordinator.gaps[0].type, 'analysis-deferred');
});

test('bounded store evicts oldest unpinned records and protects pinned records', async () => {
  const store = new MemoryPreservationStore({ maxBytes: 1500, maxRecords: 2 });
  const make = (sequence) => createObservation({ sessionId: 's', sequence, source: 'test-fixture', kind: 'status', payload: { text: 'x'.repeat(100) }, clock: fixedClock });
  const a = make(1); const b = make(2); const c = make(3);
  await store.append(a, { pinned: true });
  await store.append(b);
  await store.append(c);
  const list = await store.list('s');
  assert.equal(list.length, 2);
  assert.ok(list.some((item) => item.id === a.id), 'pinned record survives eviction');
  assert.ok(list.some((item) => item.id === c.id), 'new record is stored');
  const deleted = await store.deleteSession('s');
  assert.equal(deleted.removed, 1, 'only unpinned records are deleted');
  assert.deepEqual((await store.list('s')).map((item) => item.id), [a.id]);
});

test('storage exhaustion is explicit and coordinator reports a preservation gap', async () => {
  const store = new MemoryPreservationStore({ maxBytes: 1024, maxRecords: 1 });
  const huge = createObservation({ sessionId: 's', sequence: 1, source: 'test-fixture', kind: 'status', payload: { text: 'x'.repeat(2000) }, clock: fixedClock });
  await assert.rejects(store.append(huge), StoragePressureError);
  const coordinator = new CaptureCoordinator({ store, clock: fixedClock });
  const adapter = { source: 'test-fixture', start: async () => ({ granted: true }), stop: async () => ({ stopped: true }) };
  await coordinator.startSession({ adapter, userInitiated: true, consent: createCaptureConsentReceipt({ accepted: true, scope: 'screen-capture' }) });
  const result = await coordinator.ingest(event('status', { text: 'x'.repeat(2000) }));
  assert.equal(result.accepted, true);
  assert.equal(result.preserved, false);
  assert.equal(result.gap.type, 'storage-pressure');
});

test('permission revocation stops source and records a known gap', async () => {
  let stopped = false;
  const coordinator = new CaptureCoordinator({ store: new MemoryPreservationStore(), clock: fixedClock });
  const adapter = { source: 'test-fixture', start: async () => ({ granted: true }), stop: async () => { stopped = true; } };
  await coordinator.startSession({ adapter, userInitiated: true, consent: createCaptureConsentReceipt({ accepted: true, scope: 'screen-capture' }) });
  const result = await coordinator.handlePermissionRevoked('os-revoked');
  assert.equal(result.state, 'stopped');
  assert.equal(stopped, true);
  assert.equal(coordinator.gaps[0].type, 'permission-revoked');
});

test('DOM snapshot identifies semantic elements without reading entered field values', () => {
  const makeElement = (tagName, attrs = {}, text = '') => ({
    tagName,
    hidden: false,
    innerText: text,
    textContent: text,
    getAttribute: (name) => attrs[name] ?? null,
    hasAttribute: (name) => Object.hasOwn(attrs, name),
    getBoundingClientRect: () => ({ x: 1, y: 2, width: 30, height: 40 }),
  });
  const button = makeElement('BUTTON', { 'aria-label': 'Open menu' });
  const password = makeElement('INPUT', { type: 'password', value: 'dont-read-this' });
  const hidden = makeElement('DIV', { hidden: '' }, 'hidden secret');
  const normal = makeElement('H1', {}, 'Welcome');
  const elements = [makeElement('HTML'), button, password, hidden, normal];
  let index = 0;
  const doc = {
    documentElement: elements[0],
    title: 'Test page',
    location: { href: 'https://example.test/path?token=secret#hash' },
    defaultView: { NodeFilter: { SHOW_ELEMENT: 1 }, getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }) },
    createTreeWalker: () => ({ currentNode: elements[0], nextNode: () => elements[++index] ?? null }),
  };
  const snapshot = captureDocumentSnapshot(doc);
  assert.equal(snapshot.title, 'Test page');
  assert.equal(snapshot.url, 'https://example.test/path');
  assert.ok(snapshot.nodes.some((node) => node.type === 'button' && node.label === 'Open menu'));
  const passwordNode = snapshot.nodes.find((node) => node.type === 'field');
  assert.equal(passwordNode.label, '[REDACTED]');
  assert.equal(passwordNode.sensitive, true);
  assert.ok(!JSON.stringify(snapshot).includes('dont-read-this'));
  assert.ok(!JSON.stringify(snapshot).includes('hidden secret'));
});


test('Android native adapter is user-consented, visible, video-only and does not claim accessibility-tree access', async () => {
  const plugin = await readFile(new URL('../android-overlay/app/src/main/java/com/axon/app/screencapture/ScreenCapturePlugin.java', import.meta.url), 'utf8');
  const service = await readFile(new URL('../android-overlay/app/src/main/java/com/axon/app/screencapture/ScreenCaptureService.java', import.meta.url), 'utf8');
  const manifest = await readFile(new URL('../android-overlay/manifest-additions.xml', import.meta.url), 'utf8');
  const main = await readFile(new URL('../android-overlay/app/src/main/java/com/axon/app/MainActivity.java', import.meta.url), 'utf8');
  assert.match(plugin, /createScreenCaptureIntent/);
  assert.match(plugin, /requiresUserConsentEachSession/);
  assert.match(plugin, /requestPermissionForAlias\(\"notifications\"/);
  assert.match(plugin, /accessibilityTree\", false/);
  assert.match(service, /FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION/);
  assert.match(service, /setOngoing\(true\)/);
  assert.match(service, /reconcileSnapshot/);
  assert.match(service, /capture-process-no-longer-active/);
  assert.match(service, /setVideoEncoder\(MediaRecorder\.VideoEncoder\.H264\)/);
  assert.match(service, /audioCaptured\", false/);
  assert.doesNotMatch(service, /setAudioSource/);
  assert.match(manifest, /FOREGROUND_SERVICE_MEDIA_PROJECTION/);
  assert.match(manifest, /foregroundServiceType=\"mediaProjection\"/);
  assert.match(main, /registerPlugin\(ScreenCapturePlugin\.class\)/);
  assert.equal((service.match(/createVirtualDisplay\(/g) ?? []).length, 1, 'one VirtualDisplay is created per MediaProjection session');
});


test('Android adapter preserves the final segment before the native stopped event closes the session', async () => {
  const listeners = new Map();
  const plugin = {
    addListener: async (name, callback) => { listeners.set(name, callback); return { remove: async () => listeners.delete(name) }; },
    startSession: async () => { await listeners.get('captureStatus')({ state: 'active', sessionId: 'native-s' }); return { granted: true }; },
    stopSession: async () => {
      await listeners.get('segmentSaved')({ sequence: 1, file: '/private/segment-1.mp4', startedAtUtc: '2026-11-11T10:00:00.000Z' });
      await listeners.get('captureStatus')({ state: 'stopped', reason: 'user-stop', sessionId: 'native-s' });
    },
  };
  const adapter = createAndroidMediaProjectionAdapter(plugin, { startTimeoutMs: 500 });
  const store = new MemoryPreservationStore();
  const coordinator = new CaptureCoordinator({ store, clock: fixedClock });
  const started = await coordinator.startSession({ adapter, userInitiated: true, consent: createCaptureConsentReceipt({ accepted: true, scope: 'screen-capture' }) });
  await coordinator.stopSession('user-stop');
  const saved = await store.list(started.sessionId);
  assert.ok(saved.some((item) => item.kind === 'video-segment' && item.payload.sequence === 1));
  assert.ok(saved.some((item) => item.kind === 'status' && item.payload.state === 'stopped'));
  assert.equal(coordinator.getStatus().state, 'stopped');
});


test('composite adapter combines Android screen recording with optional AXON-owned DOM observation', async () => {
  const native = { source: 'android-media-projection', start: async ({ onEvent }) => { await onEvent({ source: 'android-media-projection', kind: 'status', payload: { state: 'active' } }); return { granted: true }; }, stop: async () => ({ stopped: true }) };
  const dom = { source: 'browser-dom', start: async ({ onEvent }) => { await onEvent({ source: 'browser-dom', kind: 'screen-transition', payload: { title: 'AXON' } }); return { granted: true }; }, stop: async () => ({ stopped: true }) };
  const composite = createCompositeCaptureAdapter([{ adapter: native, required: true }, { adapter: dom, required: false }]);
  const store = new MemoryPreservationStore();
  const coordinator = new CaptureCoordinator({ store, clock: fixedClock });
  const session = await coordinator.startSession({ adapter: composite, userInitiated: true, consent: createCaptureConsentReceipt({ accepted: true, scope: 'screen-capture' }), });
  assert.equal(session.adapter, 'axon-interface');
  assert.equal(session.adapterResult.sources.length, 2);
  assert.deepEqual((await store.list(session.sessionId)).map((item) => item.source).sort(), ['android-media-projection', 'browser-dom']);
  const result = await coordinator.stopSession('test-stop');
  assert.equal(result.stopped, true);
});


test('source stop detected after a paused/background interval closes the coordinator session', async () => {
  let stopCalled = false;
  const coordinator = new CaptureCoordinator({ store: new MemoryPreservationStore(), clock: fixedClock });
  const adapter = { source: 'test-fixture', start: async () => ({ granted: true }), stop: async () => { stopCalled = true; return { stopped: true }; } };
  await coordinator.startSession({ adapter, userInitiated: true, consent: createCaptureConsentReceipt({ accepted: true, scope: 'screen-capture' }) });
  await coordinator.handleSourceStopped('native-session-ended', 'source-stopped');
  assert.equal(stopCalled, true);
  assert.equal(coordinator.getStatus().state, 'stopped');
  assert.equal(coordinator.gaps[0].type, 'source-stopped');
});
