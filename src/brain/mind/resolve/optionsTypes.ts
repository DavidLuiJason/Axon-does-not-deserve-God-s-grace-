/**
 * B04B3 RESOLUTION OPTIONS: the CONTRACT. Written by the Director (2026-10-27). The builder reads it and never changes it.
 *
 * WHAT THIS JOB DOES: B04B Resolution takes two optional helpers that B04B2 left out on purpose:
 *   - `options.related(inputKey, schemaKey)`: how CLOSE two dictionary concepts are (a number from 0 to 1);
 *   - `options.status`: tool id -> Status, so that a tool that exists in the plan but is not built is answered honestly.
 * This job builds the two PURE makers of those helpers. It does NOT touch the dictionary, the registry or the stages:
 * the dictionary arrives as an injected function (`RelationLookup`), the registry as plain `ToolFact` records. The Director wires them.
 *
 * KEYS: "lemma:pos" with pos v, n or a (for example the key of the verb convert). Keys of different pos are never related.
 *
 * THE CLOSENESS RULE (fixed, so that it can be proven; the numbers are ESTIMATES, the owner may tune them later):
 *   identical keys                                   1
 *   synonyms (either one lists the other)            0.8   (an exact word must always beat a synonym)
 *   one step broader or narrower (either direction)  0.5
 *   two steps in the SAME direction (broader of broader, narrower of narrower; siblings through a shared parent are NOT related) 0.25
 *   anything else                                    0
 *   Symmetric: related(a,b) equals related(b,a). The best applicable value wins.
 *   At most the first 8 entries of each list a lookup returns are read (cost bound).
 */
import type { Status, ToolFact } from '../schema/schemaTypes';

export const SYNONYM_SIMILARITY = 0.8;
export const ONE_STEP_SIMILARITY = 0.5;
export const TWO_STEP_SIMILARITY = 0.25;
export const MAX_LIST_ENTRIES = 8;

/** What the dictionary knows about one concept. Every list holds keys written "lemma:pos". */
export interface Relations {
  readonly synonyms: readonly string[];
  readonly broader: readonly string[];
  readonly narrower: readonly string[];
}
/** Injected by the Director from the dictionary. May return null (unknown concept), may throw: the maker must survive both. */
export type RelationLookup = (key: string) => Relations | null;

/** The module `options.ts` exports exactly these two functions (named exports; the runner checks every line). */
export interface OptionsApi {
  /** Returns a NEW function (inputKey, schemaKey) => 0 | 0.25 | 0.5 | 0.8 | 1 following the rule above. Never throws, never returns NaN. */
  makeRelated(lookup: RelationLookup): (inputKey: string, schemaKey: string) => number;
  /**
   * tool id -> Status using `deriveStatus` from schemaTypes. A NEW frozen object with no prototype (so 'constructor' and 'toString' find nothing).
   * Skips facts whose id is not a non-empty string or is '__proto__'. If an id repeats, the FIRST fact wins. A non-array input gives an empty map.
   */
  statusMapFrom(facts: readonly ToolFact[]): Readonly<Record<string, Status>>;
}
