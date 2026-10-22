# C21 Report — Summarizer and Document Reader polish

Date: 2026-10-22  
Evidence labels: MEASURED, NOT RUN.

## Result

Implemented the C21 changes in the summarizer and document reader. The independent 80-case reference regression passed after the changes. The two existing affected test files and both new behavior test files plus the regression test were transpiled to JavaScript and executed successfully. Engine-only strict TypeScript checks passed. Full project type checking and mutation/independent-splitting checks were not run in this sandbox; details follow.

The summarizer remains extractive: it copies original prose sentences and does not rewrite them.

## Files created or changed

- `src/tools/engines/text/summarize.ts` — Unicode sentence boundaries; case-sensitive abbreviation handling; fenced and indented code-region exclusion; inline backtick protection; `code: 'skip' | 'keep'`; code-block warning/count; keyword coverage warning and value; paragraph metadata; ratio option; Unicode code-point counts and exact output `text`.
- `src/tools/engines/files/documentRead.ts` — statistics derived from readable blocks; Unicode code-point character count; suppresses known false extension-mismatch warnings; documents exclusive `toBlock` semantics and exports `DocumentPage`.
- `tests/summarizeRegression.test.ts` — replays the supplied 80-case reference file.
- `tests/summarizeUnicode.test.ts` — targeted Unicode, abbreviation, code, coverage, ratio and code-point checks.
- `tests/documentReadPolish.test.ts` — readable-block statistics and extension warning checks.
- `tests/fixtures/summarizeReference.json` — exact fixture copied from C21-pack.
- `docs/reports/C21_REPORT.md` — this report.

The existing `tests/summarize.test.ts` and `tests/documentRead.test.ts` were not changed; they passed unchanged. No other repository files were included in the delivery.

## LAW CHECK (FL11)

- **FL1:** Used the complete AXON v16.9 roadmap and placed this work in the reading/tool-engine layer.
- **FL2:** Read the full C21 prompt, roadmap, both named engines, required existing tests, configuration, and supplied Python reference implementation/fixture.
- **FL3:** Preserved existing exported interfaces and made result additions additive; this supports later screens and reading-layer work.
- **FL4:** Followed the regression-first and priority order. No repeated unresolved failure was retried for a third time.
- **FL5:** The dictionary and dictionary files were not changed or omitted from the base; the returned ZIP is a delta only.
- **FL6:** Added no dictionary data or dependencies; input and sentence limits remain bounded.
- **FL7:** Used the 80-case independent reference fixture and targeted tests to measure behavior.
- **FL8:** Did not change export/guard workflows; returned only named in-lane files.
- **FL9:** Worked in order: sentence splitting and code protection, quality signals and counts, then document-reader statistics.
- **FL10:** Kept engine output truthful and did not change registry, catalog, or screen behavior.
- **FL11:** This law check is included in the report; test/type-check limitations are explicitly labelled.
- **FL12:** Did not alter or bypass brain stages or boundaries.
- **FL13:** Added no fixed phrase lists to the brain; abbreviation rules are local to the summarizer engine.
- **Rule 1:** Kept work within the specified engine/test lane and the available sandbox capabilities.
- **Rule 2:** Preserved the existing engine structure and did not add a larger system.
- **Rule 3:** Built on existing exported engine interfaces and the supplied baseline.
- **Rule 4:** Implemented in small changes and reran the affected tests after changes.
- **Rule 5:** Followed the stated priority order and disclosed unfinished verification.
- **Rule 6:** Checked counts and coverage with targeted arithmetic assertions; regression values came from the supplied independent Python fixture.
- **Rule 7:** Did not rewrite prose; skipped code by default and supports retaining original fenced/indented code blocks with `code: 'keep'`.
- **Rule 8:** Preserved 300,000-character, 5,000-sentence and 20-selected-item bounds; no new dependency or unbounded processing was introduced.
- **Rule 9:** Packaged only changed/new files with repository-relative paths for Director inspection.
- **Rule 10:** Did not alter the roadmap.
- **Rule 11:** Preserved compatibility for future consumers and existing result fields.
- **Rule 12:** Did not weaken existing tests or guards; existing summarizer and reader tests passed unchanged.
- **Rule 13:** Used relative paths and added no dependencies.

No law conflict was identified.

## MEASURED test results

### Regression baseline and final run

The baseline regression was run against the unchanged engine before implementation. It passed all **80 cases** after correcting the test comparator to use the specified absolute score tolerance of `1e-7` (the initial comparator mistakenly rounded scores and was corrected before code changes).

Command used for the no-internet route, from the repository root:

```sh
tsc --target ES2022 --module commonjs --moduleResolution node10 --esModuleInterop --skipLibCheck --rootDir . --outDir /tmp/c21finaltest tests/summarize.test.ts tests/documentRead.test.ts tests/summarizeRegression.test.ts tests/summarizeUnicode.test.ts tests/documentReadPolish.test.ts
```

The compiler emitted JavaScript despite diagnostics. Then each emitted test was run with Node from the repository root:

- `node /tmp/c21finaltest/tests/summarize.test.js` — **PASS** (`summarize tests passed: 47+ assertions, seeded cases included`).
- `node /tmp/c21finaltest/tests/documentRead.test.js` — **PASS** (`documentRead tests passed: format, error, search and pagination checks`).
- `node /tmp/c21finaltest/tests/summarizeRegression.test.js` — **PASS**, all **80** reference cases; sentence indexes and keywords identical, sentence count identical, scores within `1e-7`.
- `node /tmp/c21finaltest/tests/summarizeUnicode.test.js` — **PASS** (abbreviations, Arabic/Russian/Greek/Hindi/Chinese/Japanese and mixed scripts, quotes, decimals, URLs, lists, code protection, coverage, ratio and Unicode character counts).
- `node /tmp/c21finaltest/tests/documentReadPolish.test.js` — **PASS** (readable-block statistics and extension warning cases).

### Type checks

MEASURED, passed:

```sh
tsc --noEmit --strict --target ES2022 --moduleResolution bundler --module esnext --skipLibCheck src/tools/engines/text/summarize.ts
tsc --noEmit --strict --target ES2022 --moduleResolution bundler --module esnext --skipLibCheck src/tools/engines/files/documentRead.ts
```

The transpile command emitted diagnostics for missing `node:assert/strict` and `node:fs` type declarations because this unpacked base has no `node_modules`. It also exposed existing unrelated type errors in `src/tools/engines/data/jsonView.ts` (lines 24 and 50); this job did not change that file. The test JavaScript was nevertheless emitted and all five test programs above ran successfully.

## NOT RUN / unfinished verification

- `npx tsx ...` and `npx tsc --noEmit -p tsconfig.json`: **NOT RUN**. The base has no `node_modules`, `tsx` is not installed, and this sandbox has no network access to install dependencies. The documented local `tsc` transpile route was used instead.
- Strict standalone type checks of the three new test files: attempted, but **NOT CLEAN** because the base lacks `node:assert/strict` and `node:fs` type declarations. No test-specific type errors were reported beyond those missing declarations.
- The full `test:kernel` script: **NOT RUN** because it depends on `tsx` and project modules absent from this sandbox.
- Mutation tests (at least six) and the separate independent Python comparison across 40+ additional texts: **NOT RUN**. These are the optional final priority (iv); the Director should perform them during inspection.
- Phone testing, cloud build, and full project lint: **NOT RUN** in this sandbox.

## Lines to add to `test:kernel`

Add these three entries (do not edit `package.json` in this delivery):

```sh
tsx tests/summarizeUnicode.test.ts
tsx tests/summarizeRegression.test.ts
tsx tests/documentReadPolish.test.ts
```

## Director handoff

Please inspect the returned delta against the current base, run the full project tests and type check with real project dependencies, and perform the deferred mutation and independent Python checks before merge.
