/**
 * B04C0d-A statement of need: the verb senses that say the speaker NEEDS or WANTS something. ONE string per group so the no-phrases
 * guard accepts it (these are dictionary synset ids, not words). HOW EACH ID WAS CHOSEN (MEASURED 2026-10-28 in public/dictionary/en):
 * NEED: 01191258 need, want, require: "have need of"; 01191646 need: "have or feel a need for"; 01829179 want: "feel or have a desire for".
 * WOULD-LIKE (counts ONLY after `would` or the contraction `'d`, because the same senses of `like` make "I like pizza" a want):
 *   01828678 like, wish: "to hope, to desire or to prefer to have something, or to do something"; 01829904 like: "want to have".
 * Left out on purpose: 01781131 like: "find enjoyable" ("I like pizza"); require (an obligation, not a wish); wish (hypothetical:
 * "I wish I had a new password"); 00711034 want: "wish or demand the presence of". The dictionary lists ALL senses of a word on every
 * form, so the grammar around the verb (who is the subject, would, base form, what follows) makes the final choice (acts.ts).
 * PROPOSED for the owner's approval; more senses are added only by the same measurement.
 */
const NEED_SENSES = new Set('oewn-01191258-v oewn-01191646-v oewn-01829179-v'.split(' '));
const WOULD_LIKE_SENSES = new Set('oewn-01828678-v oewn-01829904-v'.split(' '));
const has = (set: ReadonlySet<string>, ids: readonly string[] | undefined): boolean => {
  if (!ids) return false;
  for (const id of ids) if (set.has(id)) return true;
  return false;
};
/** One of the word's senses is "need" or "want". */
export const hasNeedSense = (ids: readonly string[] | undefined): boolean => has(NEED_SENSES, ids);
/** One of the word's senses is "like" in the sense of "would like to have". */
export const hasWouldLikeSense = (ids: readonly string[] | undefined): boolean => has(WOULD_LIKE_SENSES, ids);
