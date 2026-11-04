# BATCH 3 J5 — Watchdog Registry

**Builder result:** PASS — isolated test passed. Director ACCEPTED/NOT ACCEPTED verdict is pending.

## Contract delivered

Created `src/safety/watchdogRegistry.ts` and `tests/watchdogRegistry.test.ts`. The registry validates unique ids/layers, calls every supplied probe once in registry order, maps success/degraded/failure/throw/malformed/no-probe to the requested statuses, clips details to 200 characters without exposing an error stack, excludes canaries from system counts, and suppresses every system status to `NOT CHECKED` when any canary fails to fail.

The test covers the supplied brain/dictionary/voice/sort/canary case, call order, canary failure, no-canary mode, malformed probes, detail clipping and invalid inputs.

## LAW CHECK (FL11)

- FL1: Safety registry crosses the system layers; later startup, Settings and chat surfaces are separate carriers.
- FL2: Read only the roadmap, intake/tag material required by it, package/tsconfig and the named downscale style sample; target files were absent.
- FL4: Probe ordering, status and canary known answers were run.
- FL10: No capability registration, chat action or “which systems are online” response is declared by this standalone engine.
- FL11: This visible check is repeated in the report.
- FL12: The engine cannot answer main chat independently; future use must pass through the brain.
- FL14: Pure TypeScript; no repository imports or platform-specific probe implementation.
- FL15: The registry reports probe outcomes only; it does not independently prove every underlying system is healthy.
- 7Q: This is a canary-gated registry primitive, not the app-wide self-check caller or SAFE MODE.
- N2: `TRUSTED` means the configured canary behaved as expected, not that a cloud build or phone run occurred.

## Limits and later additions

The supplied card implements the canary gate but not the separate independent checker (for example, a cloud-build signal) named in roadmap 7P P4. It also has no startup caller, probe inventory, Settings screen, brain schema, chat action or device integration. Probe functions and their expected behavior are supplied by the caller. Rival/gap: AXON's intended watchdog checks both systems and itself; this file supplies only the in-process registry and canary half.

## Test evidence

Command: `node .build/tests/watchdogRegistry.test.js`

Printed output: `PASS watchdogRegistry: 22 checks; order, statuses, canary gate, no-canary mode, malformed/throwing probes, bounds`

`test:kernel` line to add later: `tsx tests/watchdogRegistry.test.ts`

**NOT RUN:** `tsx`, `test:kernel`, cloud-build second-checker integration, Android startup/self-check, Settings/chat integration, Director verification/mutants, full suite, Vite/cloud build or phone run.

## Placement and acceptance handoff

Roadmap 7L items 12, 20 and 21 still record the wider 7P/7T and journal-related work as UNPLANNED pending explicit placement/dependencies/proof. This return supplies the six standalone engine contracts and isolated test evidence only; it does not rewrite the roadmap, design plan, board or status tags. The Director must reconcile those roadmap pointers and perform independent return checks before marking any card ACCEPTED.
