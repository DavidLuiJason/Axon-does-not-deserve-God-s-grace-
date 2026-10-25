/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B03B3b TEACH and CORRECT (written by the Director, 2026-10-25). Reads, per piece of the message, whether the speaker
 *   - TEACHES a word or phrase: "serendipity means a happy accident", "lunch run means go and buy food", "'lol' signifies laughing out loud", or
 *   - CORRECTS what was understood: "no, I meant kilometres", "I meant 10 not 5".
 * No word list decides this. The dictionary decides (synset ids in teachSenses.ts: which verbs give the meaning of a word, which mean
 * "intend to express"); the grammar around the verb makes the final choice (the speaker as subject = a correction; anything else with a
 * term before it and a meaning after it = a lesson). It is a READING: it learns, saves and changes nothing; a taught pair is saved only by
 * a later job after the owner's yes. Pure: no storage, no network, no clock. Never throws.
 */
import type { Lex, MaterialRange } from '../lexical';
import type { MeaningStructure, StructurePiece } from '../structure/glueTypes';
import { LINK_WORDS } from '../structure/linkWords';
import { QUOTE_CLOSE, QUOTE_OPEN } from './teachSenses';
import type { CorrectAct, TeachAct, TeachDoubt, TeachSpan, TeachingReading } from './teachTypes';
import { TEACH_WORDS } from './teachWords';

function words(units: readonly Lex[], text: string, from: number, to: number): TeachSpan | null {
  if (to <= from || from < 0 || to > units.length) return null;
  const start = units[from]!.start; const end = units[to - 1]!.end;
  const value = text.slice(start, end).trim();
  return value.length === 0 ? null : { start, end, text: value, quoted: false };
}

/** A quoted or code region as a span, without the quote marks around it. */
function quoted(material: MaterialRange, text: string): TeachSpan | null {
  let start = material.start; let end = material.end;
  for (let k = 0; k < 3 && end - start >= 2 && QUOTE_OPEN.includes(text.charAt(start)) && QUOTE_CLOSE.includes(text.charAt(end - 1)); k += 1) { start += 1; end -= 1; }
  const value = text.slice(start, end).trim();
  return value.length === 0 ? null : { start, end, text: value, quoted: true };
}

/** The last material region that lies completely inside [from, to). */
function materialBefore(materials: readonly MaterialRange[], from: number, to: number): MaterialRange | null {
  let found: MaterialRange | null = null;
  for (const m of materials) if (m.start >= from && m.end <= to) found = m;
  return found;
}
/** The first material region that lies completely inside [from, to). */
function materialAfter(materials: readonly MaterialRange[], from: number, to: number): MaterialRange | null {
  for (const m of materials) if (m.start >= from && m.end <= to) return m;
  return null;
}

const standsAlone = (unit: Lex): boolean => unit.grammar || unit.subject;
/** The closed link words (if, because, when ...) of B03B2a: they open a piece but are not part of what is taught. */
const LINK_SET = new Set(Object.values(LINK_WORDS).join(' ').split(' '));
const DOUBT_REASON: Readonly<Record<TeachDoubt, string>> = {
  consequence: 'the dictionary lists this verb as giving the meaning of a word, but what follows reads like a consequence, so it may not be a lesson',
  importance: 'the dictionary lists this verb as giving the meaning of a word, but "means ... to me" usually says how much something matters, so it may not be a lesson',
  purpose: 'the speaker says what they meant, but "meant to" may only state an intention, not a replacement',
  filler: 'the speaker says "I mean" but a whole statement follows, which is how people pause while talking, so it may not be a correction',
};

function readTeach(units: readonly Lex[], piece: StructurePiece, pieceIndex: number, next: StructurePiece | undefined, t: number, v: number, negated: boolean, materials: readonly MaterialRange[], text: string): TeachAct | null {
  // Where the term starts. A command or "I think" in front ("remember that lunch run means ...") is the LEAD, not part of the term.
  let lead: TeachSpan | null = null;
  // "if", "because", "and", "then" at the start of the piece are not part of the term.
  let base = piece.from;
  while (base < t && (LINK_SET.has(units[base]!.norm) || units[base]!.coordinator || units[base]!.sequencer)) base += 1;
  let termFrom = base;
  const main = piece.parts.verb;
  if (main !== null && main >= base && main < t && (main === base || (main === base + 1 && units[base]!.subject))) {
    if (units[main]!.speech) return null;               // "tell Tom that x means y" reports words to someone else; it is not a lesson for AXON
    let from = main + 1;
    const reported = units[from]?.norm === TEACH_WORDS.complementizer && from < t;
    if (reported) from += 1;
    // Without "that", a lead is taken only when it cannot be the first word of the term: "I think ...", or a word the dictionary lists only as a verb ("remember ..."); "lunch run means ..." keeps "lunch".
    const certain = reported || units[base]!.subject || !units[main]!.pos.has('n');
    const hasWords = from < t;
    const hasMaterial = units[t]!.materialBefore && materialBefore(materials, units[main]!.end, units[t]!.start) !== null;
    if (certain && (hasWords || hasMaterial)) { termFrom = from; lead = words(units, text, piece.from, from); }
  }
  if (lead === null && base > piece.from) lead = words(units, text, piece.from, base);
  // A question ("what does x mean", "does x mean y") is asked, not taught.
  if (units[termFrom] !== undefined && termFrom < t && (units[termFrom]!.aux || units[termFrom]!.question)) return null;
  for (let k = termFrom; k < t; k += 1) if (units[k]!.question) return null;

  const quotedTerm = units[t]!.materialBefore ? materialBefore(materials, t > 0 ? units[t - 1]!.end : 0, units[t]!.start) : null;
  let term: TeachSpan | null = quotedTerm ? quoted(quotedTerm, text) : null;
  let termKnown: boolean | null = null;
  if (term === null) {
    term = words(units, text, termFrom, t);
    if (term === null) return null;
    if (t - termFrom === 1) {
      if (standsAlone(units[termFrom]!)) return null;    // "it means", "this means", "they mean": a statement about something said before, not a lesson
      termKnown = units[termFrom]!.known;
    }
  }

  const upper = v + 1 < units.length ? units[v + 1]!.start : text.length;
  const quotedMeaning = units[v]!.materialAfter ? materialAfter(materials, units[v]!.end, upper) : null;
  let meaning: TeachSpan | null = quotedMeaning ? quoted(quotedMeaning, text) : null;
  let doubt: TeachDoubt | null = null;
  if (meaning === null) {
    meaning = words(units, text, v + 1, piece.to);
    if (meaning === null) return null;
    const first = units[v + 1]!;
    if (first.subject || first.norm === TEACH_WORDS.complementizer) doubt = 'consequence';   // "x means that we must stop": a consequence, not a definition
    else if (piece.to - (v + 1) >= 2 && units[piece.to - 2]!.norm === TEACH_WORDS.infinitive && units[piece.to - 1]!.objectPronoun) doubt = 'importance';   // "x means a lot to me"
  }
  const verb = words(units, text, v, v + 1)!;
  const nextStarts = next !== undefined && next.from === piece.to && (units[next.from]!.coordinator || units[next.from]!.sequencer);
  const bothQuoted = term.quoted && meaning.quoted;
  return {
    kind: 'teach', piece: pieceIndex, clause: piece.clause, verb, negated, standalone: piece.mayRunAlone,
    confidence: doubt ? 0.35 : bothQuoted ? 0.95 : 0.9, doubt, term, meaning, termKnown, mayContinue: nextStarts, lead,
    reason: doubt ? DOUBT_REASON[doubt] : 'a verb that gives the meaning of a word, with a word or phrase before it and its meaning after it',
  };
}

function readCorrect(units: readonly Lex[], piece: StructurePiece, pieceIndex: number, v: number, negated: boolean, materials: readonly MaterialRange[], text: string): CorrectAct | null {
  let j = v + 1;
  let doubt: TeachDoubt | null = null;
  if (j < piece.to && units[j]!.aux) j += 1;                                                                    // "what I meant WAS kilometres"
  else if (j + 1 < piece.to && units[j]!.norm === TEACH_WORDS.infinitive && units[j + 1]!.pos.has('v')) {       // "I meant to SAY kilometres" (say, tell...) or "I meant to call" (a purpose)
    doubt = units[j + 1]!.speech ? null : 'purpose';
    j += 2;
  }
  const upper = j < units.length ? units[j]!.start : text.length;
  const quotedValue = materialAfter(materials, units[j - 1]!.end, upper);
  let neg = -1;
  for (let k = j; k < piece.to; k += 1) if (units[k]!.neg) { neg = k; break; }
  let replacement: TeachSpan | null = null;
  let rejected: TeachSpan | null = null;
  if (quotedValue) replacement = quoted(quotedValue, text);
  else if (negated) rejected = words(units, text, j, piece.to);
  else if (neg === -1) replacement = words(units, text, j, piece.to);
  else { replacement = words(units, text, j, neg); rejected = words(units, text, neg + 1, piece.to); }
  if (negated && quotedValue) { rejected = replacement; replacement = null; }
  if (replacement === null && rejected === null) return null;
  if (replacement !== null && !replacement.quoted && piece.to - j === 1 && standsAlone(units[j]!)) return null;  // "I mean it": says nothing to replace
  if (doubt === null && replacement !== null && !replacement.quoted && units[j]!.subject) doubt = 'filler';   // "I mean we should go": a pause in speech, not a correction
  const verb = words(units, text, v, v + 1)!;
  return {
    kind: 'correct', piece: pieceIndex, clause: piece.clause, verb, negated, standalone: piece.mayRunAlone,
    confidence: doubt ? 0.35 : negated ? 0.8 : 0.85, doubt, replacement, rejected, needsPrevious: true,
    reason: doubt ? DOUBT_REASON[doubt] : 'the speaker is the subject of a verb that means "intend to express", followed by what was meant',
  };
}

/** Reads teach and correct acts. One reading per piece at most. `units` are the word units of the message, `materials` its quoted and code regions. */
export function readTeaching(units: readonly Lex[], structure: MeaningStructure | undefined, materials: readonly MaterialRange[], text: string): TeachingReading[] {
  const out: TeachingReading[] = [];
  if (!structure || units.length === 0) return out;
  try {
    structure.pieces.forEach((piece, pieceIndex) => {
      for (let v = piece.from; v < piece.to; v += 1) {
        const unit = units[v];
        if (!unit || (!unit.meaning && !unit.intend)) continue;
        // Step back over "does", "did", "not", "n't" right before the verb: "does not mean", "I didn't mean".
        let t = v; let negated = false;
        while (t > piece.from && (units[t - 1]!.aux || units[t - 1]!.neg)) { t -= 1; if (units[t]!.neg) negated = true; }
        const before = t > piece.from ? units[t - 1] : undefined;
        const speaker = before !== undefined && before.subject && before.speaker;
        const reading = speaker
          ? (unit.intend ? readCorrect(units, piece, pieceIndex, v, negated, materials, text) : null)
          : (unit.meaning ? readTeach(units, piece, pieceIndex, structure.pieces[pieceIndex + 1], t, v, negated, materials, text) : null);
        if (reading) { out.push(reading); break; }
      }
    });
  } catch { return []; }
  return out;
}
