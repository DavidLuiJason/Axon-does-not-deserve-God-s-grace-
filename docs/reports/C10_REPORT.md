# C10 — Converter wiring report

## Verdict

**INCOMPLETE VERIFICATION — do not merge until the tests and project type check run in a provisioned Node environment.** The requested source and test delta was created, but this sandbox could not run the TypeScript test runner or complete a type check because the ZIP has no installed dependencies and package installation timed out. This is not labelled as tested or ready to merge.

## Top view

Roadmap v16.5 describes AXON as a foundation-first Android app with a core dictionary, explicit brain stages, a live capability registry, tested pure engines, and screens built separately in AI Studio. C10 is engine-side Converter wiring for Data formats, Text formats, and image-conversion planning. Later breakage risks include the screen's present number/text-only assumptions, format convention mismatches, JSON number precision when values are materialised, and memory limits on the Infinix Note 10. No screen, dictionary, registry, catalog, package file, or guard file was changed.

## LAW CHECK (FL11)

- FL1: Followed roadmap v16.5 and preserved the existing Converter architecture.
- FL2: Read the supplied roadmap and checked the required base paths before editing.
- FL3: Kept later screen, registry and chat integration in view; screen wiring remains a later job.
- FL4: Followed priority order; no third fix was attempted after a repeated failure.
- FL5: Dictionary data and dictionary code were not changed or omitted.
- FL6: Added no dependencies or static datasets; block input is capped at 1,000,000 characters and existing engine limits remain in force.
- FL7: Recorded actual command outcomes; did not claim unavailable checks passed.
- FL8: Changes are confined to the declared source/test/report lane.
- FL9: Reused the existing engines instead of creating parallel parsers.
- FL10: New conversion paths return typed errors and change notes; no registry edits or capability claims were added.
- FL11: This law check is included in the report.
- FL12: No brain imports or bypasses were introduced.
- FL13: No fixed phrase list or brain vocabulary was added.
- Rule 1: Kept work to the requested kinds, adapter and tests.
- Rule 2: Preserved the existing engine dependencies and legacy adapter behavior in code paths.
- Rule 3: Built on the existing CSV, YAML, XML, JSON-token, text-format and image-planning engines.
- Rule 4: One builder and one delta archive; full incremental execution was blocked by missing dependencies.
- Rule 5: Followed the specified data, text, image priority.
- Rule 6: Attempted the requested checks and recorded their real outcomes below.
- Rule 7: Did not intentionally add lossy shortcuts; CSV cell arrays are explicitly serialized as JSON text and reported.
- Rule 8: Added a block-input cap and relied on bounded underlying engines; further adversarial execution remains unverified.
- Rule 9: Created a ZIP containing only new/changed permitted files.
- Rule 10: Did not edit the roadmap.
- Rule 11: Exposed engine-side kind metadata and planning without changing the screen.
- Rule 12: Existing guards and locks were not changed; package scripts are reported for manual addition.
- Rule 13: ZIP entries use paths relative to repository root.

## Files created or changed

- Changed `src/tools/converter/kinds.ts` — entry types now include `block` and `file`; added Data formats, Text formats and Image kind metadata.
- Changed `src/tools/converter/convert.ts` — routes new format kinds, retains existing numeric/base branches, exports `planConversion`.
- Changed `src/tools/converter/index.ts` — exports the new adapter functions and types.
- Created `src/tools/converter/blocks.ts` — bounded data/text adapters, conversion notes, table flattening, typed errors and image planning export.
- Changed `tests/toolsConverter.test.ts` — only the assertions that assumed every kind was numeric/text were adjusted: block kinds accept arbitrary text, while image planning requires metadata and is tested separately. Legacy-specific assertions remain.
- Created `tests/convertBlocks.test.ts` — seeded pair coverage, text conversions, error/notes checks, image planning and legacy smoke regression.
- Created `docs/reports/C10_REPORT.md` — this report.

## Commands and evidence

- **MEASURED:** Base path gate — all ten required paths named in the prompt were present in the supplied ZIP.
- **NOT RUN:** `npx tsx tests/toolsConverter.test.ts` — timed out while npx attempted to resolve the unavailable local runner.
- **NOT RUN:** `npx tsx tests/convertBlocks.test.ts` — local `tsx` is unavailable; package installation did not complete.
- **NOT RUN:** `npm run test:kernel` — dependencies were not installed, so the test suite could not execute.
- **NOT RUN (failed before project analysis):** `tsc --noEmit -p tsconfig.json` — `TS2688: Cannot find type definition file for 'vite/client'` because project dependencies are absent.
- **NOT RUN (failed before project analysis):** strict targeted `tsc` invocation over the converter and engine files — global compiler reported missing ambient type definitions (`fs-extra`, `jszip`, `node`, `react`, `react-dom`, `slice-ansi`).
- **NOT RUN:** `npm ci --ignore-scripts --no-audit --no-fund` — sandbox transport timed out; no successful install was observed.
- No check counts are claimed because the test files did not execute.

## Test script lines to add

Add these lines to the `test:kernel` command in `package.json` (do not change package.json as part of this delta):

```text
&& tsx tests/toolsConverter.test.ts && tsx tests/convertBlocks.test.ts
```

## Unfinished / limitations

- The new test suite has not been executed, so conversion behavior and TypeScript compatibility remain unverified.
- The requested independent Python reference comparisons and a baseline table of exact pre-change outputs were not measured in this sandbox; the legacy regression in the new test is only a smoke check, not a full independent baseline proof.
- The current screen has not been changed, as required. A later screen job must handle `block` and `file` entries rather than treating all non-number entries as number-base conversions.
- Do not merge until the new tests, all affected `test:kernel` commands, and `npx tsc --noEmit -p tsconfig.json` pass in a provisioned environment. If the same setup/check failure occurs twice, follow the Two-Strike Rule rather than attempting a third fix.
