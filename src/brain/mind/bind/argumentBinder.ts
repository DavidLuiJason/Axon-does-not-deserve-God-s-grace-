/**
 * C1 PART 2: THE ARGUMENT BINDER (Director, 2026-10-31).
 *
 * WHAT IT DOES: after Resolution chose ONE tool for ONE clause (a `match`), it turns what the Meaning stage found in that clause
 * (typed values, quoted material, detail spans, words) into the typed `args` a runner takes (`src/tools/runners/runnerTypes.ts`,
 * encoding by slot kind), then decides: RUN, CONFIRM-FIRST or ASK. PURE: no clock, storage, dictionary or random. Never throws.
 * Inputs are never changed; the same input gives the same output.
 *
 * RULES (fixed, so that they can be proven; none reads a phrase, FL13):
 *  1. Slots are read in the schema's order. Each value or word is used at most once.
 *  2. number <- number, roman or percent value (its `value`); duration <- duration (`ms`, 0 or more); quantity <- quantity
 *     ({value, unit}); date <- date or datetime (`date`). An ambiguous date (`dateAlternatives`) or a value with an `error` is NOT used:
 *     the slot stays missing and the reason says so. Same-kind slots take the values in message order.
 *  3. choice <- a clause word whose lowercase form equals EXACTLY ONE of the slot's choices (supplied by the caller from the tool's descriptor).
 *     Two different choices hit, or none: not filled. yes-no is never inferred. time slots are never filled (the clock comes from the device).
 *  4. Required text slots, in order, take text sources: quoted material first, then detail spans; the characters of values and choice words
 *     already used are cut out; surrounding quote marks are stripped. More sources than slots: the first ones are used and it is noted.
 *     No source for a required text slot: it is missing (asking is better than guessing; OPEN_ITEMS 55 and B04C_PLAN risk 3).
 *  5. A required slot still empty takes its declared default from `bindDefaults.ts`, with a note; otherwise it is missing.
 *     A required file slot is always missing (the chat cannot carry files yet).
 *  6. DECISION: any missing slot -> 'ask'. Else 'confirm-first' when the tool has an effect other than showing a result, or its undo is not
 *     'not-needed', or Resolution's evidence was 'value' only (the "Is 5 minutes a long time" trap), or a used value was weak (confidence under 0.5).
 *     Else 'run'. A STATED NEED changes nothing here (owner decision 2026-10-28: confirm, not ask): a free, undoable tool runs at once and
 *     `understood` says what was understood.
 */
import type { SlotSpec } from '../schema/schemaTypes';
import { getSchema } from '../schema/actionSchemas';
import { SLOT_DEFAULTS } from './bindDefaults';

export interface BindValue {
  readonly kind: string; readonly start: number; readonly end: number; readonly confidence: number;
  readonly value?: number; readonly unit?: string; readonly ms?: number; readonly date?: string;
  readonly dateAlternatives?: readonly string[]; readonly error?: string;
}
export interface BindSpan { readonly start: number; readonly end: number }
export interface BindWord { readonly norm: string; readonly start: number; readonly end: number }
export interface BindInput {
  readonly tool: string;
  /** the tool's display name, for the plain sentence */
  readonly toolName: string;
  readonly message: string;
  readonly values: readonly BindValue[];
  /** character ranges of quoted or code material inside the clause */
  readonly materials: readonly BindSpan[];
  /** character ranges of the detail spans of the clause, WITHOUT the marker word */
  readonly details: readonly BindSpan[];
  readonly words: readonly BindWord[];
  /** slot name -> the choices of the tool's descriptor */
  readonly choices: Readonly<Record<string, readonly string[]>>;
  /** Resolution's `evidence` for this match */
  readonly evidence?: 'concept' | 'value' | 'both';
}
export interface MissingSlot { readonly slot: string; readonly kind: string; readonly choices?: readonly string[]; readonly reason: string }
export interface BindResult {
  readonly tool: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly decision: 'run' | 'confirm-first' | 'ask';
  readonly missing: readonly MissingSlot[];
  readonly assumptions: readonly string[];
  /** plain reasons for 'ask' or 'confirm-first' (empty for 'run') */
  readonly why: readonly string[];
  /** one plain sentence: what AXON understood */
  readonly understood: string;
}

const QUOTES: Readonly<Record<string, true>> = { '"': true, "'": true, '`': true, '\u201C': true, '\u201D': true, '\u2018': true, '\u2019': true };
const NUMBER_KINDS: Readonly<Record<string, true>> = { number: true, roman: true, percent: true };
const DATE_KINDS: Readonly<Record<string, true>> = { date: true, datetime: true };
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const list = <T>(v: readonly T[] | undefined): readonly T[] => (Array.isArray(v) ? v : []);
const validSpan = (s: BindSpan, len: number): boolean => !!s && Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 0 && s.end <= len && s.start < s.end;

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} second${total === 1 ? '' : 's'}`;
  const m = Math.floor(total / 60); const s = total % 60;
  const minutes = `${m} minute${m === 1 ? '' : 's'}`;
  return s === 0 ? minutes : `${minutes} ${s} second${s === 1 ? '' : 's'}`;
}
function describe(kind: string, v: unknown): string {
  if (kind === 'duration' && isNum(v)) return formatDuration(v);
  if (kind === 'quantity' && v !== null && typeof v === 'object') { const q = v as { value: number; unit: string }; return `${q.value} ${q.unit}`; }
  if (kind === 'text' && typeof v === 'string') return `\u201C${v.length > 40 ? v.slice(0, 40) + '\u2026' : v}\u201D`;
  return String(v);
}

export function bindArguments(input: BindInput): BindResult {
  const tool = typeof input?.tool === 'string' ? input.tool : '';
  const schema = getSchema(tool);
  const empty = { tool, args: {}, missing: [] as MissingSlot[], assumptions: [] as string[] };
  if (schema === null) return { ...empty, decision: 'ask', why: ['This tool is not known.'], understood: 'I could not tell which tool you meant.' };
  const message = typeof input.message === 'string' ? input.message : '';
  const values = list(input.values); const words = list(input.words);
  const args: Record<string, unknown> = {};
  const kinds: Record<string, string> = {};
  const missing: MissingSlot[] = []; const assumptions: string[] = []; const why: string[] = [];
  const usedValue: Record<number, true> = {}; const consumed: BindSpan[] = [];
  let weak = false;

  const takeValue = (accept: (v: BindValue) => boolean): { v: BindValue; i: number } | null => {
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (usedValue[i] || !v || typeof v.kind !== 'string' || !accept(v)) continue;
      return { v, i };
    }
    return null;
  };
  const use = (found: { v: BindValue; i: number }): void => {
    usedValue[found.i] = true;
    if (isNum(found.v.start) && isNum(found.v.end)) consumed.push({ start: found.v.start, end: found.v.end });
    if (isNum(found.v.confidence) && found.v.confidence < 0.5) weak = true;
  };

  for (const slot of schema.slots) {
    if (slot.kind === 'number') {
      const f = takeValue((v) => NUMBER_KINDS[v.kind] === true && isNum(v.value) && v.error === undefined);
      if (f) { use(f); args[slot.name] = f.v.value; kinds[slot.name] = 'number'; }
    } else if (slot.kind === 'duration') {
      const f = takeValue((v) => v.kind === 'duration' && isNum(v.ms) && v.ms >= 0 && v.error === undefined);
      if (f) { use(f); args[slot.name] = f.v.ms; kinds[slot.name] = 'duration'; }
    } else if (slot.kind === 'quantity') {
      const f = takeValue((v) => v.kind === 'quantity' && isNum(v.value) && typeof v.unit === 'string' && v.unit !== '' && v.error === undefined);
      if (f) { use(f); args[slot.name] = { value: f.v.value, unit: f.v.unit }; kinds[slot.name] = 'quantity'; }
    } else if (slot.kind === 'date') {
      const f = takeValue((v) => DATE_KINDS[v.kind] === true && typeof v.date === 'string' && v.error === undefined);
      if (f) {
        use(f);
        if (list(f.v.dateAlternatives).length > 0) missing.push({ slot: slot.name, kind: 'date', reason: 'The date could be read two ways.' });
        else { args[slot.name] = f.v.date; kinds[slot.name] = 'date'; }
      }
    } else if (slot.kind === 'choice') {
      const options = list(input.choices?.[slot.name]);
      const hits: Record<string, BindWord> = {};
      for (const w of words) {
        if (!w || typeof w.norm !== 'string') continue;
        for (const c of options) if (typeof c === 'string' && c.toLowerCase() === w.norm.toLowerCase()) hits[c] = w;
      }
      const names = Object.keys(hits);
      if (names.length === 1) { args[slot.name] = names[0]; kinds[slot.name] = 'choice'; consumed.push({ start: hits[names[0]].start, end: hits[names[0]].end }); }
    }
  }

  // text slots (rule 4)
  const textSlots = schema.slots.filter((s) => s.kind === 'text' && s.required);
  if (textSlots.length > 0) {
    const cut = (s: BindSpan): string => {
      let out = ''; let at = s.start;
      for (const c of consumed.filter((x) => validSpan(x, message.length)).sort((a, b) => a.start - b.start)) {
        if (c.end <= at || c.start >= s.end) continue;
        out += message.slice(at, Math.max(at, c.start)) + ' '; at = Math.max(at, c.end);
      }
      return (out + message.slice(at, s.end)).split(' ').filter((p) => p !== '').join(' ');
    };
    const strip = (t: string): string => (t.length >= 2 && QUOTES[t[0]] === true && QUOTES[t[t.length - 1]] === true ? t.slice(1, -1) : t);
    const byStart = (a: BindSpan, b: BindSpan): number => a.start - b.start;
    const mats = list(input.materials).filter((s) => validSpan(s, message.length)).slice().sort(byStart).map((s) => strip(message.slice(s.start, s.end)));
    const dets = list(input.details).filter((s) => validSpan(s, message.length)).slice().sort(byStart).map(cut);
    const sources = (mats.length >= textSlots.length ? mats : mats.concat(dets)).filter((t) => t !== '');
    textSlots.forEach((slot, i) => { if (i < sources.length) { args[slot.name] = sources[i]; kinds[slot.name] = 'text'; } });
    if (sources.length > textSlots.length) assumptions.push('I used the first piece of text and left the rest.');
  }

  // defaults and missing (rule 5)
  for (const slot of schema.slots as readonly SlotSpec[]) {
    if (!slot.required || slot.kind === 'time' || Object.prototype.hasOwnProperty.call(args, slot.name)) continue;
    if (missing.some((m) => m.slot === slot.name)) continue;
    const d = Object.prototype.hasOwnProperty.call(SLOT_DEFAULTS, tool) ? SLOT_DEFAULTS[tool][slot.name] : undefined;
    if (d !== undefined && slot.kind !== 'file') { args[slot.name] = d.value; kinds[slot.name] = slot.kind; assumptions.push(d.note[0].toUpperCase() + d.note.slice(1) + '.'); continue; }
    const opts = slot.kind === 'choice' ? list(input.choices?.[slot.name]) : [];
    missing.push({ slot: slot.name, kind: slot.kind, ...(opts.length > 0 ? { choices: opts } : {}), reason: slot.kind === 'file' ? 'This needs a file.' : 'This was not said.' });
  }

  let decision: BindResult['decision'] = 'run';
  if (missing.length > 0) { decision = 'ask'; why.push('Something needed was not said: ' + missing.map((m) => m.slot).join(', ') + '.'); }
  else {
    if (schema.effects.some((e) => e !== 'shows-result')) why.push('This tool does more than show a result.');
    if (schema.undo !== 'not-needed') why.push('This cannot simply be taken back.');
    if (input.evidence === 'value') why.push('The message only carried a value; it did not ask for this tool.');
    if (weak) why.push('A value in the message was uncertain.');
    if (why.length > 0) decision = 'confirm-first';
  }
  const parts = schema.slots.filter((s) => Object.prototype.hasOwnProperty.call(args, s.name)).map((s) => `${s.name}: ${describe(kinds[s.name] ?? s.kind, args[s.name])}`);
  const name = typeof input.toolName === 'string' && input.toolName !== '' ? input.toolName : tool;
  const understood = `I read this as ${name}${parts.length > 0 ? ' (' + parts.join(', ') + ')' : ''}.${assumptions.length > 0 ? ' ' + assumptions.join(' ') : ''}`;
  return { tool, args, decision, missing, assumptions, why, understood };
}
