/**
 * AXON Screen Intelligence — shared, platform-neutral contracts.
 * Raw observations are immutable; interpretations are stored separately.
 */
export const SCREEN_INTELLIGENCE_SCHEMA_VERSION = 1;

export const CAPTURE_SOURCES = Object.freeze([
  'android-media-projection',
  'browser-dom',
  'axon-interface',
  'test-fixture',
]);

export const SCREEN_CAPTURE_DISCLOSURE_VERSION = '1.0';

export const SCREEN_CAPTURE_DISCLOSURE = Object.freeze({
  title: 'Screen capture session',
  body: 'When you start, AXON records the visible device screen across apps for this session. The recording is saved in AXON private app storage and is not sent to an AI or external service by this engine. It may include private messages, account information, or other sensitive content visible on screen. No microphone or call audio is recorded. Android shows a persistent recording notification; you can stop from AXON or that notification. Secure or protected content may be blank or unavailable.',
  scope: 'screen-capture',
  version: SCREEN_CAPTURE_DISCLOSURE_VERSION,
});

/** @param {{accepted?: boolean, scope?: string, disclosureVersion?: string, acceptedAt?: string}} options */
export function createCaptureConsentReceipt({ accepted, scope, disclosureVersion = SCREEN_CAPTURE_DISCLOSURE_VERSION, acceptedAt = new Date().toISOString() } = {}) {
  if (accepted !== true || scope !== 'screen-capture' || disclosureVersion !== SCREEN_CAPTURE_DISCLOSURE_VERSION) {
    throw new Error('The current screen-capture disclosure must be explicitly accepted.');
  }
  return Object.freeze({ granted: true, accepted: true, scope, disclosureVersion, acceptedAt });
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export const CAPTURE_STATES = Object.freeze([
  'idle', 'requesting-permission', 'active', 'paused', 'stopping', 'stopped', 'failed',
]);

export function createId(prefix = 'obs') {
  const random = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${random}`;
}

export function createTimestamp(clock = {}) {
  const wall = typeof clock.wallNow === 'function' ? clock.wallNow() : new Date();
  const date = wall instanceof Date ? wall : new Date(wall);
  const monotonicMs = typeof clock.monotonicNow === 'function'
    ? clock.monotonicNow()
    : (globalThis.performance?.now?.() ?? Date.now());
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  let timeZone = 'UTC';
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { /* default */ }
  return Object.freeze({
    utc: date.toISOString(),
    local: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')}${offset}`,
    timeZone,
    utcOffset: offset,
    monotonicMs,
    monotonicClock: typeof clock.monotonicNow === 'function' ? (clock.monotonicClock ?? 'injected-monotonic') : (globalThis.performance?.now ? 'performance-time-origin' : 'wall-clock-fallback'),
  });
}

export function createObservation({
  sessionId,
  sequence,
  source,
  kind,
  payload = {},
  clock,
  app = null,
  display = null,
  completeness = 'complete',
  privacy = 'user-authorised-local',
  capturedAt = null,
  sourceSequence = null,
}) {
  if (!sessionId || typeof sessionId !== 'string') throw new TypeError('sessionId is required');
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new TypeError('sequence must be a positive safe integer');
  if (!CAPTURE_SOURCES.includes(source)) throw new TypeError(`Unsupported capture source: ${source}`);
  if (!['screen-transition', 'screenshot', 'video-segment', 'gap', 'status'].includes(kind)) {
    throw new TypeError(`Unsupported observation kind: ${kind}`);
  }
  const timestamp = capturedAt ?? createTimestamp(clock);
  return deepFreeze({
    schemaVersion: SCREEN_INTELLIGENCE_SCHEMA_VERSION,
    id: createId('obs'),
    sessionId,
    sequence,
    sourceSequence: Number.isSafeInteger(sourceSequence) && sourceSequence > 0 ? sourceSequence : null,
    source,
    kind,
    timestamp,
    ingestedAt: createTimestamp(clock),
    app: app && typeof app === 'object' ? Object.freeze({ ...app }) : null,
    display: display && typeof display === 'object' ? Object.freeze({ ...display }) : null,
    completeness,
    privacy,
    payload: Object.freeze({ ...payload }),
  });
}

export function validateObservation(value) {
  if (!value || typeof value !== 'object') return { ok: false, reason: 'not-object' };
  if (value.schemaVersion !== SCREEN_INTELLIGENCE_SCHEMA_VERSION) return { ok: false, reason: 'schema-version' };
  if (!value.sessionId || !Number.isSafeInteger(value.sequence) || value.sequence < 1) return { ok: false, reason: 'identity' };
  if (!CAPTURE_SOURCES.includes(value.source)) return { ok: false, reason: 'source' };
  if (!value.timestamp?.utc || !Number.isFinite(value.timestamp?.monotonicMs) || !value.timestamp?.monotonicClock) return { ok: false, reason: 'timestamp' };
  return { ok: true };
}
