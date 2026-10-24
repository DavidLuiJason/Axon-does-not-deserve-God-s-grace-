# B03A report: the Meaning stage, part A (Director rebuild, 2026-10-24)

**What it is.** The brain's Meaning stage now splits a message into clauses (instruction-sized pieces), attaches quoted or code material to the right clause, and decides each clause's act (ask, command, greet, thanks, chat, unknown) and polarity (positive or negative), each with a confidence, a recorded reason and the other readings above 0.2. Nothing reaches the chat differently: replies are byte-identical (golden transcript, 79 messages).

**Why a rebuild.** ChatGPT's return was rejected (nothing run). The previous Director account built a working version but its sandbox was lost with the account; only its findings survived. This is a fresh build from the prompt, the 46-message corpus and those findings. Evidence labels: MEASURED = run in the Director sandbox on the real dictionary.

## Results (MEASURED)
- Corpus: 44 of 44 core items pass. Stretch: S02 passes, S01 (typos) does not (reported, not required).
- Confusion table (first clause): every act 100 percent precision and recall (ask 8, command 13, greet 4, thanks 3, chat 9, unknown 4, none 3).
- New negative suite: 56 messages written before the code was run, 56 pass. Two failed on the first run ("thanks" was not recognised as a full thanks word); one rule was changed (first-listed sense decides, see below) and both passed. One more case (G56, coordinated verbs) was added after a probe found a real defect and fixed.
- Mutation tests: 7 of 7 deliberate breaks are caught (3 to 14 corpus items fail each). An 8th, "a comma never starts a clause", was NOT caught because the "and/then" and greeting rules already cover every corpus case; it was replaced, not hidden.
- Golden transcript: 79 of 79 replies identical; the Meaning stage ran on all 79; every other trace entry unchanged.
- Fuzz: 400 seeded random messages; invariants hold (same input same output, spans ordered, every material region in exactly one clause, valid act and confidence).
- Budget: 0.07 ms per message on average (Meaning stage only; first-call worst 13 ms) on this machine. The Infinix Note 10 was NOT measured (HYPOTHESIS: still far below the half-second budget).
- Static guards (`tests/meaningNoPhrases.test.ts`): no regular-expression literal and no array of three or more strings in `src/brain/mind` outside `closedSets.ts` and `concepts.ts` (ids only); the existing guard in `mindPipeline.test.ts` also passes. The new guard found one violation in my own code (tie-break order) and it was fixed.
- All other test files: 85 pass. NOT RUN here: capabilityTruth, engineTruth, userDictionaryImport, zipTool (the sandbox has no `jszip`); they passed in your cloud build before.
- Type check: new and changed source files are clean under `tsc --strict` (also under the stricter `noUncheckedIndexedAccess`). The whole-project `tsc` and Vite are NOT RUN here; the cloud build is the real proof.

## How the anchors were derived (MEASURED, not remembered)
All noun senses whose gloss mentions greeting, salutation, gratitude or thanks were listed with their hypernym links (`Dictionary.relations`; `public/dictionary/en/rel` DOES hold hypernyms). Kept as GREETING: hello/hi/howdy (06645018, hypernym greeting), good morning (06645178), good afternoon (06645314), good evening (80042148), ciao/aloha (06644428, gloss "say hello"), greetings (06642524). THANKS: thanks (07243631), thank you (07243905). Dropped: cards, gestures and acts (card, salute, pax, hail, welcome) and the verb "thank" (an order "thank him" is a command). `tests/meaningA.test.ts` re-checks every id against the dictionary on each run.
"Full anchor" means the word's FIRST listed sense is the anchor (the dictionary lists the commonest sense first): "hello", "thanks" are full (confidence 0.95 or 0.8); "morning" alone is a weaker greeting (0.8); "every morning" is not a greeting.

## Option A conversation words
`src/brain/knowledge/conversationWords.ts` (outside the brain folder): hey, heya, hiya, yo (greet); thx, thanx, thankyou, ty, cheers (thanks). Each has a reason and status `proposed`; the test proves each is absent from the dictionary (or, for "cheers", present without the thanks meaning). **The owner decides which stay.**

## Known limits (not hidden; each belongs to a later job)
"light travels fast" reads as a command; "stop" alone is unknown; "I thank you" is unknown (the dictionary phrase "thank you" swallows the verb); typos are not repaired; "Hello, can you open X and show me Y?" reads the last part as a command although the whole sentence was a question. Part B (typed slots, teach, correct, references) fixes the argument side.

## Files
New: `src/brain/mind/meaning/{closedSets,concepts,lexical,clauses,acts,build,index}.ts`, `src/brain/knowledge/conversationWords.ts`, `tests/meaningA.test.ts`, `tests/meaningNoPhrases.test.ts`, `tests/fixtures/meaning-corpus-a.json`, `tests/fixtures/meaning-negative-a.json`.
Changed (small): `src/brain/mind/{types,stages,pipeline,index}.ts` (additive; `createStages` and `createMind` accept an optional knowledge slot so tests use the real dictionary), `src/brain/knowledge/{slot,dictionarySlot}.ts` and `analysis/analyze.ts` (every part of speech of a word passes through the slot; before, only the 5 shown senses counted), `tests/mindPipeline.test.ts` (two messages renamed), `tests/qrDecode.test.ts` (line 30 type slip), `package.json` (two tests added to `test:kernel`), docs.

## LAW CHECK
FL1/FL3 the stage sits in layer 3 (Understanding), after Analysis, before Resolution. FL4 one fix per problem; two-strike rule never reached. FL5 dictionary used, never touched. FL9 each symptom tied to its layer. FL10 no chat change. FL11 this check. FL12 nothing reaches the chat outside the brain; `brainBoundary` passes. FL13 no phrase lists: closed grammar classes only in `closedSets.ts`; open meaning from the dictionary; the one owner-approved file is outside the brain folder. Rules 1/4 one job, proof by run. 6 measured before designed. 12 guards grow with the code. 13 relative paths only.
