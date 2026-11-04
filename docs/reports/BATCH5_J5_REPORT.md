# BATCH 5 - J5 CHARACTER SHEET report

**Placement:** Layer 3 — Understanding / continuity support; finish-line D (decision and verification support); dependency: none.
**Files:** `src/story/characterSheet.ts`, `tests/characterSheet.test.ts`, `docs/reports/BATCH5_J5_REPORT.md`.

## LAW CHECK (FL11)
- FL1 — placed as a narrow continuity checker within Layer 3, not a general story-understanding system.
- FL3 — returns findings only; story workflow and memory integration remain separate work.
- FL10 — does not claim a chat capability or independent user-facing answer path.
- FL11 — this job-specific law check is repeated here.
- FL13 — trait domains and names are caller-provided data; the engine contains no fixed character or colour vocabulary.
- FL15 — findings are rule-based checks against an owner-provided sheet, not independently verified story facts.

## Result
BUILT; ISOLATED TEST RUN: PASS

Printed test line: `CHARACTER_SHEET OK: 41 checks`

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
node /mnt/data/axonbatch5-build/tests/characterSheet.test.js
```

The compiled Node test printed the exact line above. The test contains more than 30 independent checks.

`test:kernel` addition (not applied to package.json): `tsx tests/characterSheet.test.ts`

## Hand-worked oracle
Supplied Mara/Ms Vale sheet and four sentences produce sentences 4, mentions 3 and exactly one finding: Mara, eyes, expected green, found blue at sentence 1.
Ms Vale sentence contains expected black hair, so later blond does not create a hair finding; the sky sentence names nobody.
MARA brown eyes finds sentence 0; Maraud is not Mara and yields zero mentions; Ms vale red hair and blue eyes yields eyes then hair findings.
Invalid purple value, duplicate eyes key, one-value domain and duplicate names Mara/mara return the specified errors.
Extra 1. A name is matched only as consecutive tokens, so `Maraud` does not satisfy `Mara`.
Extra 2. `Mara saw a red door.` can report red hair; this is the card's known role-insensitive colour-word limitation, not silently corrected.

## Deliberate breakages and test detection
1. Value-in-domain guard removed — caught by purple value rejection. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
2. Duplicate-name guard removed — caught by Mara/mara duplicate-name check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
3. Trait-key validation made case-insensitive — caught by uppercase Eyes key rejection. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
4. Domain uniqueness guard removed — caught by duplicate-domain check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
5. Name token equality inverted — caught by whole-name-token/oracle mention checks. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
6. Question-mark sentence delimiter removed — caught by sentence delimiter count. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
7. Expected-value suppression removed — caught by exact oracle finding list (blond hair false finding). — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
8. Text size limit raised by one — caught by 200001-character rejection. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.

## Questions for the Director
none. The known role-insensitive colour-word limitation is retained and stated, exactly as the card requires.

## What I could not check
No story corpus beyond the hand-worked fixtures, narrative pipeline, character memory store or UI was integrated. The engine cannot determine whether a colour token describes the named trait's actual role. `tsx` and `test:kernel` were not run/changed; Node execution used TypeScript compilation. Add to test:kernel: `tsx tests/characterSheet.test.ts`.
