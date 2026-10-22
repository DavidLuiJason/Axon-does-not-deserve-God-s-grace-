# B03A: The Meaning stage, part A (clauses, material, speech act, polarity)

WHO THIS IS FOR: ChatGPT (a NEW chat; it writes code and runs it in its own sandbox). It writes the brain's pure stage and its tests only; it never designs screens.
WHAT THIS DOES: Builds the first half of the brain's Meaning stage: it finds each instruction in a message, attaches quoted or code material to the right one, and decides what each clause is (a question, a command, a greeting, thanks, plain chat, or not understood), all from English structure and the dictionary, never from phrase lists.
WHAT YOU DO: START ONLY AFTER the tools are finished (owner order) and the cloud build of the whole project passes. Attach: this file, AXON_ROADMAP_V16_8.md and BASE.zip (the repository, taken after the last merge). Paste the one line.
WHAT TO BRING BACK: ONE zip named B03A-meaning-a.zip (report at docs/reports/B03A_REPORT.md). Give it to Claude (or the next Director account) to inspect with verify_return.py, run the corpus, and try to break it before anything is merged.
PASTE THIS ONE LINE INTO CHATGPT (then attach the files above): Do the job in the attached file B03A_FOR_CHATGPT_MEANING_STAGE_PART_A.md, exactly, using the attached roadmap and the attached BASE zip. Follow the standing rules in it, run and type-check everything yourself, and return one zip.
IF CHATGPT REPLIES WITH ONLY A REVIEW AND A LAW CHECK AND BUILDS NOTHING, paste this in the SAME chat (do not start a new one, do not send it a third time): "Continue now, in this same chat. Do not report again. Write the first file, run its test, then the next. Your next message must contain the zip. If you cannot finish everything, deliver the finished items complete and tested and list the rest."

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB B03A: THE MEANING STAGE, PART A (clauses, material attachment, speech act, polarity)

WHY THIS IS SIZED SMALL: the Meaning stage (roadmap 7.2 stage 4) is split in two. THIS job finds the clauses of a message, attaches the quoted or code material to the right clause, decides each clause's speech act (ask, command, greet, thanks, chat, unknown) and its polarity. Part B (teach, correct, typed slots such as numbers, quantities with units, dates, references) is written AFTER this one is accepted, because it builds on what this job produces (Rule 3: from the foundation up).

FILES THAT MUST EXIST IN THE BASE (stop and say which is missing): src/brain/mind/types.ts, src/brain/mind/stages.ts, src/brain/mind/pipeline.ts, src/brain/mind/legacy.ts, src/brain/mind/analysis/analyze.ts, src/brain/mind/analysis/needs.ts, src/brain/knowledge/slot.ts, src/brain/types.ts, tests/mindPipeline.test.ts, tests/brainGolden.test.ts, tests/fixtures/brainGolden.json, tests/analysis.test.ts, tests/fixtures/analysis100.json, tests/brainBoundary.test.ts, tests/symbols.test.ts. READ all of them, and roadmap sections 3 (FL10, FL12, FL13), 7.2, 7.3 and 7.5, before you design anything.

WHAT EXISTS: stages Intake, Reading (language versus MATERIAL segments: code and quotes) and Analysis (tokens with positions, lemmas, parts of speech and synset ids from the knowledge slot) are built and traced. The Meaning stage is 'not-built': `Frame` is `{ act: 'unknown', confidence }` and `SpeechAct` is only `'unknown'`.

THE DESIGN (follow it; if you find it cannot work, STOP and say why with evidence):
1. TYPES (extend `src/brain/mind/types.ts` without breaking any existing export): `SpeechAct = 'ask' | 'command' | 'greet' | 'thanks' | 'chat' | 'unknown'` (teach and correct arrive in part B); `Clause { span: {start, end}; tokenRange: {from, to}; materialIds: number[] }`; `ClauseFrame { clause: Clause; act: SpeechAct; polarity: 'positive' | 'negative'; confidence: number; reason: string; alternatives: { act: SpeechAct; confidence: number; reason: string }[] }`; `Meaning { clauses: ClauseFrame[]; onlyMaterial: boolean }`; `MindContext` gets an optional `meaning?: Meaning`. Keep `Frame` and the single `frame` field working (set `frame` from the FIRST clause so old code and the golden transcript keep working).
2. CLAUSE SPLITTING (`src/brain/mind/meaning/clauses.ts`): from the Analysis tokens (language segments only). A boundary is sentence punctuation or a coordinating conjunction ONLY when the words after it begin a new clause (a verb in base form or a subject followed by a verb); a conjunction joining two nouns, two quantities, two adjectives or two objects (`salt and pepper`, `5 miles and 3 feet`) is NOT a boundary. A greeting or thanks clause followed by more words is its own clause. Material (quoted text, code) attaches to the NEAREST EARLIER clause that has an instruction and no material yet, otherwise to the nearest earlier clause.
3. SPEECH ACT (`src/brain/mind/meaning/acts.ts`): from generic English STRUCTURE plus dictionary facts, never from phrase lists (FL13). ask = a question mark, or a first language token that is a question word, or an auxiliary placed before its subject; command = an imperative (the first language token is a verb in base form with no subject before it; politeness words and `then` and `now` before it are skipped); polarity negative when a negation word modifies the verb (including the contracted form). greet and thanks are decided by CONCEPT: derive, from the dictionary through the knowledge slot (synset ids on the tokens), a small set of named CONCEPT ANCHORS (`src/brain/mind/meaning/concepts.ts`: for example GREETING and THANKS as synset ids, plus the ids you need for their hypernym chains) and report in your report HOW you derived each id (the lookups you ran and what they returned: MEASURED, never remembered). A clause whose every meaningful token belongs to an anchor concept is that act. If after TWO attempts you cannot derive working anchors for greet or thanks from the dictionary, STOP and report with the evidence; do NOT fall back to word lists. chat = a clause with a subject and a verb that is neither ask nor command; unknown = anything else (no verb and no anchor, gibberish, digits only, a bare question mark).
4. CLOSED SETS (`src/brain/mind/meaning/closedSets.ts`): the ONLY string lists allowed are the small closed sets of English grammar words: question words, auxiliaries, pronouns, determiners, prepositions, coordinating conjunctions, negation words, politeness words and time adverbs such as then and now. Name each set and say in a comment why it is closed grammar and not vocabulary (FL13). No other file under src/brain/mind may hold a list of three or more words or phrases.
5. CONFIDENCE: a number with a recorded reason string (what structural facts decided it). `alternatives` lists the other readings that scored above 0.2 (the polite `can you convert units` is an ask whose alternatives MUST contain a command). Use the constants in `src/brain/matcher.ts` (RUN_AT 0.8, ASK_AT 0.5) as the thresholds; do not invent new ones without a recorded reason.
6. THE STAGE: replace the 'not-built' Meaning stage in `stages.ts` so it runs `buildMeaning(context)`, writes `context.meaning` and `context.frame`, and records a trace entry `state: 'ran'` with a note such as `3 clauses: ask, command, thanks`. A failure inside it is traced as failed and NEVER changes what the user sees: execution still goes through the legacy handlers exactly as before (B4 retires them).
7. NOTHING reaches the chat differently in this job. The golden transcript (79 messages) must replay with ONLY the meaning stage's trace entry differing; the replies are byte for byte the same.

THE CORPUS (test data, not code: it may contain any words because it is documentation and proof, FL13). Create it EXACTLY as `tests/fixtures/meaning-corpus-a.json`. `kind: "core"` items must all pass; `kind: "stretch"` items are only reported. `clauses` lists the expected clauses in order with their act, the number of material regions attached, and polarity. `[]` means no language clause (only material, or empty). A text containing `\n` means a real newline.
````json
[
 {
  "id": "P01",
  "text": "count the words in \"red green blue\"",
  "clauses": [
   {
    "act": "command",
    "material": 1,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P02",
  "text": "convert 5 miles to kilometres",
  "clauses": [
   {
    "act": "command",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P03",
  "text": "please sort these lines \"pear\napple\nfig\"",
  "clauses": [
   {
    "act": "command",
    "material": 1,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P04",
  "text": "open the calculator",
  "clauses": [
   {
    "act": "command",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P05",
  "text": "show me my dictionary",
  "clauses": [
   {
    "act": "command",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P06",
  "text": "set a timer for ten minutes",
  "clauses": [
   {
    "act": "command",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P07",
  "text": "what does serendipity mean?",
  "clauses": [
   {
    "act": "ask",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P08",
  "text": "how many words are in \"one two three\"?",
  "clauses": [
   {
    "act": "ask",
    "material": 1,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P09",
  "text": "is the dictionary ready?",
  "clauses": [
   {
    "act": "ask",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P10",
  "text": "where is my timer",
  "clauses": [
   {
    "act": "ask",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core",
  "note": "no question mark: structure only"
 },
 {
  "id": "P11",
  "text": "why did that fail?",
  "clauses": [
   {
    "act": "ask",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P12",
  "text": "can you convert units",
  "clauses": [
   {
    "act": "ask",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core",
  "note": "polite request: act is ask and the alternatives list MUST contain a command reading"
 },
 {
  "id": "P13",
  "text": "hello",
  "clauses": [
   {
    "act": "greet",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P14",
  "text": "good morning",
  "clauses": [
   {
    "act": "greet",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P15",
  "text": "hey there",
  "clauses": [
   {
    "act": "greet",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P16",
  "text": "thanks",
  "clauses": [
   {
    "act": "thanks",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P17",
  "text": "thank you very much",
  "clauses": [
   {
    "act": "thanks",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P18",
  "text": "it is raining today",
  "clauses": [
   {
    "act": "chat",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P19",
  "text": "I like short answers",
  "clauses": [
   {
    "act": "chat",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "P20",
  "text": "that was helpful",
  "clauses": [
   {
    "act": "chat",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "M01",
  "text": "count the words in \"a b c\" and then convert 5 miles to kilometres",
  "clauses": [
   {
    "act": "command",
    "material": 1,
    "polarity": "positive"
   },
   {
    "act": "command",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "M02",
  "text": "open the timer, then show me the dictionary",
  "clauses": [
   {
    "act": "command",
    "material": 0,
    "polarity": "positive"
   },
   {
    "act": "command",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "M03",
  "text": "hello, what does serendipity mean?",
  "clauses": [
   {
    "act": "greet",
    "material": 0,
    "polarity": "positive"
   },
   {
    "act": "ask",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "M04",
  "text": "thanks. now sort these lines \"b\na\"",
  "clauses": [
   {
    "act": "thanks",
    "material": 0,
    "polarity": "positive"
   },
   {
    "act": "command",
    "material": 1,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "M05",
  "text": "what is a kilometre and how many are in a mile?",
  "clauses": [
   {
    "act": "ask",
    "material": 0,
    "polarity": "positive"
   },
   {
    "act": "ask",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "N01",
  "text": "salt and pepper",
  "clauses": [
   {
    "act": "unknown",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core",
  "note": "a phrase with no verb: one clause, unknown"
 },
 {
  "id": "N02",
  "text": "convert 5 miles and 3 feet to kilometres",
  "clauses": [
   {
    "act": "command",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core",
  "note": "and joins two quantities, NOT two instructions"
 },
 {
  "id": "N03",
  "text": "sort the red and blue lines",
  "clauses": [
   {
    "act": "command",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "N04",
  "text": "count the words and letters in \"ab cd\"",
  "clauses": [
   {
    "act": "command",
    "material": 1,
    "polarity": "positive"
   }
  ],
  "kind": "core",
  "note": "and joins two objects"
 },
 {
  "id": "N05",
  "text": "rock and roll is a kind of music",
  "clauses": [
   {
    "act": "chat",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "N06",
  "text": "what is the difference between a lake and a pond?",
  "clauses": [
   {
    "act": "ask",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "N07",
  "text": "I want tea and coffee",
  "clauses": [
   {
    "act": "chat",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "N08",
  "text": "tom and jerry are cartoon characters",
  "clauses": [
   {
    "act": "chat",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "X01",
  "text": "`rm -rf /`",
  "clauses": [],
  "kind": "core",
  "note": "only material: no language clause, nothing is interpreted"
 },
 {
  "id": "X02",
  "text": "he said \"count the words in this\" yesterday",
  "clauses": [
   {
    "act": "chat",
    "material": 1,
    "polarity": "positive"
   }
  ],
  "kind": "core",
  "note": "quoted words are material and are never obeyed"
 },
 {
  "id": "X03",
  "text": "```\nopen the calculator\n```",
  "clauses": [],
  "kind": "core",
  "note": "a code block is untouchable material"
 },
 {
  "id": "X04",
  "text": "the word \"convert\" has two syllables",
  "clauses": [
   {
    "act": "chat",
    "material": 1,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "X05",
  "text": "qzx plm vbn",
  "clauses": [
   {
    "act": "unknown",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "X06",
  "text": "   ",
  "clauses": [],
  "kind": "core",
  "note": "empty: no clauses"
 },
 {
  "id": "X07",
  "text": "?",
  "clauses": [
   {
    "act": "unknown",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "X08",
  "text": "12345",
  "clauses": [
   {
    "act": "unknown",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "core"
 },
 {
  "id": "X09",
  "text": "do not delete anything",
  "clauses": [
   {
    "act": "command",
    "material": 0,
    "polarity": "negative"
   }
  ],
  "kind": "core"
 },
 {
  "id": "X10",
  "text": "don't convert it",
  "clauses": [
   {
    "act": "command",
    "material": 0,
    "polarity": "negative"
   }
  ],
  "kind": "core"
 },
 {
  "id": "X11",
  "text": "I do not like that",
  "clauses": [
   {
    "act": "chat",
    "material": 0,
    "polarity": "negative"
   }
  ],
  "kind": "core"
 },
 {
  "id": "S01",
  "text": "cuont the wrods in \"a b\"",
  "clauses": [
   {
    "act": "command",
    "material": 1,
    "polarity": "positive"
   }
  ],
  "kind": "stretch",
  "note": "typo tolerance: reported, not required"
 },
 {
  "id": "S02",
  "text": "could you maybe tell me what a mile is",
  "clauses": [
   {
    "act": "ask",
    "material": 0,
    "polarity": "positive"
   }
  ],
  "kind": "stretch",
  "note": "indirect question: reported, not required"
 }
]
````

PROOF REQUIRED (the test file `tests/meaningA.test.ts`):
1. Replay the whole corpus through the real pipeline: for every core item the clause count, each clause's act, material count and polarity must match. Print a CONFUSION TABLE (expected act by actual act, first clause) and precision and recall per act. Acceptance: 100 percent of core items; stretch items reported with their result.
2. Golden transcript: replay `tests/fixtures/brainGolden.json` and show that only the meaning trace entry changed.
3. A NEGATIVE suite of at least 40 NEW messages you write yourself (not from the corpus): quoted commands, code, noun phrases with `and`, statements that start with a verb-looking noun, long chat sentences, other punctuation, mixed case, extra spaces, emoji, right-to-left text; each with its expected result; derive them BEFORE running. Deliberately break the code (mutation tests: change a rule and show the corpus catches it) at least 5 times.
4. STATIC GUARDS (new `tests/meaningNoPhrases.test.ts`): no regular-expression literal anywhere under src/brain/mind; no array of three or more string literals under src/brain/mind outside closedSets.ts and (for synset ids only) concepts.ts; `tests/brainBoundary.test.ts` still passes.
5. Budget: measure and print milliseconds for the Meaning stage over the corpus (MEASURED, on your machine; the roadmap's budget for the whole understanding is well under half a second on the weakest phone).
6. Run every existing test command in the `test:kernel` script and the strict type check; all must pass.

LANE: NEW src/brain/mind/meaning/clauses.ts, acts.ts, concepts.ts, closedSets.ts, index.ts, build.ts; tests/meaningA.test.ts, tests/meaningNoPhrases.test.ts, tests/fixtures/meaning-corpus-a.json, docs/reports/B03A_REPORT.md. CHANGED (minimal): src/brain/mind/types.ts (additive), src/brain/mind/stages.ts (the Meaning stage only), src/brain/mind/index.ts if an export is needed. Nothing else. Report the exact line to add to `test:kernel`.
DONE MEANS: corpus 100 percent on core items, confusion table printed, golden transcript unchanged, static guards pass, mutation tests killed, strict `tsc` and all existing tests pass, report written with the LAW CHECK and how each concept anchor was derived.

## STANDING RULES (apply to every step of the job)

START RULE: after the one short paragraph and the LAW CHECK, START BUILDING IN THE SAME REPLY. Do not ask permission, do not stop to restate a plan, do not end your turn with a status report. Your next deliverable after the LAW CHECK is working files and, at the end, the zip. A reply that contains only a review and a Law Check is a FAILED delivery (this has happened before). Work in small verified steps: write ONE file, run its test, fix it, then the next file.

QUALITY LAW (owner, ABSOLUTE): the result must be perfect on its FIRST delivery. Do not hand back anything that merely looks finished.
1. RUN everything yourself in your sandbox before you hand anything over: unpack the repository zip you were given, install what it needs (package.json, tsconfig.json, tsx and the tests under tests/ are there), run every new test with `npx tsx tests/NAME.test.ts`, run the existing tests the job could affect (at least every command in the `test:kernel` script of package.json that does not depend on this job being merged), and run the type check with the project's own options (`npx tsc --noEmit -p tsconfig.json`; this is the project's `lint` script). A returned file that fails the type check is a failed delivery.
2. If your sandbox cannot run something (no internet to install, no tsx, no tsc), say exactly which step was NOT RUN and why, and do the strictest manual check you can. Never write "should work" or "tested" for something you did not run. Evidence labels: MEASURED (you ran it and saw the result), NOT RUN, HYPOTHESIS.
3. NO stubs, NO placeholders, NO "TODO", NO empty functions, NO hard-coded or fake results, NO simplified version that only works for the happy path, NO file that compiles but does nothing. Every error path returns a typed, honest error. Never claim an ability the code does not have.
4. Derive every expected number in a test by an INDEPENDENT calculation (Python with Decimal, hashlib, zlib and so on), never from memory. Break each new behaviour on purpose (empty input, huge input, odd characters, emoji, right-to-left text, zero, negative, wrong types) and keep those cases as tests. Seeded random tests use a fixed seed so they repeat.
5. If you cannot finish everything in one run, work in the PRIORITY ORDER given, deliver the finished items complete and tested, and list the unfinished ones plainly. NEVER deliver a half-built item. A smaller perfect delivery beats a larger broken one. Redoing work is worse than anything.
6. The weakest phone we support is an Infinix Note 10 (low memory). Cap input sizes with an honest typed error, never loop without a bound, never allocate without a bound.

ENGINE CONTRACT (every engine file in this job):
- PURE TypeScript. No React, no JSX, no DOM, no `window`, no `localStorage`, no network. Anything that needs time, randomness or storage is INJECTED as a parameter so tests control it. (The only exception is a job that names a .tsx file in its LANE.)
- Exported limit constants (for example `LOAN_LIMITS`) and exported types. Functions never throw for bad input: they return a typed result such as `{ ok: true, ... } | { ok: false, error: 'code', message: 'plain words' }`.
- Each tool-facing engine file also exports ONE descriptor object named `<TOOL>_DESCRIPTOR` = `{ toolId, displayName, purpose, examples: string[], inputs: { name: string; kind: 'text' | 'choice' | 'file' | 'yes-no'; choices?: string[]; prompt?: string }[] }` with 2 or 3 honest examples (documentation and tests only; the brain never matches on them: FL13). The `toolId` MUST be the exact catalog id from `src/tools/toolCatalog.ts`: loan-calculator, split-bill, pattern-tester, device-profile, json-viewer, file-inspector, qr-maker, zip-tool, code-formatter, file-compare (a new entry added later), and 'converter' for the format hubs and image planning. Do NOT register anything in the capability registry and do NOT edit the tool menu: a later job does both.
- No new dependency (jszip is already installed; only a job that names it may use it). No regular-expression literal inside `src/brain/mind`. Never add words or phrases to the brain.

LANE AND FILES: create or change ONLY the files named in the LANE section. Never edit package.json, tools/files.lock, tools/guard.mjs, .github, public/dictionary, src/App.tsx, src/tools/toolCatalog.ts or anything under src/components (unless the LANE names it). Never delete, rename or shorten an existing file. Do NOT edit package.json: REPORT the exact new lines to add to the `test:kernel` script (each as `tsx tests/NAME.test.ts`).

RETURN: ONE zip of NEW and CHANGED files only, paths relative to the repository root, no top folder needed, no nested zips, containing the report file named in the job. Create it with your code tool and give the download link. The report must contain: your LAW CHECK; every file created or changed; the exact commands you ran with the real pass or fail results and check counts; anything NOT RUN; anything unfinished; the package.json test lines to add.

CHECK THE BASE FIRST: the job names files that must exist in the repository zip you were given. If any is missing, STOP and say which.
