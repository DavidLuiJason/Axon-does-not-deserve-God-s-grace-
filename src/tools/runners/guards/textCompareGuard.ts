import type { LaneGuard } from '../../../brain/mind/directLane';

const QUOTE_MARKS = "\"'\u201C\u201D\u2018\u2019";
const QUOTE_CLOSE: Readonly<Record<string, string>> = Object.freeze({
  '"': '"', "'": "'", '“': '”', '‘': '’'
});
const INTENT: Readonly<Record<string, true>> = Object.freeze({
  compare: true, comparetexts: true, diff: true, differences: true
});
const MODES: Readonly<Record<string, true>> = Object.freeze({ line: true, lines: true, word: true, words: true });
const EVERYDAY: Readonly<Record<string, true>> = Object.freeze({
  mean: true, means: true, meaning: true, prices: true, price: true,
  options: true, people: true, image: true, pixels: true
});

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

function isQuoted(value: string, message: string): boolean {
  let at = message.indexOf(value);
  while (at >= 0) {
    const before = at > 0 ? message.charAt(at - 1) : '';
    const after = message.charAt(at + value.length);
    if (before && after && QUOTE_MARKS.includes(before) && QUOTE_MARKS.includes(after)) return true;
    at = message.indexOf(value, at + 1);
  }
  return false;
}

function removeQuotedValue(value: string, message: string): string {
  let at = message.indexOf(value);
  while (at >= 0) {
    const before = at > 0 ? message.charAt(at - 1) : '';
    const after = message.charAt(at + value.length);
    if (before && after && QUOTE_MARKS.includes(before) && QUOTE_MARKS.includes(after)) {
      return message.slice(0, at) + ' ' + message.slice(at + value.length);
    }
    at = message.indexOf(value, at + 1);
  }
  return message;
}

function quotedCount(message: string): number {
  let count = 0;
  let expectedClose = '';
  for (const char of message) {
    if (!expectedClose) {
      if (Object.prototype.hasOwnProperty.call(QUOTE_CLOSE, char)) expectedClose = QUOTE_CLOSE[char]!;
    } else if (char === expectedClose) {
      count += 1;
      expectedClose = '';
    }
  }
  return count;
}

export const textCompareGuard: LaneGuard = (args, message) => {
  const original = args.original;
  const revised = args.revised;
  if (typeof original !== 'string' || typeof revised !== 'string' || !original.trim() || !revised.trim()) {
    return 'two complete texts are required, so the existing path should ask';
  }
  if (original === revised) return 'the two supplied texts are identical, so the existing path should handle the request';
  if (!isQuoted(original, message) || !isQuoted(revised, message)) return 'both texts must be clearly quoted as the comparison inputs';
  if (quotedCount(message) > 2) return 'more than two quoted texts were supplied';
  const outside = wordsOf(removeQuotedValue(revised, removeQuotedValue(original, message)));
  if (outside.some(word => Object.prototype.hasOwnProperty.call(EVERYDAY, word))) {
    return 'the request appears to compare things in the everyday sense or compare non-text content';
  }
  if (!outside.some(word => Object.prototype.hasOwnProperty.call(INTENT, word))) return 'the request does not clearly ask to compare two texts';
  const modes = new Set(outside.filter(word => Object.prototype.hasOwnProperty.call(MODES, word))
    .map(word => word === 'lines' ? 'line' : word === 'words' ? 'word' : word));
  if (modes.size > 1) return 'the request names conflicting comparison modes';
  return null;
};
