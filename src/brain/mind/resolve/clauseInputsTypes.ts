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
 *     has a part of speech starting with 'n' gives `lemma:n` (RESOLVE-TC: and also `base:n` for each of the token's `alternativeNounLemmas`, so a plural that is itself a headword keeps both readings), and one starting with 'adj' or equal to 'a' or 's' gives `lemma:a`.
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
 * 16. (RESOLVE-TC part 4, owner-approved 2026-10-31.) QUANTITY: when `parts.quantity` (the counted noun after "how many", from the closed set in closedSets.ts) lies inside the piece, `verbs` gets `count:v` (the one meaning of the set) and the words of that span count as object words (rule 5); a copula verb of such a piece is NOT a verb key; verbs never repeat.
 * 17. TWO READINGS OF A COMPOUND (the "word count" rule): when `parts.verb` and the first word of `parts.object` are neighbours, neither a copula nor a need verb, and BOTH words can be noun and verb and each stands in its base form (surface = lemma), `PieceInput.alternative` holds the swapped reading (second word = the verb, first word = an object, the rest unchanged). `resolveMessage` resolves both and takes the alternative ONLY if it is a match with strictly fewer empty required slots than the first reading; then `PieceResolution.reading` is 'alternative' (loud, FL15). GUARD (part 5): the tool the second reading picks must also be matched by the verb that reading supplied (the `a|verb` evidence key; verbs match by identity), so a second reading that wins only through a related noun never replaces the first. No word list is involved.
 * 18. (RESOLVE-TC part 5, Director's proposal, owner confirms.) "HOW MUCH" AS A SECOND READING: when `parts.quantitySecond` lies inside the piece (the noun phrase after "how much", closed set in closedSets.ts) and `parts.quantity` is absent, `PieceInput.alternative` is a count reading: verbs [count:v], objects = the words of that span and of every `parts.details` span (rule 5), `provided` as in the first reading. The first reading is unchanged. The choice between the readings is rule 17 (a match with strictly fewer empty slots), so "how much is 12 times 3" (no noun phrase before the verb) and any request whose first reading already matches are untouched. It replaces a compound reading (rule 17) on the same piece.
 * 10. Inputs are never changed; the same input gives the same output.
 * 11. (B04C0d-A) `need: true` on `clauses[piece.clause]` gives `need: true` on the input; otherwise the field is absent. For such a piece rule 4
 *     changes: the word `parts.verb` points to is NOT a verb (it is the need verb). If a `parts.details` span with marker `to` exists, the first
 *     word of the first such span that has a verb part of speech gives `lemma:v` (the wanted action) and the words after it, in that span, are read
 *     by rule 5 like any detail; with no such span `verbs` is empty. Rule 5 still reads `parts.object`. No other piece is affected.
 */
import type { ProvidedSlot, ResolveInput, ResolveOptions, Resolution } from './resolveTypes';

export interface TokenLike { readonly lemma: string; readonly alternativeNounLemmas?: readonly string[]; readonly hyphenParts?: readonly { readonly lemma: string; readonly partsOfSpeech?: readonly string[] }[]; readonly partsOfSpeech?: readonly string[]; readonly start: number; readonly end: number }
export interface SegmentLike { readonly kind: 'language' | 'material'; readonly start: number; readonly end: number }
export interface WordLike { readonly norm: string; readonly start: number; readonly end: number }
export interface SpanLike { readonly from: number; readonly to: number }
export interface DetailLike { readonly marker: string; readonly from: number; readonly to: number }
export interface PartsLike { readonly verb: number | null; readonly object: SpanLike | null; readonly details: readonly DetailLike[]; readonly copula?: boolean; readonly quantity?: SpanLike | null; readonly quantitySecond?: SpanLike | null }
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
/** `alternative` (RESOLVE-TC part 4, rule 16): the second reading of a two-word compound ("word count": noun + noun-or-verb); absent when there is none. */
export interface PieceInput { readonly piece: number; readonly clause: number; readonly mayRunAlone: boolean; readonly input: ResolveInput; readonly alternative?: ResolveInput }
/** `reading` (FL15, loud): 'alternative' when the compound's second reading won; absent otherwise. */
export interface PieceResolution { readonly piece: number; readonly clause: number; readonly mayRunAlone: boolean; readonly resolution: Resolution; readonly reading?: 'alternative' }

/** Required exports of src/brain/mind/resolve/clauseInputs.ts */
export interface ClauseInputsApi {
  buildResolveInputs(input: AdapterInput): PieceInput[];
  /** buildResolveInputs, then resolveClause for each; a piece with mayRunAlone false is still resolved (the stage decides what to do). */
  resolveMessage(input: AdapterInput, options?: ResolveOptions): PieceResolution[];
}
export type { ProvidedSlot };
