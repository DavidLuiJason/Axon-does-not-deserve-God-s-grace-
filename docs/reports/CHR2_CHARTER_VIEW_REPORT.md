# CHR2 Charter View Report

## Five-line roadmap assessment

1. **Finished AXON:** Six layers, from Ground and Knowledge through Language, Understanding, Voice and Reach, with tools, memory, media and external capabilities.
2. **Job placement:** CHR2 belongs to Layer 5 (Reach), Charter authority under sections 7A and 7E, supporting the Act-or-Ask feed.
3. **Dependencies:** Existing `charter.ts`, `change.ts` and `broker.ts`; the broker remains the final execution authority.
4. **Later additions:** CHR3 storage/write path, Router, Settings and Act-or-Ask integration must remain separate.
5. **Potential breakage:** Incorrect trust verification, permissive rule merging, or missing actions could let tools run without the owner's required approval. Fail-closed behavior is essential.

## LAW CHECK (FL11)

- **FL1:** Preserve the six-layer placement and identify downstream risks.
- **FL2:** Read the complete roadmap and every named source file; no unrelated files inspected.
- **FL3:** Keep CHR2 compatible with the later CHR3 and FEED3 stages.
- **FL4:** Run the prescribed proofs; stop after two failures of the same problem.
- **FL5:** Preserve the dictionary; no dictionary files or functionality are touched.
- **FL9:** Keep this job inside the planned Layer 5 Charter sequence.
- **FL11:** Include this check in the final report.
- **FL13:** No fixed phrase lists, regex literals or prohibited string arrays.
- **FL14:** Reuse the existing Charter validator, default and signature verifier; duplicate no existing logic.
- **FL15:** Fail closed on invalid or unverifiable Charter data and test the safety boundary.

Conflict check: the CHR2 scope is consistent with its roadmap placement. CHR1 describes future storage decisions, but this job explicitly excludes storage and writing. The implementation follows the narrower CHR2 boundary.

## Files created

Exactly these three files are in the delivery archive:

- `src/mind/charter/charterView.ts`
- `tests/charterView.test.ts`
- `docs/reports/CHR2_CHARTER_VIEW_REPORT.md`

The engine has exactly the three requested exports. It performs no storage or I/O. The Charter object in a load is not frozen or cloned; result wrappers and feed arrays are frozen. Input data is not mutated.

## Proof commands and output

### Required TSX command

Command: `tsx tests/charterView.test.ts`

**NOT RUN.** `tsx` is not installed in this environment. An attempt to invoke it through `npx --yes tsx tests/charterView.test.ts` timed out while trying to obtain the package. No TSX pass is claimed.

### Available runtime substitute

Command: `node --experimental-strip-types tests/charterView.test.ts`

Printed output:

```text
CHARTER_VIEW OK: 1001 checks
```

This executed the test file with Node's built-in TypeScript stripping; it is not represented as the requested `tsx` command.

### Required engine type-check

Command:

```text
tsc --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler --allowImportingTsExtensions --skipLibCheck src/mind/charter/charterView.ts
```

Printed output: **no output; exit code 0.**

The initial type-check attempt was blocked because the named dependency `broker.ts` had not yet been copied into the temporary mini-base workspace. After adding that already-named dependency, the exact command above passed. No source file outside the three delivery files was changed.

## Mutant checks

Eleven deliberate engine mutants were applied one at a time. Each was caught by the test suite; the original engine was restored after each run.

| Deliberate mutant | Check that caught it |
|---|---|
| Allowed rule can loosen a stricter level | V09 strictest-level case |
| Ask beats never | V09 strictest-level case |
| Unknown declared action treated as allowed | V10 unknown-action case |
| Skip unsigned signature check | L04 unsigned Charter case |
| Untrusted load has an empty ask list | V15 fail-closed case |
| Ignore the second lane | V14 duplicate action across lanes |
| Check input size after parsing | L10 size-before-parse case |
| Do not revalidate a trusted load | V18 invalid Charter in trusted-shaped load |
| Links affect an untrusted load | V17 links-ignored case |
| Unfrozen success results | frozen result/value/array property checks |
| Unsorted serialized keys | S06 key-order serialization case |

Each mutant run exited non-zero (test failure), and all eleven were caught.

## `test:kernel` package script line

Do not edit `package.json` in this job. Append this script entry in the later integration change:

```json
"test:kernel": "tsx tests/charterView.test.ts"
```

## NOT RUN / limitations

- `tsx tests/charterView.test.ts`: **NOT RUN** (tsx unavailable; npx attempt timed out).
- Type-checking the test file separately: **NOT RUN**. The required engine-only TypeScript command passed.
- Director's independent second-reference rerun: **NOT RUN**; reserved for the Director.
- No storage, writer, Router, broker integration, Settings screen, or FEED3 wiring was built, as explicitly required.

## DIRECTOR VERDICT (2026-11-06): ACCEPTED, after one Director fix
- MEASURED (Director sandbox): the returned test runs under tsx (the report said NOT RUN): CHARTER_VIEW OK 1001 checks; engine tsc strict clean; the Director reference (61 checks: 25 load rows, 8 serialize rows, 26 error rows and the pinned default hash 167fb2be) passes on the returned engine.
- FINDING F1 (fixed by the Director, 3 lines): a declared action named like an inherited property (constructor, toString, __proto__, hasOwnProperty, valueOf) was read as a found "allowed" rule on a parsed Charter, so the tool stayed free instead of going UP to ask. The engine now reads rules through an own-property helper (`ruleOf`). The returned 1001 checks did not catch it; the mutant that reverts it passes the returned test and fails the Director checks.
- Director checks added in `tests/charterViewDirectorChecks.test.ts` (24 checks): inherited names on parsed and built-in Charters, never beating the unknown-action ask, action order, untrusted load shape, symbol key in a link, empty link tool, signature kept, fresh default per call.
- Mutants: the builder's 11 all killed (rerun not needed); Director mutants M1 to M8: 7 killed by the returned test or the reference, M1 (the real gap) killed only by the Director checks, M7 (empty link tool) a gap now closed.
- The report's `test:kernel` line would have replaced the whole script; the Director APPENDED ` && tsx tests/charterView.test.ts && tsx tests/charterViewDirectorChecks.test.ts` instead.
- NOT RUN: cloud build, full test:kernel, phone. The view has no caller; CHR3 (storage and the single writer) is next.
