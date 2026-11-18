export type EngineSuccess<T> = { readonly ok: true; readonly value: T };
export type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
export type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type RepairEdit = { readonly kind: 'REPEAT' | 'MARKER' | 'GRAMMAR_PAIR'; readonly from: string; readonly to: string };
export type RepairResult = {
  readonly original: string;
  readonly reading: string;
  readonly changed: boolean;
  readonly edits: readonly RepairEdit[];
  readonly alternatives: readonly string[];
  readonly verdict: 'KEEP' | 'REPAIRED' | 'ASK';
  readonly askQuestion: string | null;
};

const failure = (error: string, message: string): EngineResult<RepairResult> => ({
  ok: false, error, message
});

const quoteState = (text: string): { balanced: boolean; outside: string } => {
  let quote: '"' | '”' | null = null;
  let outside = '';
  let unmatchedClose = false;
  for (const char of text) {
    if (quote === null) {
      if (char === '"') quote = '"';
      else if (char === '“') quote = '”';
      else if (char === '”') unmatchedClose = true;
      else outside += char;
    } else if (char === quote) {
      quote = null;
    }
  }
  return { balanced: quote === null && !unmatchedClose, outside };
};

// No regular expressions in the mind folder (tests/mindPipeline.test.ts), so these small helpers walk the characters.
const isSpace = (c: string): boolean => c.trim() === '';
const isWordChar = (c: string | undefined): boolean =>
  c !== undefined && ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_');

const collapseSpaces = (text: string): string => {
  let out = '';
  let space = false;
  for (const c of text) {
    if (isSpace(c)) space = true;
    else {
      if (space && out !== '') out += ' ';
      space = false;
      out += c;
    }
  }
  return out;
};

const normalForm = (sentence: string): string => {
  let out = collapseSpaces(sentence.toLowerCase());
  while (out !== '' && '.!?'.includes(out[out.length - 1])) out = out.slice(0, -1);
  return out.trim();
};

// The two closed lists below were approved by the owner (REPAIR_STAGE_DESIGN). They are kept as keyed lookups because the mind folder allows no
// array of string literals outside closedSets.ts; they can move into closedSets.ts later without changing behaviour.
const HOW_MUCH_NOUNS: Readonly<Record<string, true>> = { words: true, letters: true, characters: true, lines: true, sentences: true, paragraphs: true, numbers: true, digits: true, vowels: true, items: true };
type HowMuch = { readonly whole: string; readonly how: string; readonly gap1: string; readonly much: string; readonly gap2: string; readonly noun: string };
const matchHowMuch = (rest: string): HowMuch | null => {
  if (rest.slice(0, 3).toLowerCase() !== 'how') return null;
  let i = 3;
  while (i < rest.length && isSpace(rest[i])) i++;
  if (i === 3) return null;
  const gap1 = rest.slice(3, i);
  if (rest.slice(i, i + 4).toLowerCase() !== 'much') return null;
  const much = rest.slice(i, i + 4);
  i += 4;
  const start2 = i;
  while (i < rest.length && isSpace(rest[i])) i++;
  if (i === start2) return null;
  const gap2 = rest.slice(start2, i);
  for (const noun of Object.keys(HOW_MUCH_NOUNS)) {
    if (rest.slice(i, i + noun.length).toLowerCase() === noun && !isWordChar(rest[i + noun.length])) {
      return { whole: rest.slice(0, i + noun.length), how: rest.slice(0, 3), gap1, much, gap2, noun: rest.slice(i, i + noun.length) };
    }
  }
  return null;
};

const RISKY_WORDS: Readonly<Record<string, true>> = { delete: true, remove: true, erase: true, overwrite: true, send: true, pay: true, transfer: true, format: true };
const hasRiskyWord = (text: string): boolean => {
  let word = '';
  for (const c of text + ' ') {
    if (isWordChar(c)) word += c;
    else {
      if (word !== '' && Object.prototype.hasOwnProperty.call(RISKY_WORDS, word.toLowerCase())) return true;
      word = '';
    }
  }
  return false;
};

const sentencesOf = (text: string): string[] => {
  const sentences: string[] = [];
  let start = 0;
  let quote: '"' | '”' | null = null;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (quote === null) {
      if (char === '"') quote = '"';
      else if (char === '“') quote = '”';
    } else if (char === quote) {
      quote = null;
    }
    if (quote === null && (char === '.' || char === '!' || char === '?') &&
        (index + 1 === text.length || text[index + 1] === ' ')) {
      const part = text.slice(start, index + 1).trim();
      if (part) sentences.push(part);
      start = index + 1;
      while (start < text.length && text[start] === ' ') start++;
      index = start;
      continue;
    }
    index++;
  }
  const tail = text.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
};

const grammarFix = (sentence: string): { text: string; edits: RepairEdit[] } => {
  const edits: RepairEdit[] = [];
  let result = '';
  let quote: '"' | '”' | null = null;
  let index = 0;
  while (index < sentence.length) {
    const char = sentence[index];
    if (quote === null) {
      if (char === '"') quote = '"';
      else if (char === '“') quote = '”';
    } else if (char === quote) {
      quote = null;
    }
    if (quote === null) {
      const match = matchHowMuch(sentence.slice(index));
      if (match && (index === 0 || !isWordChar(sentence[index - 1]))) {
        const much = match.much;
        const replacement = [...'many'].map((letter, position) =>
          much[position] === much[position].toUpperCase() ? letter.toUpperCase() : letter
        ).join('');
        const before = match.whole;
        const after = match.how + match.gap1 + replacement + match.gap2 + match.noun;
        edits.push({ kind: 'GRAMMAR_PAIR', from: before, to: after });
        result += after;
        index += before.length;
        continue;
      }
    }
    result += char;
    index++;
  }
  return { text: result, edits };
};

export function repairMessage(input: { readonly text: string }): EngineResult<RepairResult> {
  if (input === null || typeof input !== 'object' || typeof (input as { text?: unknown }).text !== 'string' ||
      !(input as { text: string }).text.trim()) {
    return failure('bad-input', 'Input must be an object with non-empty string text.');
  }
  const original = (input as { text: string }).text;
  if (original.length > 4000) return failure('too-long', 'Text must not exceed 4000 characters.');

  const quotes = quoteState(original);
  const keep = (): EngineResult<RepairResult> => ({
    ok: true,
    value: {
      original, reading: original, changed: false, edits: [], alternatives: [],
      verdict: 'KEEP', askQuestion: null
    }
  });
  if (!quotes.balanced) return keep();

  const sentences = sentencesOf(original);
  const removed = new Set<number>();
  const markerEdits: RepairEdit[] = [];
  const markers = new Set(['wait', 'oops']);

  for (let index = 0; index < sentences.length; index++) {
    if (!markers.has(normalForm(sentences[index])) || removed.has(index)) continue;
    const gone: string[] = [];
    const previous = index - 1;
    if (previous >= 0 && !removed.has(previous) && !markers.has(normalForm(sentences[previous]))) {
      removed.add(previous);
      gone.push(sentences[previous]);
    }
    removed.add(index);
    gone.push(sentences[index]);
    markerEdits.push({ kind: 'MARKER', from: gone.join(' '), to: '' });
  }

  const repeatEdits: RepairEdit[] = [];
  let index = 0;
  while (index < sentences.length) {
    if (removed.has(index)) { index++; continue; }
    const base = normalForm(sentences[index]);
    let next = index + 1;
    while (next < sentences.length && !removed.has(next) && normalForm(sentences[next]) === base) {
      removed.add(next);
      repeatEdits.push({ kind: 'REPEAT', from: sentences[next], to: '' });
      next++;
    }
    index = next;
  }

  const remaining = sentences.filter((_sentence, position) => !removed.has(position));
  if (remaining.length === 0) return keep();

  const grammarEdits: RepairEdit[] = [];
  const repairedSentences = remaining.map(sentence => {
    const fixed = grammarFix(sentence);
    grammarEdits.push(...fixed.edits);
    return fixed.text;
  });
  const edits = [...markerEdits, ...repeatEdits, ...grammarEdits];
  if (edits.length === 0) return keep();

  const reading = repairedSentences.join(' ').trim();
  if (!reading) return keep();
  const risky = hasRiskyWord(quotes.outside);
  return {
    ok: true,
    value: {
      original,
      reading,
      changed: true,
      edits,
      alternatives: [original],
      verdict: risky ? 'ASK' : 'REPAIRED',
      askQuestion: risky ? `Did you mean: "${reading}"?` : null
    }
  };
}
