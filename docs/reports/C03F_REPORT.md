# C03F Report — YAML block scalar fix

Date: 2026-10-18

## Result

Fixed `parseYaml` so block scalar content is read from the original physical input lines, retaining blank lines and `#` characters that belong to the scalar. The fix keeps original physical line positions for the scalar reader, preserves comment stripping for ordinary YAML lines, handles literal and folded line breaks, honours `-`, default and `+` chomping, supports scalar values in sequence items and sequence-item mappings, and reports compact nested sequences as unsupported with a clearer message.

Expected values for the 14 block-scalar cases in `tests/yaml.test.ts` were independently obtained by running Python PyYAML 6.0.3 `yaml.safe_load`; the resulting values were pasted as constants. The test source labels these cases accordingly.

## LAW CHECK (FL11)

- **FL1 — Top view:** Used the full supplied roadmap and the six-layer architecture in Section 6.
- **FL2 — Read everything, then act:** Read the complete roadmap, Part 00 (Section 3), `docs/JOB_BOARD.md`, `docs/DIRECTOR_HANDBOOK.md`, and the relevant YAML source, tests, package scripts and TypeScript configuration.
- **FL3 — Plan reaches the end:** Preserved the YAML subset contract used by the planned data-format Converter.
- **FL4 — Progress first, no repeating:** Made a minimal parser change; did not repeat a failed repair attempt.
- **FL5 — Dictionary is core:** No dictionary data or files changed.
- **FL6 — Searchable compression:** No dictionary storage or compression changed.
- **FL7 — Measure why:** Compared expected block-scalar values with PyYAML 6.0.3 and ran the YAML regression test.
- **FL8 — Source export:** No export files or behaviour changed.
- **FL9 — Plan first:** Changes are confined to the YAML parser, its tests and this report.
- **FL10 — Truthful capabilities:** This report distinguishes measured results from checks that could not run.
- **FL11 — Every-Stage Law:** This Law Check is included here and was provided before implementation; no roadmap conflict was found.
- **FL12 — One designed brain:** No brain stages or chat integration changed.
- **FL13 — Structure before vocabulary:** No fixed phrases or patterns were added to the brain.
- **Rule 1 — Size the job:** Kept the change to the two specified defects and their regression coverage.
- **Rule 2 — Sound foundation:** Preserved existing parser behaviour and round-trip tests.
- **Rule 3 — Foundation first:** Changed only the data engine and its tests, not screens.
- **Rule 4 — One builder, one proof:** Verified the YAML test and in-lane strict type check; did not claim unavailable checks passed.
- **Rule 5 — Plan before work:** Followed the C03F priority order.
- **Rule 6 — Measure, design, build, prove:** Ran the test and strict in-lane TypeScript check after the edit.
- **Rule 7 — Compress without degrading quality:** No content or test data was removed to make the fix pass.
- **Rule 8 — Weakest supported phone:** Existing input size, nesting and value limits remain in place.
- **Rule 9 — Verify the connection:** Used the supplied repository base and packaged only the three permitted paths.
- **Rule 10 — Roadmap size cap:** Did not edit the roadmap.
- **Rule 11 — Account for the future:** Retained nested mapping/sequence use and scalar chomping behaviour.
- **Rule 12 — Locks grow with the project:** Did not change package scripts, locks, guards or test gates.
- **Rule 13 — Portable project:** The returned zip contains repository-relative paths only and no wrapper directory.

## Files created or changed

1. `src/tools/engines/data/yaml.ts` — changed.
2. `tests/yaml.test.ts` — changed.
3. `docs/reports/C03F_REPORT.md` — created.

No other files are included in the returned zip.

## Commands and evidence

- **MEASURED —** `node --experimental-strip-types tests/yaml.test.ts` — PASS. Output: `yaml.test.ts PASS: 350 seeded round trips, 9 hand documents, 14 PyYAML-derived block-scalar cases, 10 hostile cases, 9 boundary/edge checks`. This used Node 22's built-in TypeScript stripping as an alternate runner, not `tsx`.
- **NOT RUN —** `npx tsx tests/yaml.test.ts`. `tsx` is not installed in the supplied base; the `npx --no-install tsx tests/yaml.test.ts` attempt timed out after 20 seconds while trying to resolve the unavailable package.
- **MEASURED —** `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions src/tools/engines/data/yaml.ts tests/yaml.test.ts` — PASS, no diagnostics (global TypeScript 5.8.3).
- **MEASURED —** `tsc --noEmit -p tsconfig.json` — FAIL before project checking could proceed: `TS2688: Cannot find type definition file for 'vite/client'`. The supplied archive has no `node_modules`.
- **NOT RUN —** `npx tsc --noEmit -p tsconfig.json`; `npx` package resolution was unavailable in this sandbox. The equivalent global `tsc` command above was attempted and reported the missing `vite/client` type.
- **NOT RUN —** the repository's `test:kernel` script under its prescribed `tsx` runner. `tsx` and the project's dependencies are not installed, and package resolution timed out. As a diagnostic only, all 30 test files were attempted using `node --experimental-strip-types`: `brainBoundary.test.ts` and `roadmapSize.test.ts` exited successfully; the other 28 could not resolve extensionless TypeScript imports (for example `src/kernel/index`). These alternate-runner outcomes are not counted as a valid `test:kernel` run.
- **MEASURED —** PyYAML version `6.0.3` was available in Python. `yaml.safe_load` was run for the 14 scalar fixtures, and its values were entered as test constants.
- **NOT RUN —** install/dependency recovery, because package resolution did not complete in this sandbox.
- **Unfinished:** The prescribed `tsx` test command, full project type check and prescribed `test:kernel` run remain to be repeated in an environment with the repository dependencies installed.

## Coverage measured by the YAML test

- 350 seeded stringify/parse round trips passed.
- 9 existing hand-written YAML documents passed.
- 14 PyYAML-derived block-scalar cases passed, covering literal/folded scalars, one and two blank lines, inline and standalone `#`, `|+`, `|-`, `>-`, a following key, sequence items, sequence-item mappings, comments outside scalars, a less-indented comment, and EOF without a final newline.
- 10 hostile YAML inputs were rejected.
- 9 boundary/edge assertions passed, including empty input, wrong input type, oversize input, zero and negative values, emoji, RTL text, odd characters, CRLF, a long line, invalid indentation, unsupported compact nested sequences, and invalid non-finite values.

## `test:kernel` addition

Do not edit `package.json` in this patch. Append this command to the existing `test:kernel` chain:

`tsx tests/yaml.test.ts`

## Known limit retained

Compact nested sequences such as `- - 7` remain unsupported. The parser now returns an honest unsupported error that explains the supported alternative: put the outer dash on its own line and indent the nested `- 7` beneath it.

## Director inspection 2026-10-18 (INSPECTED-OK, MERGE)
- MEASURED: verify_return.py clean (1 new, 2 changed in lane, none out of lane); yaml test passes under tsx (350 round trips plus 14 PyYAML-derived block-scalar cases); strict tsc passes.
- MEASURED by hand: the four failing cases now match PyYAML (blank lines kept in `|` and `>`, `#` kept inside blocks); a fresh set of 5 documents matches PyYAML except the two known limits; with the OLD engine the NEW test fails (exit 1), so the test can catch the bug.
- Known limits unchanged: `- - 7` refused with a clear message; `1.5e3` reads as a number (YAML 1.2 style; PyYAML 1.1 reads a string); a flow list nested 101 deep is accepted (limit is 100 for block nesting): minor, not fixed.
