/** PROPOSED, the owner's yes is WAITING. */
import type { PercentageMode } from '../engines/numbers/percentage';

export const PERCENT_MODE_WORDS: Readonly<Record<string, PercentageMode>> = Object.freeze({
  'percent-of': 'percent-of',
  'what-percent': 'what-percent',
  change: 'change',
  adjust: 'adjust',
  'percent-of-what': 'percent-of-what'
});
export const PERCENT_MODE_CHOICES: readonly string[] = Object.freeze(Object.keys(PERCENT_MODE_WORDS));

export function foldPercentMode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const key = value.toLowerCase();
  return Object.prototype.hasOwnProperty.call(PERCENT_MODE_WORDS, key) ? PERCENT_MODE_WORDS[key] : value;
}
