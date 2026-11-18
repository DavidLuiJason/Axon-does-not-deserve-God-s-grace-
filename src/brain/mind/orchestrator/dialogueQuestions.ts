// P05 DIALOGUE QUESTIONS (pure helpers). When a tool was found but its text is missing, the brain should ASK for the text and use the answer.
// These helpers only read the brain's trace and build the follow-up request. The pending question itself is kept with the existing dialogue state.
export const TEXT_QUESTION = 'Which text should I use? Send it as your next message, or say cancel to stop.';
export const CANCEL_REPLY = 'Okay, I dropped that request. Nothing was changed.';
export const RESEND_REPLY = 'I could not use that text. Please send it again without quotation marks.';

type TraceLike = { readonly entries: readonly { readonly stage: string; readonly state: string; readonly note: string }[] };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function entries(trace: unknown): TraceLike['entries'] | null {
  if (!isObj(trace) || !Array.isArray(trace.entries)) return null;
  for (const e of trace.entries) if (!isObj(e) || typeof e.stage !== 'string' || typeof e.note !== 'string') return null;
  return trace.entries as TraceLike['entries'];
}

export function entryNote(trace: unknown, stage: string): string | null {
  const list = entries(trace);
  if (!list) return null;
  for (const e of list) if (e.stage === stage) return e.note;
  return null;
}

/** True when the brain found a tool but could not fill a slot and nobody answered: the foundation fallback after "the binder says ask". */
export function binderAsked(source: string, trace: unknown): boolean {
  if (source !== 'foundation') return false;
  const note = entryNote(trace, 'execution');
  return note !== null && note.includes('the binder says ask');
}

function numberBefore(part: string, suffix: string): number {
  const t = part.trim();
  if (!t.endsWith(suffix)) return 0;
  const head = t.slice(0, t.length - suffix.length).trim();
  const words = head.split(' ');
  const n = Number(words[words.length - 1]);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** True when Resolution found a tool (a match, an unavailable tool, or a question about which tool): the message is a request of its own, not an answer. */
export function traceReadsAsRequest(trace: unknown): boolean {
  const note = entryNote(trace, 'resolution');
  if (note === null) return false;
  let total = 0;
  for (const chunk of note.split(';')) {
    for (const part of chunk.split(',')) total += numberBefore(part, ' matches') + numberBefore(part, ' questions') + numberBefore(part, ' unavailable');
  }
  return total > 0;
}

const hasQuote = (s: string): boolean => s.includes('"') || s.includes('\u201c') || s.includes('\u201d');

/** The original request plus the answer as ONE quoted text. Null when the quotes cannot be kept apart safely. */
export function withQuotedText(original: string, value: string): string | null {
  let base = original.trim();
  while (base !== '' && '.!?'.includes(base[base.length - 1])) base = base.slice(0, -1).trim();
  const text = value.trim();
  if (base === '' || text === '' || hasQuote(base)) return null;
  if (text.includes('\u201c') || text.includes('\u201d')) return null;
  const wrapped = text.includes('"') ? '\u201c' + text + '\u201d' : '"' + text + '"';
  return base + ' ' + wrapped;
}

/** A copy of the trace in which one stage's entry is replaced (or added) with a real note. Anything that is not a trace is returned as it is. */
export function withStageNote(trace: unknown, stage: string, note: string): unknown {
  const list = entries(trace);
  if (!list || !isObj(trace)) return trace;
  let found = false;
  const next = list.map((e) => { if (e.stage === stage) { found = true; return { ...e, state: 'ran', note }; } return e; });
  if (!found) next.push({ stage, state: 'ran', note });
  return { ...trace, entries: next };
}
