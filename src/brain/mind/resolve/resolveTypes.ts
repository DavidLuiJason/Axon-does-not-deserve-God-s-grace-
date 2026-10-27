/**
 * B04B RESOLUTION: the CONTRACT. Written by the Director (2026-10-27). The builder reads it and never changes it.
 *
 * WHAT RESOLUTION DOES: it takes ONE clause already understood by the Meaning stage (speech act, polarity, verbs, objects,
 * technical names, typed values) and finds the tool schema it MEANS, by CONCEPT OVERLAP, never by remembered phrases (FL13).
 * It answers one of six things, honestly: a match, a question with choices, nothing found, not a request, a refusal ("do not"),
 * or "this exists in the plan but is not built". It never runs a tool (FL12): Planning does that later.
 * PURE: no clock, no storage, no dictionary, no screen, no random. Same input gives the same output. Inputs are never changed.
 *
 * THE SCORING RULE (fixed, so that it can be proven):
 *   1. Concept keys of a schema: each `actions` entry, each `objects` entry, and each `names` entry written "name:" + word.
 *      The input has the same three groups. Duplicates in the input count once.
 *   2. weight(key) = 1 / (number of schemas that have that key). A key no schema has weighs nothing.
 *   3. A schema key is MATCHED by an input key that is identical (similarity 1) or, when `options.related` is given, by the
 *      best `related(inputKey, schemaKey)` (a number from 0 to 1; values outside 0..1 or NaN count as 0; `related` is
 *      called only for keys of the same group, never for names).
 *   4. score(schema) = sum over its keys of weight(key) * best similarity of any input key to it. Schemas whose `acts` do
 *      not include the input act are removed BEFORE scoring.
 *   5. Candidates = schemas with score > 0, best first, ties broken by tool id (A to Z), at most 4 kept.
 *   6. ASK when the best score minus the second score is below ASK_MARGIN (and the second is above 0).
 *   7. confidence = round2(top / (top + second + 0.25)), where `second` is 0 if there is none.
 */
import type { Act, SlotKind, Status } from '../schema/schemaTypes';

export const ASK_MARGIN = 0.5;
export const MAX_CANDIDATES = 4;

export type InputAct = Act | 'greet' | 'thanks' | 'chat' | 'unknown';
export interface ProvidedSlot { readonly kind: SlotKind }
export interface ResolveInput {
  readonly act: InputAct;
  readonly polarity: 'positive' | 'negative';
  /** "lemma:v" */
  readonly verbs: readonly string[];
  /** "lemma:n" or "lemma:a" */
  readonly objects: readonly string[];
  /** technical words, lowercase */
  readonly names: readonly string[];
  /** the typed values the Meaning stage found in this clause (one entry per value) */
  readonly provided: readonly ProvidedSlot[];
}
export interface ResolveOptions {
  readonly related?: (inputKey: string, schemaKey: string) => number;
  /** tool id -> status; a tool missing from this map is treated as 'built' */
  readonly status?: Readonly<Record<string, Status>>;
}
export interface Candidate {
  readonly tool: string;
  readonly score: number;
  /** schema keys that were matched with similarity above 0 */
  readonly matched: readonly string[];
}
export interface Common {
  /** 0 to 1, ordinal, derived by the rule above; NOT a probability */
  readonly confidence: number;
  /** one plain sentence saying why (never empty) */
  readonly reason: string;
  readonly candidates: readonly Candidate[];
}
export type Resolution =
  | (Common & { readonly kind: 'match'; readonly tool: string; /** names of required slots with no provided value */ readonly missingSlots: readonly string[] })
  | (Common & { readonly kind: 'unavailable'; readonly tool: string; readonly status: Status })
  | (Common & { readonly kind: 'ask'; /** 2 to 4 tool ids, best first */ readonly choices: readonly string[] })
  | (Common & { readonly kind: 'none' })
  | (Common & { readonly kind: 'not-a-request' })
  | (Common & { readonly kind: 'negated'; /** the tool that WOULD have matched, or null */ readonly tool: string | null });
