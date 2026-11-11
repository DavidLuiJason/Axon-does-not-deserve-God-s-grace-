# AXON CONNECT2 — Wave 3 Report

**Result: WAVE 3 DELIVERED — 1 of 5 Wave 3 tools connected.**

| Wave 3 tool | Final status | Evidence / blocker |
|---|---|---|
| `converter` | **BINDER GAP — OFF** | Three real-brain probes matched Converter but the binder asked for required conversion arguments. No partial wiring shipped. |
| `calculator` | **BINDER GAP — OFF** | Required `angle` is not safely supplied. The only tested default path failed the v3.1 no-old-handler prerequisite; no default or wiring shipped. |
| `percentage-helper` | **BINDER GAP — OFF** | Three real-brain probes matched Percentage Helper but the binder asked for the required values. No partial wiring shipped. |
| `qr-maker` | **ON — CONNECTED** | 20/20 exact real-brain answers, 27/27 must-not cases kept out, 10/10 other replies unchanged, zero missing task records; all three mutants caught. |
| `random-picker` | **BINDER GAP — OFF** | Pick requests are not resolved reliably; other matching requests ask the binder. In addition, the direct-lane random provider is deterministic (`randomBelow: () => 0`). |

## Standard preamble

1. The finished AXON contains the six roadmap layers: Ground, Knowledge, Reading Language, Understanding, Voice and Reach.
2. This work is Layer 5 — Reach: connecting existing tools through the brain, task kernel and chat capability path.
3. Later risks are incorrect resolver matches, unfilled required slots, and runtime dependencies that could produce misleading results if a tool were enabled without proof.

## Base used (Version 3.1, section 0C)

No separately named W1/W2 merge ZIPs were attached. Following the owner's confirmation, I built the working copy from the original repository ZIP and applied `AXON-CONNECT2-W2.zip` over it. The returned Wave 2 ZIP is cumulative, so it supplies the W1 and W2 files needed for this base.

**Important state reconciliation:** the supplied W2 ZIP still had Text Cleaner ON. Version 3.1 explicitly says `text-cleaner` is deliberately OFF and must stay OFF. I therefore disabled its switch, task, kernel registration, guard registration and chat action in this patch. Its prepared action/guard files were not deleted or edited. This is a required v3.1 base-state correction, not a new Wave 3 connection. The final live set is seven tools: Case Converter, Sort Lines, Number to Words, Encoder/Decoder, Hash Tool, QR Maker and Text Counter.

## LAW CHECK (FL11)

- **FL1:** Work stays in Layer 5 Reach and follows section 6 of the roadmap.
- **FL2:** The complete V21.3 roadmap and Part 00 were reviewed; only prompt-authorized files were opened or changed.
- **FL3:** QR Maker is connected through the existing brain, runner, kernel task and chat capability path.
- **FL4:** Baseline was run first; binder, resolver, schema and engines were not changed. Gaps remain OFF.
- **FL5:** The dictionary was not changed or copied; the final guard verified its hashes.
- **FL7:** QR Maker was measured through the real brain, including wrong cases, ordinary messages, task records and latency.
- **FL9:** No foundation redesign or unrelated implementation was performed.
- **FL10:** QR Maker has an available chat action only while its switch is ON; Text Cleaner was removed from the available chat actions because its switch is OFF.
- **FL11:** This law check is repeated in the report.
- **FL12:** The QR guard is imported only by `laneGuards.ts`; it does not import from `src/brain/`.
- **FL13:** No fixed phrase list was added. The QR guard uses structural checks and closed single-word option records.
- **FL14:** The prepared QR action and existing QR engine are reused; no duplicate engine was created.

## Wave 3 tool findings

### 1. Converter — BINDER GAP, OFF

No action, task, chat capability, guard registration, live choice registration or switch was shipped.

The real-brain trace produced the following three probes:

| Message | Resolution note | Execution note |
|---|---|---|
| `convert 5 km to m` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R4)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder says ask` |
| `please convert 2 kg to g` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R4)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder says ask` |
| `convert 100 °F to °C` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R4)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder says ask` |

**Likely required slots:** `from` and `to` are choice slots for concrete units, with `input` also required by the action schema. The approved `converterWords.ts` set describes conversion kinds, not the unit values `km`, `m`, `kg`, `g`, `°F` and `°C`. The trace exposes only “binder says ask”, not the individual missing field names, so I cannot honestly claim which one of the required fields triggered each ask. The exact per-field attribution remains unobservable in the permitted trace. No binder, resolver, schema or word-set changes were made.

**DIFFERS FROM OLD:** none; switch and chat action remain OFF. **Mutants:** not applicable; no live-brain test was created for an OFF tool.

### 2. Calculator — BINDER GAP, OFF

No action, task, chat capability, guard registration, live choice registration, default or switch was shipped.

With the tool temporarily selected for trace-only diagnosis and without a permitted default, the three probes were:

| Message | Resolution note | Execution note |
|---|---|---|
| `evaluate "2+2"` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder had to assume something, so the old handler may answer differently` |
| `evaluate "sin(30)" in degrees` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder had to assume something, so the old handler may answer differently` |
| `evaluate "sin(1)" in radians` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder had to assume something, so the old handler may answer differently` |

**Required slot:** `angle` is required by the prepared action schema. The existing declared `rad` default can only be enabled and spoken if every OFF answer message gets the foundation fallback, per section 0B. A temporary proof attempt returned the correct 20/20 runner answers, but only 17/20 OFF messages used the foundation fallback; three were answered by `local-rules` with “I have nothing registered”. Therefore the default prerequisite was not met, and I removed all temporary wiring. Explicit degree/radian words also cannot be relied on as bound values. A separate `calculate 2+2` trace selected `loan-calculator` instead of Calculator, which is an additional resolver limitation.

The temporary Calculator real-brain test was run with a double-timing loop over every must-not case and timed out twice. Per the two-strike rule I stopped and did not attempt a third run. No Calculator changes remain in the final patch.

**DIFFERS FROM OLD:** none shipped; switch and chat action remain OFF. **Mutants:** no final live-brain test, because the tool remains OFF.

### 3. Percentage Helper — BINDER GAP, OFF

No action, task, chat capability, guard registration, live choice registration or switch was shipped.

| Message | Resolution note | Execution note |
|---|---|---|
| `calculate 20 percent of 50` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R4)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder says ask` |
| `calculate change from 80 to 92 percent` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R4)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder says ask` |
| `increase 100 by 8 percent` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R4)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder says ask` |

**Likely required slot:** `values`, which is a required JSON-text slot in the prepared schema. The ordinary numbers in the message are not enough for the binder to construct that JSON value. The trace does not name the slot directly, so this is the schema-backed diagnosis, not a claim that the trace printed the field name. No schema or binder change was made.

**DIFFERS FROM OLD:** none; switch and chat action remain OFF. **Mutants:** not applicable; no live-brain test was created for an OFF tool.

### 4. QR Maker — ON, CONNECTED

**Registered path:**

- `QR_ACTION` registered in `src/kernel/axonEngine.ts`.
- `LIVE_TASKS['qr-maker']` maps runner arguments to action input and folds the level value.
- `LIVE_CHOICES['qr-maker']` uses the prepared closed QR level choices.
- `qrMakerGuard` is registered in `LANE_GUARDS`.
- `HAND_ON['qr-maker'] = 'runner'` and `qr-maker` is pinned in `tests/liveSwitches.test.ts`.
- `act.qr-maker` is available in the existing Creation Tools chat capability.
- The predeclared medium (`M`) default is spoken aloud. This is listed as **DIRECTOR DECISION, OVERRIDABLE**: all 20 OFF answer cases returned the foundation fallback, so the section 0B prerequisite was met.

**MEASURED line:**

`MEASURED real brain, 57 messages: answered exactly 20 of 20; must-not kept out 27 of 27; others identical 10 of 10; answers without task record 0`

- OFF baseline: 20/20 answer cases used the foundation fallback.
- DIFFERS FROM OLD: all 20 answer cases, because OFF used the foundation fallback and ON returned the hand-verified QR result. The full list is printed by the test output log and the test itself.
- Must-not: 27/27 preserved the OFF reply; other messages: 10/10 identical.
- Fastest of two timings on the long hostile input: 353.4 ms (limit 1,500 ms).
- QR payload property: the prepared action's generated module matrix was decoded and matched the exact input payload `hello`.
- Matrix size checks included 21×21, 25×25 and 29×29 payloads, including Unicode `café ☕`.
- Explicit error-correction level requests remain a **BINDER GAP for that option**. The guard yields instead of silently using the default.

**Option-gap traces:**

| Message | Resolution note | Execution note |
|---|---|---|
| `make a QR code for "hello" with low error correction` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the error-correction level option cannot be bound by the real brain` |
| `make a QR code for "hello" with high error correction` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the error-correction level option cannot be bound by the real brain` |
| `make a QR code for "hello" with level H` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 1 fast, 0 ask, 0 deep [piece 0 fast (R6)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the error-correction level option cannot be bound by the real brain` |

**Mutants caught:** `guard-always-go`, `wrong-runner-result`, `missing-task-record`.

### 5. Random Picker — BINDER GAP / runtime dependency gap, OFF

No action, task, chat capability, guard registration, live choice registration or switch was shipped.

| Message | Resolution note | Execution note |
|---|---|---|
| `pick a name from Alice and Bob` | `1 pieces; 0 matches, 1 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R7)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: no single sure tool was found` |
| `shuffle these items` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R4)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder says ask` |
| `choose a random integer between 1 and 10` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R4)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder says ask` |

**Required slot:** `items` is not reliably filled from plain wording; the pick form also fails resolver matching. Separately, `src/brain/index.ts` `buildLaneConfig` injects `randomBelow: () => 0`, and the runner uses that dependency. That makes the chat runner deterministic rather than random. `src/brain/index.ts` is explicitly forbidden to change in this job, so even a binder success would not make this safe to enable. No random-picker wiring shipped.

**DIFFERS FROM OLD:** none; switch and chat action remain OFF. **Mutants:** not applicable; no live-brain test was created for an OFF tool.

## Baseline and final ratchets

The untouched W2 patch baseline was run before changes. The full baseline output is in `CONNECT2_W3_TEST_OUTPUT.txt` under **BASELINE**. Two baseline issues were found and then reconciled only in the allowed expected-state files:

- `brainGolden.test.ts` initially failed because the W1/W2 chat actions were already ON in the supplied W2 patch, but the golden “what can you do” lists still described the earlier three-action state. The expected action lists were updated only for `help`, `what can you do`, `What can you do?` and `what tools do you have?`. The Number Tools purpose was also reworded to avoid the ordinary word “words” causing a false suggestion for `talley the words`. The final golden test passed without other transcript changes.
- `wireGenerated.test.ts` initially failed because its pins still expected three live tools. Only the permitted live switch, live choice and live task expected pins were updated. The final test passed.

Final results:

| Test | Final output |
|---|---|
| `liveAdmission.test.ts` | `liveAdmission: 28 checks passed` |
| `liveSwitches.test.ts` | `liveSwitches: 11 checks passed` |
| `brainBoundary.test.ts` | `6 allowed importers` |
| `meaningNoPhrases.test.ts` | `75 files scanned, 155 checks` |
| `directLane.test.ts` | `35 checks passed` |
| `directLaneEndToEnd.test.ts` | `9 checks passed`; lane OFF byte-identical 50/50; lane ON 33/50; different or wrong 0 |
| `liveSortLines.test.ts` | `18 checks passed`; 24/24 answers, 26/26 must-not, 10/10 others, 0 missing task records |
| `liveTextCounter.test.ts` | `9 checks passed`; same pre-existing one discrepancy: old handler reports 4 words for `one two three`, runner reports 3 |
| Wave 3 prepared tests: `liveConverter`, `liveCalculator`, `livePercentageHelper`, `liveQrMaker`, `liveRandomPicker` | Each `22 checks, 0 failed` |
| `liveBrainQrMaker.test.ts` | `23 checks passed`; measured 20/20, 27/27, 10/10, 0 missing task records |
| `liveBrainNumberToWords.test.ts` | `71 checks passed`; measured 20/20, 29/29, 10/10, 0 missing task records |
| `liveBrainHashTool.test.ts` | `13 checks passed`; measured 20/20, 27/27, 10/10, 0 missing task records |
| `liveBrainEncoderDecoder.test.ts` | `19 checks passed`; measured 22/22, 28/28, 10/10, 0 missing task records |
| `brainGolden.test.ts` | `79 messages, 242 field checks` passed |
| `wireGenerated.test.ts` | `64 checks` passed |
| `valuesRunner.test.ts` | `VALUES RUNNER OK: 205656 checks` |
| `node tools/guard.mjs` | `354 locked files present; 3342 dictionary files match their hashes` |

**Text Cleaner:** intentionally OFF per section 0C; its real-brain test was not run for this wave. Its prepared files were left untouched. The older Wave 1 report is historical and is superseded by the v3.1 explicit OFF decision.

## Changed files (only differences from the W2 base)

1. `src/brain/mind/laneGuards.ts` — register QR Maker guard; remove Text Cleaner guard registration because v3.1 says Text Cleaner is OFF.
2. `src/capabilities/registerAxonTools.ts` — add QR Maker chat action; remove Text Cleaner chat action; reword Number Tools purpose to avoid an ordinary-word golden suggestion; update Text Tools comment.
3. `src/kernel/axonEngine.ts` — register QR action; remove Text Clean action registration because Text Cleaner is OFF.
4. `src/tools/runners/guards/qrMakerGuard.ts` — enforce QR marker, quoted input, extra-action/negation/target/long-input safety; yield for unbound level options.
5. `src/tools/runners/liveSwitches.ts` — add QR Maker switch, choice, task and spoken default; remove Text Cleaner from ON/task state.
6. `src/tools/runners/qrWords.ts` — remove the four forbidden single-letter aliases `l`, `m`, `q`, `h`.
7. `tests/fixtures/brainGolden.json` — update only capability-list expected replies for the four help/ability messages to reflect the v3.1 live set.
8. `tests/liveBrainQrMaker.test.ts` — add real-brain answer, must-not, others, payload round-trip, task, latency, trace and three-mutant proof.
9. `tests/liveSwitches.test.ts` — pin QR Maker ON and Text Cleaner OFF.
10. `tests/wireGenerated.test.ts` — update only live switch/choice/task expected pins to the v3.1 seven-tool state.
11. `docs/reports/CONNECT2_W3_REPORT.md` — this report.

## Exact `test:kernel` addition

`package.json` was read but not changed. Append this to the existing `test:kernel` command after `tests/liveAdmission.test.ts`:

```text
&& tsx tests/liveBrainQrMaker.test.ts
```

## NOT RUN

- `tsc NOT RUN` — it is not included in the bundled toolchain; Director's responsibility.
- `snapshot --check NOT RUN` — not part of the Version 3.1 ratchet list.
- `tests/liveBrainTextCleaner.test.ts NOT RUN` — Text Cleaner is explicitly OFF in Version 3.1.
- Real-brain live tests for Converter, Calculator, Percentage Helper and Random Picker NOT RUN as go-live tests because their measured binder/resolver/runtime gaps leave them OFF.
- Android build/install NOT RUN — outside this connection task.
- No npm, npx, ts-node, install or network command was used.
