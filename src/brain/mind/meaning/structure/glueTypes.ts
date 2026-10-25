/** B03B2 glue: what the Meaning stage keeps of the structure jobs (2a links, 2b parts, 2c references). Word indices are positions in `words`. */
import type { ClauseLink } from './types';
import type { ClauseParts } from './partsTypes';
import type { ClauseRefs } from './refTypes';

export interface StructureWord { readonly norm: string; readonly start: number; readonly end: number }
export interface StructurePiece {
  readonly from: number;            // first word of the piece
  readonly to: number;              // one past the last word
  readonly clause: number;          // index in Meaning.clauses of the clause (part A) that holds this piece
  readonly mayRunAlone: boolean;    // false: a condition or reason piece, or a dangling one, NEVER runs by itself (owner-confirmed)
  readonly parts: ClauseParts;
  readonly refs: ClauseRefs;
}
export interface MeaningStructure {
  readonly words: StructureWord[];
  readonly pieces: StructurePiece[];
  readonly links: ClauseLink[];
}
