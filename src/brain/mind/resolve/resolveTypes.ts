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
 *
 * VALUE EVIDENCE (B04C0b-D, Director 2026-10-28; built in C0b-C; MEASURED by a scratch prototype on the 57 dev requests with four tools declaring a value: 21 to 27 exact, nothing found 12 to 6, wrong tool 12 to 11):
 *   8. A third key group, `v`. The input has the key `v|KIND` once for each distinct KIND in `provided[].value` that is in VALUE_KIND_LABELS.
 *      Any other value (a bare number, a Roman numeral, quoted text) gives NO key. The schema has `v|KIND` for each entry of `schema.values`.
 *   9. The key weighs like any other key (rule 2: 1 / number of schemas having it) and is matched by IDENTITY only: `related` is never called for `v` keys.
 *      The key's weight in the score is multiplied by VALUE_WEIGHT. Rules 4 to 7 apply unchanged (the act filter first, the same ASK_MARGIN).
 *  10. A candidate whose matched keys are ALL `v` keys is VALUE-ONLY. When the winner is value-only, the result carries `evidence: 'value'`
 *      (a match found by what the message CARRIES, not by what it SAYS); otherwise `evidence` is 'concept' when no `v` key matched and 'both' when
 *      both did. A value-only winner is a normal match for Resolution; the stage that RUNS the tool (C1) decides whether to confirm first
 *      (MEASURED trap: "Is 5 minutes a long time" carries a duration and is not a request to start a timer).
 *  11. A tool whose `values` is absent scores exactly as before: adding this changes nothing for any tool that declares no value.
 *  12. (B04C0d-A) `need: true` means the speaker STATED A NEED ("I need a QR code"); it did not give an order. The clause is scored
 *      exactly like a command (same keys, same weights, same margin); `need` changes only what may be RETURNED.
 *  13. A need clause returns a `match` or an `unavailable` result ONLY when the scoring alone would return that. Where the scoring would
 *      return `ask`, `none` or `negated`, a need clause returns `not-a-request` instead (reason: "A statement of need names no tool
 *      clearly, so it stays conversation"), because a statement is not an order: AXON never asks "which tool?" about "I need help".
 *  14. For a need clause the verb that states the need is NOT a verb key (`need` and `want` are not tools); the `verbs` list is the
 *      verb of the wanted action ("to count" in "I need to count the words"), or empty when the clause names a thing ("a QR code").
 *      A need clause never changes how any other clause is scored.
 */
import type { Act, SlotKind, Status, ValueKind } from '../schema/schemaTypes';

export const ASK_MARGIN = 0.5;
export const MAX_CANDIDATES = 4;
/** B04C0b-D rule 9. One, so a value key weighs as much as a concept key; the prototype with a wider declaration set gave 25 exact at 1 and 24 at 0.5. C0b-C may lower it only with a measured reason. */
export const VALUE_WEIGHT = 1;

export type InputAct = Act | 'greet' | 'thanks' | 'chat' | 'unknown';
/** `value` (B04C0b-D) is the KIND the Meaning stage found, before it is folded into `kind`: a percent is `kind: 'number'` (so a number slot is still filled) AND `value: 'percent'` (so it is evidence). Absent for a bare number or text. */
export interface ProvidedSlot { readonly kind: SlotKind; readonly value?: ValueKind }
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
  /** B04C0d-A: the clause is a STATEMENT OF NEED read as a request (rules 12 to 14). Absent for every other clause. */
  readonly need?: true;
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
  /** B04C0b-D rule 10: what the winning match rested on. Absent on results with no candidate. */
  readonly evidence?: 'concept' | 'value' | 'both';
}
export type Resolution =
  | (Common & { readonly kind: 'match'; readonly tool: string; /** names of required slots with no provided value */ readonly missingSlots: readonly string[] })
  | (Common & { readonly kind: 'unavailable'; readonly tool: string; readonly status: Status })
  | (Common & { readonly kind: 'ask'; /** 2 to 4 tool ids, best first */ readonly choices: readonly string[] })
  | (Common & { readonly kind: 'none' })
  | (Common & { readonly kind: 'not-a-request' })
  | (Common & { readonly kind: 'negated'; /** the tool that WOULD have matched, or null */ readonly tool: string | null });
