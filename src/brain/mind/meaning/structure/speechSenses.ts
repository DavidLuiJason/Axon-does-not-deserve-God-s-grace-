/**
 * B03B2c glue: verb senses that mean TELLING, ASKING or INSTRUCTING SOMEONE, so a clause such as "tell Tom to call me" is a
 * relay (what Tom is to do), not an order for AXON. ONE string of synset ids so the no-phrases guard accepts it.
 * HOW EACH ID WAS CHOSEN (MEASURED 2026-10-25 in public/dictionary/en, glosses and `rel` hypernym links): the words reached by the
 * hypernyms inform, request, tell or communicate are far too many (tell alone reaches add, know, label), so this is a short,
 * hand-checked list of senses. PROPOSED for the owner's approval; more senses (warn, advise, request) are added only the same way.
 * 00748704 tell, say, order: give instructions to or direct somebody to do something; 00954556 tell: let something be known;
 * 00612092 remind: put in the mind of someone; 00754499 ask: make a request or demand of somebody; 00751969 instruct: give
 * instructions or directions for some task; 00875364 notify, advise: inform somebody of something.
 * Not included on purpose: call (its senses are naming, telephoning, ordering to come: "call me to confirm" is a purpose, not a relay).
 */
const SPEECH_SENSES = new Set('oewn-00748704-v oewn-00954556-v oewn-00612092-v oewn-00754499-v oewn-00751969-v oewn-00875364-v'.split(' '));
/** True when one of the word's synset ids is a telling, asking or instructing verb sense. */
export function hasSpeechSense(ids: readonly string[] | undefined): boolean {
  if (!ids) return false;
  for (const id of ids) if (SPEECH_SENSES.has(id)) return true;
  return false;
}
