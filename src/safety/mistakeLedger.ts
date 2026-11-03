/** Append-only, deterministic mistake ledger. No clock, storage, network or filesystem access. */
export type MistakeLedgerEntry = Readonly<{
  id: string;
  date: string;
  mistake: string;
  correction: string;
  regressionTest: string;
}>;

export type MistakeLedgerError =
  | 'invalid-input'
  | 'invalid-date'
  | 'missing-regression-test'
  | 'duplicate-id'
  | 'too-many-entries'
  | 'too-large'
  | 'damaged-ledger';

export type MistakeLedgerResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: MistakeLedgerError; message: string; line?: number };

export const MISTAKE_LEDGER_LIMITS = Object.freeze({
  maxEntries: 100_000,
  maxTextCharacters: 4_000,
  maxSerializedCharacters: 20_000_000,
});

export function isLedgerDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1]!;
}

function validateEntry(value: unknown): MistakeLedgerResult<MistakeLedgerEntry> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'invalid-input', message: 'A ledger entry object is required.' };
  }
  const entry = value as Record<string, unknown>;
  if (typeof entry.regressionTest !== 'string' || entry.regressionTest.trim().length === 0) {
    return { ok: false, error: 'missing-regression-test', message: 'Every recorded mistake must name its regression test.' };
  }
  if (typeof entry.id !== 'string' || entry.id.trim().length === 0 || entry.id.length > 120
      || typeof entry.mistake !== 'string' || entry.mistake.trim().length === 0
      || typeof entry.correction !== 'string' || entry.correction.trim().length === 0) {
    return { ok: false, error: 'invalid-input', message: 'An entry needs a non-empty id, mistake and correction.' };
  }
  if (!isLedgerDate(entry.date)) {
    return { ok: false, error: 'invalid-date', message: 'The entry date must be a real Gregorian date in YYYY-MM-DD form.' };
  }
  if (entry.regressionTest.trim().length === 0) {
    return { ok: false, error: 'missing-regression-test', message: 'Every recorded mistake must name its regression test.' };
  }
  if ([entry.id, entry.mistake, entry.correction, entry.regressionTest].some((part) => (part as string).length > MISTAKE_LEDGER_LIMITS.maxTextCharacters)) {
    return { ok: false, error: 'too-large', message: 'A ledger field exceeds the supported character limit.' };
  }
  const allowed = new Set(['id', 'date', 'mistake', 'correction', 'regressionTest']);
  if (Object.keys(entry).some((key) => !allowed.has(key))) {
    return { ok: false, error: 'invalid-input', message: 'The ledger entry contains an unknown field.' };
  }
  return { ok: true, value: Object.freeze({
    id: entry.id,
    date: entry.date,
    mistake: entry.mistake,
    correction: entry.correction,
    regressionTest: entry.regressionTest,
  }) };
}

function validateEntries(value: unknown): MistakeLedgerResult<readonly MistakeLedgerEntry[]> {
  if (!Array.isArray(value)) return { ok: false, error: 'invalid-input', message: 'Ledger entries must be an array.' };
  if (value.length > MISTAKE_LEDGER_LIMITS.maxEntries) return { ok: false, error: 'too-many-entries', message: 'The ledger exceeds its entry limit.' };
  const ids = new Set<string>();
  const entries: MistakeLedgerEntry[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const checked = validateEntry(value[i]);
    if (!checked.ok) return { ...checked, message: `Entry ${i + 1}: ${checked.message}` };
    if (ids.has(checked.value.id)) return { ok: false, error: 'duplicate-id', message: `Entry ${i + 1} repeats id "${checked.value.id}".` };
    ids.add(checked.value.id);
    entries.push(checked.value);
  }
  return { ok: true, value: Object.freeze(entries) };
}

/** Returns a new array; existing entries are never edited, removed, reordered or replaced. */
export function appendMistakeLedger(
  current: unknown,
  addition: unknown,
): MistakeLedgerResult<readonly MistakeLedgerEntry[]> {
  const existing = validateEntries(current);
  if (!existing.ok) return existing;
  const next = validateEntry(addition);
  if (!next.ok) return next;
  if (existing.value.some((entry) => entry.id === next.value.id)) {
    return { ok: false, error: 'duplicate-id', message: `The ledger already contains id "${next.value.id}".` };
  }
  if (existing.value.length >= MISTAKE_LEDGER_LIMITS.maxEntries) {
    return { ok: false, error: 'too-many-entries', message: 'The ledger exceeds its entry limit.' };
  }
  return { ok: true, value: Object.freeze([...existing.value, next.value]) };
}

/** One JSON object per line. Order is preserved exactly; no sorting or compaction occurs. */
export function serializeMistakeLedger(entries: unknown): MistakeLedgerResult<string> {
  const checked = validateEntries(entries);
  if (!checked.ok) return checked;
  const serialized = checked.value.map((entry) => JSON.stringify(entry)).join('\n');
  if (serialized.length > MISTAKE_LEDGER_LIMITS.maxSerializedCharacters) {
    return { ok: false, error: 'too-large', message: 'The serialized ledger exceeds its character limit.' };
  }
  return { ok: true, value: serialized.length === 0 ? '' : `${serialized}\n` };
}

/** Strict JSONL parser: one damaged, blank or duplicate line rejects the entire ledger. */
export function parseMistakeLedger(serialized: unknown): MistakeLedgerResult<readonly MistakeLedgerEntry[]> {
  if (typeof serialized !== 'string') return { ok: false, error: 'invalid-input', message: 'Serialized ledger must be text.' };
  if (serialized.length > MISTAKE_LEDGER_LIMITS.maxSerializedCharacters) {
    return { ok: false, error: 'too-large', message: 'Serialized ledger exceeds its character limit.' };
  }
  if (serialized.length === 0) return { ok: true, value: Object.freeze([]) };
  const lines = serialized.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  if (lines.length > MISTAKE_LEDGER_LIMITS.maxEntries) return { ok: false, error: 'too-many-entries', message: 'The ledger exceeds its entry limit.' };
  const parsed: unknown[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]!.trim().length === 0) {
      return { ok: false, error: 'damaged-ledger', message: 'Blank lines are not valid ledger records.', line: i + 1 };
    }
    let value: unknown;
    try { value = JSON.parse(lines[i]!); }
    catch { return { ok: false, error: 'damaged-ledger', message: 'The ledger contains invalid JSON.', line: i + 1 }; }
    const checked = validateEntry(value);
    if (!checked.ok) return { ok: false, error: 'damaged-ledger', message: checked.message, line: i + 1 };
    parsed.push(checked.value);
  }
  const all = validateEntries(parsed);
  if (!all.ok) return { ok: false, error: 'damaged-ledger', message: all.message };
  return { ok: true, value: all.value };
}
