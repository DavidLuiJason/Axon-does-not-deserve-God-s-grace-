# BATCH 3 J6 — Measured Basis

**Builder result:** PASS — isolated test passed. Director ACCEPTED/NOT ACCEPTED verdict is pending.

## Contract delivered

Created `src/knowledge/measuredBasis.ts` and `tests/measuredBasis.test.ts`. `describeChance` validates integer counts, withholds the percentage below `minCases`, and otherwise returns a rounded percentage plus a 95% Wilson interval using z = 1.96. `brierScore` validates paired probabilities/outcomes and calculates mean squared probability error. `calibrationReport` compares the supplied forecast probabilities with the plain mean-outcome baseline and uses the exact requested statements.

The test contains the 15/20 and 10/10 Wilson examples, the 3-case no-basis result, the 3-item Brier answer, and all three supplied 12-case calibration vectors and invalid-input cases.

## LAW CHECK (FL11)

- FL1: Layer 5 forecasting measurement; result integration and source admission are later work.
- FL2: Read only the roadmap, intake/tag material required by it, package/tsconfig and the named downscale style sample; target files were absent.
- FL4: Hand-computed Wilson, Brier and baseline answers were tested.
- FL11: This visible check is repeated in the report.
- FL12: No calibration result is sent to chat by this standalone engine.
- FL14: Pure TypeScript with no repository imports or hidden measurement source.
- FL15: A basis is stated only from supplied checked cases; this engine does not admit the source or certify future outcomes.
- 7F: Below the minimum case count, the percent field is absent and the statement is “no measured basis”.
- N2: The result describes only the input records; no wider accuracy claim is made.

## Limits and later additions

This engine measures caller-supplied outcomes and probabilities; it does not collect experiments, verify source independence, build a held-out dataset, store a provenance record or wire calibration into J4. A large or biased sample can still be unrepresentative. Rival/gap: the AXON-specific safeguard is to withhold percentages without sufficient records and compare forecasts against a plain-rate baseline; no external dataset is bundled.

## Test evidence

Command: `node .build/tests/measuredBasis.test.js`

Printed output: `PASS measuredBasis: 37 checks; Wilson intervals, no-basis threshold, Brier, baseline comparison, typed errors`

`test:kernel` line to add later: `tsx tests/measuredBasis.test.ts`

**NOT RUN:** `tsx`, `test:kernel`, source-data admission, held-out experiment collection, J4 integration, Director verification/mutants, full suite, Vite/cloud build or phone run.

## Placement and acceptance handoff

Roadmap 7L items 12, 20 and 21 still record the wider 7P/7T and journal-related work as UNPLANNED pending explicit placement/dependencies/proof. This return supplies the six standalone engine contracts and isolated test evidence only; it does not rewrite the roadmap, design plan, board or status tags. The Director must reconcile those roadmap pointers and perform independent return checks before marking any card ACCEPTED.
