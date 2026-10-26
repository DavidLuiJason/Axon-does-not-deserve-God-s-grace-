/**
 * B03B3c-GLUE: the dictionary sense groups behind the tone word facts (urgent, anger, harsh). Dictionary synset ids, not words: ONE
 * string per group so the no-phrases guard accepts it. HOW EACH GROUP WAS CHOSEN (MEASURED 2026-10-25 in public/dictionary/en: every
 * id was looked up and the words that carry it were listed, then the false positives were cut):
 * URGENT2 (strong): 00717023 urgent, pressing; 00073249 urgently, desperately; 00034524 asap; 07432005 emergency; 14474486, 05179327,
 *   13967568 urgency; 14474655 hurry, haste ("a condition of urgency").
 * URGENT1 (mild, added to URGENT2 for the weak reading): 00049277 immediately, at once, right away ("without delay"); 00106154 right away ("at once", the phrase's second sense); 00106290 promptly,
 *   quickly; 02059573 and 00460453 hurry, hasten ("move very fast", "act at high speed").
 * ANGER2 (strong): 00115265 enraged, furious, infuriated; 00116717 livid; 00116588 irate; 00115905 very angry; 00116305 outraged,
 *   indignant; 00225897 furiously; 01799899 enrage.
 * ANGER1 (mild, added to ANGER2 for the weak reading): 00114629 angry; 00116004 mad; 01811355 annoyed, irritated; 01791774 annoy, irritate;
 *   00090253 annoying, irritating; 00419407 annoyance; 00228939 angrily; 01140041 irritable, testy; 00117340 resentful; 01778057 and
 *   07561835 hate; 00426454 exasperation; 01769257, 00871066 frustrating; 02341968 frustrated, disappointed.
 * HARSH (curses and insults, as the dictionary itself labels them): 00673766 and 00673178 (expletives: damn); 14878732, 06623729 (obscene
 *   terms); 09834593 (insulting terms of address); 13576978; 00847651 and 91000131 (fuck).
 * RULE (one for every group): the dictionary lists ALL senses of a word on every form, so a word counts only when at least a QUARTER of its
 *   senses are in the group ("now" has 1 of 8 urgency-by-delay senses and is NOT urgent; "dirt", "blame", "screw", "press", "pinch of salt" stay
 *   clean; "angry" 1 of 3 and "urgent" 1 of 1 count). A dictionary PHRASE counts only when ALL its senses are in the group ("get to" is not anger).
 * KNOWN LIMITS: "sore" (said alone) and "directly" still carry a weak flag (weak flags alone never change what AXON does, only how it
 *   words an answer: the answer turns calm only when the anger is aimed at AXON or is strong); "hurry up" is read through "hurry"; "frustrate" (verb), "fed up", "sick of" and insults without a dictionary label are NOT read.
 * PROPOSED for the owner's approval; more senses are added only by the same measurement.
 */
const URGENT2 = new Set('oewn-00717023-s oewn-00073249-r oewn-00034524-r oewn-07432005-n oewn-14474486-n oewn-05179327-n oewn-13967568-n oewn-14474655-n'.split(' '));
const URGENT1 = new Set('oewn-00049277-r oewn-00106154-r oewn-00106290-r oewn-02059573-v oewn-00460453-v'.split(' '));
const ANGER2 = new Set('oewn-00115265-s oewn-00116717-s oewn-00116588-s oewn-00115905-s oewn-00116305-s oewn-00225897-r oewn-01799899-v'.split(' '));
const ANGER1 = new Set('oewn-00114629-a oewn-00116004-s oewn-01811355-s oewn-01791774-v oewn-00090253-s oewn-00419407-n oewn-00228939-r oewn-01140041-s oewn-00117340-a oewn-01778057-v oewn-07561835-n oewn-00426454-n oewn-01769257-s oewn-00871066-s oewn-02341968-s'.split(' '));
const HARSH = new Set('oewn-00673766-s oewn-00673178-s oewn-14878732-n oewn-06623729-n oewn-09834593-n oewn-13576978-n oewn-00847651-n oewn-91000131-n'.split(' '));

export interface ToneSenseFlags { urgent: 0 | 1 | 2; anger: 0 | 1 | 2; harsh: boolean }
export const NO_TONE_SENSES: ToneSenseFlags = { urgent: 0, anger: 0, harsh: false };

function share(ids: ReadonlySet<string>, all: ReadonlySet<string>, phrase: boolean): boolean {
  let hit = 0;
  for (const id of all) if (ids.has(id)) hit += 1;
  if (hit === 0) return false;
  return phrase ? hit === all.size : hit * 4 >= all.size;
}
const URGENT_ANY = new Set<string>([...URGENT2, ...URGENT1]);
const ANGER_ANY = new Set<string>([...ANGER2, ...ANGER1]);
function level(strong: ReadonlySet<string>, either: ReadonlySet<string>, all: ReadonlySet<string>, phrase: boolean): 0 | 1 | 2 {
  if (share(strong, all, phrase)) return 2;
  return share(either, all, phrase) ? 1 : 0;
}

/** The tone facts of one word from the synset ids of its dictionary entry (`phrase`: the unit is a multi-word dictionary phrase). */
export function toneSenseFlags(ids: readonly string[] | undefined, phrase: boolean): ToneSenseFlags {
  if (!ids || ids.length === 0) return NO_TONE_SENSES;
  const all = new Set(ids);
  return { urgent: level(URGENT2, URGENT_ANY, all, phrase), anger: level(ANGER2, ANGER_ANY, all, phrase), harsh: share(HARSH, all, phrase) };
}
