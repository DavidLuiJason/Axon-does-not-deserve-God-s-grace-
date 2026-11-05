# BATCH 6 - J2 Decision Record report

**Placement:** Layer 3, Understanding; finish-line stage D, Decision Engine (7U), implementing the 7E Decision Dimensions record only; dependency: none.

**Files:** `src/decision/decisionRecord.ts`; `tests/decisionRecord.test.ts`; `docs/reports/BATCH6_J2_REPORT.md`.

## LAW CHECK (FL11)
- FL1: placed in layer 3; later Router/shadow/go-live work is not included.
- FL2: read only the mini-base roadmap, BATCH6_COMMON.md and J2 card.
- FL3: isolated record validator; no Router, broker, screen or caller is added.
- FL4: one job; hand-worked oracle, strict checks and eight deliberate breakages.
- FL9: placed at the Decision Engine finish-line stage; no stage order is changed.
- FL11: this visible check is repeated here; no conflict was found.
- FL12: no chat or brain path is added; nothing calls this engine yet.
- FL13: no phrase/pattern list; closed values come only from the card; one generic error sentence.
- FL14: one pure engine, no imports or duplicate implementation; no existing file is touched.
- FL15: no outside facts or evidence are introduced.

## Result
BUILT; ISOLATED TEST RUN: PASS

Printed test line: `DECISION_RECORD OK: 352 checks`

Commands run from `/mnt/data/batch6b_work`:

```sh
tsc --noEmit --strict --target ES2020 --module commonjs src/decision/decisionRecord.ts tests/decisionRecord.test.ts
```
Output: no diagnostics; exit status 0.

```sh
rm -rf /tmp/axon-batch6b-test && tsc --strict --target ES2020 --module commonjs --outDir /tmp/axon-batch6b-test src/decision/decisionRecord.ts tests/decisionRecord.test.ts
```
Output: no diagnostics; exit status 0.

```sh
node /tmp/axon-batch6b-test/tests/decisionRecord.test.js
```
Output: `DECISION_RECORD OK: 352 checks`

`tsx tests/decisionRecord.test.ts` was NOT RUN. `package.json` was not changed. Add this line to `test:kernel`: `tsx tests/decisionRecord.test.ts`.

## Hand-worked oracle

The card's 33 concrete cases are grouped under A–I; expected results were written independently before running the engine:

- A (1): FAST + DIRECT + ALLOW + 5 steps + `one-capability` gives AUTO, null ask, and an unchanged one-code list.
- B (1): DEEP + DEEP-DIVE + OWNER keeps the trimmed question `Which file?`.
- C (2): FAST/STRUCTURED and DEEP/DIRECT are both valid; route and depth are separate dimensions.
- D (4): ASK with null or CLARIFICATION fails; APPROVAL with ALLOW fails; ASK with APPROVAL succeeds.
- E (3): NEVER + null succeeds; NEVER + CLARIFICATION returns `blocked-with-question`; NEVER + APPROVAL returns `permission-ask-mismatch` first.
- F (3): own `confidence` returns `confidence-not-allowed`; `extra` returns `unknown-key`; both still return `confidence-not-allowed`.
- G (6): two question marks return `more-than-one-question`; empty, whitespace-only and 201-character questions return `bad-ask`; 200 characters and exactly one question mark are valid.
- H (12): ASK route is invalid; `DEEP DIVE` is not the exact depth token; empty, duplicate, 11-item and malformed reason lists fail; 10 reason codes pass; steps -1, 1001 and 1.5 fail; 0 and 1000 pass.
- I (1): two question marks plus invalid permission returns `more-than-one-question`, because ask validation precedes permission validation.

Two additional hand-worked cases:
- J: DEEP + ADVANCED + AUTO + MISSING-INPUT + ALLOW + 42 steps + two distinct reasons returns the same fields, with `Which source?` trimmed. Arithmetic: 42 is within the inclusive 0–1000 budget range; two reason codes are within the 1–10 range.
- K: DEEP + DEEP-DIVE + APPROVAL + ASK + 0 steps + 10 unique reason codes is valid. Arithmetic: 0 is the inclusive minimum budget; 10 is the inclusive maximum reason count.

Boundary arithmetic also checks question lengths 0/1/2 and 199/200/201; step values -1/0/1 and 999/1000/1001; reason-list counts 0/1/2 and 9/10/11; and reason-code lengths 29/30/31. First and last members of the closed route, depth, depth-source, ask-kind and permission sets are tested. Returned success/failure objects and nested arrays/objects are checked for freezing; input snapshots are compared before and after.

## Deliberate breakages and test detection
1. Remove the array-input rejection — CAUGHT by `bad-input array exact error`.
2. Default depthSource to OWNER — CAUGHT by `oracle A exact record`.
3. Raise the question-length ceiling to 201 — CAUGHT by `oracle G4 201 chars code branch`.
4. Permit two question marks — CAUGHT by `oracle G1 code branch`.
5. Raise the steps ceiling to 1001 — CAUGHT by `oracle H9 over maximum steps code branch`.
6. Raise the reason-count ceiling to 11 — CAUGHT by `oracle H5 eleven reasons code branch`.
7. Stop rejecting duplicate reason codes — CAUGHT by `oracle H4 duplicate reasons code branch`.
8. Return an unfrozen reason array — CAUGHT by `oracle A reasons frozen`.

Each mutation was applied alone, the relevant check was run, and the original engine was restored before the next mutation. The final strict check and test were rerun after restoration.

## Questions for the Director

The card does not explicitly say whether the nested `ask` object may contain extra own keys. I used the stricter reading: it must contain exactly `kind` and `question`; an extra key returns `bad-ask`. Please confirm or amend this rule when the full 7E design is written.

## What I could not check

- Router, Resolution, broker, shadow mode, go-live, screen and end-to-end integration: NOT RUN / not part of this isolated job.
- `tsx` execution and `test:kernel` integration: NOT RUN; `package.json` was intentionally untouched.
- Main repository type-check/build, cloud build and Android device behavior: NOT RUN.
- Director's independent reference-engine comparison and independent breakages: NOT RUN.
