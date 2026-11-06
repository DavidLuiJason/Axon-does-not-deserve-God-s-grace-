# FEED1 Act-or-Ask Feed Report

## Five-line project assessment
1. **Finished AXON (roadmap section 6):** Five layers from Ground and Knowledge through Reading, Understanding, Voice and Reach, supporting a truthful Android conversational AI with tools, media, memory and verified execution.
2. **FEED1 placement:** Layer 3 (Understanding), at the Resolution-to-J6 boundary on the edge of Planning, under roadmap 7K and 7E.
3. **Dependency:** The completed J6 `decideActOrAsk` engine, imported only as a TypeScript type; no caller is added.
4. **Later additions:** Context lookup, Charter storage, repair, Router caller, Dialogue wording, J2 recording, screens, wiring and storage remain separate jobs.
5. **Possible breakage:** Incorrect tool/schema mapping, precedence, missing-slot classification or permission/undo handling could cause an unsafe action, invalid J6 input or unnecessary question.

## LAW CHECK (FL11)
- **FL1:** Feed placement and downstream J6 dependency are identified.
- **FL2:** Only the roadmap and the six named reference files were read.
- **FL3:** The feed produces J6 input without taking over later brain stages.
- **FL4:** One isolated engine, independent expected values, strict compilation and mutation tests.
- **FL9:** FEED1 is explicitly placed under 7K and the approved design.
- **FL11:** This visible check is repeated in the report.
- **FL12:** No caller, screen or independent execution path is introduced.
- **FL13:** No message text, confidence score or fixed phrase list is introduced.
- **FL14:** J6 remains the single decision engine; FEED1 only prepares its typed input.
- **FL15:** Exact hand-worked cases, a J6 acceptance sweep and deliberate mutants challenge the implementation.

**Conflict check:** No conflict found between the prompt, roadmap v21.3, J6 and the FEED1 design.

## Scope and implementation
Created exactly these three files:
- `src/decision/actOrAskFeed.ts`
- `tests/actOrAskFeed.test.ts`
- `docs/reports/FEED1_ACT_OR_ASK_FEED_REPORT.md`

No mini-base file was changed. The feed accepts typed facts only. It does not read message text, accept Resolution confidence/reason/candidates, create question wording, call J6, add a caller, or introduce screens, storage, wiring or a clock. It validates own string and symbol keys (including requiring each of the eight top-level keys to be own properties), validates arrays element by element, follows the required first-failure order, applies strictest-reading precedence, and freezes success and failure results. The test uses literal expected values for all 32 supplied rows and independently checks the J6 boundary.

## Proof commands and printed output

The requested command with `--ignoreConfig` was tried first:

```sh
tsc --noEmit --strict --target ES2020 --module commonjs --ignoreConfig src/decision/actOrAskFeed.ts src/decision/actOrAsk.ts tests/actOrAskFeed.test.ts
```

Printed output:

```text
error TS5023: Unknown compiler option '--ignoreConfig'.
```

The installed TypeScript compiler does not support that flag, so it was omitted as the prompt allows. Strict no-emit check:

```sh
tsc --noEmit --strict --target ES2020 --module commonjs src/decision/actOrAskFeed.ts src/decision/actOrAsk.ts tests/actOrAskFeed.test.ts
```

Printed output: no diagnostics; exit status 0.

Compile the test for Node:

```sh
rm -rf /mnt/data/feed1_compiled
tsc --strict --target ES2020 --module commonjs --outDir /mnt/data/feed1_compiled src/decision/actOrAskFeed.ts src/decision/actOrAsk.ts tests/actOrAskFeed.test.ts
```

Printed output: no diagnostics; exit status 0.

Run:

```sh
node /mnt/data/feed1_compiled/tests/actOrAskFeed.test.js
```

Printed output:

```text
ACT_OR_ASK_FEED OK: 8021 checks
```

The clean strict compile and test were rerun after all mutation trials, with the original engine restored.

## Deliberate mutants

Each mutant was compiled and run against the unchanged test. All eight were CAUGHT:

1. **Ignore value-only evidence (`evidence: 'value'`):** caught by `23 value evidence all eight exact fields`.
2. **Take the best undo classification instead of the worst:** caught by `2 noter all eight exact fields`.
3. **Drop MONEY priority in outward effects:** caught by `3 mailer all eight exact fields`.
4. **Let safe-step fills beat context fills:** caught by `15 context beats safe all eight exact fields`.
5. **Ignore `charter.never`:** caught by `26 charter never mailer all eight exact fields`.
6. **Map non-pure `not-needed` tools to READ-ONLY:** caught by `6 oddpure all eight exact fields`.
7. **Drop the unknown-tool check:** caught by `unknown match tool exact code`.
8. **Swap schema validation ahead of resolution validation:** caught by `resolution before schemas exact code`.

The original source was restored after each mutation. Final clean proof is the strict compile and 8,021-check run above.

## `test:kernel` line to add

```text
tsx tests/actOrAskFeed.test.ts
```

`package.json` was not edited.

## NOT RUN
- The Director's independent reference-engine rerun.
- FEED2 checks against all real repository schemas and the Router R3 consistency check.
- CTX1, CHR1, DLG1, BUD1, REP4 and FEED3; these are separate dependencies/jobs.
- Repository-wide tests, full build, cloud build, APK and Android-device behavior.
- `tsx tests/actOrAskFeed.test.ts` through `test:kernel`; the compiled Node test was run directly.
