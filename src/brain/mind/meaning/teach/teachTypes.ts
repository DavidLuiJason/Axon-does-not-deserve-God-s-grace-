/**
 * B03B3b TEACH and CORRECT: what the Meaning stage reports. Written by the Director. A READING ONLY: nothing is learned, saved or
 * changed because of it (a taught pair is saved only by a later job, B03B3d, and only after the owner's yes).
 * Every span is a piece of the ORIGINAL message (character positions and the text), so a later stage can show exactly what was taken.
 */
export interface TeachSpan { readonly start: number; readonly end: number; readonly text: string; readonly quoted: boolean }

/** Why a reading may be wrong: 'consequence' ("A means that B follows", not a lesson); 'importance' ("A means a lot to me", not a lesson);
 *  'purpose' ("I meant to call" says what was intended, not a replacement); 'filler' ("I mean we should go": a spoken filler, not a correction). */
export type TeachDoubt = 'consequence' | 'importance' | 'purpose' | 'filler';

interface Base {
  /** Index in `Meaning.structure.pieces` and in `Meaning.clauses`. */
  readonly piece: number;
  readonly clause: number;
  /** The "mean" verb as written ("means", "meant", "signifies"). */
  readonly verb: TeachSpan;
  /** "does not mean", "didn't mean": the sentence says what the word does NOT mean (or what was NOT meant). */
  readonly negated: boolean;
  /** false when the piece belongs to a condition or reason ("if x means y, ..."): it must never be learned by itself. */
  readonly standalone: boolean;
  /** Ordinal, NOT calibrated on real messages. */
  readonly confidence: number;
  readonly doubt: TeachDoubt | null;
  readonly reason: string;
}
/** "serendipity means a happy accident": a word or phrase and what it stands for. */
export interface TeachAct extends Base {
  readonly kind: 'teach';
  readonly term: TeachSpan;
  readonly meaning: TeachSpan;
  /** true: the dictionary already knows the term (a lesson would ADD a meaning); false: it does not; null: several words or quoted, not judged. */
  readonly termKnown: boolean | null;
  /** The next piece starts with "and" or "then": the meaning may go on there, so a later stage asks before cutting it. */
  readonly mayContinue: boolean;
  /** Words that stood before the term ("remember that"), kept so nothing is dropped silently. */
  readonly lead: TeachSpan | null;
}
/** "no, I meant kilometres": the speaker says what they meant instead of what was understood. */
export interface CorrectAct extends Base {
  readonly kind: 'correct';
  /** What the speaker meant (null when the sentence only says what was NOT meant). */
  readonly replacement: TeachSpan | null;
  /** What was NOT meant ("10 not 5": 5), when the sentence says so. */
  readonly rejected: TeachSpan | null;
  /** What is corrected is in an earlier message: the Dialogue stage (B05) must find it. */
  readonly needsPrevious: true;
}
export type TeachingReading = TeachAct | CorrectAct;
