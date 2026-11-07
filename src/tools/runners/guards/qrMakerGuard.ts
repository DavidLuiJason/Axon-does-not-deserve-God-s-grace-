import type { LaneGuard } from '../../../brain/mind/directLane';

const MAKE: Readonly<Record<string, true>> = Object.freeze({ make: true, create: true, generate: true, encode: true });
const READ: Readonly<Record<string, true>> = Object.freeze({ read: true, scan: true, decode: true, recognize: true, extract: true });
const NOT_TEXT: Readonly<Record<string, true>> = Object.freeze({
  image: true, file: true, photo: true, attachment: true, screenshot: true
});
const LEVELS: Readonly<Record<string, true>> = Object.freeze({ L: true, M: true, Q: true, H: true });
const QUOTE_MARKS = "\"'\u201C\u201D\u2018\u2019";

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

export const qrMakerGuard: LaneGuard = (args, message) => {
  const value = args.text;
  if (typeof value !== 'string' || !value.trim()) return 'QR content is missing';
  const words = wordsOf(message);
  if (hasAny(words, READ)) return 'the request is to read or decode a QR code, not create one';
  if (hasAny(words, NOT_TEXT)) return 'the request targets an image or file rather than the owner’s quoted text';
  if (!hasAny(words, MAKE)) return 'the request does not clearly ask to create a QR code';
  if (!isQuoted(value, message)) return 'the QR content must be the owner’s clearly quoted text';
  if (!Object.prototype.hasOwnProperty.call(LEVELS, String(args.level))) return 'the QR error-correction level is not supported';
  return null;
};
