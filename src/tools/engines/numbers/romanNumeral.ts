/**
 * Shared pure engine for Roman numerals (1–3999, strict canonical form).
 * A string is valid only when toRoman(parseRoman(x)) === x.
 * Used by the values reader and any future Roman tool.
 */

export type RomanParseResult =
  | { ok: true; value: number }
  | { ok: false; error: 'invalid-roman' | 'out-of-range' | 'invalid-input'; message: string };

export type RomanFormatResult =
  | { ok: true; text: string }
  | { ok: false; error: 'out-of-range' | 'invalid-input'; message: string };

const VALUES: ReadonlyArray<[string, number]> = [
  ['M', 1000],
  ['CM', 900],
  ['D', 500],
  ['CD', 400],
  ['C', 100],
  ['XC', 90],
  ['L', 50],
  ['XL', 40],
  ['X', 10],
  ['IX', 9],
  ['V', 5],
  ['IV', 4],
  ['I', 1],
];

const LETTERS = new Set(['I', 'V', 'X', 'L', 'C', 'D', 'M']);

export function parseRoman(text: string): RomanParseResult {
  if (typeof text !== 'string') {
    return { ok: false, error: 'invalid-input', message: 'expected a string' };
  }
  const s = text;
  if (s.length === 0) {
    return { ok: false, error: 'invalid-roman', message: 'empty' };
  }
  for (let i = 0; i < s.length; i++) {
    if (!LETTERS.has(s[i]!)) {
      return { ok: false, error: 'invalid-roman', message: 'non-roman letter (only the seven upper-case letters, no spaces)' };
    }
  }
  let i = 0;
  let total = 0;
  for (const [sym, val] of VALUES) {
    while (s.startsWith(sym, i)) {
      total += val;
      i += sym.length;
      if (total > 3999) {
        return { ok: false, error: 'out-of-range', message: 'value exceeds 3999' };
      }
    }
  }
  if (i !== s.length) {
    return { ok: false, error: 'invalid-roman', message: 'not fully consumed' };
  }
  if (total < 1 || total > 3999) {
    return { ok: false, error: 'out-of-range', message: 'value outside 1–3999' };
  }
  // Canonical check: only accept if toRoman reproduces the input.
  const back = toRoman(total);
  if (!back.ok || back.text !== s) {
    return { ok: false, error: 'invalid-roman', message: 'not canonical form' };
  }
  return { ok: true, value: total };
}

export function toRoman(n: number): RomanFormatResult {
  if (typeof n !== 'number' || !Number.isInteger(n)) {
    return { ok: false, error: 'invalid-input', message: 'expected an integer' };
  }
  if (n < 1 || n > 3999) {
    return { ok: false, error: 'out-of-range', message: 'Roman numerals support 1–3999' };
  }
  let remaining = n;
  let out = '';
  for (const [sym, val] of VALUES) {
    while (remaining >= val) {
      out += sym;
      remaining -= val;
    }
  }
  return { ok: true, text: out };
}
