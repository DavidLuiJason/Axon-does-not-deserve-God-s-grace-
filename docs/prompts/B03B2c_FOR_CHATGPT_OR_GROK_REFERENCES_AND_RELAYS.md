# B03B2c: POINTER WORDS AND "WHO IS IT FOR" (references and relays)

[B03B2 = brain job "Meaning stage, part B, piece 2: structure". B03B2a (done) links clauses, B03B2b (accepted) finds each clause's verb, object and details. This piece finds (1) POINTER words: "it", "that", "again", "the last one" point back at something said or done before, so the brain must not treat them as new things; (2) RELAYS: in "tell Tom to call me" the words "to call me" are what Tom is to do, NOT an order for AXON. B05 later works out WHAT a pointer points to; this job only finds the pointers and the relays.]

WHO THIS IS FOR: ChatGPT or Grok (either one, in a NEW chat). Pure code and tests only, no screens.
WHAT THIS DOES: fills ONE file, `structure/references.ts` (function `readReferences`), against the Director's contract `structure/refTypes.ts` and closed word set `structure/refWords.ts`. Not wired into the Meaning pipeline yet (the Director does that glue).
WHAT YOU DO: START NOW. Attach this file, `AXON_ROADMAP_V18_1.md` and `B03B2c-MINIBASE.zip`. Nothing else.
WHAT TO BRING BACK: ONE zip `B03B2c-refs.zip` with `src/brain/mind/meaning/structure/references.ts`, an OPTIONAL `tests/refOwn.test.ts` (your own extra cases and mutation tests, which must pass) and `docs/reports/B03B2c_REPORT.md`. Paths from the mini-base root, no top folder.
PASTE THIS ONE LINE: Do the job in the attached file B03B2c_FOR_CHATGPT_OR_GROK_REFERENCES_AND_RELAYS.md exactly, using the attached roadmap and mini-base. Run everything yourself with `node run.mjs` as the file says, and return one zip.
IF THE BUILDER REPLIES WITH ONLY A REVIEW AND A LAW CHECK, paste once in the SAME chat: "Continue now, in this same chat. Do not report again. Write the file, run the test, then your next message must contain the zip. If you cannot finish everything, deliver what is finished and tested and list the rest."

---
## STANDARD PROMPT PREAMBLE (v17.9, unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. Open ONLY the files this prompt names and the files you are asked to create or change; do not read any other document, folder or archive. AXON is a foundation-first project and its foundation is being reopened. Answer in at most five lines: (1) what the finished AXON contains (section 6 of the roadmap), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list only the laws this job touches (by number, one line each, at most 12 lines) and say how the job complies; repeat it in your report; if a law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

(In the roadmap "Part 00" means section 3, the Foundation Laws.)

---

## THE JOB

MINI-BASE: `structure/refTypes.ts` (the contract: READ FIRST, do not change), `structure/refWords.ts` (the closed words, ONE string per group; import `REF_WORDS`, never copy the words), `structure/clauseParts.ts`, `partsTypes.ts`, `detailWords.ts`, `types.ts` (B03B2b and shared types; do not change), `tests/refRunner.test.ts` (THE PROOF; it builds the clause parts with the real `readClauseParts`; read it, do not change it), `tests/valuesGuard.test.ts` (FL13 guard), `run.mjs`, `tsconfig.values.json`.

### The function
`readReferences(words, ranges, parts)` gets the words of one message (each with the dictionary facts in `RefFacts`), the clause ranges, and `parts[i]` = the clause parts of range i. It returns one `ClauseRefs` per range: `{ pointers, relay, needsPrevious }`.

### The rules (all of them; the runner has a case for each)
1. WORD GROUPS come from `REF_WORDS` (thing: it them this that these those; again: again; earlier: last previous same; one: one ones). Never write the words yourself (FL13). Work on `norm`.
2. Let V = `parts.verb` (the index of the main verb), or -1 when the clause has none. A word BEFORE or AT the verb (the subject, as in "it is raining", "that is fine") is never a `thing` or `earlier` pointer.
3. `again`: any `again` word in the clause is a pointer of kind `again`, wherever it stands (before the verb too).
4. `thing`: a word of the thing group, AFTER the verb (or anywhere when V = -1), is a pointer of kind `thing` when the next word of the SAME clause is: missing, or a word of the `one` group ("that one"), or a word that is none of noun, subject pronoun, verb, determiner. So "convert that" and "convert it to pdf" point; "convert that file" (that + noun), "I know that he left" (that + subject pronoun), "tell him it is late" (it + verb) do not.
5. `earlier`: a word of the earlier group, AFTER the verb (or anywhere when V = -1), whose PREVIOUS word in the clause is a determiner, and whose next word is missing or of the `one` group, is a pointer of kind `earlier` ("delete the last one", "open the same"). "the last week" is not (it is a time; B03B1 reads it). "last one" without a determiner is not.
6. Pointers are listed in word order, once per word. Pointers inside a relay's content are still listed.
7. `needsPrevious` is true only when V = -1 (no main verb) and the clause holds at least one pointer ("again", "the last one", "that one").
8. RELAY: when the main verb (V >= 0) is NOT a copula, `words[V].speech` is true, `parts.infinitive` is an index that is greater than V + 1 (at least one word between the verb and the "to") and inside the clause, the clause is a relay: `verb` = V; `addressee` = words V+1 up to (not including) the infinitive; `content` = from the infinitive to the end of the clause; `addresseeIsSpeaker` = the addressee is exactly one word and that word has `first` true ("remind me to call mom"). In every other case `relay` is null: "tell me a joke" and "tell Tom" (no infinitive), "tell to open it" (no addressee), "make him tell Tom to stop" (the main verb is not a speech verb) are NOT relays.
9. Pure: never change the input, same answer twice, never throw. Bad input (not arrays) gives []. A bad range (outside the words, from >= to), a missing `parts[i]` or missing word facts gives an EMPTY entry `{ pointers: [], relay: null, needsPrevious: false }` for that range, so the output length always equals the number of ranges when the three inputs are arrays.
10. SPEED: 70,000 words in one message under 500 ms, and one clause of 70,000 words under 1,500 ms. Every search linear.

### Order of work and proof
1. Read the contract and the runner. 2. Write `references.ts`. 3. `node run.mjs tests/refRunner.test.ts` until `REF RUNNER OK`. 4. `node run.mjs tests/valuesGuard.test.ts`. 5. `tsc -p tsconfig.values.json` if a tsc exists, else NOT RUN. 6. Optional: `tests/refOwn.test.ts` with 15 cases of your own and at least 6 mutation tests (break your own function on purpose and show the test fails). 7. Report.

HARD RULES: no regular-expression literal; no array of three or more string literals (the guard rejects `['a','b','c']`; use one string and `.split(' ')`); change no file except `references.ts`, your optional test and your report; no import outside the mini-base. If the same problem fails twice, stop and report. A partial delivery of finished passing work is success.

DONE MEANS: the runner prints `REF RUNNER OK` (0 failures), the guard passes, the report gives the exact counts, the LAW CHECK (at most 12 lines), what was NOT RUN, and ONE line on a sentence type the runner does not cover that you think will break these rules.
