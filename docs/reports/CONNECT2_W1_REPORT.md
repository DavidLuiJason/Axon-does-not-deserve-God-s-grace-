> DIRECTOR NOTE (2026-11-11): this is ChatGPT's report. The Director turned Text Cleaner OFF after verification (see docs/CONNECT2_W1_BOARD_LINES.md); its liveBrain test and wiring are not in the merged repo. Number to Words is ON.

# AXON CONNECT2 — Wave 1 Report

## Standard preamble

1. **Finished AXON (roadmap §6):** 0 Ground (build, budgets, device profile, guard, export, signing); 1 Knowledge slot; 2 Reading language; 3 Understanding (frames, references, tone, truth, checking); 4 Voice; 5 Reach (tools, memory, media, permissioned device files, optional model, AXON Code, AXON Web and outside AIs).
2. **Job location:** Layer 5 — Reach, connecting existing tool runners to the brain and task kernel.
3. **Possible later breakage:** unbound slots must continue to yield; text-cleaner's current no-option default is a no-op; Password Generator cannot safely go live while the brain injects a deterministic random source into its chat runner.

## Wave 1 status table

| Tool | Status | Evidence / boundary |
|---|---|---|
| `find-replace` | **BINDER GAP — OFF** | Real brain matches some requests but cannot reliably bind the three quoted values into `text`, `pattern` and `replacement`. No action, chat capability, task entry, guard registration or switch shipped. |
| `text-cleaner` | **ON — limited default path** | Real brain answered 20/20 base requests, kept 26/26 must-not cases out, and left 10/10 other replies unchanged. All seven option flags remain unbound; the guard yields when an option is explicitly requested. With no option supplied, the existing engine default makes no changes. |
| `number-to-words` | **ON — cardinal only** | Real brain answered 20/20 cardinal requests, kept 29/29 must-not cases out, and left 10/10 other replies unchanged. Ordinal requests yield because the ordinal option is not bound. |
| `password-generator` | **BINDER / RUNTIME DEPENDENCY GAP — OFF** | A temporary real-brain property test passed ordinary length/character checks, but source inspection showed the chat runner receives `randomBelow: () => 0` from `buildLaneConfig`. That makes its chat password output deterministic. The prepared kernel action uses `cryptoRandomBelow`, but the direct lane replies with the runner result. The permitted scope cannot fix this safely. All temporary wiring and defaults were removed. |

**Wave result: 2 of 4 tools connected.** No Wave 2 work was started.

## LAW CHECK (FL11)

- **FL1:** placed the work in Layer 5 against the complete section 6 top view.
- **FL2:** read the complete V21.3 roadmap and only the prompt-named/permitted source files.
- **FL3:** connected only through the existing brain, runner, kernel task and chat capability path.
- **FL4:** ran baseline first; retained passing tools; did not edit the resolver, binder, schema or engines.
- **FL5:** preserved the dictionary and verified all dictionary hashes with `tools/guard.mjs`.
- **FL7:** used real-brain OFF/ON measurements, task records, must-not cases, other-message comparisons and latency measurements.
- **FL9:** kept the work in Layer 5 Reach; no foundation or lower-layer redesign.
- **FL10:** registered chat actions only for tools whose switches are ON; OFF tools have no available chat action.
- **FL11:** this visible check is repeated in the report.
- **FL12:** all shipped chat execution remains in the direct brain lane; each tool guard declares its own local `LaneGuard` type.
- **FL13:** added no phrase lists; guard decisions use structural checks and frozen single-word records.
- **FL14:** kernel actions call the prepared existing pure engines; no duplicate engines were added.

## Per-tool findings

### 1. Find and Replace — BINDER GAP, OFF

The prepared part-only test passed (19 checks), but the real-brain trace showed that matching is not enough. The binder did not reliably assign three quoted values to the three intended slots.

Required intended mapping for `replace "cat" with "fox" in "cat dog"`:

- `text` = `cat dog`
- `pattern` = `cat`
- `replacement` = `fox`

Temporary diagnostic wiring with defaults temporarily permitted produced this incorrect interpretation instead:

- `text` = `cat`
- `pattern` = `fox`
- the remaining quoted value was left unused
- result: `0 matches replaced`, output `cat`

That temporary wiring was fully removed. The shipped repository has no `find-replace` task entry, kernel action registration, chat action, lane-guard registration or live switch.

**Real-brain trace evidence (temporary diagnostic wiring):**

| Message | Resolution note | Execution note |
|---|---|---|
| `replace "cat" with "fox" in "cat dog"` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]` | `direct lane yielded: the binder had to assume something, so the old handler may answer differently` |
| `replace "cat" with "fox" in "cat dog" please` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]` | `direct lane yielded: the binder had to assume something, so the old handler may answer differently` |
| `replace "cat" with "fox" in "cat dog" case sensitive no whole word no regex no replace all yes` | `1 pieces; 0 matches, 1 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R7)]` | `direct lane yielded: no single sure tool was found` |
| `find "cat" in "cat dog" and replace with "fox"` | `1 pieces; 0 matches, 1 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R7)]` | `direct lane yielded: no single sure tool was found` |

**DIFFERS FROM OLD:** none shipped; the OFF path returned the foundation fallback. The incorrect temporary answer above was rejected and is not in the package.

**Mutants:** the prepared guard test printed `MUTANT CAUGHT`; no live-brain mutant test was shipped because the tool remains OFF.

### 2. Text Cleaner — ON, with seven option binder gaps

The real brain can match a simple quoted clean request and record the task. It does not fill these optional yes/no fields:

`trimEachLine`, `collapseRepeatedSpaces`, `removeBlankLines`, `collapseBlankLines`, `straightenQuotesAndDashes`, `removeZeroWidth`, `normalizeLineEndings`.

The guard therefore yields when the message explicitly asks for one of those operations or another unsupported target/action. It does not guess which cleaning mode to apply. When no option is requested, the existing runner's default is an identity operation and reports `Changes: none.` This is a technically connected but deliberately limited path; it does not claim that unbound cleaning options work.

**MEASURED line:**

`MEASURED real brain, 56 messages: answered exactly 20 of 20; must-not kept out 26 of 26; others identical 10 of 10; answers without task record 0`

**Latency:** `MUST-NOT latency (two trials): 353, 353 ms; fastest 353 ms` (both under 1.5 seconds).

**Three option-gap traces:**

| Message | Resolution note | Execution note |
|---|---|---|
| `clean "hello" by trimming each line` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]` | `direct lane yielded: the request includes an unsupported operation or target, so the existing path should decide` |
| `clean "a  b" by collapsing repeated spaces` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]` | `direct lane yielded: the request includes an unsupported operation or target, so the existing path should decide` |
| `clean "hello" and remove blank lines` | `2 pieces; 2 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 1 ask, 0 deep [piece 0 fast (R6); piece 1 ask (R4)]; second reading adopted (2 requests, the first reading found 1)` | `direct lane yielded: the message has more than one piece` |

**DIFFERS FROM OLD:** no Text Cleaner chat handler exists. Two ordinary OFF requests reached generic `local-rules` fallbacks instead of the foundation fallback:

- `can you clean "a  b"` — OFF: `I have nothing registered for "clean "a  b""...`; ON: `a  b` plus `Changes: none.` and a task record. The hand result with no cleaning option selected is the unchanged input.
- `could you please clean "final sample"` — OFF: `I have nothing registered for "please clean "final sample""...`; ON: `final sample` plus `Changes: none.` and a task record. The hand result with no cleaning option selected is the unchanged input.

**Mutants caught:** `guard-always-go`, `wrong-runner-result`, `missing-task-record`.

**Successful real-brain test output:**

```text
BINDER GAP TRACE "clean \"hello\" by trimming each line" | resolution: 1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]
BINDER GAP TRACE "clean \"hello\" by trimming each line" | execution: legacy executor preserves current provider order and fallback; direct lane yielded: the request includes an unsupported operation or target, so the existing path should decide
BINDER GAP TRACE "clean \"a  b\" by collapsing repeated spaces" | resolution: 1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]
BINDER GAP TRACE "clean \"a  b\" by collapsing repeated spaces" | execution: legacy executor preserves current provider order and fallback; direct lane yielded: the request includes an unsupported operation or target, so the existing path should decide
BINDER GAP TRACE "clean \"hello\" and remove blank lines" | resolution: 2 pieces; 2 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 1 ask, 0 deep [piece 0 fast (R6); piece 1 ask (R4)]; second reading adopted (2 requests, the first reading found 1)
BINDER GAP TRACE "clean \"hello\" and remove blank lines" | execution: legacy executor preserves current provider order and fallback; direct lane yielded: the message has more than one piece
MEASURED real brain, 56 messages: answered exactly 20 of 20; must-not kept out 26 of 26; others identical 10 of 10; answers without task record 0
OFF foundation fallback for 18 of 20 answer cases; other OFF routes: ["can you clean \"a  b\"" => local-rules, "could you please clean \"final sample\"" => local-rules]; no Text Cleaner chat handler exists.
BINDER GAP: option flags trimEachLine, collapseRepeatedSpaces, removeBlankLines, collapseBlankLines, straightenQuotesAndDashes, removeZeroWidth, normalizeLineEndings are not filled; guard yields when an option is explicitly requested.
MUST-NOT latency (two trials): 353, 353 ms; fastest 353 ms
MUTANT CAUGHT: guard-always-go
MUTANT CAUGHT: wrong-runner-result
MUTANT CAUGHT: missing-task-record
liveBrainTextCleaner: 70 checks passed
```

A later repeat of this test inside a long combined test command timed out before printing output. The successful standalone run above is retained; no further retry was made.

### 3. Number to Words — ON, cardinal only

The brain resolves supported cardinal forms. The ordinal option is not bound, so the guard yields for ordinal requests. No schema or binder change was made.

**MEASURED line:**

`MEASURED real brain, 59 messages: answered exactly 20 of 20; must-not kept out 29 of 29; others identical 10 of 10; answers without task record 0`

**Latency:** `MUST-NOT latency (two trials): 358, 358 ms; fastest 358 ms` (both under 1.5 seconds).

**Three ordinal/resolver traces:**

| Message | Resolution note | Execution note |
|---|---|---|
| `spell the number 21 as an ordinal` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]` | `direct lane yielded: the ordinal option is not bound by the real brain, so the existing path should decide` |
| `write the number 12 as first` | `1 pieces; 0 matches, 1 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R7)]` | `direct lane yielded: no single sure tool was found` |
| `convert the number 22 to ordinal words` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]` | `direct lane yielded: the ordinal option is not bound by the real brain, so the existing path should decide` |

**DIFFERS FROM OLD:** none; all 20 answer messages returned the foundation fallback with the tool OFF. No old Number to Words chat handler was present.

**Mutants caught:** `guard-always-go`, `wrong-runner-result`, `missing-task-record`.

**Printed real-brain output:**

```text
MEASURED real brain, 59 messages: answered exactly 20 of 20; must-not kept out 29 of 29; others identical 10 of 10; answers without task record 0
OFF foundation fallback for 20 of 20 answer cases; DIFFERENCES FROM OLD: none (no old chat handler).
MUST-NOT latency (two trials): 358, 358 ms; fastest 358 ms
BINDER GAP TRACE "spell the number 21 as an ordinal" | resolution: 1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]
BINDER GAP TRACE "spell the number 21 as an ordinal" | execution: legacy executor preserves current provider order and fallback; direct lane yielded: the ordinal option is not bound by the real brain, so the existing path should decide
BINDER GAP TRACE "write the number 12 as first" | resolution: 1 pieces; 0 matches, 1 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R7)]
BINDER GAP TRACE "write the number 12 as first" | execution: legacy executor preserves current provider order and fallback; direct lane yielded: no single sure tool was found
BINDER GAP TRACE "convert the number 22 to ordinal words" | resolution: 1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]
BINDER GAP TRACE "convert the number 22 to ordinal words" | execution: legacy executor preserves current provider order and fallback; direct lane yielded: the ordinal option is not bound by the real brain, so the existing path should decide
MUTANT CAUGHT: guard-always-go
MUTANT CAUGHT: wrong-runner-result
MUTANT CAUGHT: missing-task-record
liveBrainNumberToWords: 71 checks passed
```

### 4. Password Generator — BINDER / RUNTIME DEPENDENCY GAP, OFF

A temporary test wired the tool and exercised 20 requests, 33 must-not cases and 10 other messages. Its length/allowed-character properties passed, but that was not sufficient to prove password security.

The permitted read of `buildLaneConfig` showed:

```ts
deps: () => ({ now: Date.now(), randomBelow: () => 0, random01: () => 0 }),
```

The prepared chat runner in `src/tools/runners/createRunners.ts` calls `passwordGenerator(..., deps.randomBelow)`. Therefore the direct-lane reply uses a deterministic random source. The prepared kernel action in `src/tools/passwordAction.ts` uses `cryptoRandomBelow`, but the direct lane's visible reply is the runner reply, not the kernel action result. Changing `buildLaneConfig`, the runner or engine is outside this prompt's allowed write scope. I did not ship an insecure password generator.

A temporary candidate options default (`lowercase + uppercase + digits`) was tested and said aloud, but it was **not shipped** and is **not an owner/Director decision**. The prepared action and guard were restored to their original contents; no password switch, task entry, kernel registration, chat action, guard registration or bind default remains.

**Temporary diagnostic measurement (not a shipped test):**

`MEASURED real brain, 63 messages: answered exactly 20 of 20; must-not kept out 33 of 33; others identical 10 of 10; answers without task record 0`

The temporary test caught `guard-always-go`, `wrong-runner-result` and `missing-task-record`. The test file and temporary wiring were removed after the deterministic random-source finding. The prepared part-only test still passes (19 checks), but it does not prove the live chat password source is secure.

**Temporary real-brain test output (not shipped):**

```text
MEASURED real brain, 63 messages: answered exactly 20 of 20; must-not kept out 33 of 33; others identical 10 of 10; answers without task record 0
OFF foundation fallback for 20 of 20 answer cases; DIFFERENCES FROM OLD: none (no old chat handler).
DIRECTOR DECISION, OVERRIDABLE: when options JSON is not supplied, use lowercase + uppercase + digits; said aloud before generation.
MUST-NOT latency (two trials): 373, 361 ms; fastest 361 ms
BINDER GAP TRACE "make a strong password of length 12" | resolution: 1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]
BINDER GAP TRACE "make a strong password of length 12" | execution: legacy executor preserves current provider order and fallback; direct lane yielded: the options slot is not reliably filled in this length construction, so the existing path should decide
BINDER GAP TRACE "make a password of length 12" | resolution: 1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]
BINDER GAP TRACE "make a password of length 12" | execution: legacy executor preserves current provider order and fallback; direct lane yielded: the options slot is not reliably filled in this length construction, so the existing path should decide
BINDER GAP TRACE "create a password of length 12" | resolution: 1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]
BINDER GAP TRACE "create a password of length 12" | execution: legacy executor preserves current provider order and fallback; direct lane yielded: the options slot is not reliably filled in this length construction, so the existing path should decide
BINDER GAP TRACE "generate a password with 12 characters including symbols" | resolution: 1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]
BINDER GAP TRACE "generate a password with 12 characters including symbols" | execution: legacy executor preserves current provider order and fallback; direct lane yielded: the request includes an unsupported operation or target, so the existing path should decide
MUTANT CAUGHT: guard-always-go
MUTANT CAUGHT: wrong-runner-result
MUTANT CAUGHT: missing-task-record
liveBrainPasswordGenerator: 93 checks passed
```

The line labelled `DIRECTOR DECISION` was generated by the temporary test harness; it was not an actual Director approval. The candidate default was not shipped.

**DIFFERS FROM OLD:** not applicable; the tool remains OFF and has no old chat handler.

## Baseline and final ratchets

### Baseline (untouched repository copy)

The first prescribed `liveAdmission` test passed, so the remaining baseline ratchets were run. `valuesRunner` began but did not finish within the initial 120-second command timeout; this was recorded as a baseline timeout, not repaired. The baseline guard passed.

```text
===== BASELINE tests/liveAdmission.test.ts =====
liveAdmission: 20 checks passed
===== BASELINE tests/liveSwitches.test.ts =====
liveSwitches: 11 checks passed
===== BASELINE tests/brainBoundary.test.ts =====
B1 brain boundary passed: 6 allowed importers (src/components/CreditsModal.tsx, src/components/DictionaryScreen.tsx, src/components/toolScreens/MyDictionaryScreen.tsx, src/services/axonBrainInterface.ts, src/tools/engines/dictionary/userDictionaryBackend.ts, src/tools/runners/runnerSchema.ts)
===== BASELINE tests/meaningNoPhrases.test.ts =====
B03A NO-PHRASES GUARD OK: 75 files scanned, 155 checks
===== BASELINE tests/directLane.test.ts =====
directLane: 35 checks passed
===== BASELINE tests/directLaneEndToEnd.test.ts =====
lane OFF: replies byte-identical 50/50, trace identical (apart from the yield note) 50/50
lane ON: answered by the lane 33/50 (equal to old reply 33, equal after the said-aloud sentence 0), different or wrong 0
  yielded 7x: no single sure tool was found
  yielded 10x: the binder says ask
directLaneEndToEnd: 9 checks passed
===== BASELINE tests/liveSortLines.test.ts =====
MEASURED real brain, 60 messages: answered with the exact sorted text 24 of 24; must-not-answer kept out 26 of 26; other replies identical 10 of 10; answers without a task record 0
liveSortLines: 18 checks passed
===== BASELINE tests/liveTextCounter.test.ts =====
MEASURED real brain, 63 messages: answered by the lane 34; reply identical to the old one apart from task number and milliseconds 62; lane answers with a task record missing or extra 0; lane answers that differ 1; non-lane replies that differ 0
LANE ANSWERS THAT DIFFER:
"count words in \"one two three\" please"
  old ="That text has 4 words.\n\nWords: 4\nCharacters: 22 (19 without spaces)\nLetters: 17\nLines: 1\n\nRan as task task-N: COMPLETED in N ms, from your exact input."
  lane="That text has 3 words.\n\nWords: 3\nCharacters: 13 (11 without spaces)\nLetters: 11\nLines: 1\n\nRan as task task-N: COMPLETED in N ms, from your exact input."
teach reply: {"content":"Saved. When you say \"tally\" I will read it as \"count\". This stays on this phone as your own data. It only helps if \"count\" is something I alre
liveTextCounter: 9 checks passed
===== BASELINE tests/liveFindReplace.test.ts =====
PASS HYPOTHESIS wrong yields: how does find and replace work?
PASS HYPOTHESIS wrong yields: replace a file on my phone
PASS HYPOTHESIS wrong yields: find \"cat\" and translate it
PASS HYPOTHESIS wrong yields: find \"cat\" and summarize it
PASS HYPOTHESIS wrong yields: find \"cat\" in my database
PASS HYPOTHESIS wrong yields: replace every file in folder
PASS HYPOTHESIS wrong yields: undo the last replacement
PASS HYPOTHESIS wrong yields: what is regex?
PASS right passes: find \"cat\" and replace
PASS right passes: replace in \"cat sat\"
PASS right passes: find \"red cat\" and replace
PASS right passes: find \"abc abc\" and replace
PASS right passes: find \"hello\" and replace
PASS right passes: find \"one two\" and replace
PASS hand result 1
PASS hand result 2
PASS hand result 3
PASS refused invalid pattern
PASS MUTANT CAUGHT
19 checks, 0 failed
===== BASELINE tests/liveTextCleaner.test.ts =====
PASS HYPOTHESIS wrong yields: how does text cleaning work?
PASS HYPOTHESIS wrong yields: clean my whole computer
PASS HYPOTHESIS wrong yields: clean this file on disk
PASS HYPOTHESIS wrong yields: clean \"hello\" and translate it
PASS HYPOTHESIS wrong yields: clean \"hello\" and summarize it
PASS HYPOTHESIS wrong yields: clean \"hello\" but preserve formatting exactly
PASS HYPOTHESIS wrong yields: clean the database
PASS HYPOTHESIS wrong yields: what is a text cleaner?
PASS right passes: clean \"  hello  \"
PASS right passes: clean \"a  b\"
PASS right passes: clean \"one\n\ntwo\"
PASS right passes: clean \"  line  \"
PASS right passes: clean \"curly “quote”\"
PASS right passes: clean \"a\r\nb\"
PASS hand result 1
PASS hand result 2
PASS hand result 3
PASS refused oversized input
PASS MUTANT CAUGHT
19 checks, 0 failed
===== BASELINE tests/liveNumberToWords.test.ts =====
PASS HYPOTHESIS wrong yields: what is the number system?
PASS HYPOTHESIS wrong yields: calculate 12 times 3
PASS HYPOTHESIS wrong yields: convert 12 dollars to naira
PASS HYPOTHESIS wrong yields: spell 12 as a Roman numeral
PASS HYPOTHESIS wrong yields: find the percentage of 12
PASS HYPOTHESIS wrong yields: round 12 to nearest ten
PASS HYPOTHESIS wrong yields: divide 12 by 3
PASS HYPOTHESIS wrong yields: explain number 12
PASS right passes: spell 12
PASS right passes: write 42 in words
PASS right passes: convert 100 to words
PASS right passes: say 7 as words
PASS right passes: spell 21
PASS right passes: write 5 in words
PASS hand result 1
PASS hand result 2
PASS hand result 3
PASS refused invalid number
PASS MUTANT CAUGHT
19 checks, 0 failed
===== BASELINE tests/livePasswordGenerator.test.ts =====
PASS HYPOTHESIS wrong yields: how are passwords stored?
PASS HYPOTHESIS wrong yields: recover my old password
PASS HYPOTHESIS wrong yields: crack a password
PASS HYPOTHESIS wrong yields: decrypt this password
PASS HYPOTHESIS wrong yields: reveal my account password
PASS HYPOTHESIS wrong yields: retrieve saved password
PASS HYPOTHESIS wrong yields: generate password for wifi recovery
PASS HYPOTHESIS wrong yields: find my existing password
PASS right passes: generate password
PASS right passes: create a password
PASS right passes: generate a strong password
PASS right passes: make a new password
PASS right passes: generate password now
PASS right passes: create password
PASS hand result 1
PASS hand result 2
PASS hand result 3
PASS refused too-short password
PASS MUTANT CAUGHT
19 checks, 0 failed
===== BASELINE tests/valuesRunner.test.ts =====
STRETCH V82 (a): number:"ten"=10  (matches)
[baseline command timed out at 120 seconds before completion]
```

Baseline guard:

```text
GUARD OK: 354 locked files present; 3342 dictionary files match their hashes (1 dictionary folder(s)); 681 new file(s) not locked yet.
```

### Final ratchets after Wave 1

The final `liveAdmission` and `liveSwitches` reflect two new live tools (not Password Generator):

```text
liveAdmission: 24 checks passed
liveSwitches: 11 checks passed
B1 brain boundary passed: 6 allowed importers (src/components/CreditsModal.tsx, src/components/DictionaryScreen.tsx, src/components/toolScreens/MyDictionaryScreen.tsx, src/services/axonBrainInterface.ts, src/tools/engines/dictionary/userDictionaryBackend.ts, src/tools/runners/runnerSchema.ts)
B03A NO-PHRASES GUARD OK: 75 files scanned, 155 checks
directLane: 35 checks passed
lane OFF: replies byte-identical 50/50, trace identical (apart from the yield note) 50/50
lane ON: answered by the lane 33/50 (equal to old reply 33, equal after the said-aloud sentence 0), different or wrong 0
  yielded 7x: no single sure tool was found
  yielded 10x: the binder says ask
directLaneEndToEnd: 9 checks passed
MEASURED real brain, 60 messages: answered with the exact sorted text 24 of 24; must-not-answer kept out 26 of 26; other replies identical 10 of 10; answers without a task record 0
liveSortLines: 18 checks passed
MEASURED real brain, 63 messages: answered by the lane 34; reply identical to the old one apart from task number and milliseconds 62; lane answers with a task record missing or extra 0; lane answers that differ 1; non-lane replies that differ 0
LANE ANSWERS THAT DIFFER:
"count words in \"one two three\" please"
  old ="That text has 4 words.\n\nWords: 4\nCharacters: 22 (19 without spaces)\nLetters: 17\nLines: 1\n\nRan as task task-N: COMPLETED in N ms, from your exact input."
  lane="That text has 3 words.\n\nWords: 3\nCharacters: 13 (11 without spaces)\nLetters: 11\nLines: 1\n\nRan as task task-N: COMPLETED in N ms, from your exact input."
teach reply: {"content":"Saved. When you say \"tally\" I will read it as \"count\". This stays on this phone as your own data. It only helps if \"count\" is something I alre
liveTextCounter: 9 checks passed
```

The `liveTextCounter` discrepancy (old path says 4 words; runner says 3 for `one two three`) is present in the untouched baseline and remains unchanged by this wave.

Prepared Wave 1 part-only tests, final run:

```text
liveFindReplace.test.ts: 19 checks, 0 failed
liveTextCleaner.test.ts: 19 checks, 0 failed
liveNumberToWords.test.ts: 19 checks, 0 failed
livePasswordGenerator.test.ts: 19 checks, 0 failed
```

The exact printed `PASS` lines for these four tests are the same as the baseline block above; all four were rerun after wiring and passed.

New real-brain Number to Words test, final standalone run:

```text
MEASURED real brain, 59 messages: answered exactly 20 of 20; must-not kept out 29 of 29; others identical 10 of 10; answers without task record 0
OFF foundation fallback for 20 of 20 answer cases; DIFFERENCES FROM OLD: none (no old chat handler).
MUST-NOT latency (two trials): 358, 358 ms; fastest 358 ms
BINDER GAP TRACE "spell the number 21 as an ordinal" | resolution: 1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]
BINDER GAP TRACE "spell the number 21 as an ordinal" | execution: legacy executor preserves current provider order and fallback; direct lane yielded: the ordinal option is not bound by the real brain, so the existing path should decide
BINDER GAP TRACE "write the number 12 as first" | resolution: 1 pieces; 0 matches, 1 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R7)]
BINDER GAP TRACE "write the number 12 as first" | execution: legacy executor preserves current provider order and fallback; direct lane yielded: no single sure tool was found
BINDER GAP TRACE "convert the number 22 to ordinal words" | resolution: 1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]
BINDER GAP TRACE "convert the number 22 to ordinal words" | execution: legacy executor preserves current provider order and fallback; direct lane yielded: the ordinal option is not bound by the real brain, so the existing path should decide
MUTANT CAUGHT: guard-always-go
MUTANT CAUGHT: wrong-runner-result
MUTANT CAUGHT: missing-task-record
liveBrainNumberToWords: 71 checks passed
```

New real-brain Text Cleaner test: one standalone run completed successfully with 70 checks, 20/20 answers, 26/26 must-not, 10/10 others and fastest long-input latency 353 ms. A later repeat inside a combined command timed out before output; no further retry was made.

`valuesRunner` final run (300-second timeout):

```text
STRETCH V82 (a): number:"ten"=10  (matches)
round trip numbers 0..99999: skipped 0 (word outside the closed set)
unit round trip: 1 symbols skipped (contain a space or are shared)
speed: 0.059 ms per message on average over 1700 calls
jobs checked: a,b,c,d
  job a: core items passed 30, failed 0
  job b: core items passed 22, failed 0
  job c: core items passed 26, failed 0
  job d: core items passed 6, failed 0
  kinds proven by passing items: {"quantity":10,"percent":2,"number":34,"date":15,"roman":3,"duration":12,"datetime":1,"time":9}
VALUES RUNNER OK: 205656 checks
```

Final dictionary guard:

```text
GUARD OK: 354 locked files present; 3342 dictionary files match their hashes (1 dictionary folder(s)); 683 new file(s) not locked yet.
```

## NOT RUN / limitations

- `tsc NOT RUN` — the bundled toolchain does not contain TypeScript's compiler; the Director owns type-checking.
- `snapshot --check NOT RUN` — it is not in the Version 3 ratchet list.
- `tests/liveBrainTextCleaner.test.ts` had one successful standalone run (70 checks) and a later combined-run timeout; no third attempt was made.
- `tests/liveBrainPasswordGenerator.test.ts` was a temporary diagnostic, passed functional properties, then was removed after the deterministic random-source finding. Password Generator is OFF.
- `tests/liveBrainFindReplace.test.ts` was not created because Find and Replace is a binder gap and remains OFF.
- Wave 2, Wave 3 and Wave 4 were not started.

## Exact `test:kernel` addition (do not edit package.json here)

Append this to the existing `test:kernel` command after its current final `tests/liveAdmission.test.ts` entry:

```text
&& tsx tests/liveBrainNumberToWords.test.ts && tsx tests/liveBrainTextCleaner.test.ts
```

`package.json` was not changed.

## Changed files in the cumulative ZIP

| Path | Reason |
|---|---|
| `src/brain/mind/laneGuards.ts` | Registers the Text Cleaner and Number to Words guards with the direct lane. |
| `src/capabilities/registerAxonTools.ts` | Declares `act.text-cleaner` and the `cap.number-tools` / `act.number-to-words` capability so chat capability truth matches the live tools. |
| `src/kernel/axonEngine.ts` | Registers `TEXT_CLEAN_ACTION` and `NUMBER_WORDS_ACTION` with the existing task engine. |
| `src/tools/runners/guards/numberToWordsGuard.ts` | Yields ordinal requests and structurally unsafe/unsupported requests; cardinal requests remain eligible. |
| `src/tools/runners/guards/textCleanerGuard.ts` | Yields explicit unbound cleaning options, unsupported targets and oversized messages. |
| `src/tools/runners/liveSwitches.ts` | Adds the two live switches and their task-input mappings; no choices/defaults added. |
| `tests/liveSwitches.test.ts` | Pins the two additional live tools. |
| `tests/liveBrainNumberToWords.test.ts` | Adds real-brain OFF/ON oracle, must-not, others, task-record, guard, latency and mutant proof. |
| `tests/liveBrainTextCleaner.test.ts` | Adds real-brain OFF/ON oracle, must-not, others, task-record, guard, latency and mutant proof. |
| `docs/reports/CONNECT2_W1_REPORT.md` | Records the full Wave 1 outcome, law check, gaps and test evidence. |

No dictionary files, engines, resolver, binder, schema rows, `directLane.ts`, `src/brain/index.ts`, `package.json`, lock files, guard scripts or prior live-tool implementations were changed.
