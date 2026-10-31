# RESOLVE-TC: board lines, part 1 of 3 (Director, 2026-10-31). MEASURED, no fix written yet.

**How to run the measurement (no install):** copy `docs/director/resolveTcMeasure.ts.txt` to `docs/director/resolveTcMeasure.ts`, then from the repo root:
`node --experimental-transform-types --no-warnings run.mjs docs/director/resolveTcMeasure.ts x detail`
(plain `node run.mjs` fails: `src/brain/dictionary/dictionary.ts` uses a parameter property, so Node needs transform mode.) Delete the copy afterwards; it is a Director tool, not part of the app.

**BASELINE (MEASURED, real stages, real dictionary, the 50 requests of `tests/textCounterPilot.test.ts`):** text-counter 5, translator 15, tally-counter 6, ask 13, none 11. Same as the previous account's numbers (5 / 15 / 6 / 13 / 11).

**ROOT CAUSES (MEASURED by tracing tokens and pieces; three, not one):**
1. **Plural kept as its own headword.** `analyze.ts` pass 1 looks up the surface directly; "words" and "letters" ARE dictionary headwords, so `token.lemma` stays "words" / "letters" ("lines" and "characters" are not, so they become "line" / "character" and match). Pass 2 only puts the real base into `token.alternativeLemmas` (a string list, no part of speech) and `clauseInputs.ts` (rule 5) never reads it. Result: object `words:n`; the schema concept is `word:n`; the dictionary then relates "words" to the translator's `language:n`. Effect seen: "count words ..." 15 times to the translator, or an ask on `count:v` alone for "letters".
2. **"how many N are in ..." gets the wrong verb.** For "how many words are in X" the clause parts stage picks the verb word = "words" (index 2), copula = false, object = "are in". So the noun is read as a verb (`words:v`) and the object holds only "are" and "in". All 11 "how many ..." requests end in NONE. Place to fix: the clause-parts code under `src/brain/mind/meaning/` (the fix is in Meaning, not in Resolution).
3. **Compound nouns "word count", "character count", "letter count", "line count"** are read as verb + object ("word" = verb, "count" = object, which means `tally:n`), so they go to the tally-counter (6 requests, with "please count letters"). Same layer as 2 (clause parts), or the compound handling of B03B.
4. NOT a reading defect (HYPOTHESIS): "chars" and "char" are in no schema concept (`word`, `line`, `character`, `letter` only), so "count chars" will stay an ask unless the owner decides how short forms are handled (FL13: no phrase list).

**PLAN (three small parts, one fix each, measure after each; Two-Strike Rule applies per fix):**
- **Part 2, fix 1 (plural, cause 1):** make the analysis record the part of speech of each alternative lemma (new OPTIONAL token field next to `alternativeLemmas`; it exists only when alternatives exist) and let `clauseInputs.ts` rule 5 ALSO give `alt:n` for a token that has a noun reading. No phrase list. Contract text in `clauseInputsTypes.ts` gets one new rule line. Expected (HYPOTHESIS): the "count words/letters in ..." requests stop going to the translator; the 50 are re-measured.
- **Part 3, fix 2 (how many ..., cause 2):** read the clause-parts code, find why `words` wins as verb and `are` is not a copula in a question starting with "how many", fix there, re-measure.
- **Part 4, fix 3 (compounds, cause 3), only if parts 2 and 3 leave them failing; then the Resolution scoreboard and the six named tests (`resolveRunner`, `resolveOptionsRunner`, `resolutionStage`, `argumentBinder`, `textCounterPilot`, `brainBoundary`).**
Target: far above 5 of 50; the number is reported as measured, whatever it is.

**NOT RUN:** any fix, the full suite, the scoreboard. This part changed no source file.
