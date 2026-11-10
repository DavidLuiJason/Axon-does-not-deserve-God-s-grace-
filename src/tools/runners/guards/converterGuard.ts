// The brain boundary (FL12) forbids importing src/brain here, so the guard type is declared locally; it must stay the same shape as LaneGuard in src/brain/mind/directLane.ts.
type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;
import { CONVERTER_KINDS } from '../../converter/kinds';

const INTENT: Readonly<Record<string, true>> = Object.freeze({ convert: true, translate: true });
const FILE_WORDS: Readonly<Record<string, true>> = Object.freeze({
  file: true, photo: true, image: true, document: true, upload: true, attachment: true
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

function hasAny(words: readonly string[], set: Readonly<Record<string, true>>): boolean {
  return words.some(word => Object.prototype.hasOwnProperty.call(set, word));
}

function isPlainNumber(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && Array.from(trimmed).every(char => '0123456789+-.,'.includes(char));
}

function matchesKinds(from: string, to: string): number {
  return CONVERTER_KINDS.filter(kind =>
    kind.units.some(unit => unit.id === from) && kind.units.some(unit => unit.id === to)
  ).length;
}

function isQuoted(value: string, message: string): boolean {
  const marks = "\"'\u201C\u201D\u2018\u2019";
  let at = message.indexOf(value);
  while (at >= 0) {
    const before = at > 0 ? message.charAt(at - 1) : '';
    const after = message.charAt(at + value.length);
    if (before && after && marks.includes(before) && marks.includes(after)) return true;
    at = message.indexOf(value, at + 1);
  }
  return false;
}

export const converterGuard: LaneGuard = (args, message) => {
  const { from, to, input } = args;
  if (typeof from !== 'string' || typeof to !== 'string' || typeof input !== 'string' || !input.trim()) {
    return 'a value and both conversion units are required';
  }
  const words = wordsOf(message);
  if (!hasAny(words, INTENT)) return 'the request does not clearly ask to convert a value';
  if (hasAny(words, FILE_WORDS)) return 'the request may be asking for file conversion, which this text action cannot perform';
  if (matchesKinds(from, to) !== 1) return 'the source and target do not identify one unambiguous conversion kind';
  if (from === to) return 'source and target are the same; the existing path should confirm the intended operation';
  const kind = CONVERTER_KINDS.find(item => item.units.some(unit => unit.id === from) && item.units.some(unit => unit.id === to));
  if (kind?.entry === 'file') return 'this conversion requires a file';
  if (!isQuoted(input, message) && !isPlainNumber(input)) return 'the value is not clearly supplied as a number or quoted text';
  return null;
};
