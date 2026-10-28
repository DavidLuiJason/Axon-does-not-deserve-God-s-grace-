/**
 * B04B2 CLAUSE INPUTS: the CONTRACT. Written by the Director (2026-10-27). The builder reads it and never changes it.
 *
 * WHAT THIS IS: the bridge from what the Meaning stage already knows (words, dictionary lemmas, clause acts, clause pieces
 * with verb and object, values) to the `ResolveInput` of B04B. One input per piece. PURE: no clock, no dictionary, no storage.
 * The shapes below are STRUCTURAL: the real `Analysis`, `Meaning.structure` and `ExtractedValue` objects fit them as they are
 * (extra fields are ignored), so this file imports nothing from the Meaning stage.
 *
 * THE RULES (fixed, so that they can be proven):
 *  1. One output entry per piece, in piece order, even for a piece that is empty or damaged (then its input has empty lists).
 *  2. act and polarity come from `clauses[piece.clause]`; a missing clause gives act 'unknown', polarity 'positive'.
 *  3. A word is joined to a token when the token's `start` lies inside [word.start, word.end). The first such token wins.
 *  4. verbs: the word `piece.parts.verb` points to, as `lemma:v` (lemma lowercased). Nothing else is a verb.
 *  5. objects: every word inside `parts.object` and inside every `parts.details` span (from inclusive, to exclusive) whose joined token
 *     has a part of speech starting with 'n' gives `lemma:n`, and one starting with 'adj' or equal to 'a' or 's' gives `lemma:a`.
 *     A token with both gives both. Word order, no duplicates. A word with no token or no such part of speech gives nothing.
 *  6. names: for the same words as rule 5, the lowercase `norm` and the lowercase lemma, kept only if they are made of letters a to z
 *     and digits 0 to 9, word order, no duplicates. (Names are matched exactly by the resolver and only if some schema owns them.)
 *  7. provided: the values (`ValueLike`) lying fully inside the piece's characters [words[from].start, words[to-1].end), in order of
 *     start: number, percent, roman -> number; quantity -> quantity; duration -> duration; date -> date; time -> time;
 *     datetime -> date then time; any other kind is ignored. Each 'material' segment lying fully inside those characters gives one 'text'.
 *     B04C0b-D: an entry built from a percent, quantity, duration, date or time value ALSO carries `value` with that kind (a datetime gives one entry of kind date and one of kind time, each with its own `value`); numbers, Roman numerals and text carry none.
 *     Values are merged with the material entries by start position.
 *  8. `mayRunAlone` is copied from the piece.
 *  9. Hostile input (missing arrays, indexes out of range, null) never throws.
 * 10. Inputs are never changed; the same input gives the same output.
 * 11. (B04C0d-A) `need: true` on `clauses[piece.clause]` gives `need: true` on the input; otherwise the field is absent. For such a piece rule 4
 *     changes: the word `parts.verb` points to is NOT a verb (it is the need verb). If a `parts.details` span with marker `to` exists, the first
 *     word of the first such span that has a verb part of speech gives `lemma:v` (the wanted action) and the words after it, in that span, are read
 *     by rule 5 like any detail; with no such span `verbs` is empty. Rule 5 still reads `parts.object`. No other piece is affected.
 */
import type { ProvidedSlot, ResolveInput, ResolveOptions, Resolution } from './resolveTypes';

export interface TokenLike { readonly lemma: string; readonly partsOfSpeech?: readonly string[]; readonly start: number; readonly end: number }
export interface SegmentLike { readonly kind: 'language' | 'material'; readonly start: number; readonly end: number }
export interface WordLike { readonly norm: string; readonly start: number; readonly end: number }
export interface SpanLike { readonly from: number; readonly to: number }
export interface DetailLike { readonly marker: string; readonly from: number; readonly to: number }
export interface PartsLike { readonly verb: number | null; readonly object: SpanLike | null; readonly details: readonly DetailLike[] }
export interface PieceLike { readonly from: number; readonly to: number; readonly clause: number; readonly mayRunAlone: boolean; readonly parts: PartsLike }
export interface ClauseLike { readonly act: string; readonly polarity: 'positive' | 'negative'; readonly need?: boolean }
export interface ValueLike { readonly kind: string; readonly start: number; readonly end: number }

export interface AdapterInput {
  readonly tokens: readonly TokenLike[];
  readonly segments: readonly SegmentLike[];
  readonly clauses: readonly ClauseLike[];
  readonly words: readonly WordLike[];
  readonly pieces: readonly PieceLike[];
  readonly values: readonly ValueLike[];
}
export interface PieceInput { readonly piece: number; readonly clause: number; readonly mayRunAlone: boolean; readonly input: ResolveInput }
export interface PieceResolution { readonly piece: number; readonly clause: number; readonly mayRunAlone: boolean; readonly resolution: Resolution }

/** Required exports of src/brain/mind/resolve/clauseInputs.ts */
export interface ClauseInputsApi {
  buildResolveInputs(input: AdapterInput): PieceInput[];
  /** buildResolveInputs, then resolveClause for each; a piece with mayRunAlone false is still resolved (the stage decides what to do). */
  resolveMessage(input: AdapterInput, options?: ResolveOptions): PieceResolution[];
}
export type { ProvidedSlot };
