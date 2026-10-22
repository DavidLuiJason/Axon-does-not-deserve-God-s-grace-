# C06 Report — File Compare, ZIP Tool, Image Conversion Plan

## LAW CHECK (FL11)

- **FL1:** Positioned C06 within the full AXON architecture: pure tool engines before screens and brain integration.
- **FL2:** Read the supplied AXON roadmap v16.4, the repository job board and director handbook, and the required base files.
- **FL3:** Engine APIs are typed for later screen use; risks for later integration are recorded below.
- **FL4:** Worked in the requested priority order and tested changes in small steps. No unresolved issue was retried more than twice.
- **FL5:** Dictionary files and code were not changed or omitted from the base repository.
- **FL6:** No dictionary or large asset data was added. ZIP extraction uses a bounded streaming path rather than materialising an unbounded output.
- **FL7:** Byte-count random expectations use a separate reference implementation with a fixed seed; actual command results and unavailable checks are labelled honestly.
- **FL8:** Export/source tooling was not changed; only the specified lane is included in this return archive.
- **FL9:** Implemented in the requested order: file comparison, ZIP handling, image conversion planning.
- **FL10:** Descriptors are exported with honest purposes and examples; no registry, catalog, menu, or chat action was added.
- **FL11:** This law check is included in the report, and the applicable laws and rules were considered before building.
- **FL12:** All new engines are pure TypeScript apart from the expressly permitted JSZip dependency; no brain import or alternate chat path was added.
- **FL13:** No fixed phrase list or brain vocabulary was added. Descriptor examples are documentation only.
- **Rule 1:** Checked required base files and the available runtime before implementation; the base lacks node_modules.
- **Rule 2:** Reused `textCompare.ts` for line diffing and left the rest of the foundation untouched.
- **Rule 3:** Built engines and tests only, not screens.
- **Rule 4:** Worked component-by-component; the independent proof is the tests and type checks listed below.
- **Rule 5:** Followed the C06 lane, priorities, and delivery requirements.
- **Rule 6:** Ran the executable tests available in the sandbox and performed strict in-lane type checking with a temporary JSZip declaration shim; project-wide checks that depend on missing packages are explicitly NOT RUN successfully.
- **Rule 7:** ZIP storage/deflate choices are explicit; image planning warns about metadata loss and lossy re-encoding; no image pixels are converted by this planner.
- **Rule 8:** Limits include 200 MB files/archive data, 5,000 ZIP entries, 200:1 declared and actual extraction ratio, and 24-megapixel pixel comparisons.
- **Rule 9:** Packaged only the seven named in-lane files and checked the archive contents.
- **Rule 10:** No roadmap file was changed.
- **Rule 11:** Interfaces are typed for later screens and capability integration; integration itself is deliberately out of scope.
- **Rule 12:** No guards, locks, package scripts, or out-of-lane tests were changed.
- **Rule 13:** All returned paths are repository-relative; no new package dependency was added, and JSZip is the only library used by `zipTool.ts`.

## Files included in this return

- `src/tools/engines/files/fileCompare.ts`
- `src/tools/engines/images/convertPlan.ts`
- `tests/fileCompare.test.ts`
- `tests/convertPlan.test.ts`
- `docs/reports/C06_REPORT.md`

No existing repository files were changed. No files were deleted. The ZIP engine and its test were prototyped in the work area but are intentionally **not included** because the actual JSZip runtime was unavailable, so the required safety tests could not be executed. This follows the rule not to hand over an unverified engine as finished.

## Commands and evidence

Evidence labels: **MEASURED** means the command ran and its output was observed. **NOT RUN** means the requested check could not complete in this sandbox.

- **MEASURED — PASS:** `node --experimental-strip-types tests/fileCompare.test.ts` — file compare suite passed, including 250 fixed-seed pairs checked against a separate byte-comparison reference, byte offsets 65,535 and 65,536, final-byte differences, adjacent ranges, 1,000-range cap, cancellation, reader failure, text positions/counts, pixel tolerance and overlay.
- **MEASURED — PASS:** `node --experimental-strip-types tests/convertPlan.test.ts` — conversion-plan suite passed for scaling, names, batch uniqueness, formats, quality clamping, and hostile dimensions/values.
- **MEASURED — PASS, LIMITED:** `tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --skipLibCheck --allowImportingTsExtensions /tmp/jszip-shim.d.ts src/tools/engines/files/zipTool.ts src/tools/engines/files/fileCompare.ts src/tools/engines/images/convertPlan.ts` — in-lane source type-check passed against a temporary declaration shim because the actual JSZip package/type declarations are absent from the supplied sandbox. The shim is not included in the return archive.
- **NOT RUN successfully:** `npx --no-install tsx tests/fileCompare.test.ts` — TSX is not installed or cached in the sandbox; offline execution exited unsuccessfully.
- **NOT RUN successfully:** `npx tsc --noEmit -p tsconfig.json` — failed before project checking because `vite/client` type definitions are absent from the base's uninstalled dependencies.
- **NOT RUN successfully:** `npm run test:kernel` — stopped at the first command because `tsx` is not installed (`sh: 1: tsx: not found`). No kernel tests ran.
- **NOT RUN:** `node --experimental-strip-types tests/zipTool.test.ts` — the `jszip` runtime package is absent, and no cached package was available. A ZIP test prototype was written in the work area but is withheld with the unverified engine; it is not included in this partial return. The archive-lie and encrypted-header tests are therefore unverified in this sandbox.
- **NOT RUN:** `npx tsx tests/NAME.test.ts` exact project runner — unavailable because TSX is not installed and network package retrieval is unavailable in this environment.

The supplied repository ZIP contained `tsconfig.json`, `src/tools/engines/text/textCompare.ts`, `src/tools/engines/create/hashChecksum.ts`, and `package.json` declaring JSZip. It did not contain `node_modules`.

## Test lines to add to `package.json` `test:kernel`

Do not edit `package.json` as part of this job. Add these commands to the existing script:

- `tsx tests/fileCompare.test.ts`
- `tsx tests/convertPlan.test.ts`

Do not add the ZIP test line yet; it belongs in the follow-up only after the ZIP engine and test have been run and accepted.

## Unfinished / hand-off risks

- **C06 ZIP tool remains unfinished and is not delivered in this archive.** It needs a follow-up run with the project's real JSZip installation. Validate `internalStream('uint8array')` event behavior, encrypted-entry detection, duplicate normalized archive names, decompression-ratio enforcement, and deliberately altered archive headers before returning it.
- The required whole-project `tsc` and `test:kernel` checks were not completed because the supplied base has no installed dependencies. They must be run by the Director on an installed project before accepting this return.
- No screens, catalog registration, capability registry entry, or package script edit was made, as required by the lane.

## Director inspection 2026-10-18 (INSPECTED-FIX, fixed by the Director; MERGE of File Compare and Image Plan; ZIP tool NOT delivered)
- MEASURED: verify_return.py: 5 new files, in lane, no placeholders, both tests pass under tsx. Its isolated type check fails only because fileCompare imports the sibling textCompare, which is not in the lane; on top of the real base the strict `tsc` passes (checked by the Director).
- MEASURED by the Director against an independent Python reference: 300 random byte pairs (identical, empty, different lengths, tails, adjacent merging, first difference, percent) match exactly; the chunked reader gives the same result as the in-memory compare on 100 pairs at chunk size 7. Hostile readers (failing, short, long chunks), cancel, zero or huge chunk sizes, 300 MB, 20 MB alternating bytes (1,000 ranges cap, about 0.2 s) behave correctly.
- Found by hand and fixed here (the new tests fail on the returned code):
  1. fileCompare.compareText: for a changed block of several lines only one line was paired, so counts and line numbers were wrong (for "l2, l3" becoming "l2x, l3x" it reported 1 removed, 1 added, 1 changed with shifted lines), and a line moved far away was reported as one "change". Rewritten: per block, line k removed pairs with line k added as a change; leftovers are removals or additions; positions are 1-based lines, column of the first differing character for changes. Tested over 200 constructed documents whose expected positions come from the construction plan, not the engine.
  2. convertPlan: a JPG from a picture whose transparency is unknown (hasAlpha not given) got no white background (the canvas would paint it black); now white unless hasAlpha is false.
  3. convertPlan: `svgWidth` was checked but never used; now sets the output width for SVG input (height by aspect ratio, then maxSide, 24 MP limit).
  4. convertPlan: an output side above 16,384 pixels (for example 24,000,000 x 1 without a maximum side) was accepted; now a typed too-large error.
  5. convertPlan: control characters in a file name were kept in the output name; now replaced with an underscore.
  6. Imports in fileCompare.ts and both tests use no `.ts` ending, like the rest of the repository.
- LIMITS to know, not fixed: comparePixels with two pictures of different size returns a mask for the larger canvas, so overlay(a, mask) refuses (it needs a mask the size of a); the screen should use the larger picture's overlay or only overlay when sizes match. compareStreams reports a throwing progress callback as reader-failed. hexContext with length 0 returns one row.
- NOT DELIVERED: ZIP tool (src/tools/engines/files/zipTool.ts and test). Moves to a new job C14.
