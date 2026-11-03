import { createSourceRecord, normalizeSourceUrl } from '../src/web/sourceRecord';
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function equal<T>(actual: T, expected: T, message: string): void { assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`); }
const digest = 'A'.repeat(64);
const normalized = normalizeSourceUrl('HTTPS://Example.COM:443/path?q=1#section');
assert(normalized.ok, 'valid HTTPS URL normalizes');
equal(normalized.value, 'https://example.com/path?q=1', 'host, default port and fragment normalized');
const record = createSourceRecord({ url: 'https://EXAMPLE.com:443/a#frag', publisher: 'Example Publisher', date: '2026-10-20', sha256: digest }, '2026-11-03', 7);
assert(record.ok, 'valid source record created');
equal(record.value.truthLabel, 'REPORTED', 'source record never self-upgrades');
equal(record.value.ageDays, 14, 'source age is calendar-day based');
equal(record.value.stale, true, 'age beyond threshold is stale');
equal(record.value.sha256, digest.toLowerCase(), 'hash normalized to lowercase');
const fresh = createSourceRecord({ url: 'http://example.com', publisher: 'Publisher', date: '2026-11-02', sha256: digest }, '2026-11-03', 7);
assert(fresh.ok && !fresh.value.stale, 'fresh source not stale');
const future = createSourceRecord({ url: 'https://example.com', publisher: 'Publisher', date: '2026-11-04', sha256: digest }, '2026-11-03', 7);
assert(!future.ok && future.error === 'future-date', 'future source date rejected');
const hash = createSourceRecord({ url: 'https://example.com', publisher: 'Publisher', date: '2026-11-02', sha256: 'bad' }, '2026-11-03', 7);
assert(!hash.ok && hash.error === 'invalid-hash', 'malformed SHA-256 rejected');
const credentials = normalizeSourceUrl('https://user:pass@example.com/path');
assert(!credentials.ok && credentials.error === 'invalid-url', 'source record refuses credential-bearing URLs');
const scheme = normalizeSourceUrl('file:///tmp/a');
assert(!scheme.ok && scheme.error === 'unsupported-protocol', 'non-http scheme rejected');
// Director additions: stale boundary and digest length.
{
  const src = { url: 'https://a.com/x', publisher: 'P', date: '2026-10-04', sha256: 'a'.repeat(64) };
  const edge = createSourceRecord(src, '2026-11-03', 30);
  assert(edge.ok && edge.value.ageDays === 30 && edge.value.stale === false, 'age equal to the threshold is not stale');
  const over = createSourceRecord({ ...src, date: '2026-10-03' }, '2026-11-03', 30);
  assert(over.ok && over.value.stale === true, 'age above the threshold is stale');
  assert(!createSourceRecord({ ...src, sha256: 'a'.repeat(63) }, '2026-11-03', 30).ok, 'a 63-character digest is rejected');
  assert(!createSourceRecord({ ...src, sha256: 'a'.repeat(65) }, '2026-11-03', 30).ok, 'a 65-character digest is rejected');
}
console.log('PASS sourceRecord: URL normalization, provenance label, age/stale, future date, hash and protocol validation');
