import { isCountNoun, isRiskyVerb } from '../../knowledge/repairWords';

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

const isSpace = (char: string): boolean => char.trim() === '';
const isWordChar = (char: string | undefined): boolean => char !== undefined &&
  ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char === '_');
const isEndMark = (char: string): boolean => char === '.' || char === '!' || char === '?';

/** The sentence in lower case, whitespace runs collapsed to one space, trailing . ! ? removed. */
const normalForm = (sentence: string): string => {
  const words: string[] = [];
  let word = '';
  for (const char of sentence.toLowerCase()) {
    if (isSpace(char)) { if (word) words.push(word); word = ''; } else word += char;
  }
  if (word) words.push(word);
  let text = words.join(' ');
  while (text.length > 0 && isEndMark(text[text.length - 1])) text = text.slice(0, -1);
  return text.trim();
};

const readSpaces = (text: string, from: number): number => {
  let end = from;
  while (end < text.length && isSpace(text[end])) end++;
  return end;
};

type HowMuch = { how: string; gapOne: string; much: string; gapTwo: string; noun: string; end: number };

/** "how much" + a counted noun, starting exactly at `at` (any letter case, any whitespace between the words). */
const matchHowMuch = (text: string, at: number): HowMuch | null => {
  if (text.slice(at, at + 3).toLowerCase() !== 'how') return null;
  const gapOneEnd = readSpaces(text, at + 3);
  if (gapOneEnd === at + 3) return null;
  const muchEnd = gapOneEnd + 4;
  if (text.slice(gapOneEnd, muchEnd).toLowerCase() !== 'much') return null;
  const gapTwoEnd = readSpaces(text, muchEnd);
  if (gapTwoEnd === muchEnd) return null;
  let nounEnd = gapTwoEnd;
  while (isWordChar(text[nounEnd])) nounEnd++;
  const noun = text.slice(gapTwoEnd, nounEnd);
  if (!isCountNoun(noun)) return null;
  return {
    how: text.slice(at, at + 3), gapOne: text.slice(at + 3, gapOneEnd), much: text.slice(gapOneEnd, muchEnd),
    gapTwo: text.slice(muchEnd, gapTwoEnd), noun, end: nounEnd
  };
};

const hasRiskyVerb = (text: string): boolean => {
  let word = '';
  for (const char of text) {
    if (isWordChar(char)) word += char;
    else { if (word && isRiskyVerb(word)) return true; word = ''; }
  }
  return word !== '' && isRiskyVerb(word);
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
      const match = index === 0 || !isWordChar(sentence[index - 1]) ? matchHowMuch(sentence, index) : null;
      if (match) {
        const much = match.much;
        const replacement = [...'many'].map((letter, position) =>
          much[position] === much[position].toUpperCase() ? letter.toUpperCase() : letter
        ).join('');
        const before = sentence.slice(index, match.end);
        const after = match.how + match.gapOne + replacement + match.gapTwo + match.noun;
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
  const risky = hasRiskyVerb(quotes.outside);
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
