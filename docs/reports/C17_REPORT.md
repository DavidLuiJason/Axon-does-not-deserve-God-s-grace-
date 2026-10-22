# C17 Report — File Converter and Batch Convert planners

## Result

Both planners and their tests are implemented in the C17 lane. No existing project file was changed. Evidence labels below distinguish commands actually run from commands that could not run in this sandbox.

## LAW CHECK (FL11)

- **FL1 — Top view:** used the complete supplied AXON roadmap v16.8 to place this job in the Files and Converters layer.
- **FL2 — Read everything, then act:** reviewed the complete supplied roadmap and inspected all C17 required base paths plus `kinds.ts`, `convert.ts`, the conversion engines, limits and test configuration before implementation. The repository's full handbook and job board are empty in this ZIP.
- **FL3 — Plan reaches the end:** both planners support later screen-driven single-file and batch workflows without implementing screens.
- **FL4 — Progress first:** implemented in priority order and verified in small steps; no third attempt was made at a failing command.
- **FL5 — Dictionary is core:** dictionary files were not edited or omitted from the base; the return ZIP contains only the five in-lane new files.
- **FL6 — Searchable compression:** no dictionary data was copied; batch output holding is capped and drainable.
- **FL7 — Measure why:** tests and type-check commands were run where possible; unavailable tooling and failures are reported honestly below.
- **FL8 — Source export:** no export or repository comparison code was changed.
- **FL9 — Plan first:** format IDs are derived from `CONVERTER_KINDS`; detection and conversion limits reference existing engine constants.
- **FL10 — Truthful capabilities:** the required descriptors are exported; no menu or registry is edited.
- **FL11 — Every-Stage Law:** this check is included here and was considered before building.
- **FL12 — One designed brain:** pure engines only; no chat or brain imports were added.
- **FL13 — Structure before vocabulary:** examples are descriptor documentation only; no brain phrase list was added.
- **Rule 1:** kept the job to the two planners, their tests and this report.
- **Rule 2:** built on the existing Converter and engines rather than replacing the foundation.
- **Rule 3:** formats, image limits, CSV limits, Markdown/HTML limits and inspect behaviour reuse existing definitions.
- **Rule 4:** each engine/test was run separately before continuing.
- **Rule 5:** followed the supplied priority order: file converter first, batch second.
- **Rule 6:** ran focused tests, existing converter regression tests and a strict engine-file type check.
- **Rule 7:** no image quality degradation is performed by a planner; batch held outputs are capped at 64 MiB by default.
- **Rule 8:** enforces 50 files, 100 MiB total input, 30 image files, a 64 MiB default held-output cap, and existing conversion limits where measurable.
- **Rule 9:** the return ZIP contains only the C17 lane files and relative repository paths.
- **Rule 10:** roadmap unchanged.
- **Rule 11:** targets derive from `kinds.ts`, so supported formats are not copied into a second fixed format list.
- **Rule 12:** guard, lock and dictionary files are unchanged.
- **Rule 13:** no new dependency; paths in the ZIP are repository-relative.

## Files created

- `src/tools/engines/files/fileConvertPlan.ts`
- `src/tools/engines/files/batchPlan.ts`
- `tests/fileConvertPlan.test.ts`
- `tests/batchPlan.test.ts`
- `docs/reports/C17_REPORT.md`

## Verification results

### MEASURED — passed

- `node /tmp/c17-runner.cjs "$PWD/tests/fileConvertPlan.test.ts"` — passed, 14 explicit assertions. The runner transpiles TypeScript using the globally installed TypeScript compiler; it is a fallback, not `tsx`.
- `node /tmp/c17-runner.cjs "$PWD/tests/batchPlan.test.ts"` — passed, 31 explicit assertions plus 2,000 seeded operations. Each operation checked the total-count invariant and percent range.
- `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck src/tools/engines/files/fileConvertPlan.ts src/tools/engines/files/batchPlan.ts` — passed.
- `node /tmp/c17-runner.cjs "$PWD/tests/convertBlocks.test.ts"` — passed, 1,101 checks.
- `node /tmp/c17-runner.cjs "$PWD/tests/toolsConverter.test.ts"` — passed, 134 checks plus 221 regression checks.
- Independent Python fixture arithmetic: 4 input files, 26 UTF-8 bytes total; the expected JSON targets are `csv`, `tsv`, `xml`, `yaml`; case-folded output-name simulation confirmed unique names and no overwrite of an input name.
- Base preflight: every required C17 file was found, including `src/tools/converter/kinds.ts`, `src/tools/converter/convert.ts`, `src/tools/converter/blocks.ts`, image conversion planner, inspect, ZIP tool, CSV, Markdown, and both existing Converter tests.

### Existing `test:kernel` checks — fallback runner

The repository's `test:kernel` script contains 30 `tsx` test commands. The fallback runner passed the first 23 completed tests through `tests/cropResize.test.ts` except `tests/tools.test.ts` and `tests/capabilityTruth.test.ts`, which failed under the fallback environment. `tests/tools.test.ts` cannot load its dependency because this checkout has no installed project dependencies; `tests/capabilityTruth.test.ts` invokes tooling unavailable to the fallback runner. The grouped run timed out before all remaining tests completed. Therefore, the full `test:kernel` script is **NOT RUN to completion**; do not treat the partial fallback run as a full pass.

### NOT RUN / blocked

- `npx tsx tests/fileConvertPlan.test.ts` and `npx tsx tests/batchPlan.test.ts`: the checkout has no local `tsx` binary; `npx` timed out while trying to resolve it. The tests were run through the explicitly described fallback transpile runner instead.
- `npx tsc --noEmit -p tsconfig.json` (the project's configured lint/type-check): **NOT RUN successfully**. Global `tsc --noEmit -p tsconfig.json` failed immediately with TS2688 because `vite/client` type definitions are not installed in this sandbox.
- Full `test:kernel`: NOT RUN to completion for the reasons above.

## Package script lines to add

Do not edit `package.json` in this lane. Add these entries to the `test:kernel` chain in a later merge:

- `tsx tests/fileConvertPlan.test.ts`
- `tsx tests/batchPlan.test.ts`

## Unfinished items / caveats

- The complete project type-check and full kernel suite need to be rerun in a checkout with project dependencies installed.
- Image conversion planning requires dimensions either from the inspected header or supplied as options; if dimensions cannot be verified from the first 4096 bytes, the planner returns a typed error rather than claiming the 24-megapixel limit was checked.
