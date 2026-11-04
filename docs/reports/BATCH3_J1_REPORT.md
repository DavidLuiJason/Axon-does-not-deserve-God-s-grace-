# BATCH 3 J1 — Sign Combiner

**Builder result:** PASS — isolated test passed. Director ACCEPTED/NOT ACCEPTED verdict is pending.

## Contract delivered

Created `src/knowledge/signCombiner.ts` and `tests/signCombiner.test.ts`. `combineSigns` validates caller-supplied rules and observations, trims and de-duplicates signs, scores each matching rule once, groups conclusions, sorts rankings deterministically, records the unique union of signs and sorted rule ids, selects the chance basis by sign count / weight / code-unit id, and returns one-sign near misses. Conclusions are explicitly labelled `INFERRED`; missing measured basis is represented as `chance: null` and `no measured basis`.

The test includes the four hand-written rule fixtures and the requested results, order invariance, a basis tie, conclusion-ranking tie, typed bad-input cases, and frozen output.

## LAW CHECK (FL11)

- FL1: Layer 3 derived knowledge; later work must admit source-backed sign tables through FL15.
- FL2: Read only the roadmap, intake/tag material required by it, package/tsconfig and the named downscale style sample; target files were absent.
- FL4: Tested the known answers and typed errors; after correcting the near-miss test oracle, the card passed.
- FL11: This visible check is repeated in the report.
- FL12: Engine is standalone; it does not answer chat or bypass the brain.
- FL13: Rules are caller-supplied typed data, not a fixed phrase or pattern list.
- FL14: Pure TypeScript; no repository imports or duplicated engine dependencies.
- FL15: Conclusions remain INFERRED; supplied base rates are stated with their rule basis and are not promoted to VERIFIED.
- 7F: A near miss or inference is not a fact; no source-admission process is claimed here.
- N2: Only the printed isolated test is claimed as passed; broader checks remain NOT RUN.

## Limits and later additions

This file combines only the rules supplied by its caller. It does not admit/sign/verify source tables, persist knowledge, resolve contradictory sources, or wire to the knowledge slot, brain, registry or UI. A wrong or stale caller-supplied table can still produce a wrong INFERRED conclusion. Rival/gap: the AXON-specific safeguard is traceable inference with visible signs and measured basis; no external application integration is claimed.

## Test evidence

Command: `node .build/tests/signCombiner.test.js`

Printed output: `PASS signCombiner: 23 checks; scoring, near-misses, ranking, ordering, basis, typed errors, frozen result`

`test:kernel` line to add later: `tsx tests/signCombiner.test.ts`

**NOT RUN:** `tsx`, `test:kernel`, Director verification/mutants, full suite, Vite/cloud build, phone run, knowledge-slot or brain integration.

## Placement and acceptance handoff

Roadmap 7L items 12, 20 and 21 still record the wider 7P/7T and journal-related work as UNPLANNED pending explicit placement/dependencies/proof. This return supplies the six standalone engine contracts and isolated test evidence only; it does not rewrite the roadmap, design plan, board or status tags. The Director must reconcile those roadmap pointers and perform independent return checks before marking any card ACCEPTED.
