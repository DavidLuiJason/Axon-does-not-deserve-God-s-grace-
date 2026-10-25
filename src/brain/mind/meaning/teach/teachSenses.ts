/**
 * B03B3b TEACH and CORRECT: the verb senses that decide which act a "mean" clause is. ONE string per group so the no-phrases guard
 * accepts it (these are dictionary synset ids, not words). HOW EACH ID WAS CHOSEN (MEASURED 2026-10-25 in public/dictionary/en):
 * TEACH (a word or phrase and what it stands for): 00933814 mean, signify, stand for: "denote or connote" ("'maison' means 'house'");
 *   00933429 denote: "have as a meaning"; 00934286 signify: "convey or express a meaning".
 * INTEND (what the speaker meant to say; used only with the speaker as subject, which is how "I meant kilometres" is told apart from
 *   "kilometre means a thousand metres"): 00957180 mean, intend: "mean or intend to express or convey".
 *   Left out on purpose: 00732037 "intend to refer to" (think of, have in mind): "I think of kilometres" is not a correction.
 * Not included on purpose: 02641270 mean: "have as a logical consequence" and 02748357 "have a specified degree of importance" (those are
 *   "it means we have to stop" and "it means nothing": statements, never lessons). The dictionary lists ALL senses of "mean" on every form
 *   ("means", "meant"), so the grammar around the verb (who is the subject, what stands before and after) makes the final choice.
 * PROPOSED for the owner's approval; more senses are added only by the same measurement.
 */
const TEACH_SENSES = new Set('oewn-00933814-v oewn-00933429-v oewn-00934286-v'.split(' '));
const INTEND_SENSES = new Set('oewn-00957180-v'.split(' '));
const has = (set: ReadonlySet<string>, ids: readonly string[] | undefined): boolean => {
  if (!ids) return false;
  for (const id of ids) if (set.has(id)) return true;
  return false;
};
/** One of the word's senses is "has the meaning of" (a word that gives the meaning of another). */
export const hasTeachSense = (ids: readonly string[] | undefined): boolean => has(TEACH_SENSES, ids);
/** One of the word's senses is "intend to express" or "intend to refer to". */
export const hasIntendSense = (ids: readonly string[] | undefined): boolean => has(INTEND_SENSES, ids);
/** Quote characters that wrap quoted or code material (a character set, not words): opening and closing. */
export const QUOTE_OPEN = '"“‘\'`';
export const QUOTE_CLOSE = '"”’\'`';
