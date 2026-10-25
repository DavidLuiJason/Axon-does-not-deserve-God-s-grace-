# B03B2a: LINKED CLAUSES (condition, time, reason, and "may not run alone")

[B03B2 = brain job "Meaning stage, part B, piece 2: structure". B03A (done) splits a message into clauses; B03B0 and B03B1 (done) gave the language kit and values. This job finds which clauses depend on which: "If it rains, cancel the trip" must NOT let "cancel the trip" run on its own. This is the safety rule behind it (owner, confirmed): a clause with a condition never runs alone.]

WHO THIS IS FOR: ChatGPT or Grok (either one, in a NEW chat). Pure code and tests only, no screens.
WHAT THIS DOES: fills ONE file, `structure/links.ts` (function `linkClauses`), against the Director's contract `structure/types.ts`. Not wired into the Meaning pipeline yet (the Director does that glue).
WHAT YOU DO: START NOW. Attach this file, `AXON_ROADMAP_V17_9.md` and `B03B2a-MINIBASE.zip`. Nothing else.
WHAT TO BRING BACK: ONE zip `B03B2a-links.zip` with `src/brain/mind/meaning/structure/links.ts`, an OPTIONAL `tests/structureLinks.test.ts` (your own extra cases and mutation tests, which must pass) and `docs/reports/B03B2a_REPORT.md`. Paths from the mini-base root, no top folder.
PASTE THIS ONE LINE: Do the job in the attached file B03B2a_FOR_CHATGPT_OR_GROK_LINKED_CLAUSES.md exactly, using the attached roadmap and mini-base. Run everything yourself with `node run.mjs` as the file says, and return one zip.
IF THE BUILDER REPLIES WITH ONLY A REVIEW AND A LAW CHECK, paste once in the SAME chat: "Continue now, in this same chat. Do not report again. Write the file, run the test, then your next message must contain the zip. If you cannot finish everything, deliver what is finished and tested and list the rest."

---
## STANDARD PROMPT PREAMBLE (v17.9, unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. Open ONLY the files this prompt names and the files you are asked to create or change; do not read any other document, folder or archive. AXON is a foundation-first project and its foundation is being reopened. Answer in at most five lines: (1) what the finished AXON contains (section 6 of the roadmap), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list only the laws this job touches (by number, one line each, at most 12 lines) and say how the job complies; repeat it in your report; if a law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

(In the roadmap "Part 00" means section 3, the Foundation Laws.)


---

## THE JOB

MINI-BASE: `structure/types.ts` (the contract: READ FIRST, do not change), `structure/linkWords.ts` (the closed link words, ONE string per kind; do not copy them into your file, import `LINK_WORDS`), `tests/structureRunner.test.ts` (THE PROOF, 40 cases; read it, do not change it), `tests/valuesGuard.test.ts` (FL13 guard).

### The function
`linkClauses(words, ranges, asks)` gets the words of one message (each with its norm, whether it can be a verb, whether it is a subject pronoun, and the punctuation gap before it), the clause ranges B03A already found (split only at punctuation), and `asks[i]` (range i ends with "?"). It returns `{ ranges, links, mayRunAlone }`.

### The rules (all of them; the runner has a case for each)
1. LINK WORDS come from `LINK_WORDS` (condition: if, unless; time: when, after, before, while; reason: because). Never write the words yourself (FL13).
2. A link word is a REAL marker only when a clause follows it: the next word is a subject pronoun, or a verb occurs after it before the next link word. "after the meeting", "before 7", "call me when ready", "go unless" have no clause after the word, so they are NOT links (the prepositional use is B03B2b's job). The clause runs from the marker to the end of its input range or to the next real marker.
3. A range that ends with "?" has no links at all ("when is the meeting?", "what if it rains?").
4. A real marker in the middle of a range SPLITS the range there: "cancel the trip if it rains" becomes two output ranges. A real marker at the start of a range does not split it. Output ranges are in order, touch each other, never overlap and cover every input word of every valid input range.
5. Every clause that starts with a real marker is a DEPENDENT clause, one `ClauseLink` per dependent, in order. Its MAIN clause: for a clause split off inside a range, the nearest EARLIER non-dependent clause of the same sentence, else the nearest later one; for a dependent that begins its input range, the nearest LATER non-dependent clause of the same sentence, else the nearest earlier one; else null. A sentence ends where a word has `gapBefore` 'strong'. Never link across sentences.
6. `mayRunAlone[i]` is false for every dependent clause AND for the main clause of every condition or time link; it stays true for the main clause of a reason link ("set a timer because I am cooking" still sets the timer) and for every other clause.
7. Pure: never change the input, same answer twice, never throw: bad input (not arrays, ranges outside the words, missing `asks`, missing fields) gives `{ ranges: [], links: [], mayRunAlone: [] }`.
8. SPEED: 70,000 words in one message in under 500 ms. Every search must be LINEAR (do not rescan to the end of the sentence for each clause; one pass forward and one backward is enough).

### Order of work and proof
1. Read the contract and the runner. 2. Write `links.ts`. 3. `node run.mjs tests/structureRunner.test.ts` until `STRUCTURE RUNNER OK`. 4. `node run.mjs tests/valuesGuard.test.ts`. 5. `tsc -p tsconfig.values.json` if a tsc exists, else NOT RUN. 6. Optional: `tests/structureLinks.test.ts` with 20 cases of your own and at least 6 mutation tests (break your own function on purpose and show the test fails). 7. Report.

HARD RULES: no regular-expression literal; no array of three or more string literals (FL13); change no file except `links.ts`, your optional test and your report; no import outside the mini-base. If the same problem fails twice, stop and report. A partial delivery of finished passing work is success.

DONE MEANS: the runner prints `STRUCTURE RUNNER OK` (0 failures), the guard passes, the report gives the exact counts, the LAW CHECK (at most 12 lines), what was NOT RUN, and ONE line on a sentence type the 40 cases do not cover that you think will break these rules.
