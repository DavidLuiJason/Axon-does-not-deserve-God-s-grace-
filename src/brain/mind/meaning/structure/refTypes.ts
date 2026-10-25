/**
 * B03B2c REFERENCES AND RELAYS: the CONTRACT (written by the Director; do not change).
 * Input per word: facts the caller took from the dictionary (verb, noun, determiner, subject-pronoun, first-person, speech verb).
 * `parts` is the output of readClauseParts (B03B2b) for the same ranges. Nothing here knows any word except the closed set in refWords.ts.
 */
import type { ClauseParts, Span } from './partsTypes';
import type { WordRange } from './types';

export interface RefFacts {
  readonly norm: string;          // lower-case word
  readonly verb: boolean;         // the dictionary lists it as a verb (or it is an auxiliary)
  readonly noun: boolean;         // the dictionary lists it as a noun
  readonly determiner: boolean;   // a, an, the, this, that ... as the dictionary or closed grammar sets say
  readonly subject: boolean;      // a subject pronoun: i you he she it we they there
  readonly first: boolean;        // first person: me, my, myself, us, we, i ... (the speaker)
  readonly speech: boolean;       // when used as a verb, one of its senses is telling or asking someone (the caller derives it from the dictionary's is-a links)
}
export type PointerKind = 'thing' | 'again' | 'earlier';
export interface Pointer { readonly kind: PointerKind; readonly at: number }      // `at` = word index
export interface Relay {
  readonly verb: number;                 // index of the speech verb
  readonly addressee: Span;              // the words between the verb and the infinitive marker "to"
  readonly addresseeIsSpeaker: boolean;  // the addressee is exactly one first-person word ("remind me to ...")
  readonly content: Span;                // from the infinitive marker to the end of the clause: REPORTED words, never an order for AXON
}
export interface ClauseRefs {
  readonly pointers: Pointer[];          // in word order
  readonly relay: Relay | null;
  readonly needsPrevious: boolean;       // the clause has no main verb and holds a pointer: it only makes sense with the clause before it
}
export type ReadReferences = (words: readonly RefFacts[], ranges: readonly WordRange[], parts: readonly ClauseParts[]) => ClauseRefs[];
