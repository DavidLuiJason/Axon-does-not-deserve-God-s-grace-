import { createId, createObservation, validateObservation } from './contracts.mjs';
import { StoragePressureError } from './memory-store.mjs';

/** Coordinates user-authorised sources; capture/preservation never waits for analysis. */
export class CaptureCoordinator {
  /** @param {{store: {append: (observation: object, options?: object) => Promise<object>}, clock?: object, analysisQueueLimit?: number, onObservation?: (observation: object) => void, onStatus?: (status: object) => void}} options */
  constructor({ store, clock, analysisQueueLimit = 64, onObservation = () => {}, onStatus = () => {} } = {}) {
    if (!store?.append) throw new TypeError('A preservation store is required.');
    this.store = store;
    this.clock = clock;
    if (!Number.isSafeInteger(analysisQueueLimit) || analysisQueueLimit < 1) throw new RangeError('analysisQueueLimit must be a positive integer.');
    this.analysisQueueLimit = analysisQueueLimit;
    this.onObservation = onObservation;
    this.onStatus = onStatus;
    this.state = 'idle';
    this.session = null;
    this.sequence = 0;
    this.analysisQueue = [];
    this.gaps = [];
    this.adapter = null;
  }
  async getCapabilities() {
    if (!this.adapter?.getCapabilities) return [];
    return this.adapter.getCapabilities();
  }
  /** @param {{adapter: {source?: string, start: (args: object) => Promise<object>, stop: (args: object) => Promise<object>}, userInitiated?: boolean, consent?: object, options?: object}} options */
  async startSession({ adapter, userInitiated = false, consent = null, options = {} } = {}) {
    if (this.state === 'active' || this.state === 'requesting-permission') throw new Error('A capture session is already active or starting.');
    if (!userInitiated) throw new Error('Capture sessions must be explicitly initiated by the user.');
    if (!adapter?.start || !adapter?.stop) throw new TypeError('A valid capture adapter is required.');
    if (!consent?.granted || consent.accepted !== true || consent.scope !== 'screen-capture' || consent.disclosureVersion !== '1.0' || !consent.acceptedAt) {
      throw new Error('Explicit acceptance of the current screen-capture disclosure is required.');
    }
    this.adapter = adapter;
    this.sequence = 0;
    this.state = 'requesting-permission';
    this.onStatus({ state: this.state, sessionId: null });
    const sessionId = createId('session');
    this.session = { id: sessionId, startedAt: null, options: { ...options }, source: adapter.source ?? 'test-fixture' };
    try {
      const result = await adapter.start({ sessionId, options, onEvent: (event) => this.ingest(event) });
      if (result?.granted === false) throw new Error(result.reason || 'Capture permission was not granted.');
      this.session.startedAt = this.#timestamp();
      this.state = 'active';
      this.onStatus({ state: this.state, sessionId, adapter: this.session.source });
      return { sessionId, state: this.state, adapter: this.session.source, adapterResult: result ?? null };
    } catch (error) {
      this.state = 'failed';
      this.onStatus({ state: this.state, sessionId, error: error.message });
      this.session = null;
      throw error;
    }
  }
  async ingest(input) {
    if (!this.session || !['active', 'requesting-permission', 'stopping'].includes(this.state)) return { accepted: false, reason: 'session-inactive' };
    const observation = createObservation({
      ...input,
      sessionId: this.session.id,
      sequence: ++this.sequence,
      source: input.source ?? this.session.source,
      sourceSequence: input.sourceSequence ?? input.payload?.localSequence ?? null,
      clock: this.clock,
    });
    const valid = validateObservation(observation);
    if (!valid.ok) return { accepted: false, reason: valid.reason };
    try {
      const stored = await this.store.append(observation, { pinned: input.pinned === true });
      if (this.analysisQueue.length < this.analysisQueueLimit) this.analysisQueue.push(observation.id);
      else this.gaps.push({ type: 'analysis-deferred', sequence: observation.sequence, observationId: observation.id, at: this.#timestamp() });
      // Observer/UI callbacks are downstream of durable preservation. Their failure
      // must never turn a successfully stored observation into a false storage failure.
      try { this.onObservation(observation); } catch (callbackError) {
        this.gaps.push({ type: 'observer-callback-failed', sequence: observation.sequence, observationId: observation.id, at: this.#timestamp(), reason: String(callbackError?.message ?? callbackError) });
      }
      if (observation.kind === 'gap') this.gaps.push({ ...observation.payload, sequence: observation.sequence, at: observation.timestamp.utc });
      if (observation.kind === 'status' && observation.payload?.state === 'stopped') {
        const sessionId = this.session.id;
        this.state = 'stopped';
        this.session = null;
        this.adapter = null;
        this.onStatus({ state: 'stopped', sessionId, reason: observation.payload?.reason ?? 'source-stopped' });
      }
      return { accepted: true, preserved: true, analysisQueued: this.analysisQueue.includes(observation.id), storage: stored, observation };
    } catch (error) {
      const gap = { type: error instanceof StoragePressureError ? 'storage-pressure' : 'preservation-failed', sequence: observation.sequence, observationId: observation.id, at: this.#timestamp(), reason: error.message };
      this.gaps.push(gap);
      this.onStatus({ state: this.state, sessionId: this.session.id, warning: gap });
      return { accepted: true, preserved: false, analysisQueued: false, gap };
    }
  }
  takeAnalysisBatch(limit = 8) {
    const count = Math.max(0, Math.min(100, Math.floor(limit)));
    return this.analysisQueue.splice(0, count);
  }
  async stopSession(reason = 'user-stop') {
    if (!this.session) return { stopped: true, state: this.state, alreadyStopped: true };
    const sessionId = this.session.id;
    this.state = 'stopping';
    this.onStatus({ state: this.state, sessionId, reason });
    let adapterResult = { stopped: true };
    try { adapterResult = await this.adapter?.stop?.({ sessionId, reason }) ?? { stopped: true }; }
    catch (error) { adapterResult = { stopped: false, reason: String(error?.message ?? error) }; }
    finally {
      this.state = 'stopped';
      this.onStatus({ state: this.state, sessionId, reason });
      this.session = null;
      this.adapter = null;
      if (adapterResult.stopped === false) this.gaps.push({ type: 'stop-unconfirmed', at: this.#timestamp(), reason: adapterResult.reason ?? 'source-stop-unconfirmed', sessionId });
    }
    return { stopped: adapterResult.stopped !== false, state: this.state, sessionId, reason, adapterResult };
  }
  async handleSourceStopped(reason = 'source-stopped', gapType = 'source-stopped') {
    if (!this.session) return { stopped: true, alreadyStopped: true };
    this.gaps.push({ type: gapType, at: this.#timestamp(), reason });
    return this.stopSession(reason);
  }
  async handlePermissionRevoked(reason = 'permission-revoked') {
    return this.handleSourceStopped(reason, 'permission-revoked');
  }
  getStatus() {
    return { state: this.state, sessionId: this.session?.id ?? null, source: this.session?.source ?? null, analysisPending: this.analysisQueue.length, knownGaps: this.gaps.length };
  }
  #timestamp() {
    const wall = typeof this.clock?.wallNow === 'function' ? this.clock.wallNow() : new Date();
    return wall instanceof Date ? wall.toISOString() : new Date(wall).toISOString();
  }
}
