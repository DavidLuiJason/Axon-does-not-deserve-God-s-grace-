# TEST-FIX2 BOARD LINES (Director, 2026-11-11)

WHO IT IS FOR: the owner and every Director. What the two cloud-build failures were, why they happened, and what changed.

JOB: TEST-FIX2 [fix the cloud build failures `engineTruth.test.ts` and `liveFacts.test.ts`]. Status: MERGED when the owner merges AXON-TESTFIX2-merge.zip. Evidence label: MEASURED on a full copy of the main zip (Node 22, tsx, jszip linked from the Director sandbox), NOT the cloud build.

FAILURES (owner paste): engineTruth `only proven actions are available: act.number-to-words`; liveFacts `fact 33 (number-to-words) field chat: live available vs fixture not-built`.

CAUSE (MEASURED): number-to-words, encoder-decoder and hash-tool went live through the brain with CONNECT1-A (`liveSwitches.ts` HAND_ON; their chat actions are `available` in `registerAxonTools.ts`/`registerEngineTools.ts`). Two ORACLES were never updated: the allow-list in `tests/engineTruth.test.ts` (held 4 ids) and `tests/fixtures/toolFacts.json` (chat `not-built` for the three). Both tests stop at the first failure, so the cloud showed only number-to-words; the live registry differs from the fixture in exactly THREE facts (#33, #42, #43). The earlier Directors could not run either test (jszip missing; CONNECT2_W1 board line F4 says NOT RUN), so the cloud build was the first to show it.

WHICH SIDE WAS WRONG: the oracles. Independent evidence: liveBrainNumberToWords 71 checks, liveBrainEncoderDecoder 19, liveBrainHashTool 13, liveSwitches 11, liveAdmission 26 (the gate reads the real registries and admits all three) all pass. The app was not changed; no tool was switched or downgraded.

CHANGES (3 test files, 1 fixture, records): fixture chat `not-built` to `available` for the three; engineTruth allow-list is now a map action id to its proof test file and the test also requires that file to exist (a new `available` action without a named proof now fails); resolveOptionsRunner status counts 5/35/18/5 to 8/32/18/5 (the same three tools moved built to ready; it passed before only because fixture and count were both stale); WIRING_LEDGER three lines corrected (ON today 6, not 3).

PROOF: engineTruth 283 checks, liveFacts 681 checks, resolveOptionsRunner 769 checks; two mutants on the new engineTruth guard (missing proof file, dropped id) both fail it as they must. ALL 240 test files run on the changed tree: 237 passed in a parallel run on a one-core sandbox; the 3 that failed (summarizeSpeed, tableFromBoxes, valuesRunner: timing under load) pass when run alone, so 240 of 240.

NOT RUN: npm ci, vite build, lint, the cloud build, any phone. The Director sandbox has no node_modules (jszip linked by hand), so the full tree cannot be type-checked here. The edit to engineTruth adds one import of node:fs, as other tests already do.

DIRECTOR DECISIONS (overrulable): D1 the fixture is changed to match the live registry only after the end-to-end proofs above passed, never the other way round. D2 the stronger engineTruth guard stays (proof file must exist). LESSON: a registry flip needs the oracles that name its status updated in the SAME merge; liveAdmission checks parts, not these two oracles. A cheap guard for that is a later small job, not done here.

NEXT: Round 2, AXON Web verification (owner assigned; the AXON Web zip is not opened in this round).
