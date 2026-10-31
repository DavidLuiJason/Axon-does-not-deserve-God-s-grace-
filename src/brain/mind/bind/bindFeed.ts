/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BIND-FEED (BF1): turns what the real stages already produce (Meaning structure, segments, values, Resolution matches) into the
 * `BindInput` of `bindArguments`. Pure. It runs no tool (FL12), knows no tool (FL13): names and choices are injected (FL14).
 * One item per Resolution result that is a `match` of a piece that may run alone; every other result yields nothing (the dialogue stage
 * handles ask, none, unavailable, negated, not-a-request; a conditional piece never runs alone).
 * A Detail's `from` is the MARKER word itself (`clauseParts.ts`), so the detail text starts one word later.
 */
import type { BindInput, BindSpan, BindValue, BindWord } from './argumentBinder';
import type { MeaningStructure } from '../meaning/structure/glueTypes';
import type { PieceResolution } from '../resolve/clauseInputsTypes';
import { REF_WORDS } from '../meaning/structure/refWords';

const ONE_WORDS = new Set(REF_WORDS.one.split(' '));

export interface FeedSegment { readonly kind: 'language' | 'material'; readonly start: number; readonly end: number }
export interface FeedValue {
  readonly kind: string; readonly start: number; readonly end: number; readonly confidence: number;
  readonly value?: number; readonly unit?: string; readonly ms?: number; readonly date?: string;
  readonly dateAlternatives?: readonly string[]; readonly error?: string;
}
export interface FeedInput {
  readonly message: string;
  readonly segments: readonly FeedSegment[];
  readonly structure: MeaningStructure;
  readonly values: readonly FeedValue[];
  readonly resolutions: readonly PieceResolution[];
  readonly choicesFor: (tool: string) => Readonly<Record<string, readonly string[]>>;
  readonly toolNameFor: (tool: string) => string;
}
export interface FeedItem { readonly piece: number; readonly clause: number; readonly input: BindInput }

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

function toBindValue(v: FeedValue): BindValue {
  return {
    kind: v.kind, start: v.start, end: v.end, confidence: v.confidence,
    ...(v.value !== undefined ? { value: v.value } : {}),
    ...(v.unit !== undefined ? { unit: v.unit } : {}),
    ...(v.ms !== undefined ? { ms: v.ms } : {}),
    ...(v.date !== undefined ? { date: v.date } : {}),
    ...(v.dateAlternatives !== undefined ? { dateAlternatives: v.dateAlternatives } : {}),
    ...(v.error !== undefined ? { error: v.error } : {}),
  };
}

export function buildBindInputs(input: FeedInput): FeedItem[] {
  const out: FeedItem[] = [];
  try {
    const { message, structure } = input;
    if (typeof message !== 'string' || !structure || !Array.isArray(structure.words) || !Array.isArray(structure.pieces) || !Array.isArray(input.resolutions)) return out;
    const words = structure.words;
    const pieces = structure.pieces;
    const segments = Array.isArray(input.segments) ? input.segments : [];
    const values = Array.isArray(input.values) ? input.values : [];
    for (const item of input.resolutions) {
      const found = item.resolution;
      if (found.kind !== 'match' || item.mayRunAlone !== true) continue;
      const piece = pieces[item.piece];
      if (!piece || !isInt(piece.from) || !isInt(piece.to) || piece.from < 0 || piece.to <= piece.from || piece.to > words.length) continue;
      const start = words[piece.from]!.start;
      const lastEnd = words[piece.to - 1]!.end;
      const next = pieces[item.piece + 1];
      const nextStart = next && isInt(next.from) && next.from >= 0 && next.from < words.length ? words[next.from]!.start : message.length;
      const reachEnd = Math.max(lastEnd, nextStart);
      const pieceWords: BindWord[] = words.slice(piece.from, piece.to).map((w) => ({ norm: w.norm, start: w.start, end: w.end }));
      const details: BindSpan[] = [];
      for (const d of piece.parts.details) {
        const from = d.from + 1;
        if (!isInt(d.from) || !isInt(d.to) || from >= d.to || from < piece.from || d.to > piece.to) continue;
        details.push({ start: words[from]!.start, end: words[d.to - 1]!.end });
      }
      const references: BindSpan[] = [];
      for (const p of piece.refs.pointers) {
        if (!isInt(p.at) || p.at < piece.from || p.at >= piece.to) continue;
        // an 'earlier' pointer ("the above", "the last one") is by the references rule preceded by a determiner and may be followed by "one": the pointer is the whole phrase
        const open = p.kind === 'earlier' && p.at > piece.from ? p.at - 1 : p.at;
        const close = p.kind === 'earlier' && p.at + 1 < piece.to && ONE_WORDS.has(words[p.at + 1]!.norm) ? p.at + 1 : p.at;
        references.push({ start: words[open]!.start, end: words[close]!.end });
      }
      for (const d of piece.refs.deictic ?? []) {
        if (isInt(d.at) && isInt(d.last) && d.at >= piece.from && d.last < piece.to && d.last > d.at) references.push({ start: words[d.at]!.start, end: words[d.last]!.end });
      }
      const materials: BindSpan[] = segments
        .filter((s) => s.kind === 'material' && isInt(s.start) && isInt(s.end) && s.start >= start && s.end <= reachEnd)
        .map((s) => ({ start: s.start, end: s.end }));
      const inPiece = values.filter((v) => isInt(v.start) && isInt(v.end) && v.start >= start && v.end <= reachEnd).map(toBindValue);
      out.push({
        piece: item.piece,
        clause: item.clause,
        input: {
          tool: found.tool,
          toolName: input.toolNameFor(found.tool),
          message,
          values: inPiece,
          materials,
          details,
          references,
          words: pieceWords,
          choices: input.choicesFor(found.tool),
          ...(found.evidence !== undefined ? { evidence: found.evidence } : {}),
        },
      });
    }
  } catch {
    return out;
  }
  return out;
}
