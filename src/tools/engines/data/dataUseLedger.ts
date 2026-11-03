/** Deterministic daily network-usage ledger. No clock, storage or permissions are accessed here. */
export type UsageDailyRecord = Readonly<{
  date: string; // Gregorian calendar date, YYYY-MM-DD (no timezone conversion)
  source: string;
  receivedBytes: number;
  sentBytes: number;
}>;
export type UsageInput = Readonly<{
  date: string;
  source: string;
  receivedBytes: number;
  sentBytes: number;
}>;
export type UsageTotal = Readonly<{
  period: string;
  receivedBytes: number;
  sentBytes: number;
  totalBytes: number;
  recordCount: number;
  activeDays: number;
}>;
export type UsageResult<T> = { ok: true; value: T } | { ok: false; error: 'invalid-input' | 'invalid-date' | 'overflow' | 'invalid-retention'; message: string };

export const DATA_USE_LEDGER_LIMITS = Object.freeze({
  maxRecords: 100_000,
  maxSourceCharacters: 100,
  maxRetentionDays: 36_600,
});

export function isUsageDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= monthDays[month - 1]!;
}

function dayNumber(date: string): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(year, month - 1, day);
  return Math.floor(value.getTime() / 86_400_000);
}

function dateFromDayNumber(value: number): string {
  const date = new Date(value * 86_400_000);
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function validByteCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validateRecord(value: unknown): value is UsageDailyRecord {
  if (value === null || typeof value !== 'object') return false;
  const row = value as UsageDailyRecord;
  return isUsageDate(row.date) && typeof row.source === 'string' && row.source.length > 0 && row.source.length <= DATA_USE_LEDGER_LIMITS.maxSourceCharacters
    && validByteCount(row.receivedBytes) && validByteCount(row.sentBytes);
}


function validateRecordList(value: unknown): value is UsageDailyRecord[] {
  if (!Array.isArray(value) || value.length > DATA_USE_LEDGER_LIMITS.maxRecords) return false;
  for (let i = 0; i < value.length; i += 1) if (!validateRecord(value[i])) return false;
  return true;
}

function sumChecked(a: number, b: number): number | null {
  const value = a + b;
  return Number.isSafeInteger(value) ? value : null;
}

/** Add a sample to its date/source daily bucket, returning a new sorted array. */
export function recordUsage(records: unknown, input: unknown): UsageResult<UsageDailyRecord[]> {
  if (!validateRecordList(records)) {
    return { ok: false, error: 'invalid-input', message: 'The ledger must be an array of valid daily records.' };
  }
  if (input === null || typeof input !== 'object') return { ok: false, error: 'invalid-input', message: 'A usage sample is required.' };
  const sample = input as UsageInput;
  if (!isUsageDate(sample.date)) return { ok: false, error: 'invalid-date', message: 'Usage date must be a real YYYY-MM-DD calendar date.' };
  if (typeof sample.source !== 'string' || sample.source.length === 0 || sample.source.length > DATA_USE_LEDGER_LIMITS.maxSourceCharacters
      || !validByteCount(sample.receivedBytes) || !validByteCount(sample.sentBytes)) {
    return { ok: false, error: 'invalid-input', message: 'Source and byte counts are invalid; byte counts must be non-negative safe integers.' };
  }
  const next = (records as UsageDailyRecord[]).map((row) => ({ ...row }));
  const found = next.findIndex((row) => row.date === sample.date && row.source === sample.source);
  if (found >= 0) {
    const existing = next[found]!;
    const receivedBytes = sumChecked(existing.receivedBytes, sample.receivedBytes);
    const sentBytes = sumChecked(existing.sentBytes, sample.sentBytes);
    if (receivedBytes === null || sentBytes === null) return { ok: false, error: 'overflow', message: 'The daily byte total exceeds the safe integer range.' };
    next[found] = { ...existing, receivedBytes, sentBytes };
  } else {
    if (next.length >= DATA_USE_LEDGER_LIMITS.maxRecords) return { ok: false, error: 'invalid-input', message: 'The ledger has reached its record limit.' };
    next.push({ date: sample.date, source: sample.source, receivedBytes: sample.receivedBytes, sentBytes: sample.sentBytes });
  }
  next.sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source));
  return { ok: true, value: next };
}

/** Roll records up by calendar month (YYYY-MM) or year (YYYY), optionally for one source. */
export function rollupUsage(records: unknown, period: 'month' | 'year', source?: string): UsageResult<UsageTotal[]> {
  if (!validateRecordList(records)
      || (period !== 'month' && period !== 'year') || (source !== undefined && (typeof source !== 'string' || source.length === 0))) {
    return { ok: false, error: 'invalid-input', message: 'Valid records, a month/year period and an optional source are required.' };
  }
  const totals = new Map<string, { receivedBytes: number; sentBytes: number; recordCount: number; days: Set<string> }>();
  for (const row of records as UsageDailyRecord[]) {
    if (source !== undefined && row.source !== source) continue;
    const key = period === 'month' ? row.date.slice(0, 7) : row.date.slice(0, 4);
    const bucket = totals.get(key) ?? { receivedBytes: 0, sentBytes: 0, recordCount: 0, days: new Set<string>() };
    const received = sumChecked(bucket.receivedBytes, row.receivedBytes);
    const sent = sumChecked(bucket.sentBytes, row.sentBytes);
    if (received === null || sent === null) return { ok: false, error: 'overflow', message: `The ${key} usage total exceeds the safe integer range.` };
    bucket.receivedBytes = received;
    bucket.sentBytes = sent;
    bucket.recordCount += 1;
    bucket.days.add(row.date);
    totals.set(key, bucket);
  }
  const value = [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, bucket]) => {
    const totalBytes = sumChecked(bucket.receivedBytes, bucket.sentBytes);
    if (totalBytes === null) return null;
    return { period: key, receivedBytes: bucket.receivedBytes, sentBytes: bucket.sentBytes, totalBytes, recordCount: bucket.recordCount, activeDays: bucket.days.size };
  });
  if (value.some((row) => row === null)) return { ok: false, error: 'overflow', message: 'A rolled-up total exceeds the safe integer range.' };
  return { ok: true, value: value as UsageTotal[] };
}

/** Keep the most recent N calendar days, including asOfDate. Earlier history is discarded. */
export function applyUsageRetention(records: unknown, asOfDate: unknown, retentionDays: unknown): UsageResult<UsageDailyRecord[]> {
  if (!validateRecordList(records)) {
    return { ok: false, error: 'invalid-input', message: 'The ledger must be an array of valid daily records.' };
  }
  if (!isUsageDate(asOfDate)) return { ok: false, error: 'invalid-date', message: 'Retention reference date must be a real YYYY-MM-DD date.' };
  if (!Number.isInteger(retentionDays) || (retentionDays as number) < 1 || (retentionDays as number) > DATA_USE_LEDGER_LIMITS.maxRetentionDays) {
    return { ok: false, error: 'invalid-retention', message: `Retention must be between 1 and ${DATA_USE_LEDGER_LIMITS.maxRetentionDays} days.` };
  }
  const firstKeptDay = dayNumber(asOfDate) - (retentionDays as number) + 1;
  return { ok: true, value: (records as UsageDailyRecord[]).filter((row) => dayNumber(row.date) >= firstKeptDay && dayNumber(row.date) <= dayNumber(asOfDate)).map((row) => ({ ...row })) };
}

export function usageDateOffset(date: string, offsetDays: number): string | null {
  if (!isUsageDate(date) || !Number.isSafeInteger(offsetDays)) return null;
  const shifted = dateFromDayNumber(dayNumber(date) + offsetDays);
  return isUsageDate(shifted) ? shifted : null;
}
