import type { ExtractedValue, ScanContext } from './types';
import { isDigit, isLetter, isSpace } from './charClass';
import { CARDINAL_WORDS, ORDINAL_WORDS, HALF_WORD } from '../valueWords';
import { isCoordinator, isDeterminer, normalizeWord } from '../closedSets';

type Token = { word: string; start: number; end: number };
const weak = (why: string) => [{ kind: 'identifier', note: why }];
function suffix(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return 'th';
  const last = n % 10;
  return last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th';
}
function wordsAt(tokens: Token[], at: number): { end: number; value: number; confidence: number; alternatives?: ExtractedValue['alternatives'] } | null {
  let i = at;
  let total = 0, group = 0, last = 0, used = false, scaled = false;
  let highScale = Infinity;
  if (isDeterminer(tokens[i]?.word ?? '') && tokens[i]?.word === 'a' && (CARDINAL_WORDS.get(tokens[i + 1]?.word ?? '') ?? 0) >= 100) i++;
  const first = i;
  while (i < tokens.length) {
    const t = tokens[i];
    const n = CARDINAL_WORDS.get(t.word);
    if (n === undefined) {
      if (isCoordinator(t.word) && t.word === 'and' && (last === 100 || scaled) && CARDINAL_WORDS.has(tokens[i + 1]?.word ?? '') && tokens[i + 1].start > t.end) { i++; continue; }
      break;
    }
    if (n === 100) {
      if (!used || last === 100 || group >= 100 || group === 0) break;
      group *= 100; last = 100; i++; continue;
    }
    if (n >= 1000) {
      if (!used || group === 0 || n >= highScale) break;
      total += group * n; group = 0; last = n; highScale = n; scaled = true; i++; continue;
    }
    if (used && last !== 100 && last < 1000 && last !== 0) {
      if (!(last >= 20 && last < 100 && last % 10 === 0 && n > 0 && n < 10)) break;
    }
    if (used && last === 0) break;
    group += n; used = true; last = n; scaled = false; i++;
  }
  if (!used || i === first) return null;
  let value = total + group;
  if (tokens[i]?.word === 'and' && tokens[i + 1]?.word === 'a' && tokens[i + 2]?.word === HALF_WORD) { value += 0.5; i += 3; }
  const aloneOne = i === first + 1 && tokens[first].word === 'one';
  return { end: i, value, confidence: aloneOne ? 0.4 : 0.9, alternatives: aloneOne ? [{ kind: 'pronoun', note: 'one can stand for a noun' }] : undefined };
}
export function readNumbers(ctx: ScanContext, found: ExtractedValue[]): ExtractedValue[] {
  const out = [...found];
  const text = ctx.text;
  for (const range of ctx.ranges) {
    const tokens: Token[] = [];
    for (let i = range.start; i < range.end;) {
      if (!isLetter(text[i])) { i++; continue; }
      const start = i;
      while (i < range.end && isLetter(text[i])) i++;
      tokens.push({ word: normalizeWord(text.slice(start, i)), start, end: i });
    }
    const add = (start: number, end: number, form: ExtractedValue['form'], confidence: number, reason: string, value?: number, error?: string, alternatives?: ExtractedValue['alternatives']) => {
      const v: ExtractedValue = { kind: 'number', text: text.slice(start, end), start, end, form, confidence, reason, computed: true };
      if (error) v.error = error;
      else if (value !== undefined && Number.isSafeInteger(value) || (value !== undefined && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER)) v.value = value;
      else v.error = 'too-large';
      if (alternatives) v.alternatives = alternatives;
      out.push(v);
    };
    for (let i = range.start; i < range.end;) {
      const sign = text[i] === '-' && (i === 0 || isSpace(text[i - 1])) && i + 1 < range.end && isDigit(text[i + 1]);
      if (!isDigit(text[i]) && !sign) { i++; continue; }
      const start = i;
      if (sign) i++;
      const first = i;
      while (i < range.end && isDigit(text[i])) i++;
      if (i - first <= 3 && i > first && text[i] === ',' && i + 3 < range.end) {
        while (text[i] === ',' && i + 3 < range.end && isDigit(text[i + 1]) && isDigit(text[i + 2]) && isDigit(text[i + 3]) && (i + 4 >= range.end || !isDigit(text[i + 4]))) i += 4;
      }
      if (text[i] === '.' && i + 1 < range.end && isDigit(text[i + 1])) { i++; while (i < range.end && isDigit(text[i])) i++; }
      const numberEnd = i;
      let ordEnd = i;
      while (ordEnd < range.end && ordEnd < i + 2 && isLetter(text[ordEnd])) ordEnd++;
      const candidate = normalizeWord(text.slice(i, ordEnd));
      const isOrdinal = candidate.length === 2 && (candidate === 'st' || candidate === 'nd' || candidate === 'rd' || candidate === 'th') && (ordEnd === range.end || !isLetter(text[ordEnd]));
      const raw = text.slice(start, numberEnd).split(',').join('');
      const val = Number(raw);
      const identifier = isLetter(text[start - 1] ?? '') || (text[first] === '0' && numberEnd - first > 3) || numberEnd - first >= 9;
      const confidence = identifier ? 0.3 : 0.95;
      if (isOrdinal) { add(start, ordEnd, 'ordinal', confidence, 'digit ordinal with checked English suffix', val, candidate !== suffix(val) ? 'bad-ordinal' : undefined, identifier ? weak('digits may belong to an identifier') : undefined); i = ordEnd; }
      else add(start, numberEnd, 'digits', confidence, identifier ? 'digits attached to an identifier or long leading-zero number' : 'digit sequence with optional sign and grouping', val, undefined, identifier ? weak('digits may belong to an identifier') : undefined);
    }
    for (let k = 0; k < tokens.length;) {
      const t = tokens[k];
      if (ORDINAL_WORDS.has(t.word)) { add(t.start, t.end, 'ordinal', 0.9, 'approved ordinal word', ORDINAL_WORDS.get(t.word)); k++; continue; }
      if (t.word === HALF_WORD) { add(t.start, t.end, 'words', 0.6, 'approved half word', 0.5); k++; continue; }
      const parsed = wordsAt(tokens, k);
      if (!parsed) { k++; continue; }
      // A number phrase may join only over spaces or a single hyphen, never punctuation or other words.
      let endIndex = k + 1;
      while (endIndex < parsed.end) {
        const gap = text.slice(tokens[endIndex - 1].end, tokens[endIndex].start);
        if (gap.length === 0 || ![...gap].every(c => isSpace(c) || c === '-')) break;
        endIndex++;
      }
      const valid = endIndex === parsed.end ? parsed : wordsAt(tokens.slice(k, endIndex), 0);
      if (valid) {
        const finish = endIndex === parsed.end ? parsed.end : k + valid.end;
        const v = valid;
        add(t.start, tokens[finish - 1].end, 'words', v.confidence, 'approved cardinal words combined by English counting grammar', v.value, undefined, v.alternatives);
        k = finish;
      } else k++;
    }
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}
