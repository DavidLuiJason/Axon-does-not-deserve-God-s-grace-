# BATCH 5 - J3 ACTION VETO report

**Placement:** Layer 5 — device/app reach; finish-line S (safeguards); dependency: none.
**Files:** `src/device/actionVeto.ts`, `tests/actionVeto.test.ts`, `docs/reports/BATCH5_J3_REPORT.md`.

## LAW CHECK (FL11)
- FL1 — placed as a device-action safety gate in Layer 5, not as an independent action executor.
- FL3 — returns only a verdict; actual device/app action wiring remains later work.
- FL10 — no live device capability or chat action is claimed.
- FL11 — this job-specific law check is repeated here.
- FL12 — the engine cannot independently act or answer; it classifies a proposed action.
- FL13 — veto words are caller-supplied data; the engine contains no fixed payment/banking vocabulary list.
- FL15 — verdicts do not prove real UI state or successful execution.

## Result
BUILT; ISOLATED TEST RUN: PASS

Printed test line: `ACTION_VETO OK: 37 checks`

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
node /mnt/data/axonbatch5-build/tests/actionVeto.test.js
```

The compiled Node test printed the exact line above. The test contains more than 30 independent checks.

`test:kernel` addition (not applied to package.json): `tsx tests/actionVeto.test.ts`

## Hand-worked oracle
Payment `pay` label on b1 vetoes as payment; b2 asks; typing into Card number vetoes payment; password and secure fields veto as secret.
Prepay does not match the whole word `pay` and asks; Bank-transfer vetoes bank; Card transfer vetoes payment because payment category comes first.
Unlabelled element asks; scroll and read are allowed; missing and unknown targets return unknown-target.
Empty categories still ask on ordinary elements but secret fields remain vetoed; uppercase and multiword rule entries are bad-rules.
Extra 1. A rule token `card` does not match `postcard` because matching is whole-token only.
Extra 2. A category with an empty list is valid and produces ASK for an ordinary matching target.

## Deliberate breakages and test detection
1. Password-field veto removed — caught by oracle p1 secure-field case. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
2. secure true check inverted — caught by oracle s1. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
3. Category iteration reversed — caught by Card transfer payment-before-bank oracle. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
4. Label tokenization changed to whitespace-only — caught by Bank-transfer oracle. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
5. Rule-word validation made case-insensitive — caught by uppercase Pay bad-rules check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
6. Unknown-target guard disabled — caught by unknown-target/missing-target checks. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
7. Scroll removed from no-target ALLOWED — caught by oracle scroll. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
8. Label matching disabled — caught by oracle b1 payment veto. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.

## Questions for the Director
none

## What I could not check
No Android accessibility tree, real app screen, device action, permission broker or hardware was available or exercised. Category word data remains caller-owned and was not connected to AXON configuration. `tsx` and `test:kernel` were not run/changed; Node execution used TypeScript compilation. Add to test:kernel: `tsx tests/actionVeto.test.ts`.
