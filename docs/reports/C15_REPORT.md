# C15 Report — JSON view model, CSV/TSV and ZIP tool

## LAW CHECK (FL11)

- **FL1 — Top view:** C15 stays in AXON's data/file-engine layer and preserves the existing tokenizer.
- **FL2 — Read everything, then act:** The complete supplied v16.5 roadmap, section 3, job board, handbook and exact required base files were inspected.
- **FL3 — End-to-end plan:** Interfaces are pure TypeScript and intended for later converter/viewer integration.
- **FL4 — Progress first; Two-Strike Rule:** Files were built in priority order; no problem was given a third fix attempt.
- **FL5 — Dictionary is core:** No dictionary files or dictionary references were changed or omitted from the repository.
- **FL6 — Searchable compression:** No heavy data was added; ZIP limits constrain archive expansion.
- **FL7 — Measure why:** The report distinguishes tests actually run from checks blocked by the missing toolchain.
- **FL8 — Source export:** Only the six permitted engine/test files and this report are included in the return ZIP.
- **FL9 — Plan before repair:** The implementation follows the requested JSON, CSV/TSV, then ZIP priority order.
- **FL10 — Truthful capabilities:** JSON and ZIP descriptors use the requested catalog IDs; CSV uses `converter`; no registry or menu was changed.
- **FL11 — Every-Stage Law:** This law check is included here; commands and evidence labels are recorded below.
- **FL12 — One designed brain:** Engines contain no UI or brain integration and do not answer chat directly.
- **FL13 — Structure before vocabulary:** No brain phrase lists were added; descriptor examples are documentation only.
- **Rule 1 — Size the work:** The supplied base and existing dependencies define the scope; input and archive limits are explicit.
- **Rule 2 — Respect the foundation:** JSON view uses the existing `jsonTokens.ts` tokenizer rather than replacing it.
- **Rule 3 — Foundation first:** These are engine/test files only; no screen integration is attempted.
- **Rule 4 — One builder, one job, one proof:** Implementation and verification proceeded one engine at a time.
- **Rule 5 — Stage the work:** All output files are within the C15 lane.
- **Rule 6 — Measure, design, build, prove:** Available tests and strict TypeScript checks were run; blocked checks are marked NOT RUN.
- **Rule 7 — Compress carefully:** ZIP creation exposes STORE and DEFLATE choices and does not assume compression always shrinks data.
- **Rule 8 — Weakest phone:** Text, row, column, tree-window, entry-count, total-size, and compression-ratio limits are defined.
- **Rule 9 — Verify transfers:** The output archive contains only new in-lane files with paths relative to the repository root.
- **Rule 10 — Roadmap size:** The roadmap was not changed.
- **Rule 11 — Future compatibility:** Public APIs are typed and preserve JSON numeric token text in previews.
- **Rule 12 — Guards grow:** No tests, lock files, guards or package scripts were edited; requested script additions are listed below.
- **Rule 13 — Portable output:** Source paths are repository-relative and no dependency was added.

## Files created

1. `src/tools/engines/data/jsonView.ts`
2. `tests/jsonView.test.ts`
3. `src/tools/engines/data/csv.ts`
4. `tests/csv.test.ts`
5. `src/tools/engines/files/zipTool.ts`
6. `tests/zipTool.test.ts`
7. `docs/reports/C15_REPORT.md`

No existing files were changed. `package.json`, the capability registry, catalog, dictionary, guards and lock files were not edited.

## Verification evidence

### MEASURED

- `tsc --target ES2022 --module commonjs --moduleResolution node --strict --lib ES2022,DOM --outDir /tmp/c15js tests/jsonView.test.ts tests/csv.test.ts src/tools/engines/data/jsonTokens.ts src/tools/engines/data/jsonView.ts src/tools/engines/data/csv.ts` — PASS.
- `node /tmp/c15js/tests/jsonView.test.js` — PASS, 14 checks.
- `node /tmp/c15js/tests/csv.test.js` — PASS, 610 checks, including 300 seeded round-trip tables.
- `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM /tmp/jszip-stub.d.ts src/tools/engines/data/jsonTokens.ts src/tools/engines/data/jsonView.ts src/tools/engines/data/csv.ts src/tools/engines/files/zipTool.ts tests/jsonView.test.ts tests/csv.test.ts tests/zipTool.test.ts` — PASS. This uses a temporary declaration for JSZip and is **not** proof against the actual installed JSZip types.
- Base inspection: all required paths existed at the exact repository-relative locations; `package.json` lists `jszip`.

### NOT RUN / BLOCKED

- `npx tsx tests/jsonView.test.ts`, `npx tsx tests/csv.test.ts`, `npx tsx tests/zipTool.test.ts` — NOT RUN. The base ZIP has no `node_modules`; `tsx` is not installed, and the sandbox could not resolve/install it from the network.
- ZIP runtime tests — NOT RUN because the actual JSZip package is not installed in this sandbox. The temporary declaration above checks TypeScript shape only, not ZIP behavior.
- `npx tsc --noEmit -p tsconfig.json` (the project `lint` check) — NOT RUN successfully; direct `tsc --noEmit -p tsconfig.json` failed with `TS2688: Cannot find type definition file for 'vite/client'` because project dependencies are absent.
- Whole `test:kernel` — NOT RUN because its commands depend on `tsx`, which is absent.
- No APK/device check was run.

### HYPOTHESIS / remaining inspection risk

- `jsonView.ts` creates internal node records while building the tree, although `childrenOf` returns only the requested window. The lazy presentation window is tested; true deferred node construction for a 100,000-item array has **not** been demonstrated and needs Director inspection before acceptance.
- ZIP runtime behavior, encrypted archive handling, declared-size lies and actual JSZip metadata compatibility need a real run with the repository's installed `jszip` before merge. The ZIP tests are present but unexecuted.

## Exact `test:kernel` additions

Add these commands to the existing `test:kernel` script (do not replace its existing commands):

- `tsx tests/jsonView.test.ts`
- `tsx tests/csv.test.ts`
- `tsx tests/zipTool.test.ts`

## Unfinished / acceptance status

The JSON and CSV/TSV source files compile under the available strict standalone check, and their tests pass when transpiled with the installed global TypeScript compiler and run with Node. ZIP code and tests are written but have not been runtime-tested against JSZip. Because the required project type check, `tsx` test commands, and whole `test:kernel` could not run in this sandbox, this is **not a fully verified C15 acceptance package**. The Director should run the exact commands above in a dependency-equipped environment and inspect the JSON tree's memory behavior before merge.


## Director addendum (2026-10-20)
ChatGPT could not run anything (no node_modules, no tsx, no real jszip), so its zip tests were never executed. The Director ran everything with a real jszip 3.10 and strict tsc.
Findings and fixes:
1. zipTool.test.ts FAILED on first real run: createZip added automatic folder entries (a listing of 2 files returned 3). Fixed with createFolders:false.
2. SECURITY: both listZip and extractEntry called JSZip.loadAsync with checkCRC32:true, which makes JSZip INFLATE EVERY ENTRY while loading, so the size and ratio caps could not protect against a zip bomb (a 60 MB lying archive was inflated or rejected only after the work was done). Rewritten: names, sizes, flags and CRC are read from the central directory by this file (no reliance on JSZip private fields); loadAsync is used without CRC checking; extraction inflates as a STREAM and stops the moment a size or ratio cap is crossed; the ratio cap is measured against the real compressed size; size and CRC32 are verified after inflating.
3. Encrypted archives are now LISTED (marked encrypted) and refused on extraction (JSZip itself cannot open them).
4. jsonView: building the tree cost about 130 bytes of heap per input byte (1.1 MB of numbers cost 150 MB, MEASURED), too heavy for a low-memory phone, so the viewer cap is 512 KB (the tokenizer keeps its own 2 MB cap). A leaner index (typed arrays) is a possible later improvement.
5. csv.ts matched Python's csv module on the tricky cases checked (quotes, doubled quotes, embedded line breaks, CRLF).
Tests now: jsonView 16, csv 610, zipTool 39 checks, all pass; strict tsc passes for all three engines.
Test lines to add to test:kernel: tsx tests/jsonView.test.ts ; tsx tests/csv.test.ts ; tsx tests/zipTool.test.ts
