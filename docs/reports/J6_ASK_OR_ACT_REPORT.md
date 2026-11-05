# J6 Ask or Act Report

## Five-line project assessment
1. **Finished AXON (roadmap section 6):** Five layered foundations, from Ground and Knowledge through Reading, Understanding, Voice and Reach, supporting the complete AI assistant.
2. **J6 placement:** Layer 3, Understanding, at the edge of Planning; it implements the isolated Act-or-Ask decision.
3. **Dependency:** None; typed input only, with no imports or caller.
4. **Later additions:** Resolution, repair, permission brokerage, decision records and full brain integration remain future work.
5. **Possible breakage:** Incorrect decision precedence, missing-input handling or approval classification could cause AXON to act when it should ask, or ask unnecessarily.

## LAW CHECK (FL11)
- **FL1:** J6 is placed in the complete AXON architecture; later integration and risks are identified.
- **FL2:** Only the roadmap and explicitly named reference files were read.
- **FL3:** The engine remains bounded within the larger brain design.
- **FL4:** One engine, exact cases, strict compilation and mutation testing.
- **FL9:** J6 is permitted by the DESIGN-FIRST EXIT and placed in 7K.
- **FL10:** No registry, chat action or caller is added.
- **FL11:** This visible check is repeated in the report.
- **FL12:** No independent brain or screen execution path is introduced.
- **FL13:** No fixed phrase lists or brain vocabulary are added.
- **FL14:** One pure implementation; no duplicated engine logic.
- **FL15:** Behavior is checked against literal expected values and deliberate failure tests.

## Scope and implementation
Created exactly these three files:
- `src/decision/actOrAsk.ts`
- `tests/actOrAsk.test.ts`
- `docs/reports/J6_ASK_OR_ACT_REPORT.md`

No existing file was changed. The engine has no imports, caller, screen, storage, clock, or wiring. It returns no question text and contains no confidence value. Success and failure results are frozen; success values and reason arrays are frozen. The supplied 26 hand-worked cases are literal expected-value checks. The test also covers every specified error code, ordering, symbol and non-enumerable own keys, missing and undefined required fields, input immutability, and all 3,456 combinations.

## Proof commands and printed output

Strict no-emit check:

```sh
tsc --noEmit --strict --target ES2020 --module commonjs src/decision/actOrAsk.ts tests/actOrAsk.test.ts
```

Output: no diagnostics; exit status 0.

Compile the test for Node:

```sh
tsc --strict --target ES2020 --module commonjs --outDir /mnt/data/j6_compiled src/decision/actOrAsk.ts tests/actOrAsk.test.ts
```

Output: no diagnostics; exit status 0.

Run:

```sh
node /mnt/data/j6_compiled/tests/actOrAsk.test.js
```

Output:

```text
ACT_OR_ASK OK: 9621 checks
```

## Deliberate mutants

Each mutant was compiled and run against the unchanged test. All six were caught:

1. **Swap NEVER and NO-READING precedence** — CAUGHT by case 12 (`NEVER with no reading`), which expects BLOCK / `permission-never`.
2. **Drop the SEND approval reason** — CAUGHT by case 18 (`ALLOW does not lift approval`), whose exact reason list requires `not-undoable`, `sends`.
3. **Let ALLOW lift the NOT-UNDOABLE approval ask** — CAUGHT by case 16 (`not undoable`), which requires ASK / APPROVAL / `not-undoable`.
4. **Ignore `canUndo` in the two-reading branch** — CAUGHT by case 5 (`two close, changes, not undoable`), which requires CLARIFICATION and the two exact reasons.
5. **Use `Object.keys` instead of `Reflect.ownKeys`** — CAUGHT by `symbol own key fails`; the symbol-key error test detects the ignored symbol.
6. **Validate undo before permission** — CAUGHT by `permission precedes undo`, where both are invalid and `bad-permission` must win.

The original engine source was restored after mutation runs. The final strict compile and 9,621-check Node test were run on the restored source and passed.

## `test:kernel` line to add

```text
tsx tests/actOrAsk.test.ts
```

`package.json` was not edited.

## NOT RUN
- The `tsx tests/actOrAsk.test.ts` script itself and integration into `test:kernel`.
- Repository-wide tests, build, cloud build, APK and Android-device behavior.
- The Director's independent rerun.
- J6 callers, Resolution-derived `undo`/`outward`/`readings`/`missing`, question wording, J2 handling of non-approval ASK outcomes, screens, storage, wiring, file format and clock; intentionally undecided or outside this isolated-engine contract.
