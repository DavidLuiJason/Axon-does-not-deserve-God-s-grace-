# BATCH 3 J4 — Forecaster

**Builder result:** PASS — isolated test passed. Director ACCEPTED/NOT ACCEPTED verdict is pending.

## Contract delivered

Created `src/forecast/forecaster.ts` and `tests/forecaster.test.ts`. Walk-forward evaluation compares frequency, first-order Markov and last-five recency predictors against the persistence baseline. Frequency ties prefer the first-seen symbol; Markov ties prefer the first-seen transition; recency ties prefer the most recently seen symbol. Selector ties use frequency, Markov1, recency in that order. The result abstains for too little history or when the selected predictor does not beat persistence. `stated` reports counts only, never a percentage.

The test includes the alternating, constant, short-history and repeated `a a b` examples, plus selector tie and invalid-input checks.

## LAW CHECK (FL11)

- FL1: Layer 5 forecasting capability; calibration and brain integration are later work.
- FL2: Read only the roadmap, intake/tag material required by it, package/tsconfig and the named downscale style sample; target files were absent.
- FL4: Walk-forward known answers, baseline comparisons and abstention cases were run.
- FL11: This visible check is repeated in the report.
- FL12: No predictor answers chat independently; future requests must pass through the brain.
- FL13: Predictors operate on caller-supplied symbols; no fixed phrase or vocabulary list is added.
- FL14: Pure TypeScript with no repository imports or hidden runtime services.
- FL15: Hits are historical checks, not verified future truth; no unsupported confidence percentage is emitted.
- 7F: The engine abstains when its tested advantage is absent or the sample is too small.
- N2: No future prediction accuracy is promised beyond the supplied test history.

## Limits and later additions

The engine selects a symbol predictor and emits a historical hit count; it does not itself emit a calibrated probability, measured chance interval or source record. J6 provides separate measurement primitives but is not wired into this predictor. This leaves part of roadmap 7P P3's probability-bearing output for a later integrated contract. It does not store experiments or use trend/Markov orders 2–3. Rival/gap: AXON's intended edge is measured abstention against a plain baseline; this small selector is not a general forecasting model.

## Test evidence

Command: `node .build/tests/forecaster.test.js`

Printed output: `PASS forecaster: 28 checks; walk-forward selection, hand-counted answers, tie order, baseline abstention, typed errors`

`test:kernel` line to add later: `tsx tests/forecaster.test.ts`

**NOT RUN:** `tsx`, `test:kernel`, held-out forecasting set, probability calibration integration, Director verification/mutants, full suite, Vite/cloud build or phone run.

## Placement and acceptance handoff

Roadmap 7L items 12, 20 and 21 still record the wider 7P/7T and journal-related work as UNPLANNED pending explicit placement/dependencies/proof. This return supplies the six standalone engine contracts and isolated test evidence only; it does not rewrite the roadmap, design plan, board or status tags. The Director must reconcile those roadmap pointers and perform independent return checks before marking any card ACCEPTED.
