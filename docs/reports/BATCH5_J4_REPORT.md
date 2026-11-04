# BATCH 5 - J4 OUTSIDE AI GATE report

**Placement:** Layer 5 — outside AI services; finish-line S (safeguards) and H (reach); dependency: none.
**Files:** `src/web/outsideAiGate.ts`, `tests/outsideAiGate.test.ts`, `docs/reports/BATCH5_J4_REPORT.md`.

## LAW CHECK (FL11)
- FL1 — placed as an external-service safety gate in Layer 5.
- FL3 — handles request validation and reply classification only; no provider connection is added.
- FL10 — no outside-AI chat capability is declared live.
- FL11 — this job-specific law check is repeated here.
- FL12 — outside AI remains a tool behind the brain and permission path, never an independent answer path.
- FL13 — secrets are supplied as data; no provider phrase or secret lists are embedded.
- FL15 — status classification is a deterministic response interpretation, not proof of provider truth.

## Result
BUILT; ISOLATED TEST RUN: PASS

Printed test line: `OUTSIDE_AI_GATE OK: 51 checks`

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
node /mnt/data/axonbatch5-build/tests/outsideAiGate.test.js
```

The compiled Node test printed the exact line above. The test contains more than 30 independent checks.

`test:kernel` addition (not applied to package.json): `tsx tests/outsideAiGate.test.ts`

## Hand-worked oracle
Redaction replaces both key occurrences, counts 2, chooses the longest overlapping secret, rejects a five-character secret, and leaves unmatched text unchanged.
Reply classification: 200 ok; 429 rate-limited with 30 seconds → 30000 ms; 429 without header → null; 402 quota-used; 401 auth-failed; 422 bad-request; 503 server-error; 302 unknown.
Retry-After 99999 caps at 3600000; abc and 12s yield null; statuses 99, 600 and 2.5 return bad-reply.
Gate success for acme-ai returns `Summarise this`; secret in prompt, 3 attachments, turn 6, 101 chars, invalid provider and empty prompt return their specified errors.
100 prompt characters pass; 90 chars preview as 80 plus `...`; 80 chars preview without suffix.
Extra 1. Attachments exactly 2 and turn exactly 5 pass their respective policy limits.
Extra 2. Uppercase provider identifier is rejected; the gate does not redact a secret in a request but refuses it.

## Deliberate breakages and test detection
1. Secret sort changed to shortest-first — caught by longest-secret-wins oracle. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
2. Minimum secret length lowered — caught by short-secret error check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
3. Retry-After cap removed — caught by 3600000 ms cap check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
4. visibleLimitEvent forced false — caught by 429/402 visibility checks. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
5. Prompt limit changed from greater-than to greater-or-equal — caught by exact 100-character pass. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
6. Attachment limit changed to greater-or-equal — caught by exact 2 attachment pass. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
7. Turn limit changed to greater-or-equal — caught by exact 5 turn pass. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
8. Provider regex made case-insensitive — caught by uppercase-provider rejection. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.

## Questions for the Director
none

## What I could not check
No external AI provider, account, API, network, secret store, request transmission or real provider response was used. The engine is not connected to the permission broker or interaction journal. `tsx` and `test:kernel` were not run/changed; Node execution used TypeScript compilation. Add to test:kernel: `tsx tests/outsideAiGate.test.ts`.
