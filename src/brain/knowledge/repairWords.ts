/**
 * Word lists for the message-repair step. They are vocabulary, so they live here in the knowledge folder and
 * not in the brain's logic (the brain's folder holds no word lists outside the closed grammar classes).
 */
const COUNT_NOUNS: ReadonlySet<string> = new Set([
  'words', 'letters', 'characters', 'lines', 'sentences', 'paragraphs', 'numbers', 'digits', 'vowels', 'items',
]);

/** Verbs that change or send something: a repaired message containing one is confirmed with the owner first. */
const RISKY_VERBS: ReadonlySet<string> = new Set([
  'delete', 'remove', 'erase', 'overwrite', 'send', 'pay', 'transfer', 'format',
]);

export const isCountNoun = (word: string): boolean => COUNT_NOUNS.has(word.toLowerCase());
export const isRiskyVerb = (word: string): boolean => RISKY_VERBS.has(word.toLowerCase());
