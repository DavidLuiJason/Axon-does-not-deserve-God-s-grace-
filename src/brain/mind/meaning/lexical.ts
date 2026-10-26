/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B03A word profiles. Turns Analysis tokens into "units" (one per word, or one per dictionary phrase such as
 * "good morning" or "rock and roll") and gives each unit the facts the clause and act rules need: parts of speech
 * from the dictionary, closed-class grammar flags, anchor concept, and whether quoted or code material sits right
 * before or after it. Pure: no storage, no network, no clock.
 */
import { conversationActOf } from '../../knowledge/conversationWords';
import type { Analysis } from '../types';
import { anchorOfIds, type AnchorAct } from './concepts';
import { hasSpeechSense } from './structure/speechSenses';
import { hasIntendSense, hasTeachSense } from './teach/teachSenses';
import { isFirstPerson } from './structure/glueWords';
import { toneSenseFlags } from './tone/toneSenses';
import { isAboutAxon } from './tone/toneGlue';
import {
  isAuxiliary, isCoordinator, isDeterminer, isModal, isNegation, isNegativeClitic, isObjectPronoun, isPoliteness,
  isPossessive, isPreposition, isQuestionWord, isSequencer, isSubjectPronoun, normalizeWord, splitClitic,
} from './closedSets';

export interface Lex {
  /** Position in the unit list. */
  index: number;
  /** Index range over Analysis.tokens: [first, last] inclusive. */
  first: number;
  last: number;
  /** Character range in the message. */
  start: number;
  end: number;
  norm: string;
  /** Dictionary parts of speech reduced to n, v, a (adjective), r (adverb). */
  pos: ReadonlySet<string>;
  known: boolean;
  digits: boolean;
  question: boolean;
  /** Plain auxiliary or modal verb (including a contracted one such as "it's" or "they'll"). */
  aux: boolean;
  modal: boolean;
  canCommand: boolean;
  /** A negation word or a negative contraction. */
  neg: boolean;
  subject: boolean;
  objectPronoun: boolean;
  possessive: boolean;
  determiner: boolean;
  preposition: boolean;
  coordinator: boolean;
  polite: boolean;
  sequencer: boolean;
  /** B03B2c: one of the word's senses is telling, asking or instructing someone (from the dictionary's synset ids). */
  speech: boolean;
  /** B03B2c: first person (the speaker): closed set in structure/glueWords.ts. */
  speaker: boolean;
  /** B03B3b: one of its senses is "has the meaning of" (teach) / "intend to express" (correct), from the dictionary's synset ids. */
  meaning: boolean;
  intend: boolean;
  /** B03B3c glue: tone word facts from the dictionary's synset ids (tone/toneSenses.ts): urgency 0 to 2, anger 0 to 2, curse or insult. */
  urgent: 0 | 1 | 2;
  anger: 0 | 1 | 2;
  harsh: boolean;
  /** The word is second person or the product's name (closed set in tone/toneGlue.ts). */
  addressee: boolean;
  /** Any closed-class grammar word. */
  grammar: boolean;
  anchor: { act: AnchorAct; full: boolean; source: 'dictionary' | 'conversation-word' } | null;
  /** Quoted or code material starts between this unit and the next one (or the end of the message). */
  materialAfter: boolean;
  /** Quoted or code material ends between the previous unit (or the start) and this unit. */
  materialBefore: boolean;
}

export function posLetter(value: string): string | null {
  const v = value.toLowerCase();
  if (v.startsWith('adv') || v === 'r') return 'r';
  if (v.startsWith('adj') || v === 'a' || v === 's') return 'a';
  if (v.startsWith('n')) return 'n';
  if (v.startsWith('v')) return 'v';
  return null;
}

function isDigits(word: string): boolean {
  if (word.length === 0) return false;
  for (const ch of word) if (ch < '0' || ch > '9') return false;
  return true;
}

export interface MaterialRange { start: number; end: number; index: number }

export function materialRanges(analysis: Analysis): MaterialRange[] {
  const out: MaterialRange[] = [];
  analysis.segments.forEach((segment, index) => { if (segment.kind === 'material') out.push({ start: segment.start, end: segment.end, index }); });
  return out;
}

export function buildLex(analysis: Analysis, text: string): Lex[] {
  const tokens = analysis.tokens;
  const materials = materialRanges(analysis);
  const units: Lex[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    let last = i;
    let start = token.start;
    let end = token.end;
    if (token.entry) {
      start = token.entry.start;
      end = token.entry.end;
      while (last + 1 < tokens.length && tokens[last + 1]!.start < end) last += 1;
    }
    const surface = token.entry ? text.slice(start, end) : token.surface;
    const norm = normalizeWord(surface);
    const clitic = splitClitic(norm);
    const pos = new Set<string>();
    for (const value of token.partsOfSpeech ?? []) { const letter = posLetter(value); if (letter) pos.add(letter); }
    const word = clitic ? clitic.stem : norm;
    const negClitic = isNegativeClitic(norm);
    const aux = isAuxiliary(norm) || clitic !== null || negClitic;
    const fromDictionary = anchorOfIds(token.synsetIds);
    const conversation = fromDictionary ? null : conversationActOf(norm);
    const anchor: Lex['anchor'] = fromDictionary
      ? { ...fromDictionary, source: 'dictionary' }
      : conversation ? { act: conversation, full: true, source: 'conversation-word' } : null;
    const tone = toneSenseFlags(token.synsetIds, last > i);
    const unit: Lex = {
      index: units.length, first: i, last, start, end, norm, pos,
      known: token.knowledge === 'known' || Boolean(token.entry),
      digits: isDigits(norm),
      question: isQuestionWord(word),
      aux,
      modal: isModal(norm) || (clitic !== null && (clitic.ending === 'll' || clitic.ending === 'd')),
      canCommand: !negClitic && (norm === 'do' || norm === 'have' || norm === 'be'),
      neg: isNegation(norm) || negClitic,
      subject: isSubjectPronoun(word),
      objectPronoun: isObjectPronoun(norm),
      possessive: isPossessive(norm),
      determiner: isDeterminer(norm),
      preposition: isPreposition(norm),
      coordinator: isCoordinator(norm),
      polite: isPoliteness(norm),
      sequencer: isSequencer(norm),
      speech: hasSpeechSense(token.synsetIds),
      speaker: isFirstPerson(word),
      meaning: hasTeachSense(token.synsetIds),
      intend: hasIntendSense(token.synsetIds),
      urgent: tone.urgent,
      anger: tone.anger,
      harsh: tone.harsh,
      addressee: isAboutAxon(word),
      grammar: false,
      anchor,
      materialAfter: false,
      materialBefore: false,
    };
    unit.grammar = unit.question || unit.aux || unit.subject || unit.objectPronoun || unit.possessive || unit.determiner
      || unit.preposition || unit.coordinator || unit.neg || unit.polite || unit.sequencer;
    units.push(unit);
    i = last + 1;
  }
  for (let k = 0; k < units.length; k += 1) {
    const unit = units[k]!;
    const nextStart = k + 1 < units.length ? units[k + 1]!.start : text.length;
    const previousEnd = k > 0 ? units[k - 1]!.end : 0;
    unit.materialAfter = materials.some((m) => m.start >= unit.end && m.end <= nextStart);
    unit.materialBefore = materials.some((m) => m.start >= previousEnd && m.end <= unit.start);
  }
  return units;
}
