// The brain boundary (FL12) forbids importing src/brain here, so the guard type is declared locally; it must stay the same shape as LaneGuard in src/brain/mind/directLane.ts.
type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;

const MODES: Readonly<Record<string, true>> = Object.freeze({
  'percent-of': true, 'what-percent': true, change: true, adjust: true, 'percent-of-what': true,
  increase: true, decrease: true
});
const INTENT: Readonly<Record<string, true>> = Object.freeze({
  percent: true, percentage: true, calculate: true, change: true, increase: true, decrease: true
});

/** Words that ask for a different operation than a percentage (Director tweak, CONNECT1-B: "calculate 20 percent and compare 30 percent" must not be answered as one percentage). */
const NOT_PURE: Readonly<Record<string, true>> = Object.freeze({ tax: true, vat: true, tip: true, interest: true, apr: true, discount: true, sale: true, margin: true, markup: true, profit: true, commission: true, battery: true, loan: true, mortgage: true, grade: true, score: true, how: true, why: true, should: true, python: true, code: true, not: true, never: true, dont: true, euros: true, dollars: true, currency: true, convert: true, times: true, twice: true });
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
  if (message.length > 300) return 'the message is too long for the lane, so the existing path should decide';
  if (hasAny(words, NOT_PURE)) return 'the request carries an extra meaning (tax, tip, discount, a question or a program), so the existing path should decide';
  if (!hasAny(words, INTENT) && !message.includes('%')) return 'the request does not clearly ask for a percentage calculation';
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
