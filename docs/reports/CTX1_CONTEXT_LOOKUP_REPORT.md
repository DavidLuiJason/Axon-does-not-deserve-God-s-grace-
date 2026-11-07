# CTX1 Context Lookup — Builder Report

## Scope and placement

Built one isolated pure engine at `src/decision/contextLookup.ts`, beside the Act-or-Ask feed in Layer 3 (Understanding). It accepts only the task-local typed context sources `selected`, `attached`, `previous-reference`, and `answer`; it does not read long-term memory or call any store. No caller or CONTEXT-store location is implemented.

## LAW CHECK (FL11)

- FL1 — Located CTX1 in the complete six-layer architecture; future dependencies identified.
- FL2 — Read the complete roadmap and all named design, cases and feed files.
- FL3 — Kept the engine isolated for later FEED3 integration.
- FL9 — Implemented as a Layer 3 foundation component.
- FL10 — Produces the two missing-input lists consumed by the existing feed.
- FL11 — This check is included in the delivery report.
- FL12 — No independent chat or screen execution; feed integration is tested.
- FL13 — Uses typed kinds and sources, with no fixed phrase lists.

## Files created

1. `src/decision/contextLookup.ts`
2. `tests/contextLookup.test.ts`
3. `docs/reports/CTX1_CONTEXT_LOOKUP_REPORT.md`

No existing file was changed. The engine has no imports, IO, storage, date/time, random, regex, console, or global state. It validates exact own keys including symbols, uses the specified first-failure order, deep-freezes success and failure results, and catches exceptions as `bad-input`.

## Cases and proof

### A. Result rows — PASS

Every hand-worked row was asserted using JSON deep equality (therefore also checking key order):

C1 PASS; C2 PASS; C3 PASS; C4 PASS; C5 PASS; C6 PASS; C7 PASS; C8 PASS; C9 PASS; C10 PASS; C11 PASS; C12 PASS; C13 PASS; C14 PASS; C15 PASS; C16 PASS; C17 PASS; C18 PASS; C19 PASS; C20 PASS; C20b PASS; C21 PASS; C22 PASS; C23 PASS; C23b PASS; C24 PASS; C25 PASS; C26 PASS; C27a PASS; C27b PASS; C27c PASS; C28 PASS; C29 PASS; C29b PASS; C30 PASS.

### B. Caps — PASS

- K1 selected: 4 passes; 5 fails with `too-many-items`.
- K2 attached: 8 passes; 9 fails with `too-many-items`.
- K3 previous-reference: 8 passes; 9 fails with `too-many-items`.
- K4 answer: 8 passes; 9 fails with `too-many-items`.
- K5 all four sources at their caps simultaneously: passes.

### C. Error rows — PASS

- C-error 1: non-object inputs — `bad-input`.
- C-error 2: missing/extra/symbol own keys and extra getter key — `unknown-key`.
- C-error 3: invalid missing list/entry, duplicate slot, empty slot and invalid kind — `bad-missing`.
- C-error 4: invalid items, all four disallowed note/memory source families and other unknown sources, invalid kinds/IDs, duplicate IDs, answer-slot rules, readable rules, extra keys and non-object entries — `bad-items`.
- C-error 5: source caps checked only after item validation — `too-many-items`.
- Error-order case `{missing:5, items:5}` returns `bad-missing` — PASS.
- Throwing getter on `missing` returns `bad-input` without throwing outward — PASS.
- Every error carries the required message and is frozen — PASS.

### D. Output shape and invariants — PASS

Value key order and trace-entry key order are checked by JSON equality. Success result, value, both lists, trace and each trace entry are frozen. Error result is frozen. Input object remains unchanged. `note` and `memory` sources are rejected. The deterministic 2,000-case sweep checks trace order and uniqueness, list/trace agreement, no double fills, matching kinds, R1-only decision-slot fills, safe-step eligibility, and null item IDs for unfilled slots.

### E. Feed link rows — PASS

- L1 context answer + selected text → feed accepts; `CONTEXT-ANSWERS`.
- L2 selected choice is not used to decide → feed accepts; `OWNER-ONLY`.
- L3 readable attached file → feed accepts; `SAFE-STEP-ANSWERS`.
- L4 no candidate → feed accepts; `OWNER-ONLY`.

## Executed commands and results

Strict type check (exit 0, no diagnostics):

```sh
tsc --noEmit --strict --target ES2022 --module commonjs --moduleResolution node src/decision/contextLookup.ts tests/contextLookup.test.ts
```

The imported feed and its type dependency were also included in the strict compile-and-run command below. The test was compiled with TypeScript and executed under Node because `tsx` was not available in this environment:

```sh
tsc --strict --target ES2022 --module commonjs --moduleResolution node --outDir /tmp/ctx1js-final src/decision/contextLookup.ts src/decision/actOrAsk.ts src/decision/actOrAskFeed.ts tests/contextLookup.test.ts
node /tmp/ctx1js-final/tests/contextLookup.test.js
```

Last test output:

```text
CONTEXT_LOOKUP OK: 17030 checks
```

**tsx test: NOT RUN.** `tsx --version` reported that the command was not found; `npx --yes tsx tests/contextLookup.test.ts` timed out. No claim is made that the suite passed under `tsx`.

Exact package test line for the Director to append (package file deliberately untouched):

```text
tsx tests/contextLookup.test.ts
```

## Mutants

Ten deliberate mutations were applied to separate copies of the engine and each was caught by the final test suite. **10 killed; 0 survived.**

1. Swap R2 and R3 precedence — KILLED.
2. Allow choice/yes-no to fill from an object — KILLED.
3. Accept the first of multiple matching answers — KILLED.
4. Raise selected cap from 4 to 5 — KILLED.
5. Remove the readable-file requirement — KILLED.
6. Allow R5 to fill a non-text slot — KILLED.
7. Ignore kind matching in R1 — KILLED.
8. Remove duplicate-ID validation — KILLED.
9. Remove deep freezing of trace entries — KILLED.
10. Allow `note` as a source — KILLED.

## NOT RUN / limitations

- `tsx tests/contextLookup.test.ts`: NOT RUN (tsx unavailable; npx invocation timed out).
- Cloud build and Director's independent reference rerun: NOT RUN; reserved for the Director.
- No FEED3 caller, CONTEXT store, source writer, or owner-facing usage view was built; these remain explicitly undecided/out of scope.

## Handoff

The returned archive contains only the three requested files at their exact repository paths. The engine and tests are delivered; the `tsx` execution requirement remains outstanding and is clearly marked above.
