# D321-FIX1 board lines (owner appends; this package does not touch NOW.txt, MERGE_TAG.txt or JOB_BOARD.md, per workstreams/README.txt rule 5)

WHAT IT IS: the fix for the two red cloud builds after AXON-WORKSTREAMS-merge. Author: Director D321 (overseer). Nothing else changed.

CAUSES (MEASURED by reproducing each in a copy of the repository):
1. tsc, src/screen-intelligence/runtime.ts(37,41) TS2322: the cloud runs TypeScript 7 (strict by default); the comment type in capture-coordinator.mjs wants start(args: object), the real adapters take { onEvent }. Fixed with one cast in runtime.ts. Reproduced under tsc --strict, gone after the cast.
2. engineTruth: act.qr-maker (switched ON in CONNECT2-W3) was missing from PROVEN_AVAILABLE. Added with tests/liveBrainQrMaker.test.ts.
3. liveFacts: fact 39 (qr-maker) chat was "not-built" in tests/fixtures/toolFacts.json, live says "available". Fixture field changed.
4. sortModeWords: LIVE_SAY_DEFAULTS is now ['sort-lines','qr-maker'] by design (W3); test expected only sort-lines. Test updated (two checks).
5. Found while fixing 3: tests/resolveOptionsRunner.test.ts counts statuses from the fixture; QR Maker moved built -> ready, so 8 / 32 / 18 / 5 became 9 / 31 / 18 / 5. Test updated.

FILES: src/screen-intelligence/runtime.ts, tests/engineTruth.test.ts, tests/fixtures/toolFacts.json, tests/sortModeWords.test.ts, tests/resolveOptionsRunner.test.ts, DIRECTOR_NAP.txt (D321 line on the board, note N18), docs/D321_FIX1_BOARD_LINES.md.

MEASURED (copy of the repository, jszip stubbed because it is not installed here): before the fix liveFacts and sortModeWords fail with the cloud's exact messages; after it: engineTruth 285 checks, liveFacts 681, sortModeWords 36, resolveOptionsRunner 769, directorNap 7, actionSchemasRunner 491, toolRequestAccuracy DEV2 OK, liveSwitches 11, brainGolden 79 messages 242 checks (unchanged), brainBoundary, meaningNoPhrases 155, guard OK; strict tsc on runtime.ts clean.
NOT RUN: the four jszip tests with the real jszip, the full cloud suite. The cloud build is the proof.

NOW.txt line to append or merge into the single line: 2026-11-11 | roadmap v21.3 | D321-FIX1 (red build fix: 1 type error, 4 stale test lists) | next unchanged (D471's NEXT) | owner decisions unchanged
MERGE_TAG.txt line (newest first): 2026-11-11 | D321-FIX1 [files above] | cloud build red after WORKSTREAMS merge: runtime.ts type cast; qr-maker added to engineTruth list, toolFacts fixture, sortModeWords defaults, resolveOptions counts | MEASURED as above | NOT RUN: real-jszip tests, full cloud suite
JOB_BOARD line: D321-FIX1 | Director D321 | red build repair | ACCEPTED on the evidence above, pending the cloud build | owner CONFIRMED: waiting
