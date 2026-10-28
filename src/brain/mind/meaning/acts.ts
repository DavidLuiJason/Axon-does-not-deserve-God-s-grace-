/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B03A speech acts: decides what one clause is (ask, command, greet, thanks, chat or unknown) and its polarity,
 * from generic English STRUCTURE plus dictionary facts (never phrase lists, FL13):
 * - ask: a question word first, an auxiliary placed before its subject, or a question mark;
 * - command: an imperative, a base-form verb with nothing before it (politeness words and "then" and "now" are
 *   skipped), or a do-support imperative ("do not delete it", "don't convert it");
 * - greet / thanks: the clause begins with a dictionary anchor concept (concepts.ts) or an owner-approved
 *   conversation word, and no auxiliary, question or negation makes it a statement about the word;
 * - chat: a subject with a finite verb (an auxiliary, or a subject pronoun followed by a verb) that is neither ask nor command;
 * - unknown: anything else.
 * Every reading carries a confidence and a reason. The thresholds are the matcher's: a reading below ASK_AT is not
 * offered as the clause's act; it is listed as an alternative when it scores above 0.2.
 */
import { ASK_AT } from '../../matcher';
import type { ActReading, SpeechAct } from '../types';
import { isDoNegation } from './closedSets';
import { strongObjectCue } from './clauses';
import type { Lex } from './lexical';

export interface ClauseReading {
  /** B04C0d-A: the act is 'command' only because the speaker stated a need. */
  need?: true;
  act: SpeechAct;
  polarity: 'positive' | 'negative';
  confidence: number;
  reason: string;
  alternatives: ActReading[];
  /** The clause is one bare verb (a verb, then a coordinator, then another command); build.ts may join it to the next command. */
  loneVerb: boolean;
}

const ALTERNATIVE_FLOOR = 0.2;
/** Equal confidence is decided in this order. */
const PRIORITY: Record<SpeechAct, number> = { ask: 0, command: 1, greet: 2, thanks: 3, chat: 4, unknown: 5 };

const hasVerb = (unit: Lex | undefined): boolean => unit !== undefined && unit.pos.has('v') && !unit.digits;
const round = (value: number): number => Number(value.toFixed(2));

/** A word that may follow a greeting or thanks without turning it into something else (adverbs, names, pronouns). */
function isLightExtra(unit: Lex): boolean {
  if (unit.subject || unit.objectPronoun) return true;
  if (!unit.known && !unit.grammar) return true;
  return unit.pos.has('r') && !unit.pos.has('v');
}

function anchorReading(units: Lex[], hv: number): ActReading | null {
  const head = units[hv];
  if (!head?.anchor) return null;
  if (units.some((unit) => unit.aux || unit.question || unit.neg)) return null;
  const pure = units.every((unit, index) => index <= hv || unit.anchor?.act === head.anchor!.act || isLightExtra(unit) || unit.polite || unit.sequencer);
  const source = head.anchor.source === 'conversation-word' ? 'an owner-listed conversation word' : 'a dictionary meaning';
  const confidence = pure ? (head.anchor.full ? 0.95 : 0.8) : (head.anchor.full ? 0.6 : 0.45);
  const reason = pure
    ? `${head.anchor.act} word "${head.norm}" (${source}) with nothing else that changes it`
    : `${head.anchor.act} word "${head.norm}" (${source}) followed by other words`;
  return { act: head.anchor.act, confidence, reason };
}

interface StructuralFacts { askByStructure: boolean; doSupport: boolean }

export function readClause(units: Lex[], questionMark: boolean): ClauseReading {
  const n = units.length;
  let h = 0;
  while (h < n && (units[h]!.polite || units[h]!.sequencer || units[h]!.coordinator)) h += 1;
  // A leading negation word is skipped too ("never delete it"); its polarity is read separately.
  let hv = h;
  while (hv < n && units[hv]!.neg && !units[hv]!.aux) hv += 1;
  const polarity: 'positive' | 'negative' = units.some((unit) => unit.neg) ? 'negative' : 'positive';
  const unknownReading: ActReading = { act: 'unknown', confidence: 0.5, reason: 'no clear structure: no subject with a verb, no imperative, no question, no greeting or thanks' };
  const head = units[hv];
  if (!head) {
    const only = n === 0 ? 'no words, only punctuation or symbols' : 'only politeness or sequence words';
    return { act: 'unknown', polarity, confidence: 0.5, reason: only, alternatives: [], loneVerb: false };
  }
  const readings: ActReading[] = [];
  const facts: StructuralFacts = { askByStructure: false, doSupport: false };
  const next = units[hv + 1];

  const anchor = anchorReading(units, hv);
  if (anchor) readings.push(anchor);

  // ASK
  if (head.question) {
    facts.askByStructure = true;
    readings.push({ act: 'ask', confidence: questionMark ? 0.96 : 0.92, reason: `question word "${head.norm}" opens the clause${questionMark ? ' and a question mark closes it' : ''}` });
  } else if (head.aux && !head.subject && next) {
    const doForm = head.canCommand;
    const negThen = head.norm === 'do' && next.neg;
    const afterNeg = isDoNegation(head.norm) ? next : negThen ? units[hv + 2] : undefined;
    if (isDoNegation(head.norm) || negThen) {
      if (afterNeg && afterNeg.subject) {
        facts.askByStructure = true;
        readings.push({ act: 'ask', confidence: 0.85, reason: 'negated auxiliary in front of its subject' });
      } else if (afterNeg && hasVerb(afterNeg)) {
        facts.doSupport = true;
        readings.push({ act: 'command', confidence: 0.88, reason: 'do-support imperative: "do not" or "don\'t" followed by a verb' });
      }
    } else if (doForm) {
      if (next.subject) { facts.askByStructure = true; readings.push({ act: 'ask', confidence: 0.9, reason: `"${head.norm}" in front of its subject` }); }
      else if (questionMark) { facts.askByStructure = true; readings.push({ act: 'ask', confidence: 0.88, reason: `"${head.norm}" clause closed by a question mark` }); }
      else readings.push({ act: 'command', confidence: 0.65, reason: `"${head.norm}" used as an imperative verb` });
    } else {
      facts.askByStructure = true;
      const polite = head.modal && next.norm === 'you' && units.slice(hv + 2).some((unit) => hasVerb(unit));
      readings.push({ act: 'ask', confidence: (polite ? 0.85 : 0.88) + (questionMark ? 0.05 : 0), reason: polite ? 'polite request: modal verb, "you", then a verb' : 'auxiliary verb in front of its subject' });
      if (polite) readings.push({ act: 'command', confidence: 0.6, reason: 'a polite request ("can you ...") can be meant as an instruction' });
    }
  }
  if (questionMark && !facts.askByStructure && !facts.doSupport && !readings.some((r) => r.act === 'ask')) {
    readings.push({ act: 'ask', confidence: 0.85, reason: 'a question mark closes the clause' });
  }

  // COMMAND: a base-form verb first
  if (hasVerb(head) && !head.grammar && !head.digits && !facts.askByStructure && !facts.doSupport) {
    const strong = strongObjectCue(head, next);
    const laterAux = units.slice(hv + 1).some((unit) => unit.aux);
    const weak = !strong && next !== undefined && !next.coordinator && !next.aux && !next.neg && !next.question && (next.preposition || next.pos.size > 0 || !next.known);
    if (strong) readings.push({ act: 'command', confidence: 0.88, reason: `verb "${head.norm}" in base form with something to act on` });
    else if (weak && !laterAux) readings.push({ act: 'command', confidence: 0.65, reason: `verb "${head.norm}" first, followed by a word` });
    else if (weak) readings.push({ act: 'command', confidence: 0.25, reason: `"${head.norm}" is a verb, but an auxiliary later makes this look like a statement` });
    else if (next === undefined) readings.push({ act: 'command', confidence: head.pos.size === 1 ? 0.7 : 0.4, reason: head.pos.size === 1 ? `"${head.norm}" is only a verb and stands alone` : `"${head.norm}" is a verb or a noun and stands alone` });
    else readings.push({ act: 'command', confidence: 0.3, reason: `"${head.norm}" could be a verb but nothing follows it to act on` });
  }

  // NEED STATEMENT (B04C0d-A): a first-person subject (with `would` or 'd allowed), a need or want verb in base form
  // ("would like" only with would), and then something wanted that is not an object pronoun. Stated, not ordered: confidence just
  // above chat, and chat stays as the alternative. Resolution decides whether any tool really fits (resolve.ts, rule 13).
  if (polarity === 'positive' && !facts.askByStructure && !facts.doSupport && head.subject && head.speaker) {
    let at = hv + 1;
    let would = head.wouldClitic;
    if (!would && units[at]?.modal && units[at]!.norm === 'would') { would = true; at += 1; }
    const verb = units[at];
    const wanted = units[at + 1];
    const modalBlocks = !would && units[hv + 1]?.modal === true;
    if (verb && wanted && !modalBlocks && !verb.aux && !verb.neg && verb.baseForm && (verb.need || (would && verb.wouldLike)) && !wanted.objectPronoun) {
      readings.push({ act: 'command', confidence: 0.82, reason: `a statement of need: the speaker says "${verb.norm}" and names something wanted`, need: true });
    }
  }

  // CHAT: a subject with a finite verb
  if (!facts.askByStructure && !facts.doSupport) {
    const auxAt = units.findIndex((unit, index) => index >= hv && unit.aux);
    const subjectVerb = units.findIndex((unit, index) => unit.subject && (hasVerb(units[index + 1]) || (units[index + 1]?.neg === true && hasVerb(units[index + 2]))));
    if (auxAt >= 0) readings.push({ act: 'chat', confidence: 0.8, reason: `a subject with a finite verb ("${units[auxAt]!.norm}")` });
    else if (subjectVerb >= 0) readings.push({ act: 'chat', confidence: 0.8, reason: `subject "${units[subjectVerb]!.norm}" followed by a verb` });
  }

  readings.push(unknownReading);
  readings.sort((a, b) => b.confidence - a.confidence || PRIORITY[a.act] - PRIORITY[b.act]);
  let chosen = readings[0]!;
  if (chosen.confidence < ASK_AT) chosen = unknownReading;
  const alternatives = readings
    .filter((reading) => reading !== chosen && reading.act !== chosen.act && reading.act !== 'unknown' && reading.confidence > ALTERNATIVE_FLOOR)
    .map((reading) => ({ act: reading.act, confidence: round(reading.confidence), reason: reading.reason }));
  const loneVerb = hasVerb(head) && !head.grammar && next === undefined && !head.materialAfter && n - h === 1;
  return { act: chosen.act, polarity, confidence: round(chosen.confidence), reason: chosen.reason, alternatives, loneVerb, ...((chosen as ActReading).need === true ? { need: true as const } : {}) };
}
