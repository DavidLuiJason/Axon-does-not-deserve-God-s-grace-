# BATCH 3 J3 — Scheduler

**Builder result:** PASS — isolated test passed. Director ACCEPTED/NOT ACCEPTED verdict is pending.

## Contract delivered

Created `src/schedule/scheduler.ts` and `tests/scheduler.test.ts`. `nextRuns` supports once, interval, daily and weekly schedules, with strictly-after ordering and count bounds. Local schedules use a fixed UTC offset, including local weekday calculation across UTC date boundaries. `missedRuns` returns ascending runs in `(lastMs, nowMs]` up to the requested cap. Epoch calculations use safe integer inputs and exact integer arithmetic for intervals and local-day calculations.

The test contains the supplied once/every/daily/weekly/missed-run timestamps and typed range/kind/count errors.

## LAW CHECK (FL11)

- FL1: Layer 5 scheduling for background work; the app service and device-tier budget are later carriers.
- FL2: Read only the roadmap, intake/tag material required by it, package/tsconfig and the named downscale style sample; target files were absent.
- FL4: Known-answer timestamps and bad-input cases were run with strict compilation.
- FL11: This visible check is repeated in the report.
- FL12: This scheduler is not wired to a separate chat route or UI.
- FL14: Pure TypeScript with no repository imports, `Date.now`, timer, filesystem or network dependency.
- 7Q: Missed-run calculation is a recovery primitive, not the app's full recovery/self-check system.
- N2: No Android scheduling or background-execution guarantee is claimed.

## Limits and later additions

Daily and weekly schedules intentionally use fixed offsets and do not model daylight-saving changes. The engine calculates times only; it does not create Android jobs, persist schedules, enforce permissions, wake a device or verify execution. Rival/gap: the AXON-specific goal is permitted recurring work with measured device budgets and recovery; only the pure time calculation is delivered here.

## Test evidence

Command: `node .build/tests/scheduler.test.js`

Printed output: `PASS scheduler: 31 checks; once, interval, daily/weekly fixed offsets, strict-after, missed runs, typed errors`

`test:kernel` line to add later: `tsx tests/scheduler.test.ts`

**NOT RUN:** `tsx`, `test:kernel`, Android scheduler/foreground service, device-tier timing, Director verification/mutants, full suite, Vite/cloud build or phone run.

## Placement and acceptance handoff

Roadmap 7L items 12, 20 and 21 still record the wider 7P/7T and journal-related work as UNPLANNED pending explicit placement/dependencies/proof. This return supplies the six standalone engine contracts and isolated test evidence only; it does not rewrite the roadmap, design plan, board or status tags. The Director must reconcile those roadmap pointers and perform independent return checks before marking any card ACCEPTED.
