/**
 * Ordered, literal multi-pair find/replace.
 * Each pair is applied to the text produced by the preceding pair. Matches
 * within one pair are non-overlapping and consumed left-to-right.
 */
export type FindReplacePair = Readonly<{ find: string; replace: string }>;
export type FindReplaceManyOptions = Readonly<{ caseSensitive?: boolean }>;
export type FindReplaceManyError = 'invalid-input' | 'invalid-separator' | 'invalid-pairs' | 'too-many-pairs' | 'too-large';
export type FindReplaceManyResult =
  | { ok: true; text: string; pairCount: number; replacements: number; replacementsByPair: number[] }
  | { ok: false; error: FindReplaceManyError; message: string };
export type ParsePairsResult =
  | { ok: true; pairs: FindReplacePair[] }
  | { ok: false; error: 'invalid-input' | 'invalid-separator' | 'invalid-pairs' | 'too-many-pairs' | 'too-large'; message: string };

export const FIND_REPLACE_MANY_LIMITS = Object.freeze({
  maxInputCharacters: 200_000,
  maxOutputCharacters: 1_000_000,
  maxPairs: 100,
  maxFindCharacters: 500,
  maxReplacementCharacters: 2_000,
});

/**
 * Parse one pair per non-empty line. The first separator on a line divides
 * find from replace; later separators belong to the replacement. Neither
 * side is trimmed because leading/trailing spaces can be meaningful text.
 */
export function parseFindReplacePairs(input: unknown, separator: unknown): ParsePairsResult {
  if (typeof input !== 'string') return { ok: false, error: 'invalid-input', message: 'Pair input must be text.' };
  if (input.length > FIND_REPLACE_MANY_LIMITS.maxInputCharacters) return { ok: false, error: 'too-large', message: 'Pair input exceeds the supported character limit.' };
  if (typeof separator !== 'string' || separator.length === 0) {
    return { ok: false, error: 'invalid-separator', message: 'Choose a non-empty separator.' };
  }
  const lines = input.split(/\r\n|\n|\r/).filter((line) => line.length > 0);
  if (lines.length > FIND_REPLACE_MANY_LIMITS.maxPairs) {
    return { ok: false, error: 'too-many-pairs', message: `At most ${FIND_REPLACE_MANY_LIMITS.maxPairs} pairs are accepted.` };
  }
  const pairs: FindReplacePair[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const splitAt = line.indexOf(separator);
    if (splitAt < 0) {
      return { ok: false, error: 'invalid-pairs', message: `Line ${i + 1} does not contain the separator.` };
    }
    const find = line.slice(0, splitAt);
    const replace = line.slice(splitAt + separator.length);
    if (find.length === 0) {
      return { ok: false, error: 'invalid-pairs', message: `Line ${i + 1} has an empty find value.` };
    }
    if (find.length > FIND_REPLACE_MANY_LIMITS.maxFindCharacters || replace.length > FIND_REPLACE_MANY_LIMITS.maxReplacementCharacters) {
      return { ok: false, error: 'invalid-pairs', message: `Line ${i + 1} exceeds the supported pair length.` };
    }
    pairs.push({ find, replace });
  }
  return { ok: true, pairs };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceLiteralAll(text: string, find: string, replacement: string, caseSensitive: boolean, maxOutput: number): { text: string; count: number } | null {
  const pieces: string[] = [];
  let cursor = 0;
  let count = 0;
  let outputLength = 0;
  if (caseSensitive) {
    while (true) {
      const at = text.indexOf(find, cursor);
      if (at < 0) break;
      outputLength += at - cursor + replacement.length;
      if (outputLength > maxOutput) return null;
      pieces.push(text.slice(cursor, at), replacement);
      count += 1;
      cursor = at + find.length;
    }
  } else {
    const expression = new RegExp(escapeRegExp(find), 'giu');
    let match: RegExpExecArray | null;
    while ((match = expression.exec(text)) !== null) {
      const end = match.index + match[0].length;
      outputLength += match.index - cursor + replacement.length;
      if (outputLength > maxOutput) return null;
      pieces.push(text.slice(cursor, match.index), replacement);
      cursor = end;
      count += 1;
    }
  }
  if (count === 0) return { text, count: 0 };
  outputLength += text.length - cursor;
  if (outputLength > maxOutput) return null;
  pieces.push(text.slice(cursor));
  return { text: pieces.join(''), count };
}

export function findReplaceMany(text: unknown, pairs: unknown, options: FindReplaceManyOptions = {}): FindReplaceManyResult {
  if (typeof text !== 'string' || !Array.isArray(pairs) || options === null || typeof options !== 'object'
      || (options.caseSensitive !== undefined && typeof options.caseSensitive !== 'boolean')) {
    return { ok: false, error: 'invalid-input', message: 'Text, a pair array and options are required.' };
  }
  if (text.length > FIND_REPLACE_MANY_LIMITS.maxInputCharacters) {
    return { ok: false, error: 'too-large', message: 'Input text exceeds the supported character limit.' };
  }
  if (pairs.length > FIND_REPLACE_MANY_LIMITS.maxPairs) {
    return { ok: false, error: 'too-many-pairs', message: `At most ${FIND_REPLACE_MANY_LIMITS.maxPairs} pairs are accepted.` };
  }
  const normalized: FindReplacePair[] = [];
  for (let i = 0; i < pairs.length; i += 1) {
    const pair = pairs[i] as unknown;
    if (pair === null || typeof pair !== 'object' || typeof (pair as FindReplacePair).find !== 'string' || typeof (pair as FindReplacePair).replace !== 'string') {
      return { ok: false, error: 'invalid-pairs', message: `Pair ${i + 1} must contain string find and replace values.` };
    }
    const candidate = pair as FindReplacePair;
    if (candidate.find.length === 0 || candidate.find.length > FIND_REPLACE_MANY_LIMITS.maxFindCharacters || candidate.replace.length > FIND_REPLACE_MANY_LIMITS.maxReplacementCharacters) {
      return { ok: false, error: 'invalid-pairs', message: `Pair ${i + 1} has an empty find value or exceeds the supported pair length.` };
    }
    normalized.push(candidate);
  }
  let current = text;
  let replacements = 0;
  const replacementsByPair: number[] = [];
  for (const pair of normalized) {
    const outcome = replaceLiteralAll(current, pair.find, pair.replace, options.caseSensitive === true, FIND_REPLACE_MANY_LIMITS.maxOutputCharacters);
    if (outcome === null) return { ok: false, error: 'too-large', message: 'The replacement result would exceed the supported output character limit.' };
    current = outcome.text;
    replacements += outcome.count;
    replacementsByPair.push(outcome.count);
  }
  return { ok: true, text: current, pairCount: normalized.length, replacements, replacementsByPair };
}
