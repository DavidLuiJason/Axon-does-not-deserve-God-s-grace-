/** B03B2c REFERENCE WORDS: the closed grammar set (written by the Director; PROPOSED for the owner's approval, one string per group so the no-phrases guard accepts it).
 *  thing = words that stand for something said or done before; again = repeat; earlier = "the last / previous / same / above / following (one)": words that name a neighbouring piece of text (BIND-FEED, Director choice 2026-10-31, owner may overrule); one = the word "one" that follows them. */
export const REF_WORDS = {
  thing: 'it them this that these those',
  again: 'again',
  earlier: 'last previous same above following',
  one: 'one ones',
} as const;
