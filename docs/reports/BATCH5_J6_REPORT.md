# BATCH 5 - J6 TRAP RUNNER report

**Placement:** Layer 0 — quality/test infrastructure; finish-line S (safeguards); dependency: none.
**Files:** `src/testkit/trapRunner.ts`, `tests/trapRunner.test.ts`, `docs/reports/BATCH5_J6_REPORT.md`.

## LAW CHECK (FL11)
- FL1 — placed as a reusable test harness beneath the later go-live safety stage.
- FL3 — evaluates a caller-provided responder; it does not create or execute an AXON capability.
- FL10 — no user-facing capability or registry entry is claimed.
- FL11 — this job-specific law check is repeated here.
- FL12 — the harness checks a response function and does not answer the owner or bypass the brain.
- FL13 — trap inputs and expected behaviours are caller data; no fixed phrase list is embedded.
- FL15 — SAFE is limited to the supplied corpus and minTraps threshold; it is not a claim of general system safety.

## Result
BUILT; ISOLATED TEST RUN: PASS

Printed test line: `TRAP_RUNNER OK: 34 checks`

Strict TypeScript command run (shared batch command):

```sh
tsc --noEmit --strict --target ES2020 --module commonjs src/web/pageToText.ts tests/pageToText.test.ts src/web/browserStepGuard.ts tests/browserStepGuard.test.ts src/device/actionVeto.ts tests/actionVeto.test.ts src/web/outsideAiGate.ts tests/outsideAiGate.test.ts src/story/characterSheet.ts tests/characterSheet.test.ts src/testkit/trapRunner.ts tests/trapRunner.test.ts
```

Node compilation command run (shared batch command):

```sh
tsc --strict --target ES2020 --module commonjs --outDir /mnt/data/axonbatch5-build src/web/pageToText.ts tests/pageToText.test.ts src/web/browserStepGuard.ts tests/browserStepGuard.test.ts src/device/actionVeto.ts tests/actionVeto.test.ts src/web/outsideAiGate.ts tests/outsideAiGate.test.ts src/story/characterSheet.ts tests/characterSheet.test.ts src/testkit/trapRunner.ts tests/trapRunner.test.ts
```

Node test command run for this job:

```sh
node /mnt/data/axonbatch5-build/tests/trapRunner.test.js
```

The compiled Node test printed the exact line above. The test contains more than 30 independent checks.

`test:kernel` addition (not applied to package.json): `tsx tests/trapRunner.test.ts`

## Hand-worked oracle
Hand-worked five traps: t1 answered, t2 answered-instead-of-ask, t3 refused, t4 no-reply, t5 respond-threw; passed 2, failed 3, wrongAnswers [t2], NOT-SAFE/failures.
All five correct responses yield SAFE/all-passed; one passing trap with minTraps 2 yields NOT-SAFE/too-few-traps.
T1 answer 5 instead of exact 4 fails wrong-answer and appears in wrongAnswers.
The caller's trap array is unchanged; the callback receives only the input string.
Extra 1. A thrown callback is caught and recorded as a failed result without aborting later traps.
Extra 2. A malformed reply kind or non-string reply text fails as bad-reply.

## Deliberate breakages and test detection
1. Minimum trap lower bound removed — caught by minTraps 0 bad-options check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
2. Respond function validation removed — caught by bad-respond check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
3. Empty corpus accepted — caught by empty-traps check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
4. Duplicate ID guard removed — caught by duplicate-trap-id check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
5. Thrown callback reason changed — caught by hand-worked respond-threw oracle. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
6. none reply changed from failure to answered — caught by no-reply oracle. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
7. Exact mustEqual comparison inverted — caught by t1 wrong exact answer check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
8. wrongAnswers append removed — caught by t2/t1 wrongAnswers list checks. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.

## Questions for the Director
none

## What I could not check
The harness was tested with local deterministic callback fixtures only. No live AXON brain responder, real go-live corpus, production SAFE gate, app wiring or regression corpus was run. `tsx` and `test:kernel` were not run/changed; Node execution used TypeScript compilation. Add to test:kernel: `tsx tests/trapRunner.test.ts`.
