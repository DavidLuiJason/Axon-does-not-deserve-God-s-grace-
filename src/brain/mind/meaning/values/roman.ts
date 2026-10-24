/**
 * B03B1d reader: Roman numerals inside a message. A Roman numeral is an UPPER-CASE run of two or more of the seven
 * letters that the shared engine accepts (canonical form only). Lower-case text is never Roman (mix, did, civil).
 * Confidence 0.8; 0.2 when every letter in the whole message is upper case (a shouted sentence such as MIX THE COLOURS).
 */
import { parseRoman } from '../../../../tools/engines/numbers/romanNumeral';
import { isLetter, isUpper, isDigit } from './charClass';
import type { ExtractedValue, ScanContext } from './types';

export function readRoman(ctx: ScanContext, _found: ExtractedValue[]): ExtractedValue[] {
  const out: ExtractedValue[] = [];
  let letters = 0;
  let upper = 0;
  for (const c of ctx.text) if (isLetter(c)) { letters += 1; if (isUpper(c)) upper += 1; }
  const allUpper = letters > 0 && letters === upper;
  for (const range of ctx.ranges) {
    let i = range.start;
    while (i < range.end) {
      const c = ctx.text[i]!;
      if (!isLetter(c) && !isDigit(c)) { i += 1; continue; }
      let j = i;
      while (j < range.end && (isLetter(ctx.text[j]!) || isDigit(ctx.text[j]!))) j += 1;
      const word = ctx.text.slice(i, j);
      if (word.length >= 2) {
        const parsed = parseRoman(word);
        if (parsed.ok) {
          out.push({
            kind: 'roman', text: word, start: i, end: j, value: parsed.value, computed: true,
            confidence: allUpper ? 0.2 : 0.8,
            reason: allUpper ? 'canonical Roman numeral, but the whole message is upper case, so it may be an ordinary word' : 'upper-case run of Roman letters that passes the canonical round trip',
          });
        }
      }
      i = j;
    }
  }
  return out;
}
