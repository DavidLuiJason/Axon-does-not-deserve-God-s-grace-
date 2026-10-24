/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B03A closed sets of English GRAMMAR words (FL13).
 *
 * Why these lists are allowed: each one is a CLOSED CLASS of English grammar. A closed class has a small,
 * fixed membership that the language does not add to (nobody coins a new preposition or auxiliary), so
 * these lists are not vocabulary and do not make AXON "smarter by adding words". Everything open-ended
 * (verbs, nouns, greetings, thanks) comes from the dictionary through the knowledge slot, never from here.
 * This file and concepts.ts are the ONLY files under src/brain/mind allowed to hold word lists
 * (tests/meaningNoPhrases.test.ts enforces it).
 */

/** Closed class: interrogative words that open a question. */
const QUESTION_WORDS: ReadonlySet<string> = new Set(['what', 'who', 'whom', 'whose', 'which', 'when', 'where', 'why', 'how']);

/** Closed class: auxiliary and modal verbs (grammar carriers of tense, mood and question inversion). */
const AUXILIARIES: ReadonlySet<string> = new Set([
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
]);

/** Closed class: the modal verbs among the auxiliaries (a polite request is modal + you + verb). */
const MODALS: ReadonlySet<string> = new Set(['will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must']);

/** Closed class: auxiliaries that can also be an imperative verb ("do it", "have a look", "be quiet"). */
const AUXILIARIES_THAT_CAN_COMMAND: ReadonlySet<string> = new Set(['do', 'have', 'be']);

/** Closed class: personal pronouns that can be the subject of a clause. */
const SUBJECT_PRONOUNS: ReadonlySet<string> = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they']);

/** Closed class: personal pronouns that can be the object of a verb. */
const OBJECT_PRONOUNS: ReadonlySet<string> = new Set(['me', 'you', 'him', 'her', 'it', 'us', 'them', 'myself', 'yourself', 'itself']);

/** Closed class: possessive determiners. */
const POSSESSIVES: ReadonlySet<string> = new Set(['my', 'your', 'his', 'her', 'its', 'our', 'their']);

/** Closed class: articles and demonstrative, quantifying determiners. */
const DETERMINERS: ReadonlySet<string> = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'some', 'any', 'all', 'each', 'every', 'no', 'another', 'both', 'either', 'neither']);

/** Closed class: prepositions. */
const PREPOSITIONS: ReadonlySet<string> = new Set([
  'in', 'on', 'at', 'to', 'for', 'from', 'with', 'by', 'of', 'about', 'into', 'onto', 'over', 'under',
  'between', 'among', 'through', 'during', 'before', 'after', 'until', 'since', 'against', 'without', 'within', 'upon', 'off', 'up', 'down', 'out',
]);

/** Closed class: coordinating conjunctions. */
const COORDINATORS: ReadonlySet<string> = new Set(['and', 'or', 'but']);

/** Closed class: negation words (the determiner "no" is a determiner, not a verb negation). */
const NEGATIONS: ReadonlySet<string> = new Set(['not', 'never', 'cannot']);

/** Closed class: negative contractions of auxiliaries. */
const NEGATIVE_CONTRACTIONS: ReadonlySet<string> = new Set([
  "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't",
  "won't", "wouldn't", "shouldn't", "couldn't", "can't", "mustn't", "mightn't", "shan't", "needn't", "ain't",
]);

/** Closed class: politeness markers. */
const POLITENESS: ReadonlySet<string> = new Set(['please', 'kindly']);

/** Closed class: sequencing adverbs that open a following step. */
const SEQUENCERS: ReadonlySet<string> = new Set(['then', 'now', 'next', 'also']);

/** Closed class: the endings of contractions ("it's", "you're", "I'm", "we've", "they'll", "he'd"). */
const CLITIC_ENDINGS: ReadonlySet<string> = new Set(['s', 're', 'm', 've', 'll', 'd']);

/** Closed class: words that can stand in front of a clitic ending ("what's", "that's", "it's", "I'm"). */
const CLITIC_STEMS: ReadonlySet<string> = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'who', 'where', 'how', 'why', 'when', 'that', 'there', 'here']);

/** Lower-case, NFC, with typographic apostrophes folded to the plain one. */
export function normalizeWord(surface: string): string {
  return surface.normalize('NFC').toLowerCase().split('\u2019').join("'").split('\u2018').join("'");
}

export const isQuestionWord = (w: string): boolean => QUESTION_WORDS.has(w);
export const isAuxiliary = (w: string): boolean => AUXILIARIES.has(w);
export const isModal = (w: string): boolean => MODALS.has(w);
export const canAuxiliaryCommand = (w: string): boolean => AUXILIARIES_THAT_CAN_COMMAND.has(w);
export const isSubjectPronoun = (w: string): boolean => SUBJECT_PRONOUNS.has(w);
export const isObjectPronoun = (w: string): boolean => OBJECT_PRONOUNS.has(w);
export const isPossessive = (w: string): boolean => POSSESSIVES.has(w);
export const isDeterminer = (w: string): boolean => DETERMINERS.has(w);
export const isPreposition = (w: string): boolean => PREPOSITIONS.has(w);
export const isCoordinator = (w: string): boolean => COORDINATORS.has(w);
export const isNegation = (w: string): boolean => NEGATIONS.has(w);
export const isNegativeClitic = (w: string): boolean => NEGATIVE_CONTRACTIONS.has(w);
export const isPoliteness = (w: string): boolean => POLITENESS.has(w);
export const isSequencer = (w: string): boolean => SEQUENCERS.has(w);

/** The one negative contraction that starts a do-support imperative ("don't delete it"). */
export const isDoNegation = (w: string): boolean => w === "don't";

/** "it's" gives { stem: 'it', ending: 's' }; anything that is not stem + clitic ending gives null. */
export function splitClitic(word: string): { stem: string; ending: string } | null {
  const at = word.indexOf("'");
  if (at <= 0 || at !== word.lastIndexOf("'")) return null;
  const stem = word.slice(0, at);
  const ending = word.slice(at + 1);
  if (!CLITIC_STEMS.has(stem) || !CLITIC_ENDINGS.has(ending)) return null;
  return { stem, ending };
}

/** True for any closed-class grammar word (so a word list never needs to be repeated elsewhere). */
export function isGrammarWord(w: string): boolean {
  return QUESTION_WORDS.has(w) || AUXILIARIES.has(w) || SUBJECT_PRONOUNS.has(w) || OBJECT_PRONOUNS.has(w) || POSSESSIVES.has(w)
    || DETERMINERS.has(w) || PREPOSITIONS.has(w) || COORDINATORS.has(w) || NEGATIONS.has(w) || NEGATIVE_CONTRACTIONS.has(w)
    || POLITENESS.has(w) || SEQUENCERS.has(w) || splitClitic(w) !== null;
}
