# AXON CONNECT2 — WAVE 2 REPORT

**Workflow:** FASTER WORKFLOW, ROUND 1, VERSION 3  
**Wave:** 2 of 4  
**Base:** owner-supplied `Axon-does-not-deserve-God-s-grace--main (29).zip`  
**Delivery:** cumulative patch; contains every file changed or added since that base, including Wave 1.  
**Status:** WAVE 2 DELIVERED — 2 of 3 tools ON; 1 RESOLVER GAP.

## Wave 2 status (at top, as required)

| Tool | Final status | Evidence / reason |
|---|---|---|
| `hash-tool` | **ON** | Real brain: 20/20 exact known hash vectors; 27/27 must-not kept out; 10/10 other replies identical; 0 missing task records. Hash algorithm choice list uses canonical engine values from the approved `hashWords.ts` mapping. |
| `encoder-decoder` | **ON** | Real brain: 22/22 exact hand-written encoding/decoding results; 28/28 must-not kept out; 10/10 other replies identical; 0 missing task records. |
| `text-compare` | **RESOLVER GAP — OFF** | Common comparison requests do not consistently resolve to this tool (0 matches or a question). No chat action, kernel registration, guard registration, task entry, choice entry or live switch was left behind. |

The Wave 2 go-live adds **2 tools**. The five previously live tools remain ON. The resulting pinned ON list is: `case-converter`, `encoder-decoder`, `hash-tool`, `number-to-words`, `sort-lines`, `text-cleaner`, `text-counter`.

## Standard preamble

AXON's finished structure in roadmap section 6 contains Ground, Knowledge, Reading Language, Understanding, Voice and Reach. This job is in **Layer 5 — Reach**, connecting prepared tools through the existing brain and task system. Later risks include incorrect tool matching, incomplete argument binding, or a tool answering a request that belongs to another tool; the real-brain answer, must-not and other-tool tests are the safeguards applied here.

The complete V21.3 roadmap and Part 00 had been read for the preceding CONNECT2 work; this wave stayed within the same roadmap section and did not identify a roadmap conflict. The original roadmap and repository archive were not modified.

## LAW CHECK (FL11)

- **FL1:** Work remains in Layer 5 Reach, against section 6's top-level structure.
- **FL2:** Roadmap and Part 00 govern the work; only prompt-authorized files were inspected or changed.
- **FL3:** Both ON tools use the existing brain, runner, kernel task and chat capability path.
- **FL4:** Untouched-copy baseline was run first; passing tools were retained; the unresolved tool was left fully OFF.
- **FL5:** Dictionary files were not changed or omitted; the dictionary guard and hashes passed.
- **FL7:** Real-brain answer, must-not, other-message, task-record and latency measurements were collected for both ON tools.
- **FL9:** No foundation redesign or unrelated implementation was attempted.
- **FL10:** Only the two ON tools are advertised as available chat actions; Text Compare is not advertised.
- **FL11:** This law check is repeated in this report.
- **FL12:** Tool guards declare their own local `LaneGuard` type; only `laneGuards.ts` imports them.
- **FL13:** No phrase lists were added; approved closed choice words and structural checks are used.
- **FL14:** Prepared pure engines and prepared actions are reused; no engine was duplicated or edited.

No law conflict was found.

## Per-tool evidence

### 1. Hash Tool — ON

**MEASURED real brain, 57 messages: answered exactly 20 of 20; must-not kept out 27 of 27; others identical 10 of 10; answers without task record 0.**

- **OFF baseline:** 20/20 answer messages used the foundation/local-rules fallback. There was no old chat handler answering these messages.
- **DIFFERS FROM OLD (all ON outputs match hand-written known vectors):**
  - `calculate checksum of "abc" using MD5`
  - `calculate checksum of "hello" using MD5`
  - `calculate checksum of "world" using MD5`
  - `calculate checksum of "123" using MD5`
  - `calculate checksum of "abc" using SHA-1`
  - `calculate checksum of "hello" using SHA-1`
  - `calculate checksum of "abc" using SHA-256`
  - `calculate checksum of "hello" using SHA-256`
  - `calculate checksum of "world" using SHA-256`
  - `calculate checksum of "abc" using SHA-384`
  - `calculate checksum of "hello" using SHA-384`
  - `calculate checksum of "abc" using SHA-512`
  - `calculate checksum of "hello" using SHA-512`
  - `calculate checksum of "123456789" using CRC32`
  - `calculate checksum of "abc" using CRC32`
  - `calculate checksum of "hello" using CRC32`
  - `calculate hash for "abc" using MD5`
  - `please calculate checksum of "123456789" using CRC32`
  - `can you calculate checksum of "abc" using SHA-256`
  - `kindly calculate checksum of "hello" using MD5`
- **Findings:** First real-brain attempt showed the runner rejecting a lowercase choice word with `Choose a supported algorithm.` The cause was that the lane's choice list supplied aliases while the runner validates canonical engine values. The one corrective attempt changed only the `LIVE_CHOICES` projection to the distinct canonical values from the approved `HASH_ALGORITHM_WORDS` record. The three real-brain probes then answered with the expected values, including CRC32 `cbf43926`, MD5(`world`) `7d793037a0760186574b0282f2f435e7`, and SHA-256(`abc`) `ba7816bf...15ad`. The final 20-answer proof passed.
- **Guard:** rejects unquoted/missing input, unsupported operations and targets, conflicting algorithms (including hyphenated SHA names), and input over 1,000 characters. No algorithm phrase list was added.
- **Latency:** fastest measured must-not response was **3.4 ms**, below the 1,500 ms limit.
- **Mutants caught:** `guard-always-go`, `wrong-runner-result`, `missing-task-record`.
- **Direct guard checks:** clear quoted request passes; two algorithms, file target and overlong input yield.

### 2. Encoder and Decoder — ON

**MEASURED real brain, 60 messages: answered exactly 22 of 22; must-not kept out 28 of 28; others identical 10 of 10; answers without task record 0.**

- **OFF baseline:** 22/22 answer messages used the foundation/local-rules fallback. There was no old chat handler answering these messages.
- **DIFFERS FROM OLD (all ON outputs match hand-written results):**
  - `encode "hello" as base64`
  - `decode "aGVsbG8=" from base64`
  - `please encode "abc" as hex`
  - `decode "6869" as hex`
  - `can you encode "a b" as URL`
  - `decode "a%20b" as URL`
  - `kindly encode "world" as base64`
  - `please decode "d29ybGQ=" from base64`
  - `would you encode "cat" as base64`
  - `decode "Y2F0" from base64`
  - `can you encode "dog" as base64`
  - `please decode "ZG9n" from base64`
  - `encode "one two" as base64`
  - `decode "b25lIHR3bw==" from base64`
  - `encode "é" as hex`
  - `decode "c3a9" from hex`
  - `encode "A" as hex`
  - `decode "41" from hex`
  - `encode "hello world" as URL`
  - `decode "hello%20world" as URL`
  - `could you encode "a+b" as URL`
  - `please decode "a%2Bb" as URL`
- **Findings / supported scope:** the real brain reliably bound Base64, hex and URL operations across the 22 tested messages. It did not reliably resolve HTML, ROT13, binary or Base64URL requests, and the binder asks on empty quoted input. Those options were not falsely reported as connected by the test; the ON proof is limited to the formats and messages listed above. The guard yields for unquoted input, conflicting modes/formats, unsupported operations/targets, unsupported extra actions, and inputs over 1,000 characters.
- **Other tools:** Text Counter, Case Converter, Sort Lines and Number to Words requests remained unchanged in the OFF-vs-ON comparison; no other tool's request was stolen.
- **Latency:** fastest measured must-not response was **1.9 ms**, below the 1,500 ms limit.
- **Mutants caught:** `guard-always-go`, `wrong-runner-result`, `missing-task-record`.
- **Direct guard checks:** clear quoted request passes; unquoted input, conflicting formats, conflicting modes, unsupported operation/extra action and overlong input yield.

### 3. Text Compare — RESOLVER GAP, OFF

**MEASURED real-brain diagnostic: 3 representative requests; 0 requests reached a confirmed Text Compare execution.**

The three traces below were collected during the temporary diagnostic wiring; all temporary Text Compare wiring was then removed. The tool remains OFF and unregistered.

1. `compare "old" with "new"`
   - **resolution:** `1 pieces; 0 matches, 1 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R7)]`
   - **execution:** `legacy executor preserves current provider order and fallback; direct lane yielded: no single sure tool was found`
2. `diff "old" with "new"`
   - **resolution:** `1 pieces; 0 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 0 ask, 1 deep [piece 0 deep (R10)]`
   - **execution:** `legacy executor preserves current provider order and fallback; direct lane yielded: no single sure tool was found`
3. `compare "cat" with "dog" by word`
   - **resolution:** `1 pieces; 0 matches, 1 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R7)]`
   - **execution:** `legacy executor preserves current provider order and fallback; direct lane yielded: no single sure tool was found`

A further candidate, `compare texts "old" and "new"`, did produce `1 matches`, but the router shadow selected an ask (R4); this is not sufficient evidence of a safe, complete binding. The tool's required `mode` slot is a likely secondary blocker, but it was not claimed as proven because the switch was OFF for that supplementary trace.

- **DIFFERS FROM OLD:** no ON-vs-OFF difference; the switch stayed OFF. The existing Text Compare engine and prepared action were not changed.
- **Findings:** common forms are not matched reliably; no phrases, resolver rules, binder behavior or schema rows were changed to force a match.
- **Mutants caught:** NOT RUN — no real-brain execution test was created for an OFF resolver-gap tool.
- **Action taken:** no chat action, kernel registration, guard registration, task entry, choice entry or live switch remains for Text Compare.

## Baseline on untouched copy

The untouched base copy was tested before Wave 2 changes:

```text
sh ../axon-toolchain/run-test.sh tests/liveAdmission.test.ts
liveAdmission: 20 checks passed

sh ../axon-toolchain/run-test.sh tests/liveHashTool.test.ts
24 checks, 0 failed

sh ../axon-toolchain/run-test.sh tests/liveEncoderDecoder.test.ts
26 checks, 0 failed

sh ../axon-toolchain/run-test.sh tests/liveTextCompare.test.ts
22 checks, 0 failed
```

No baseline failure was observed in these Wave 2 prepared tests.

## Final ratchets — commands and printed output

All commands below used the bundled runner from the repository root, except the final dictionary guard.

```text
sh ../axon-toolchain/run-test.sh tests/liveAdmission.test.ts
liveAdmission: 28 checks passed

sh ../axon-toolchain/run-test.sh tests/liveSwitches.test.ts
liveSwitches: 11 checks passed

sh ../axon-toolchain/run-test.sh tests/brainBoundary.test.ts
B1 brain boundary passed: 6 allowed importers

sh ../axon-toolchain/run-test.sh tests/meaningNoPhrases.test.ts
B03A NO-PHRASES GUARD OK: 75 files scanned, 155 checks

sh ../axon-toolchain/run-test.sh tests/directLane.test.ts
directLane: 35 checks passed

sh ../axon-toolchain/run-test.sh tests/directLaneEndToEnd.test.ts
lane OFF: replies byte-identical 50/50, trace identical (apart from the yield note) 50/50
lane ON: answered by the lane 33/50 (equal to old reply 33, equal after the said-aloud sentence 0), different or wrong 0
directLaneEndToEnd: 9 checks passed

sh ../axon-toolchain/run-test.sh tests/liveSortLines.test.ts
MEASURED real brain, 60 messages: answered with the exact sorted text 24 of 24; must-not-answer kept out 26 of 26; other replies identical 10 of 10; answers without a task record 0
liveSortLines: 18 checks passed

sh ../axon-toolchain/run-test.sh tests/liveTextCounter.test.ts
MEASURED real brain, 63 messages: answered by the lane 34; reply identical to the old one apart from task number and milliseconds 62; lane answers with a task record missing or extra 0; lane answers that differ 1; non-lane replies that differ 0
liveTextCounter: 9 checks passed

sh ../axon-toolchain/run-test.sh tests/liveBrainEncoderDecoder.test.ts
MEASURED real brain, 60 messages: answered exactly 22 of 22; must-not kept out 28 of 28; others identical 10 of 10; answers without task record 0
OFF baseline: 22 of 22 answer messages used foundation/local-rules fallback; DIFFERS FROM OLD (hand truth verified): 22
MUST-NOT fastest latency: 1.9 ms (limit 1500 ms)
MUTANT CAUGHT: guard-always-go
MUTANT CAUGHT: wrong-runner-result
MUTANT CAUGHT: missing-task-record
liveBrainEncoderDecoder: 19 checks passed

sh ../axon-toolchain/run-test.sh tests/liveBrainHashTool.test.ts
MEASURED real brain, 57 messages: answered exactly 20 of 20; must-not kept out 27 of 27; others identical 10 of 10; answers without task record 0
OFF baseline: 20 of 20 answer messages used foundation/local-rules fallback; DIFFERS FROM OLD (hand truth verified): 20
MUST-NOT fastest latency: 3.4 ms (limit 1500 ms)
MUTANT CAUGHT: guard-always-go
MUTANT CAUGHT: wrong-runner-result
MUTANT CAUGHT: missing-task-record
liveBrainHashTool: 13 checks passed

sh ../axon-toolchain/run-test.sh tests/liveBrainNumberToWords.test.ts
MEASURED real brain, 59 messages: answered exactly 20 of 20; must-not kept out 29 of 29; others identical 10 of 10; answers without task record 0
liveBrainNumberToWords: 71 checks passed

sh ../axon-toolchain/run-test.sh tests/liveBrainTextCleaner.test.ts
MEASURED real brain, 56 messages: answered exactly 20 of 20; must-not kept out 26 of 26; others identical 10 of 10; answers without task record 0
liveBrainTextCleaner: 70 checks passed

sh ../axon-toolchain/run-test.sh tests/liveHashTool.test.ts
24 checks, 0 failed

sh ../axon-toolchain/run-test.sh tests/liveEncoderDecoder.test.ts
26 checks, 0 failed

sh ../axon-toolchain/run-test.sh tests/liveTextCompare.test.ts
22 checks, 0 failed


sh ../axon-toolchain/run-test.sh tests/valuesRunner.test.ts
VALUES RUNNER OK: 205656 checks

node tools/guard.mjs
GUARD OK: 354 locked files present; 3342 dictionary files match their hashes (1 dictionary folder(s)); 686 new file(s) not locked yet.
```

**Existing unrelated baseline discrepancy preserved:** `liveTextCounter` still has the known single mismatch for `count words in "one two three" please` (old path says 4 words; runner says 3). This discrepancy was present before Wave 2 and is not caused or changed by this wave. `directLaneEndToEnd` continues to report 0 different or wrong answers.

## NOT RUN

- **tsc NOT RUN** — not included in the bundled toolchain; Director owns type-checking.
- **snapshot --check NOT RUN** — not part of the Version 3 ratchet list.
- Full `npm test` / `test:kernel` script NOT RUN — npm/npx/install are prohibited by the prompt; individual required tests were run with the bundled script.
- Wave 1 prepared part-only tests (`liveFindReplace`, `liveTextCleaner`, `liveNumberToWords`, `livePasswordGenerator`) were NOT RUN again in Wave 2; their Wave 1 results remain documented in `CONNECT2_W1_REPORT.md`, and their tool files were not changed in this wave.
- Text Compare real-brain ON proof NOT RUN — it is a RESOLVER GAP and remains OFF by design.
- Android APK build/device installation NOT RUN — outside this wave's scope.

## Exact `test:kernel` addition (do not edit package.json in this job)

Append after the existing `tests/liveAdmission.test.ts` entry:

```text
&& tsx tests/liveBrainNumberToWords.test.ts && tsx tests/liveBrainTextCleaner.test.ts && tsx tests/liveBrainEncoderDecoder.test.ts && tsx tests/liveBrainHashTool.test.ts
```

## Changed/new files in cumulative patch

| File | Reason |
|---|---|
| `docs/reports/CONNECT2_W1_REPORT.md` | Preserved Wave 1 report from the prior cumulative delivery. |
| `docs/reports/CONNECT2_W2_REPORT.md` | This Wave 2 report and measured evidence. |
| `src/brain/mind/laneGuards.ts` | Registers only the two ON tool guards. |
| `src/capabilities/registerAxonTools.ts` | Adds `cap.creation-tools` and available chat actions for Hash Tool and Encoder/Decoder; no Text Compare action. |
| `src/kernel/axonEngine.ts` | Registers the prepared hash and encoder actions. |
| `src/tools/runners/guards/encoderDecoderGuard.ts` | Adds structural rejection of unsupported extra actions/targets and inputs over 1,000 characters. |
| `src/tools/runners/guards/hashToolGuard.ts` | Adds structural rejection of unsupported extra actions/targets and overlong input; recognizes hyphenated SHA choices when checking conflicting algorithms. |
| `src/tools/runners/guards/numberToWordsGuard.ts` | Wave 1 guard, retained unchanged in the cumulative patch. |
| `src/tools/runners/guards/textCleanerGuard.ts` | Wave 1 guard, retained unchanged in the cumulative patch. |
| `src/tools/runners/liveSwitches.ts` | Connects Hash Tool and Encoder/Decoder; choice list for Hash Tool exposes distinct canonical engine values; Text Compare remains OFF. |
| `tests/liveBrainEncoderDecoder.test.ts` | Real-brain proof: 22 answers, 28 must-not, 10 others, task records, latency, direct guard and mutants. |
| `tests/liveBrainHashTool.test.ts` | Real-brain proof: 20 known vectors, 27 must-not, 10 others, task records, latency, direct guard and mutants. |
| `tests/liveBrainNumberToWords.test.ts` | Wave 1 real-brain proof, retained in cumulative patch. |
| `tests/liveBrainTextCleaner.test.ts` | Wave 1 real-brain proof, retained in cumulative patch. |
| `tests/liveSwitches.test.ts` | Pins the two new ON switches and keeps the allowed live-tool set explicit. |

## Scope and integrity

No changes were made to `package.json`, the resolver, binder, schema rows, `src/tools/engines/`, `src/brain/mind/directLane.ts`, `src/brain/index.ts`, `tools/files.lock`, `tools/guard.mjs`, `.github`, `public/dictionary`, or the roadmap. The original source ZIP and dictionary were not modified. No Text Compare partial wiring remains. No Wave 3 work was started.
