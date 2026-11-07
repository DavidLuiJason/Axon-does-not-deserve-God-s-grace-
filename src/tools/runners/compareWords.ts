/** PROPOSED, the owner's yes is WAITING. */
import type { TextCompareMode } from '../engines/text/textCompare';

export const COMPARE_MODE_WORDS: Readonly<Record<string, TextCompareMode>> = Object.freeze({
  line: 'line', lines: 'line', word: 'word', words: 'word'
});
export const COMPARE_MODE_CHOICES: readonly string[] = Object.freeze(Object.keys(COMPARE_MODE_WORDS));

export function foldCompareMode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value === 'line' || value === 'word') return value;
  const key = value.toLowerCase();
  return Object.prototype.hasOwnProperty.call(COMPARE_MODE_WORDS, key) ? COMPARE_MODE_WORDS[key] : value;
}
