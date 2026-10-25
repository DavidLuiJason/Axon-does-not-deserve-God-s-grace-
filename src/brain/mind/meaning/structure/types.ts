/**
 * B03B2a LINKED CLAUSES: the CONTRACT (written by the Director; do not change).
 * Input is language only (quoted and code material is already removed) and dictionary-free: the caller supplies, per word,
 * two facts it got from the dictionary (verb, subject). This job only decides which pieces are linked, and how.
 */
export type Gap = 'none' | 'weak' | 'strong';   // what stands BEFORE a word: nothing, a comma/semicolon/colon/dash, or sentence punctuation
export type LinkKind = 'condition' | 'time' | 'reason';

export interface WordFacts {
  readonly norm: string;      // lower-case word
  readonly verb: boolean;     // the dictionary says this word can be a verb (or it is an auxiliary)
  readonly subject: boolean;  // a subject pronoun: i you he she it we they there
  readonly gapBefore: Gap;    // the punctuation gap before this word ('none' for the first word)
}
export interface WordRange { readonly from: number; readonly to: number }  // word indices, `to` exclusive

export interface ClauseLink {
  readonly kind: LinkKind;
  readonly marker: string;        // the link word, e.g. 'if'
  readonly dependent: number;     // index in the OUTPUT ranges of the clause that starts with the marker
  readonly main: number | null;   // index of the clause it depends on; null when there is none (a dangling "if it rains")
}
export interface StructureResult {
  readonly ranges: WordRange[];       // the input ranges, each split in front of every real link marker (in order, no gaps, no overlaps)
  readonly links: ClauseLink[];       // in order of `dependent`
  readonly mayRunAlone: boolean[];    // one per output range; see the rules in the job
}
/** asks[i] is true when input range i ends with a question mark. */
export type LinkClauses = (words: readonly WordFacts[], ranges: readonly WordRange[], asks: readonly boolean[]) => StructureResult;
