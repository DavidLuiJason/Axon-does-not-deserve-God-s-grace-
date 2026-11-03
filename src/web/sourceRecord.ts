/** Pure provenance record. A source record is always REPORTED, never VERIFIED. */
export type SourceRecord = Readonly<{
  url: string;
  publisher: string;
  date: string;
  sha256: string;
  identity: string;
  ageDays: number;
  stale: boolean;
  truthLabel: 'REPORTED';
}>;

export type SourceRecordError = 'invalid-input' | 'invalid-url' | 'unsupported-protocol' | 'invalid-date' | 'future-date' | 'invalid-hash';
export type SourceRecordResult =
  | { ok: true; value: SourceRecord }
  | { ok: false; error: SourceRecordError; message: string };

export const SOURCE_RECORD_LIMITS = Object.freeze({ maxUrlCharacters: 4_096, maxPublisherCharacters: 200, maxStaleAfterDays: 36_600 });

export function isSourceDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const y = Number(value.slice(0, 4)), m = Number(value.slice(5, 7)), d = Number(value.slice(8, 10));
  if (y < 1 || m < 1 || m > 12 || d < 1) return false;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return d <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
}

function dayNumber(date: string): number {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10));
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(y, m - 1, d);
  return Math.floor(value.getTime() / 86_400_000);
}

export type NormalizeSourceUrlResult =
  | { ok: true; value: string }
  | { ok: false; error: 'invalid-url' | 'unsupported-protocol'; message: string };

export function normalizeSourceUrl(value: unknown): NormalizeSourceUrlResult {
  if (typeof value !== 'string' || value.length === 0 || value.length > SOURCE_RECORD_LIMITS.maxUrlCharacters) {
    return { ok: false, error: 'invalid-url', message: 'A non-empty URL within the supported length is required.' };
  }
  if (/[\u0000-\u0020\u007f]/.test(value)) return { ok: false, error: 'invalid-url', message: 'URLs containing whitespace or control characters are rejected.' };
  let parsed: URL;
  try { parsed = new URL(value); }
  catch { return { ok: false, error: 'invalid-url', message: 'The source URL is not valid.' }; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'unsupported-protocol', message: 'Only HTTP and HTTPS source URLs are accepted.' };
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    return { ok: false, error: 'invalid-url', message: 'A source URL must have a host and must not contain credentials.' };
  }
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = '';
  if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) parsed.port = '';
  return { ok: true, value: parsed.toString() };
}

export function createSourceRecord(
  input: unknown,
  asOf: unknown,
  staleAfterDays: unknown,
): SourceRecordResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input) || !isSourceDate(asOf)
      || !Number.isInteger(staleAfterDays) || (staleAfterDays as number) < 0
      || (staleAfterDays as number) > SOURCE_RECORD_LIMITS.maxStaleAfterDays) {
    return { ok: false, error: 'invalid-input', message: 'A source object, valid as-of date and non-negative stale threshold are required.' };
  }
  const item = input as Record<string, unknown>;
  if (typeof item.publisher !== 'string' || item.publisher.trim().length === 0
      || item.publisher.length > SOURCE_RECORD_LIMITS.maxPublisherCharacters) {
    return { ok: false, error: 'invalid-input', message: 'A non-empty publisher within the supported length is required.' };
  }
  if (!isSourceDate(item.date)) return { ok: false, error: 'invalid-date', message: 'Source date must be a real YYYY-MM-DD date.' };
  if (dayNumber(item.date) > dayNumber(asOf)) return { ok: false, error: 'future-date', message: 'A source date cannot be later than the supplied as-of date.' };
  if (typeof item.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(item.sha256)) {
    return { ok: false, error: 'invalid-hash', message: 'A 64-character SHA-256 hexadecimal digest is required.' };
  }
  const normalized = normalizeSourceUrl(item.url);
  if (!normalized.ok) return normalized;
  const ageDays = dayNumber(asOf) - dayNumber(item.date);
  const sha256 = item.sha256.toLowerCase();
  return { ok: true, value: Object.freeze({
    url: normalized.value,
    publisher: item.publisher.trim(),
    date: item.date,
    sha256,
    identity: `${normalized.value}|sha256:${sha256}`,
    ageDays,
    stale: ageDays > (staleAfterDays as number),
    truthLabel: 'REPORTED',
  }) };
}
