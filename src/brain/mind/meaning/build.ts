/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B03A: builds the Meaning of a message from the Reading and Analysis stages.
 * Pure: no storage, no network, no clock. Execution still goes through the legacy handlers (B4 retires them).
 */
import type { Analysis, Clause, ClauseFrame, Meaning } from '../types';
import { readClause } from './acts';
import { classifyGap, splitClauses, type UnitRange } from './clauses';
import { buildLex, materialRanges, type Lex, type MaterialRange } from './lexical';
import { readLanguage } from './languageCheck';
import { readTeaching } from './teach/readTeaching';
import { buildStructure } from './structure/glue';
import type { MeaningStructure } from './structure/glueTypes';

export const MEANING_LIMITS = { maxTokens: 2000, maxClauses: 64 } as const;

export type MeaningOutcome =
  | { ok: true; meaning: Meaning }
  | { ok: false; error: 'too-long' | 'invalid-input'; message: string };

/** The language text between two positions with every material region removed. */
function languageBetween(text: string, from: number, to: number, materials: MaterialRange[]): string {
  if (to <= from) return '';
  let out = '';
  let cursor = from;
  for (const material of materials) {
    if (material.end <= cursor) continue;
    if (material.start >= to) break;
    if (material.start > cursor) out += text.slice(cursor, material.start);
    cursor = Math.max(cursor, material.end);
  }
  if (cursor < to) out += text.slice(cursor, to);
  return out;
}

function trimEnd(text: string, start: number, end: number): number {
  let e = end;
  while (e > start && text.slice(e - 1, e).trim() === '') e -= 1;
  return e;
}

export function buildMeaning(analysis: Analysis, text: string): MeaningOutcome {
  if (!analysis || !Array.isArray(analysis.segments) || !Array.isArray(analysis.tokens) || typeof text !== 'string') {
    return { ok: false, error: 'invalid-input', message: 'The Meaning stage needs the message text and its analysis.' };
  }
  if (analysis.tokens.length > MEANING_LIMITS.maxTokens) {
    return { ok: false, error: 'too-long', message: `The message has more than ${MEANING_LIMITS.maxTokens} words; it is not read for meaning.` };
  }
  const materials = materialRanges(analysis);
  const units = buildLex(analysis, text);
  const gapText = (k: number): string => languageBetween(text, units[k - 1]!.end, units[k]!.start, materials);
  const languageText = analysis.segments.filter((segment) => segment.kind === 'language').map((segment) => segment.text).join('');
  const hasLanguage = languageText.trim().length > 0;

  let ranges: UnitRange[] = [];
  if (units.length > 0) ranges = splitClauses(units, (k) => classifyGap(gapText(k)));
  if (ranges.length > MEANING_LIMITS.maxClauses) {
    return { ok: false, error: 'too-long', message: `The message has more than ${MEANING_LIMITS.maxClauses} instructions; it is not read for meaning.` };
  }

  const frames: ClauseFrame[] = [];
  const starts: number[] = [];
  const lone: boolean[] = [];
  if (units.length === 0) {
    if (hasLanguage) {
      const first = analysis.segments.find((segment) => segment.kind === 'language' && segment.text.trim().length > 0)!;
      const start = first.start + (first.text.length - first.text.trimStart().length);
      const lastLanguage = [...analysis.segments].reverse().find((segment) => segment.kind === 'language' && segment.text.trim().length > 0)!;
      const end = lastLanguage.start + lastLanguage.text.trimEnd().length;
      const reading = readClause([], languageText.includes('?'));
      const clause: Clause = { span: { start, end }, tokenRange: { from: 0, to: 0 }, materialIds: [] };
      frames.push({ clause, act: reading.act, polarity: reading.polarity, confidence: reading.confidence, reason: reading.reason, alternatives: reading.alternatives });
      starts.push(start);
      lone.push(false);
    }
  } else {
    ranges.forEach((range, index) => {
      const slice: Lex[] = units.slice(range.from, range.to);
      const startChar = slice[0]!.start;
      const nextStart = index + 1 < ranges.length ? units[ranges[index + 1]!.from]!.start : text.length;
      const lastEnd = slice[slice.length - 1]!.end;
      let marks = languageBetween(text, lastEnd, nextStart, materials);
      for (let k = range.from + 1; k < range.to; k += 1) marks += gapText(k);
      const reading = readClause(slice, marks.includes('?'));
      const clause: Clause = {
        span: { start: startChar, end: trimEnd(text, startChar, nextStart) },
        tokenRange: { from: slice[0]!.first, to: slice[slice.length - 1]!.last + 1 },
        materialIds: [],
      };
      frames.push({ clause, act: reading.act, polarity: reading.polarity, confidence: reading.confidence, reason: reading.reason, alternatives: reading.alternatives });
      starts.push(startChar);
      lone.push(reading.loneVerb);
    });
    // Coordinated verbs share the object that follows (a verb, a coordinator, then another command): a bare verb that was not
    // understood on its own, directly followed by a command, is a command too.
    for (let c = 0; c + 1 < frames.length; c += 1) {
      const frame = frames[c]!;
      if (lone[c] && frame.act === 'unknown' && frames[c + 1]!.act === 'command') {
        frame.act = 'command';
        frame.confidence = 0.7;
        frame.reason = 'a bare verb joined to the next command, which supplies what it acts on';
        frame.alternatives = [];
      }
    }
  }

  // Material goes to the NEAREST EARLIER clause that has an instruction and no material yet, otherwise to the
  // nearest earlier clause; material in front of the first clause goes to the first clause.
  if (frames.length > 0) {
    analysis.segments.forEach((segment, segmentIndex) => {
      if (segment.kind !== 'material') return;
      let nearest = 0;
      for (let c = 0; c < frames.length; c += 1) if (starts[c]! <= segment.start) nearest = c;
      let target = nearest;
      for (let c = nearest; c >= 0; c -= 1) {
        const frame = frames[c]!;
        if ((frame.act === 'ask' || frame.act === 'command') && frame.clause.materialIds.length === 0) { target = c; break; }
      }
      frames[target]!.clause.materialIds.push(segmentIndex);
    });
  }
  const onlyMaterial = frames.length === 0 && materials.length > 0;
  // B03B2 glue: the finer structure (links, parts, pointers, relays). Added beside the clauses; no clause field is changed.
  let structure: MeaningStructure | undefined;
  if (units.length > 0) {
    try {
      const asks = ranges.map((range, index) => {
        const slice = units.slice(range.from, range.to);
        const nextStart = index + 1 < ranges.length ? units[ranges[index + 1]!.from]!.start : text.length;
        let marks = languageBetween(text, slice[slice.length - 1]!.end, nextStart, materials);
        for (let k = range.from + 1; k < range.to; k += 1) marks += gapText(k);
        return marks.includes('?');
      });
      structure = buildStructure(units, ranges, (k) => classifyGap(gapText(k)), asks);
    } catch { structure = undefined; }
  }
  // B03B3a: does the message read as English (a reading only; nothing answers with it yet).
  const language = readLanguage(analysis);
  // B03B3b: teach and correct acts ("x means y", "no, I meant z"): a reading only; nothing learns or saves from it yet.
  const teaching = readTeaching(units, structure, materials, text);
  return { ok: true, meaning: { clauses: frames, onlyMaterial, ...(structure ? { structure } : {}), language, teaching } };
}
