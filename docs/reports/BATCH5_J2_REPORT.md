# BATCH 5 - J2 BROWSER STEP GUARD report

**Placement:** Layer 5 — Reach / AXON Web; finish-line S (safeguards) and H (reach); dependency: none.
**Files:** `src/web/browserStepGuard.ts`, `tests/browserStepGuard.test.ts`, `docs/reports/BATCH5_J2_REPORT.md`.

## LAW CHECK (FL11)
- FL1 — placed as a browser safety gate in Layer 5; it labels proposals and does not execute them.
- FL3 — the step classifier and plan budget are isolated; browser-agent wiring remains later work.
- FL10 — no chat action or live browser capability is claimed.
- FL11 — this job-specific law check is repeated here.
- FL12 — the guard returns a verdict only; it does not answer the owner or bypass the brain.
- FL13 — uses the card-defined closed set of step kinds, not accumulated phrase patterns.
- FL15 — a verdict is a typed safety classification, not proof that a real browser action succeeded.

## Result
BUILT; ISOLATED TEST RUN: PASS

Printed test line: `BROWSER_STEP_GUARD OK: 48 checks`

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
node /mnt/data/axonbatch5-build/tests/browserStepGuard.test.js
```

The compiled Node test printed the exact line above. The test contains more than 30 independent checks.

`test:kernel` addition (not applied to package.json): `tsx tests/browserStepGuard.test.ts`

## Hand-worked oracle
A. The seven-step supplied plan returns six verdicts: ALLOWED, ALLOWED, ALLOWED, ASK, REFUSED, REFUSED; counts 3/1/2; budget stop at index 6.
B. With maxAsks 1, click-control is the only verdict; the next ASK stops at index 1.
C. One read with maxSteps 1 completes without stopping; two reads stop before index 1.
D. Uppercase HTTPS is allowed; `@` in the path is allowed; credentials in the host are refused; FTP is refused as bad-url.
E. All twelve step kinds are checked; unknown kind `hack` returns bad-step.
Extra 1. maxAsks 0 stops before the first ASK at index 0, while a read-only plan proceeds.
Extra 2. An absent click-link URL asks; an explicitly present empty URL is refused as bad-url.

## Deliberate breakages and test detection
1. Host credential check removed — caught by oracle D credentials-in-URL case. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
2. Credential typing refusal inverted — caught by containsCredentials true case. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
3. Step budget equality changed to greater-than — caught by oracle A stop index. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
4. ASK budget equality changed to greater-than — caught by oracle B. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
5. Minimum maxSteps lowered — caught by maxSteps 0 bad-budget check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
6. Bad open URL changed to ALLOWED — caught by oracle D FTP case. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
7. Missing click-link target changed from ASK to REFUSED — caught by missing-click-target check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
8. allowedCount increment removed — caught by oracle A count check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.

## Questions for the Director
none

## What I could not check
No real browser, page, click, form, sign-in, message, download or payment operation was executed. The permission broker and owner-approval UI are not wired or tested. `tsx` and `test:kernel` were not run/changed; Node execution used TypeScript compilation. Add to test:kernel: `tsx tests/browserStepGuard.test.ts`.
