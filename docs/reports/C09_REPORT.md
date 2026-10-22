# C09 — Engine Registry and Truth Test Report

## Delivery status and evidence

**NOT FULLY VERIFIED.** The implementation and tests are included, but the supplied sandbox had no `node_modules`, no installed `tsx`, and no cached copy of all dependencies. The required runtime test suite and project type-check could not be completed. Do not treat this report as a green test result; the Director must run the returned package against the repository toolchain before merge.

Evidence labels used below: **MEASURED** means the command was run and its output observed; **NOT RUN** means the intended check did not complete; **HYPOTHESIS** means an unverified expectation.

## LAW CHECK (FL11)

- **FL1 — Top view:** C09 stays at the capability registry and engine-truth layer in the complete AXON plan.
- **FL2 — Read everything, then act:** The supplied v16.5 roadmap, repository job board, Director handbook and C09 prompt were consulted; implementation references actual engine exports.
- **FL3 — Plan reaches the end:** Descriptor IDs and action declarations are shaped for later brain resolution and screen work.
- **FL4 — Progress first, no repeating:** Work follows C09 priority order; no third attempt was made at unavailable test infrastructure.
- **FL5 — Dictionary is core:** No dictionary data or dictionary access path was changed.
- **FL6 — Searchable compression:** No dictionary storage or large assets were changed.
- **FL7 — Measure why:** Command outcomes and toolchain limitations are reported as observed, not assumed.
- **FL8 — Source export:** Changes are limited to the C09 lane plus the Director-authorized one-line descriptor correction.
- **FL9 — Plan first:** No screens or brain stages were added; this is registry and truth-test work only.
- **FL10 — Truthful capabilities:** Engine actions are `not-built`, carry the required note, and Text Counter's existing registration is unchanged.
- **FL11 — Every-Stage Law:** This law check is included in the report.
- **FL12 — One designed brain:** No engine is invoked from chat; registration is declarative metadata only.
- **FL13 — Structure before vocabulary:** Examples are documentation only; no fixed phrase list was added to the brain.
- **Rule 1 — Size to capacity:** Work is restricted to the named files and tests are bounded by the existing engine contracts.
- **Rule 2 — Sound foundation:** Existing registry and capability types are reused.
- **Rule 3 — Foundation first:** Descriptors and truth checks are added before screen work.
- **Rule 4 — One builder, one proof:** Changes were applied in small source edits; runtime proof is explicitly marked incomplete because the toolchain is unavailable.
- **Rule 5 — Plan before work:** C09's priority order and file lane were followed.
- **Rule 6 — Measure, design, build, prove:** Source APIs were inspected and static checks attempted; full proof remains NOT RUN.
- **Rule 7 — Compress without degrading quality:** No new dependencies or assets were added.
- **Rule 8 — Weakest supported phone:** No runtime-heavy loops or allocations were added; registry metadata is small and bounded by the finite descriptor list.
- **Rule 9 — Test the hand-over:** The ZIP contains only new and changed C09 files, with repository-relative paths.
- **Rule 10 — Roadmap size cap:** The roadmap was not changed.
- **Rule 11 — Account for the future:** The new test checks catalog, descriptor and registry agreement as descriptors are added.
- **Rule 12 — Guards grow with the project:** Guard and lock files were not changed.
- **Rule 13 — Survive being moved:** Imports are explicit and repository-relative; no new dependency was introduced.

## Files created

- `src/tools/engines/legacyDescriptors.ts` — descriptors for all 16 named legacy tools.
- `src/capabilities/registerEngineTools.ts` — explicit imports of each descriptor present in this base and one action per distinct `toolId`; converter descriptors share one `converter` action, and JSON tokens plus JSON view share one `json-viewer` action.
- `tests/engineTruth.test.ts` — checks descriptor/catalog IDs, descriptor quality, exactly one action per descriptor tool family, `not-built` status/note, availability truth, and the exact File Compare entry.
- `docs/reports/C09_REPORT.md` — this report.

## Files changed

- `src/capabilities/registerEngineTools.ts` — new file as listed above.
- `src/main.tsx` — imports and calls `registerEngineTools()` beside the other capability registrations.
- `src/tools/toolCatalog.ts` — adds only the requested `file-compare` entry.
- `tests/tools.test.ts` — updates the two catalog count assertions from 61 to 62.
- `tests/capabilityTruth.test.ts` — registers engine tool metadata before exercising registry truth; existing Text Tools / Text Counter registration remains unchanged.
- `src/tools/engines/data/jsonTokens.ts` — Director-authorized change to the descriptor's `toolId` only: `json-reformatter` → `json-viewer`. No other content in that file was intentionally changed.

## Descriptor registration coverage

The explicit imports cover the 16 legacy descriptors plus all descriptor exports found in the supplied base: `QR_DESCRIPTOR`, `PATTERN_TEST_DESCRIPTOR`, `CODE_FORMAT_DESCRIPTOR`, `CSV_DESCRIPTOR`, `JSON_TOKENS_DESCRIPTOR`, `JSON_VIEW_DESCRIPTOR`, `XML_DESCRIPTOR`, `YAML_DESCRIPTOR`, `DEVICE_PROFILE_DESCRIPTOR`, `FILE_COMPARE_DESCRIPTOR`, `FILE_INSPECT_DESCRIPTOR`, `ZIP_TOOL_DESCRIPTOR`, `LOAN_DESCRIPTOR`, `SPLIT_TIP_DESCRIPTOR`, `IMAGE_CONVERT_DESCRIPTOR`, `HTML_TEXT_DESCRIPTOR`, `MARKDOWN_DESCRIPTOR`, and `TEXT_FORMATS_DESCRIPTOR`.

No descriptor-bearing file discovered in the source scan was skipped. Engine source files that exist but do not export a descriptor are not silently registered as descriptors. The 16 legacy descriptor IDs are: `find-replace`, `case-converter`, `text-cleaner`, `sort-lines`, `text-compare`, `calculator`, `number-to-words`, `percentage-helper`, `timer`, `stopwatch`, `date-calculator`, `tally-counter`, `password-generator`, `random-picker`, `encoder-decoder`, and `hash-tool`.

## Commands and results

- **MEASURED —** `unzip -q ...` — supplied base extracted successfully.
- **MEASURED —** source scans of `src/tools/engines/` and descriptor exports — found 18 existing descriptor exports and the expected 16 legacy engines needing descriptors.
- **MEASURED —** `npm ci --offline --ignore-scripts` — FAILED: npm cache did not contain `yauzl@2.10.0`; no `node_modules` was installed.
- **NOT RUN —** `npx tsx tests/engineTruth.test.ts` — timed out because `tsx` was not installed and the sandbox could not complete the attempted resolution.
- **NOT RUN —** `npx tsx tests/capabilityTruth.test.ts` — not run; required `tsx` dependency unavailable.
- **NOT RUN —** `npx tsx tests/tools.test.ts` — not run; required `tsx` dependency unavailable.
- **MEASURED —** `npx --no-install tsc --noEmit -p tsconfig.json` — FAILED before project checking: `TS2688 Cannot find type definition file for 'vite/client'`, because dependencies are absent.
- **MEASURED —** targeted global TypeScript check of C09 source files — the new registration-file type mismatch was corrected; remaining errors arose in existing imported engine files (`codeFormat.ts`, `jsonView.ts`, `fileCompare.ts`, `zipTool.ts`) and missing `jszip` types. This is not a successful type check.
- **NOT RUN —** full `test:kernel` script — not run because `tsx` and dependencies are unavailable.
- **NOT RUN —** `npx tsx tests/engineTruth.test.ts` and all other prescribed runtime tests remain unverified.

## Package script lines to add

Do not edit `package.json` in this delivery. Add this line to `test:kernel` when merging:

`tsx tests/engineTruth.test.ts`

`tests/capabilityTruth.test.ts` and `tests/tools.test.ts` are already present in `test:kernel`; no duplicate lines are needed.

## Unfinished verification

- Install dependencies in a network-enabled environment or use the repository's working CI toolchain.
- Run `npx tsx tests/engineTruth.test.ts`, `npx tsx tests/capabilityTruth.test.ts`, and `npx tsx tests/tools.test.ts`.
- Run the entire `test:kernel` script.
- Run `npx tsc --noEmit -p tsconfig.json` and resolve any C09-introduced errors separately from existing engine/toolchain errors.

No test is reported as passing unless its command actually completed successfully.
