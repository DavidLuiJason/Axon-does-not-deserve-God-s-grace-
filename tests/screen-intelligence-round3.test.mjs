import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CaptureCoordinator,
  MemoryPreservationStore,
  createCaptureConsentReceipt,
  createObservation,
  validateObservation,
  captureDocumentSnapshot,
  createAndroidMediaProjectionAdapter,
} from '../src/screen-intelligence/index.mjs';

const consent = createCaptureConsentReceipt({ accepted: true, scope: 'screen-capture' });
const fixedClock = {
  wallNow: () => new Date('2026-11-11T12:34:56.789Z'),
  monotonicNow: (() => { let n = 100; return () => ++n; })(),
  monotonicClock: 'round3-fake-clock',
};

/** Deterministic fake platform: models consent, capture events, segment rotation,
 * permission revocation, background interruption and storage pressure. It is a
 * simulation of the adapter contract, not a substitute for a real Android device. */
class FakeCapturePlatform {
  constructor({ granted = true, quotaBytes = 1024 * 1024 } = {}) {
    this.granted = granted;
    this.quotaBytes = quotaBytes;
    this.usedBytes = 0;
    this.active = false;
    this.sequence = 0;
    this.onEvent = null;
    this.segments = [];
    this.gaps = [];
  }
  async start({ onEvent }) {
    if (!this.granted) return { granted: false, reason: 'simulated-permission-denied' };
    this.active = true;
    this.onEvent = onEvent;
    await onEvent({ source: 'test-fixture', kind: 'status', payload: { state: 'active', simulated: true } });
    return { granted: true, simulated: true };
  }
  async frame(label, bytes = 1000) {
    if (!this.active) return { accepted: false, reason: 'inactive' };
    this.sequence += 1;
    if (this.usedBytes + bytes > this.quotaBytes) {
      const gap = { type: 'simulated-storage-pressure', sequence: this.sequence };
      this.gaps.push(gap);
      await this.onEvent({ source: 'test-fixture', kind: 'gap', completeness: 'partial', payload: gap });
      return { accepted: false, reason: 'quota' };
    }
    this.usedBytes += bytes;
    const segment = { sequence: this.sequence, label, bytes, capturedAt: new Date().toISOString() };
    this.segments.push(segment);
    return this.onEvent({ source: 'test-fixture', kind: 'video-segment', sourceSequence: this.sequence, payload: segment });
  }
  async rotate(label) { return this.frame(label, 256); }
  async revoke() {
    if (!this.active) return;
    this.active = false;
    await this.onEvent({ source: 'test-fixture', kind: 'gap', completeness: 'partial', payload: { type: 'permission-revoked' } });
    await this.onEvent({ source: 'test-fixture', kind: 'status', payload: { state: 'stopped', reason: 'permission-revoked' } });
  }
  async interrupt() {
    if (!this.active) return;
    this.active = false;
    await this.onEvent({ source: 'test-fixture', kind: 'gap', completeness: 'partial', payload: { type: 'process-interrupted' } });
  }
  async stop() {
    this.active = false;
    await this.onEvent?.({ source: 'test-fixture', kind: 'status', payload: { state: 'stopped', reason: 'simulated-stop' } });
    return { stopped: true, simulated: true };
  }
}

function makeDoc({ href = 'https://example.test/page?token=secret', hiddenParent = false, link = 'https://example.test/next?auth=secret' } = {}) {
  const root = { tagName: 'HTML', parentElement: null, hidden: false, getAttribute: () => null, hasAttribute: () => false };
  const parent = { tagName: 'DIV', parentElement: root, hidden: hiddenParent, getAttribute: (n) => n === 'aria-hidden' && hiddenParent ? 'true' : null, hasAttribute: () => false };
  const button = {
    tagName: 'A', parentElement: parent, hidden: false, innerText: 'Continue', textContent: 'Continue',
    getAttribute: (n) => n === 'href' ? link : null,
    hasAttribute: (n) => n === 'href',
    getBoundingClientRect: () => ({ x: 1, y: 2, width: 30, height: 20 }),
  };
  let index = 0;
  return {
    documentElement: root, title: 'Simulated page', location: { href },
    defaultView: { NodeFilter: { SHOW_ELEMENT: 1 }, getComputedStyle: (el) => ({ display: 'block', visibility: 'visible', opacity: '1' }) },
    createTreeWalker: () => ({ currentNode: root, nextNode: () => [parent, button][index++] ?? null }),
  };
}

// 160 independent end-to-end simulated screen-event cases. Each exercises the
// same public ingestion path with varied source event shapes and payload sizes.
const kinds = ['screen-transition', 'screenshot', 'video-segment', 'gap', 'status'];
const sources = ['test-fixture', 'browser-dom', 'android-media-projection', 'axon-interface'];
for (let i = 0; i < 160; i += 1) {
  test(`simulated capture case ${String(i + 1).padStart(3, '0')}: preserve and validate event`, async () => {
    const store = new MemoryPreservationStore({ maxBytes: 128 * 1024, maxRecords: 20 });
    const coordinator = new CaptureCoordinator({ store, clock: fixedClock, analysisQueueLimit: 4 });
    const source = sources[i % sources.length];
    const kind = kinds[Math.floor(i / sources.length) % kinds.length];
    const adapter = { source, start: async () => ({ granted: true }), stop: async () => ({ stopped: true }) };
    const { sessionId } = await coordinator.startSession({ adapter, userInitiated: true, consent });
    const result = await coordinator.ingest({ source, kind, payload: { case: i + 1, label: `screen-${i + 1}`, sample: 'x'.repeat(i % 257) } });
    assert.equal(result.accepted, true);
    assert.equal(result.preserved, true);
    assert.equal(validateObservation(result.observation).ok, true);
    assert.equal(result.observation.sessionId, sessionId);
    assert.equal(result.observation.sequence, 1);
    assert.equal((await store.list(sessionId)).length, 1);
    assert.equal(result.observation.payload.case, i + 1);
  });
}

test('analysis work remains queued after capture stops so it can be processed later', async () => {
  const store = new MemoryPreservationStore();
  const coordinator = new CaptureCoordinator({ store, clock: fixedClock });
  const adapter = { source: 'test-fixture', start: async () => ({ granted: true }), stop: async () => ({ stopped: true }) };
  await coordinator.startSession({ adapter, userInitiated: true, consent });
  const result = await coordinator.ingest({ source: 'test-fixture', kind: 'screenshot', payload: { imageRef: 'frame-1' } });
  await coordinator.stopSession();
  assert.deepEqual(coordinator.takeAnalysisBatch(10), [result.observation.id]);
});

test('sequence numbers restart at one for a new capture session', async () => {
  const coordinator = new CaptureCoordinator({ store: new MemoryPreservationStore(), clock: fixedClock });
  const adapter = { source: 'test-fixture', start: async () => ({ granted: true }), stop: async () => ({ stopped: true }) };
  await coordinator.startSession({ adapter, userInitiated: true, consent });
  await coordinator.ingest({ source: 'test-fixture', kind: 'status', payload: {} });
  await coordinator.stopSession();
  await coordinator.startSession({ adapter, userInitiated: true, consent });
  const second = await coordinator.ingest({ source: 'test-fixture', kind: 'status', payload: {} });
  assert.equal(second.observation.sequence, 1);
});

test('downstream observer callback failure does not misreport a preserved observation', async () => {
  const store = new MemoryPreservationStore();
  const coordinator = new CaptureCoordinator({ store, clock: fixedClock, onObservation() { throw new Error('UI callback crashed'); } });
  const adapter = { source: 'test-fixture', start: async () => ({ granted: true }), stop: async () => ({ stopped: true }) };
  const { sessionId } = await coordinator.startSession({ adapter, userInitiated: true, consent });
  const result = await coordinator.ingest({ source: 'test-fixture', kind: 'status', payload: { state: 'ready' } });
  assert.equal(result.preserved, true);
  assert.equal((await store.list(sessionId)).length, 1);
  assert.ok(coordinator.gaps.some((gap) => gap.type === 'observer-callback-failed'));
});

test('unconfirmed native stop is reported rather than falsely reported as success', async () => {
  const listeners = new Map();
  const plugin = {
    addListener: async (name, callback) => { listeners.set(name, callback); return { remove: async () => listeners.delete(name) }; },
    startSession: async () => { await listeners.get('captureStatus')({ state: 'active' }); return { granted: true }; },
    stopSession: async () => {},
  };
  const adapter = createAndroidMediaProjectionAdapter(plugin, { stopTimeoutMs: 5 });
  await adapter.start({ sessionId: 'sim', onEvent: async () => {} });
  const result = await adapter.stop();
  assert.equal(result.stopped, false);
  assert.equal(result.reason, 'native-stop-event-timeout');
});

test('a failed native stop is recorded as a known gap by the coordinator', async () => {
  const coordinator = new CaptureCoordinator({ store: new MemoryPreservationStore(), clock: fixedClock });
  const adapter = { source: 'test-fixture', start: async () => ({ granted: true }), stop: async () => ({ stopped: false, reason: 'fake-timeout' }) };
  await coordinator.startSession({ adapter, userInitiated: true, consent });
  const result = await coordinator.stopSession();
  assert.equal(result.stopped, false);
  assert.ok(coordinator.gaps.some((gap) => gap.type === 'stop-unconfirmed'));
});

test('hidden ancestors exclude descendants from DOM snapshots', () => {
  const snapshot = captureDocumentSnapshot(makeDoc({ hiddenParent: true }));
  assert.equal(snapshot.nodes.length, 0);
});

test('DOM URL sanitizer rejects non-web schemes and strips query strings', () => {
  const safe = captureDocumentSnapshot(makeDoc());
  assert.equal(safe.url, 'https://example.test/page');
  assert.equal(safe.nodes[0].href, 'https://example.test/next');
  const unsafe = captureDocumentSnapshot(makeDoc({ href: 'javascript:alert(1)', link: 'javascript:alert(2)' }));
  assert.equal(unsafe.url, null);
  assert.equal(unsafe.nodes[0].href, null);
});

test('malformed document location does not crash DOM snapshot extraction', () => {
  const doc = makeDoc();
  doc.location.href = 'not a valid URL with spaces';
  const snapshot = captureDocumentSnapshot(doc);
  assert.equal(snapshot.url, null);
});

test('fake platform simulation preserves segments across rotation and records permission revocation', async () => {
  const platform = new FakeCapturePlatform({ quotaBytes: 10000 });
  const store = new MemoryPreservationStore();
  const coordinator = new CaptureCoordinator({ store, clock: fixedClock });
  const adapter = { source: 'test-fixture', start: (args) => platform.start(args), stop: () => platform.stop() };
  const { sessionId } = await coordinator.startSession({ adapter, userInitiated: true, consent });
  await platform.frame('home');
  await platform.rotate('video-scene-1');
  await platform.frame('video-scene-2');
  assert.equal((await store.list(sessionId)).filter((o) => o.kind === 'video-segment').length, 3);
  await platform.revoke();
  assert.equal(coordinator.getStatus().state, 'stopped');
  assert.ok(coordinator.gaps.some((gap) => gap.type === 'permission-revoked'));
});

test('fake platform simulation records quota exhaustion instead of silently dropping the event', async () => {
  const platform = new FakeCapturePlatform({ quotaBytes: 100 });
  const coordinator = new CaptureCoordinator({ store: new MemoryPreservationStore(), clock: fixedClock });
  const adapter = { source: 'test-fixture', start: (args) => platform.start(args), stop: () => platform.stop() };
  await coordinator.startSession({ adapter, userInitiated: true, consent });
  const result = await platform.frame('too-large', 101);
  assert.equal(result.accepted, false);
  assert.ok(coordinator.gaps.some((gap) => gap.type === 'simulated-storage-pressure' || gap.type === 'storage-pressure'));
});

test('fake platform simulation records process interruption as an observation', async () => {
  const platform = new FakeCapturePlatform();
  const store = new MemoryPreservationStore();
  const coordinator = new CaptureCoordinator({ store, clock: fixedClock });
  const adapter = { source: 'test-fixture', start: (args) => platform.start(args), stop: () => platform.stop() };
  const { sessionId } = await coordinator.startSession({ adapter, userInitiated: true, consent });
  await platform.frame('before-interruption');
  await platform.interrupt();
  const saved = await store.list(sessionId);
  assert.ok(saved.some((item) => item.kind === 'gap' && item.payload.type === 'process-interrupted'));
});

test('invalid analysis queue bounds are rejected at construction', () => {
  assert.throws(() => new CaptureCoordinator({ store: new MemoryPreservationStore(), analysisQueueLimit: 0 }), /positive integer/);
  assert.throws(() => new CaptureCoordinator({ store: new MemoryPreservationStore(), analysisQueueLimit: -1 }), /positive integer/);
});

test('memory store handles exact record capacity without exceeding configured maximum', async () => {
  const store = new MemoryPreservationStore({ maxBytes: 10000, maxRecords: 3 });
  for (let i = 1; i <= 9; i += 1) {
    const item = createObservation({ sessionId: 'bounded', sequence: i, source: 'test-fixture', kind: 'status', payload: { n: i }, clock: fixedClock });
    await store.append(item);
    const stats = await store.stats();
    assert.ok(stats.records <= 3);
    assert.ok(stats.bytes <= stats.maxBytes);
  }
  assert.equal((await store.list('bounded')).length, 3);
});
