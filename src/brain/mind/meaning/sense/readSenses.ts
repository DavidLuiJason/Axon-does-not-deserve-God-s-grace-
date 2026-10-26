/**
 * B03B4 SENSE BY CONTEXT. When a word has several dictionary senses, the words around it vote: each sense's gloss, synonyms and example are
 * compared with the neighbouring words (and, at half weight, with the gloss of the neighbours' own first sense, so "river" helps "bank" through
 * "water"). A small grammar cue (after "the" a noun, after "I" or "will" a verb) and a tiny prior for the dictionary's own order break ties.
 * The senses stay RANKED with the evidence; when the context does not decide, `best` is null. No word lists: only the dictionary's own text,
 * the closed grammar sets, and suffix handling. Pure: no storage, no network, no clock.
 */
import type { Lex } from '../lexical';
import { posLetter } from '../lexical';
import type { Token } from '../../types';
import { isAuxiliary, isCoordinator, isDeterminer, isModal, isNegation, isObjectPronoun, isPoliteness, isPossessive, isPreposition, isQuestionWord, isSequencer, isSubjectPronoun } from '../closedSets';
import type { SenseChoice, SenseReading } from './senseTypes';

export const SENSE_LIMITS = { window: 6, maxWords: 64, maxChoices: 4 } as const;
const DECIDE_GAP = 0.6;
const DECIDE_MIN = 1;

const isLetter = (ch: string): boolean => ch.toLowerCase() !== ch.toUpperCase();
const grammarWord = (w: string): boolean => isDeterminer(w) || isPreposition(w) || isAuxiliary(w) || isModal(w) || isNegation(w) || isSubjectPronoun(w) || isObjectPronoun(w)
  || isPossessive(w) || isQuestionWord(w) || isCoordinator(w) || isPoliteness(w) || isSequencer(w);

/** Splits text into lowercase letter runs. */
function wordsOf(text: string): string[] {
  const out: string[] = []; let cur = '';
  for (const ch of text) { if (isLetter(ch)) cur += ch.toLowerCase(); else if (cur) { out.push(cur); cur = ''; } }
  if (cur) out.push(cur);
  return out;
}
/** A light stem (suffix handling only, not vocabulary): "deposits" and "deposited" and "depositing" meet at "deposit". */
export function stemOf(word: string): string {
  let w = word;
  const cut = (suffix: string, min: number): boolean => { if (w.length - suffix.length >= min && w.endsWith(suffix)) { w = w.slice(0, w.length - suffix.length); return true; } return false; };
  if (cut('ing', 4) || cut('ied', 3) || cut('ed', 4) || cut('ies', 3) || cut('es', 4) || cut('ly', 4) || cut('s', 4)) { /* one suffix only */ }
  if (w.length > 4 && w[w.length - 1] === w[w.length - 2] && !'aeiou'.includes(w[w.length - 1]!)) w = w.slice(0, -1);
  return w;
}
/** The content stems of a text: no grammar words, nothing shorter than three letters. */
function stemsOf(text: string): string[] {
  const out: string[] = [];
  for (const w of wordsOf(text)) { if (w.length < 3 || grammarWord(w)) continue; out.push(stemOf(w)); }
  return out;
}

interface Evidence { synset: string; pos: string; gloss: string; stems: Set<string>; rank: number }

function evidenceOf(token: Token, ownStem: string): Evidence[] {
  const hints = token.senseHints ?? [];
  return hints.map((hint, rank) => {
    const stems = new Set<string>();
    for (const s of stemsOf(hint.gloss)) stems.add(s);
    for (const syn of hint.synonyms ?? []) for (const s of stemsOf(syn)) stems.add(s);
    if (hint.example) for (const s of stemsOf(hint.example)) stems.add(s);
    stems.delete(ownStem);
    return { synset: hint.synset, pos: posLetter(hint.pos) ?? '', gloss: hint.gloss, stems, rank };
  });
}

export function readSenses(units: readonly Lex[], tokens: readonly Token[]): SenseReading[] {
  const out: SenseReading[] = [];
  try {
    // Context material per unit: its own stem (weight 1) and the stems of its first sense's gloss (weight 0.5).
    const own = units.map((u) => { const w = wordsOf(u.norm); return u.grammar || w.length === 0 || (w.length === 1 && w[0]!.length < 3) ? [] : w.map(stemOf); });
    const expand = units.map((u) => { const t = tokens[u.first]; const g = t?.senseHints?.[0]?.gloss; return g && !u.grammar ? stemsOf(g) : []; });
    for (let k = 0; k < units.length && out.length < SENSE_LIMITS.maxWords; k += 1) {
      const unit = units[k]!; const token = tokens[unit.first];
      if (!token?.senseHints || token.senseHints.length < 2 || unit.grammar || unit.digits) continue;
      const ownStem = stemOf(wordsOf(unit.norm).join(' ').split(' ')[0] ?? unit.norm);
      const evidence = evidenceOf(token, ownStem);
      const direct = new Map<string, number>(); // context stem -> weight
      for (let j = Math.max(0, k - SENSE_LIMITS.window); j <= Math.min(units.length - 1, k + SENSE_LIMITS.window); j += 1) {
        if (j === k) continue;
        for (const s of own[j]!) if (s !== ownStem) direct.set(s, Math.max(direct.get(s) ?? 0, 1));
        for (const s of expand[j]!) if (s !== ownStem && !direct.has(s)) direct.set(s, 0.5);
      }
      // A stem found in many of this word's senses says little: weight it by how few senses share it.
      const spread = new Map<string, number>();
      for (const e of evidence) for (const s of e.stems) spread.set(s, (spread.get(s) ?? 0) + 1);
      const prev = k > 0 ? units[k - 1]! : null;
      const cue = prev && (prev.determiner || prev.possessive) ? 'n' : prev && (prev.modal || prev.subject || prev.neg || prev.preposition && prev.norm === 'to') ? 'v' : '';
      const choices: SenseChoice[] = evidence.map((e) => {
        let score = 0; const hits: string[] = [];
        for (const [s, w] of direct) if (e.stems.has(s)) { score += w / (spread.get(s) ?? 1); hits.push(s); }
        if (cue && e.pos === cue) score += 0.5;
        score += 0.3 / (1 + e.rank);
        return { synset: e.synset, gloss: e.gloss, score: Math.round(score * 1000) / 1000, evidence: hits.slice(0, 6) };
      }).sort((a, b) => b.score - a.score || 0);
      const top = choices[0]!; const second = choices[1]!;
      const gap = top.score - second.score;
      const decided = top.evidence.length > 0 && top.score >= DECIDE_MIN && gap >= DECIDE_GAP;
      const confidence = Math.max(0, Math.min(1, Math.round((gap / (top.score + 0.5)) * 100) / 100));
      const reason = decided ? `the words around share ${top.evidence.join(', ')} with this sense`
        : top.evidence.length === 0 ? 'no word around helps; the dictionary order is the only hint' : 'the words around fit more than one sense about equally';
      out.push({ start: unit.start, end: unit.end, norm: unit.norm, choices: choices.slice(0, SENSE_LIMITS.maxChoices), best: decided ? top.synset : null, confidence, decided, reason });
    }
  } catch { return []; }
  return out;
}
