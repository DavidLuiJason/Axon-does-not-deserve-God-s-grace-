import type { LaneGuard } from '../../../brain/mind/directLane';

const MODES: Readonly<Record<string, true>> = Object.freeze({
  'percent-of': true, 'what-percent': true, change: true, adjust: true, 'percent-of-what': true,
  increase: true, decrease: true
});
const INTENT: Readonly<Record<string, true>> = Object.freeze({
  percent: true, percentage: true, calculate: true, change: true, increase: true, decrease: true
});

/** Words that ask for a different operation than a percentage (Director tweak, CONNECT1-B: "calculate 20 percent and compare 30 percent" must not be answered as one percentage). */
const OTHER_OPERATION: Readonly<Record<string, true>> = Object.freeze({ compare: true, compared: true, comparing: true, versus: true, average: true });

function wordsOf(value: string): string[] {
  const words: string[] = [];
  let word = '';
  for (const char of value.toLowerCase()) {
    const code = char.charCodeAt(0);
    if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) word += char;
    else if (word) { words.push(word); word = ''; }
  }
  if (word) words.push(word);
  return words;
}

function hasAny(words: readonly string[], set: Readonly<Record<string, true>>): boolean {
  return words.some(word => Object.prototype.hasOwnProperty.call(set, word));
}

export const percentageHelperGuard: LaneGuard = (args, message) => {
  const mode = args.mode;
  if (typeof mode !== 'string' || !Object.prototype.hasOwnProperty.call(MODES, mode)) {
    return 'the percentage operation is not a supported choice';
  }
  const words = wordsOf(message);
  if (!hasAny(words, INTENT)) return 'the request does not clearly ask for a percentage calculation';
  if (hasAny(words, OTHER_OPERATION)) return 'the request also asks for another operation, so it asks instead of answering part of it';
  if (words.includes('salary') || words.includes('earnings') || words.includes('pay')) {
    return 'the request refers to an unspecified personal amount';
  }
  const namedModes = new Set(words.filter(word => Object.prototype.hasOwnProperty.call(MODES, word)));
  if (namedModes.size > 1 || (words.includes('change') && words.includes('of'))) {
    return 'the request names more than one percentage operation';
  }
  if (words.includes('percent') && !words.includes('calculate') && !words.includes('percentage') &&
      !words.includes('of') && !words.includes('change') && !words.includes('increase') && !words.includes('decrease')) {
    return 'percent appears to be an ordinary word, not a calculation request';
  }
  if (!args.values || typeof args.values !== 'object') return 'the numeric values are missing';
  return null;
};
