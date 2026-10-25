# B03B3b Report: TEACH and CORRECT (Director, sixth account, 2026-10-25)

## What it is
A reading of two acts, added to `Meaning.teaching` (always a list, possibly empty): a LESSON ("serendipity means a happy accident") and a CORRECTION ("no, I meant kilometres"). It learns, saves and changes nothing.

## How it decides (no word list, FL13)
- The dictionary gives the verb senses (`teach/teachSenses.ts`): "has the meaning of" for lessons, "intend to express" for corrections. Every form of the word carries all senses, so the grammar decides: the SPEAKER (I, we) as the subject right before the verb makes a correction; anything else with a term before and a meaning after makes a lesson.
- Auxiliaries and negations before the verb are stepped over ("does not mean", "I didn't mean"): the act is reported with `negated`.
- A question word, or a question order ("does x mean y?"), gives no act. A lone pronoun or closed grammar word as the term ("it means nothing") gives no act. A lead verb that tells someone ("tell Tom that x means y") gives no act.
- Quoted or code material next to the verb is the term or the meaning, without its quote marks.
- Doubts are named: consequence, importance, purpose, filler (the reading is still reported, with lower confidence, so the Dialogue stage asks).

## Proof (MEASURED in the Director sandbox)
- tests/teachCorrect.test.ts: 255 checks; 19 lessons, 12 corrections, 39 messages that must give no act, 2 known false positives and 6 known misses written down so they cannot change silently.
- 20 of 20 deliberate breakages caught (one change, dropping the "has the meaning" gate, is equivalent and was not tried: every word with an "intend" sense also has a "has the meaning" sense).
- Seeded fuzz (400 random messages), hostile input, speed (40 lessons well under a second).
- Whole `test:kernel` list: all pass except capabilityTruth, which needs the `jszip` package (no node_modules in the Director sandbox; the untouched repository fails the same way).
- Guard OK; the no-phrases guard (43 files) OK; golden transcript (79 messages, 242 field checks) and part A (3,856 checks) unchanged; tsc strict clean on the new files.

## LAW CHECK (FL11)
FL1 and FL3: lesson and correction are the pieces the Dialogue stage (B05) and taught pairs (B03B3d) need; FL4: one sized job, one proof; FL5: the dictionary decides; FL9: a stage-B03B3b piece in plan order; FL12: nothing reaches the chat, the field is only data; FL13: no phrase list, two closed grammar words and four sense ids, all proposed for the owner's approval; FL14: no copy of what another part knows.

## Limits (not hidden)
- NOT read: "x stands for y", "x is short for y", "define x as y" (no dictionary sense for them in this reading), "make that 10 minutes", "not 5, 10", "that's not what I meant" (they need the earlier message: B05).
- Read as lessons although they are not: "your help means everything", "the word serendipity means luck" (term "the word serendipity"). The Dialogue stage must show the term and meaning and ask first.
- The confidence numbers are ordinal, not calibrated; the test sentences are the Director's, not real users'.
