# AXON CONNECT2 — Wave 4 Report

**Result: WAVE 4 DELIVERED — Date Calculator is a BINDER GAP and remains OFF.** No partial registration was left in the live system.

| Wave 4 tool | Final status | Evidence / blocker |
|---|---|---|
| `date-calculator` | **BINDER GAP — OFF** | The real brain matched all three diagnostic probes, but the binder yielded twice with `the binder says ask` and once with `the binder says confirm-first`. Required values could not be filled reliably. No live switch, choice registration, task entry, guard registration, kernel registration or chat action shipped. |

## Standard preamble

1. The finished AXON contains the six roadmap layers: Ground, Knowledge, Reading Language, Understanding, Voice and Reach.
2. This work is Layer 5 — Reach: testing the existing stateless Date Calculator runner as a possible brain-connected tool.
3. Later risks are ambiguous date-operation selection and missing required date/operation values; enabling it before the binder can supply them would produce no answer or an incorrect one.

## Base used (Version 3.1, section 0C)

The Wave 4 base was reconstructed from the original repository ZIP, then the delivered Wave 2 cumulative patch was applied, followed by the Wave 3 delta patch. No W1/W2/W3 merge ZIPs were supplied. This reproduces the Wave 3 delivered state. The final Wave 4 ZIP contains only files created after that state; it is not cumulative.

The final tree was compared against that reconstructed Wave 3 base. The only differences are the four new files listed under **Changed files** below, plus this report. No earlier wave files were changed.

## LAW CHECK (FL11)

- **FL1:** Work remains in Layer 5 Reach, following section 6 of the roadmap.
- **FL2:** The V21.3 roadmap/Part 00 remain the authority; only prompt-authorized files were created or inspected.
- **FL3:** The proposed task action delegates to the existing stateless Date Calculator runner; no replacement engine was created.
- **FL4:** The untouched Wave 3 base was tested first; the binder/resolver/schema and engines were not changed.
- **FL5:** The dictionary was neither changed nor copied; the final guard verified its hashes.
- **FL7:** Real-brain traces were collected for three matched requests; no unsupported ON claim was made.
- **FL9:** No foundation redesign or unrelated work was performed.
- **FL10:** The Date Calculator has no available chat action because its switch remains OFF.
- **FL11:** This law check is repeated in this report.
- **FL12:** The new guard declares its own local `LaneGuard` type and does not import from `src/brain/`.
- **FL13:** Proposed choice words are single-word keys in frozen records; no phrase list was added.
- **FL14:** The proposed action delegates to the existing Date Calculator runner, avoiding a duplicate date engine.

## Real-brain findings — BINDER GAP

The real brain matched all three probes, but did not proceed to the runner. The trace does not expose the individual unfilled field name, so the report does not guess which one is missing.

| Message | Resolution note | Execution note |
|---|---|---|
| `calculate date 2024-01-01` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R4)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder says ask` |
| `find weekday for 2024-01-01` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 0 ask, 1 deep [piece 0 deep (R4)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder says confirm-first` |
| `calendar date 2024-01-01` | `1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep [piece 0 ask (R4)]` | `legacy executor preserves current provider order and fallback; direct lane yielded: the binder says ask` |

The prepared action schema requires `operation` and `date`. `otherDate` is required for `difference` and `count-weekdays`; `amount` and `unit` are required for `add`. The trace only says `ask` or `confirm-first`, not which field caused it. The likely gap is reliable binding of the required operation/date pair and, for the corresponding operations, their conditional values. The exact missing slot is **not observable** from the permitted trace.

A first exploratory 24-answer real-brain pass returned the foundation fallback for 23 cases and a `local-rules` response for one (`can you tell weekday for 2020-02-29`); it did not produce a runner answer. The broader exploratory run then timed out before completing its must-not/others sections, so it is NOT counted as a completed 20-answer proof and no `MEASURED real brain` line is claimed. The three short traces above are the decisive diagnostic evidence.

A separate phrasing, `add 30 days to 2024-01-01`, produced `0 matches, 1 questions` and `direct lane yielded: no single sure tool was found`. This is a resolver gap for that particular wording, but the tool's overall measured outcome is classified as **BINDER GAP**, because the other three probes matched and then yielded at binding.

### Required next capability

The brain needs to bind the operation and ISO date as explicit values from ordinary wording, and bind `otherDate`, `amount`, and `unit` when those operations require them. This job does not alter the resolver, binder, schema, or engine. The Director should decide whether a future foundation/binder task is appropriate before another connection attempt.

## Proposed closed words — Director approval required

These are proposals only. They are not registered in `LIVE_CHOICES` and have no effect while the tool is OFF.

| Slot | Single-word key | Engine value |
|---|---|---|
| operation | `add` | `add` |
| operation | `difference` | `difference` |
| operation | `weekday` | `weekday` |
| operation | `dayofyear` | `day-of-year` |
| operation | `isoweek` | `iso-week` |
| operation | `weekdays` | `count-weekdays` |
| unit | `year`, `years` | `years` |
| unit | `month`, `months` | `months` |
| unit | `day`, `days` | `days` |

All values are taken from the Date Calculator runner's existing operation/unit names. No phrase aliases were added.

## Direct guard/action test

`tests/liveDateCalculator.test.ts` passed **44 checks, 0 failed**. It covered 26 wrong-case hypotheses, six direct guard pass cases, hand-calculated weekday/date-offset/day-of-year examples, impossible-date refusal, value-map integrity, unknown-value preservation, unique choice keys, and three part-level mutant sentinels. This is a component test, not a real-brain ON proof.

Mutant sentinels printed:

- `MUTANT CAUGHT: guard-always-go`
- `MUTANT CAUGHT: wrong-runner-result`
- `MUTANT CAUGHT: missing-task-record`

## OFF-state and DIFFERS FROM OLD

- **Switch:** OFF; no `date-calculator` entry in `HAND_ON`.
- **Task:** no `LIVE_TASKS['date-calculator']` entry.
- **Choices:** no `LIVE_CHOICES['date-calculator']` entry.
- **Guard:** not registered in `LANE_GUARDS`.
- **Kernel:** `DATE_ACTION` is not registered in `axonEngine.ts`.
- **Chat:** no `act.date-calculator` action is advertised.
- **DIFFERS FROM OLD:** none shipped. Since the tool remains OFF and unregistered, the old chat path is unchanged.

## Baseline — untouched Wave 3 state

The first test was run alone before the remaining baseline checks:

```text
$ sh ../axon-toolchain/run-test.sh tests/liveAdmission.test.ts
liveAdmission: 28 checks passed
```

Baseline ratchets and real-brain proofs:

| Test | Untouched-base result |
|---|---|
| `liveAdmission.test.ts` | 28 checks passed |
| `liveSwitches.test.ts` | 11 checks passed |
| `brainBoundary.test.ts` | 6 allowed importers |
| `meaningNoPhrases.test.ts` | 75 files scanned, 155 checks |
| `directLane.test.ts` | 35 checks passed |
| `directLaneEndToEnd.test.ts` | 9 checks passed; OFF byte-identical 50/50; ON different/wrong 0 |
| `liveSortLines.test.ts` | 18 checks passed; 24/24 answers, 26/26 must-not, 10/10 others, 0 missing task records |
| `liveTextCounter.test.ts` | 9 checks passed; same known one-answer discrepancy (runner 3 words vs old handler 4 for `one two three`) |
| `liveBrainNumberToWords.test.ts` | 71 checks passed; 20/20 answers, 29/29 must-not, 10/10 others, 0 missing task records |
| `liveBrainHashTool.test.ts` | 13 checks passed; 20/20 answers, 27/27 must-not, 10/10 others, 0 missing task records |
| `liveBrainEncoderDecoder.test.ts` | 19 checks passed; 22/22 answers, 28/28 must-not, 10/10 others, 0 missing task records |
| `liveBrainQrMaker.test.ts` | 23 checks passed; 20/20 answers, 27/27 must-not, 10/10 others, 0 missing task records |
| Prepared `liveFindReplace`, `liveTextCleaner`, `liveNumberToWords`, `livePasswordGenerator` | 19 checks each, 0 failed |
| Prepared `liveHashTool` | 24 checks, 0 failed |
| Prepared `liveEncoderDecoder` | 26 checks, 0 failed |
| Prepared `liveTextCompare` | 22 checks, 0 failed |
| Prepared `liveConverter`, `liveCalculator`, `livePercentageHelper`, `liveQrMaker`, `liveRandomPicker` | 22 checks each, 0 failed |
| `brainGolden.test.ts` | 79 messages, 242 field checks passed |
| `wireGenerated.test.ts` | 64 checks passed |
| `valuesRunner.test.ts` | 205656 checks passed |
| `node tools/guard.mjs` | 354 locked files present; 3342 dictionary files match their hashes |

Two baseline caveats were preserved, not fixed:

- `liveBrainTextCleaner.test.ts` was run against the v3.1 base where Text Cleaner is deliberately OFF; it failed its first ON-answer assertion, as expected for that disabled state. Text Cleaner was not re-enabled.
- `liveFacts.test.ts` was explored but could not load because `jszip` is absent from the supplied offline toolchain (`ERR_MODULE_NOT_FOUND`). It is not one of the section 6 ratchets and no dependency was installed.

## Final ratchets — after Wave 4 files were added, with Date Calculator still OFF

| Test | Final output |
|---|---|
| `liveAdmission.test.ts` | `liveAdmission: 28 checks passed` |
| `liveSwitches.test.ts` | `liveSwitches: 11 checks passed` |
| `brainBoundary.test.ts` | `6 allowed importers` |
| `meaningNoPhrases.test.ts` | `75 files scanned, 155 checks` |
| `directLane.test.ts` | `35 checks passed` |
| `directLaneEndToEnd.test.ts` | `9 checks passed`; OFF byte-identical 50/50; ON different/wrong 0 |
| `liveSortLines.test.ts` | `18 checks passed`; same measured baseline |
| `liveTextCounter.test.ts` | `9 checks passed`; same known one-answer discrepancy as baseline |
| `liveDateCalculator.test.ts` | `44 checks, 0 failed` |
| `brainGolden.test.ts` | `79 messages, 242 field checks passed` |
| `wireGenerated.test.ts` | `64 checks passed` |
| `valuesRunner.test.ts` | `VALUES RUNNER OK: 205656 checks` |
| `node tools/guard.mjs` | `354 locked files present; 3342 dictionary files match their hashes` |

The full printed final output is supplied separately as `CONNECT2_W4_TEST_OUTPUT.txt`.

## Exact `test:kernel` addition

`package.json` was read but not changed. Append this after the existing `tests/liveAdmission.test.ts` entry:

```text
&& tsx tests/liveDateCalculator.test.ts
```

## Changed files (only differences from the Wave 3 base)

1. `src/tools/dateAction.ts` — new stateless task action; delegates to the existing `date-calculator` runner rather than creating another engine. It is not registered because of the binder gap.
2. `src/tools/runners/dateWords.ts` — proposed single-word operation/unit mappings to the existing engine values; not registered in `LIVE_CHOICES`.
3. `src/tools/runners/guards/dateCalculatorGuard.ts` — local guard type and structural checks for valid ISO dates, one operation, required operation-specific values, negation, unsupported extras/targets and oversized messages; not registered in `LANE_GUARDS`.
4. `tests/liveDateCalculator.test.ts` — direct guard/action/word-map tests (44 checks); it does not claim real-brain connectivity.
5. `docs/reports/CONNECT2_W4_REPORT.md` — this report.

## NOT RUN

- `tsc NOT RUN` — not included in the bundled toolchain; Director's responsibility.
- `snapshot --check NOT RUN` — not in the Version 3.1 ratchet list.
- A complete 20-answer / 25-must-not / 10-others Date Calculator real-brain test was **NOT COMPLETED**: the exploratory run timed out after the answer probes showed no runner answers. The three focused diagnostic traces are reported above.
- Android build/install NOT RUN — outside this connection task.
- No npm, npx, ts-node, install or network command was used.
