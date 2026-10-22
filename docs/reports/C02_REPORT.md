# C02 report — INCOMPLETE, NOT ACCEPTABLE FOR MERGE

## LAW CHECK (FL11)
FL1 top-view reviewed; FL2 roadmap and base checked; FL3 future consumers considered; FL4 priority order and two-strike rule observed; FL5 dictionary untouched; FL6 2 MB/200-depth bounded; FL7 evidence labelled; FL8 no export edits; FL9 engines before screens; FL10 descriptor not registered; FL11 check recorded; FL12 no brain edits; FL13 no phrase lists.
Rules 1–13: (1) size bounded, (2) capacity bounded, (3) foundation first, (4) one job, (5) stage planned, (6) test evidence, (7) no lossy compression, (8) low-memory cap, (9) no integrations changed, (10) roadmap untouched, (11) future use considered, (12) guards untouched, (13) relative paths.

## Files included
- src/tools/engines/data/jsonTokens.ts — partial implementation; `sortKeys:true` is explicitly unsupported, so NOT complete.
- tests/jsonTokens.test.ts — written, NOT RUN using tsx.
- docs/reports/C02_REPORT.md — this report.

## Measured commands
- Base ZIP inspection: required three files present (MEASURED).
- `npm install --ignore-scripts --no-audit --no-fund --offline`: FAILED (uncached yauzl dependency).
- `tsc --noEmit --target ES2022 --module nodenext --moduleResolution nodenext src/tools/engines/data/jsonTokens.ts`: PASSED after type fixes (MEASURED).
- `tsc --target ES2022 --module commonjs --outDir /mnt/data/c02run src/tools/engines/data/jsonTokens.ts`: PASSED (MEASURED).
- Node.js compiled-code smoke check: 8 cases PASSED (MEASURED).

## NOT RUN
- `npx tsx tests/jsonTokens.test.ts`: NOT RUN, tsx unavailable and npm offline install failed.
- `npx tsx tests/jsonView.test.ts`, `npx tsx tests/csv.test.ts`: NOT RUN, files not created.
- `npx tsc --noEmit -p tsconfig.json`: NOT RUN, repository dependencies unavailable.
- `npm run test:kernel`: NOT RUN, tsx unavailable.

## Unfinished
JSON tokenizer requires full random-property verification and correct key sorting; JSON viewer and CSV/TSV engines and tests not started. Do not merge this zip. Proposed package.json additions, only once all tests exist: `tsx tests/jsonTokens.test.ts && tsx tests/jsonView.test.ts && tsx tests/csv.test.ts`.

## Director inspection 2026-10-18 (INSPECTED-FIX, partial)
- Accepted: jsonTokens.ts (tokenize, validate, minify, pretty) after two fixes: (1) pretty() put two spaces after a colon before an array or object (engine bug); (2) the test wrote a raw CR LF inside a JSON string (test bug; the engine was right to refuse it).
- Added exact-output tests against the platform JSON.stringify (2, 4, tab). MEASURED: 380 checks pass; with the bug put back in a copy the test fails; strict tsc passes on the file.
- NOT delivered, moved to new jobs: JSON view model (jsonView), CSV and TSV (csv), sortKeys option (unsupported on purpose, it would reorder duplicate keys).
