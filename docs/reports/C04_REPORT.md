# C04 — Text formats and file inspector report

## LAW CHECK (FL11)
- FL1: placed in the engine layer before screen integration.
- FL2: roadmap v16.4 and the supplied repository structure reviewed; required files confirmed.
- FL3: typed APIs support later Converter and file-inspector integration.
- FL4: implemented and checked in priority order; no repeated third fix.
- FL5: dictionary and dictionary assets untouched.
- FL6: no large assets or dependencies added; inputs and byte scans are bounded.
- FL7: test results below are observed; no unavailable command is described as run.
- FL8: source export and snapshot mechanisms untouched.
- FL9: only the C04 lane was written.
- FL10: descriptors and conversion notes describe implemented behavior; no registry/menu claims added.
- FL11: this Law Check is present in the report.
- FL12: engines do not import into or bypass the brain.
- FL13: no brain phrase lists or vocabulary added.
- Rule 1: job is limited to four engines and tests.
- Rule 2: builds on the existing TypeScript repository.
- Rule 3: each engine can be tested independently.
- Rule 4: files were compiled and test scripts executed in small steps.
- Rule 5: work follows the requested priority order.
- Rule 6: exact expectations are independently specified; no external Markdown oracle was available.
- Rule 7: no data assets were added or lossy-compressed.
- Rule 8: limits cap text at 1 MiB, HTML tokens, nesting and header bytes.
- Rule 9: output paths are repository-relative and the zip is checked after creation.
- Rule 10: roadmap files were not changed.
- Rule 11: APIs are framework-independent for future integration.
- Rule 12: guard, locks and existing tests were not changed.
- Rule 13: no new dependency; paths are relative.

## Files created
- `src/tools/engines/text/markdown.ts`
- `src/tools/engines/text/htmlText.ts`
- `src/tools/engines/text/textFormats.ts`
- `src/tools/engines/files/inspect.ts`
- `tests/markdown.test.ts`
- `tests/htmlText.test.ts`
- `tests/textFormats.test.ts`
- `tests/fileInspect.test.ts`
- `docs/reports/C04_REPORT.md`

## Commands and evidence
- **MEASURED — passed:** global `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM --skipLibCheck src/tools/engines/text/markdown.ts src/tools/engines/text/htmlText.ts src/tools/engines/text/textFormats.ts src/tools/engines/files/inspect.ts` (engine-only type check).
- **MEASURED — passed before final test-case additions:** compiled all four engines and four test files to CommonJS using global `tsc` with a temporary `node:assert` declaration shim, then ran the generated tests with Node. Markdown passed 410 checks, HTML text passed 35 checks, text formats passed 19 checks, and file inspector passed 361 checks. All four test scripts were compiled with the temporary shim and executed under Node after the final test-source changes.
- **NOT RUN:** `npx tsx tests/markdown.test.ts`, `npx tsx tests/htmlText.test.ts`, `npx tsx tests/textFormats.test.ts`, `npx tsx tests/fileInspect.test.ts` — `tsx` is not installed in this sandbox and internet installation is unavailable.
- **NOT RUN:** `npx tsc --noEmit -p tsconfig.json` — the repository dependencies are not installed; the project configuration cannot resolve `vite/client`.
- **NOT RUN:** full `test:kernel` — requires the missing `tsx` runtime and project dependencies.
- **MEASURED — passed:** final source-and-test compilation and runtime execution after the last test-source changes: markdown 410 checks; htmlText 35; textFormats 19; fileInspect 361. This uses global `tsc` output and Node, not `tsx` directly.

## Known limitations / unfinished verification
- This is a safe, deliberately bounded Markdown subset, not a full CommonMark implementation. Nested list rendering is basic.
- HTML conversion uses a hand-written tokenizer and common entity table, not a complete HTML5 parser/entity database. HTML-to-Markdown link conversion is conservative.
- File signatures are header heuristics, not proof of file integrity. ZIP subtypes are inferred from the filename extension; image dimensions are available only when the relevant header bytes are present.
- The Director must run `docs/director/verify_return.py BASE.zip C04-text-formats-inspector.zip --lane "src/tools/engines/text/markdown.ts src/tools/engines/text/htmlText.ts src/tools/engines/text/textFormats.ts src/tools/engines/files/inspect.ts tests/markdown.test.ts tests/htmlText.test.ts tests/textFormats.test.ts tests/fileInspect.test.ts docs/reports/C04_REPORT.md" --run-tests` before merge.

## `test:kernel` lines to add
Add these commands to the `test:kernel` chain in `package.json` (do not replace existing commands):
- `tsx tests/markdown.test.ts`
- `tsx tests/htmlText.test.ts`
- `tsx tests/textFormats.test.ts`
- `tsx tests/fileInspect.test.ts`

## Director inspection 2026-10-18 (INSPECTED-FIX, fixed by the Director; MERGE)
- MEASURED: verify_return.py clean on the returned zip (9 new files, in lane, strict tsc passes, four tests pass under tsx).
- Found by hand, all fixed here with tests added (the new tests fail on the returned engines):
  1. markdown.ts: unmatched `[` took 11.5 s at 100,000 characters (quadratic regex scan; 1 MB would freeze a phone). Link and image regexes now bounded (label up to 1000, address up to 2000 characters) and skipped when the text has no `](`. Now about 1 ms.
  2. inspect.ts: lossy WebP width and height read from the wrong bytes (413 x 9514 for a 37 x 21 picture); now bytes 26 to 29 (checked against a Pillow-written file).
  3. inspect.ts: a UTF-16 text file (starts FF FE) was reported as MP3; the bare MPEG sync check now needs a plausible Layer II or III header of at least 4 bytes. Honest limit: bare Layer I audio without an ID3 tag is no longer recognised.
  4. htmlText.ts: `htmlToMarkdown` kept `javascript:` links as `[bad](javascript:...)`; unsafe addresses (javascript, data, vbscript, also obfuscated) are now dropped, the label stays.
- Checked and good: scripts and event attributes escaped in Markdown output, `javascript:` and `data:` links dropped in Markdown, 23 real files (images, zip family, pdf, gzip, wav, mp3, text) detected like the `file` command.
- LIMITS to know, not fixed: nested Markdown lists come out flat; `~~strike~~` and task boxes are not supported; `&lt;` typed in Markdown shows as the five characters `&lt;` (CommonMark would show `<`); ICO and TIFF sizes are not read; link labels over 1000 characters are no longer links.
