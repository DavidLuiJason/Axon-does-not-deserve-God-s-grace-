/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B03A clause splitting: finds each instruction-sized piece of a message from the word units (language only)
 * and decides which gaps between words are clause boundaries. Quoted and code material is never read.
 *
 * Boundaries differ on purpose:
 * - sentence punctuation (? ! or a full stop followed by a space) always starts a new clause: a new sentence is a
 *   new clause;
 * - a comma, semicolon, colon or line break, a coordinating conjunction (and, or, but) or a sequencer (then, now)
 *   starts a new clause ONLY when the words after it really begin one (a question word, an auxiliary in front of
 *   its subject, a subject with a verb, a greeting or thanks, or a verb with something to act on).
 *   "salt and pepper" and "5 miles and 3 feet" are therefore not boundaries;
 * - a greeting or thanks that is followed by words that begin a clause is its own clause even without punctuation.
 */
import type { Lex } from './lexical';

export interface UnitRange { from: number; to: number }

/** What the characters between two units contain, with quoted and code material already removed. */
export type Gap = 'none' | 'weak' | 'strong';

/** Classifies the language text between two units. Decimal points and dots inside words are not punctuation. */
export function classifyGap(text: string): Gap {
  let weak = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch === '?' || ch === '!') return 'strong';
    if (ch === '.') {
      const after = text[i + 1];
      if (after === undefined || after === ' ' || after === '\n' || after === '\t' || after === '\r') return 'strong';
      continue;
    }
    if (ch === ',' || ch === ';' || ch === ':' || ch === '\n' || ch === '\u2014' || ch === '\u2013') weak = true;
  }
  return weak ? 'weak' : 'none';
}

function isLead(unit: Lex): boolean { return unit.coordinator || unit.sequencer || unit.polite; }

function hasVerb(unit: Lex): boolean { return unit.pos.has('v') && !unit.digits; }

/** Something the verb right before it could clearly act on. */
export function strongObjectCue(verb: Lex, next: Lex | undefined): boolean {
  if (verb.materialAfter) return true;
  if (!next) return false;
  return next.determiner || next.objectPronoun || next.possessive || next.digits;
}

/** True when the words from position j on begin a clause of their own. */
export function startsClause(units: Lex[], j: number): boolean {
  let k = j;
  while (k < units.length && isLead(units[k]!)) k += 1;
  const unit = units[k];
  if (!unit) return false;
  const next = units[k + 1];
  if (unit.question) return true;
  if (unit.anchor && unit.anchor.full && !unit.neg) return true;
  if (unit.aux && next !== undefined) return true;
  if (unit.subject && next !== undefined && (next.aux || next.neg || hasVerb(next))) return true;
  if (unit.neg && !unit.aux && next !== undefined && hasVerb(next) && strongObjectCue(next, units[k + 2])) return true;
  if (hasVerb(unit) && !unit.grammar && strongObjectCue(unit, next)) return true;
  return false;
}

/** The clause ranges (over unit indices) of one message. `gapBefore(k)` is the classified gap between unit k-1 and k. */
export function splitClauses(units: Lex[], gapBefore: (k: number) => Gap): UnitRange[] {
  const ranges: UnitRange[] = [];
  let from = 0;
  const hasContent = (a: number, b: number): boolean => { for (let k = a; k < b; k += 1) if (!isLead(units[k]!)) return true; return false; };
  for (let k = 1; k < units.length; k += 1) {
    const gap = gapBefore(k);
    const unit = units[k]!;
    if (!hasContent(from, k)) continue;
    if (gap === 'strong') { ranges.push({ from, to: k }); from = k; continue; }
    if (isLead(unit) && unit.index === k) {
      let after = k;
      while (after < units.length && isLead(units[after]!)) after += 1;
      if (unit.coordinator || unit.sequencer) {
        if (startsClause(units, after)) { ranges.push({ from, to: k }); from = k; }
        continue;
      }
    }
    if (gap === 'weak' && startsClause(units, k)) { ranges.push({ from, to: k }); from = k; continue; }
    // A greeting or thanks at the start of a clause, followed by words that begin another clause.
    const head = units[from]!;
    if (k === from + 1 && head.anchor && head.anchor.full && startsClause(units, k)) { ranges.push({ from, to: k }); from = k; continue; }
  }
  ranges.push({ from, to: units.length });
  return ranges.filter((range) => range.to > range.from);
}
