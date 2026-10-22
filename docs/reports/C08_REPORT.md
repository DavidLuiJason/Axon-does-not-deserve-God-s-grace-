# C08 Report — Code Formatter Engine

## Result

**PARTIAL DELIVERY — engine and tests are implemented and pass the available isolated checks.** The repository's prescribed `tsx` test command, complete `test:kernel`, and project-wide type check could not be completed because this sandbox has no installed project dependencies and cannot retrieve `tsx` from its offline npm cache. These are not claimed as passing.

The supplied BASE was checked before building. `src/tools/engines/data/jsonTokens.ts` and `tsconfig.json` both exist. The roadmap v16.5 and job board place C08 in Wave 2 after C02's tokenizer was merged; the supplied C08 scope is compatible with the roadmap. No existing files were changed.

## LAW CHECK (FL11)

### Foundation laws
- **FL1 — Top view:** Read roadmap v16.5, job board, handbook, and the files C08 needs; keep the formatter within the engine stage.
- **FL2 — Read everything, then act:** Read the complete supplied roadmap and the relevant job/handbook and base files before implementation.
- **FL3 — Plan reaches the end:** The API is pure and descriptor-based, suitable for later converter, registry, and brain integration; no UI or registration was added.
- **FL4 — Progress first / Two-Strike Rule:** Work was built and checked in small steps. Two compile/test defects were fixed; no third attempt was made on any same failure.
- **FL5 — Dictionary is core:** Dictionary files were not edited, removed, or omitted from the base.
- **FL6 — Searchable compression:** No bundled data or dependency was added; input is capped at 2 MiB.
- **FL7 — Measure why:** Test results and environmental blockers are recorded below as measured or not run.
- **FL8 — Source export:** Export and comparison machinery were not changed.
- **FL9 — Plan first:** Only the three paths named in the C08 lane were created.
- **FL10 — Truthful capabilities:** The descriptor uses `code-formatter`; unsupported languages return `unsupported-language`; no capability registry or menu changes were made.
- **FL11 — Every-Stage Law:** This law check is included in this report; the same check appears before implementation in the conversation.
- **FL12 — One designed brain:** No brain code, chat handler, or direct chat answer path was added.
- **FL13 — Structure before vocabulary:** No brain vocabulary, fixed phrase list, or phrase matching was added.

### Building Rules
- **Rule 1 — Size to capacity:** Input has a 2 MiB cap; parsing and nesting use bounded scans/stacks.
- **Rule 2 — Respect the foundation:** Existing tokenizer and repository conventions are reused.
- **Rule 3 — Foundation first:** JSON formatting delegates to the C02 tokenizer.
- **Rule 4 — One small job:** Only the engine, its test, and its report are included.
- **Rule 5 — Stage placement:** This is an engine-only C08 Wave 2 job.
- **Rule 6 — Measure, design, build, prove:** Isolated strict compilation and executable property tests were run.
- **Rule 7 — Compress without degrading meaning:** Minification keeps important selector/value/operator spacing, string contents, URLs, and markup text; XML element-only indentation is structural whitespace.
- **Rule 8 — Weakest phone:** The engine avoids DOM/network APIs, uses explicit stacks, and rejects inputs over 2 MiB or nesting over 200 where applicable.
- **Rule 9 — Test builder/repository connection:** The exact BASE paths were checked and the returned archive contains only lane files.
- **Rule 10 — Roadmap size:** Roadmap and package configuration were not edited.
- **Rule 11 — Future compatibility:** The exported request/result types and `CODE_FORMAT_DESCRIPTOR` support later integration without registry changes.
- **Rule 12 — Locks and tests grow:** A new standalone test is supplied; no existing locks or tests were weakened.
- **Rule 13 — Portable moves:** Archive entries use repository-relative paths, with no top-level folder or nested ZIP.

## Files created

1. `src/tools/engines/code/codeFormat.ts`
2. `tests/codeFormat.test.ts`
3. `docs/reports/C08_REPORT.md`

No other repository files were changed.

## Verification evidence

### MEASURED — pass
- Command: `tsc --noEmit --target ES2022 --moduleResolution bundler --module ESNext --strict --skipLibCheck src/tools/engines/code/codeFormat.ts`
  - Result: PASS.
- Command: `tsc --target ES2022 --module commonjs --moduleResolution node --outDir /tmp/c08compiled --strict --skipLibCheck src/tools/engines/code/codeFormat.ts src/tools/engines/data/jsonTokens.ts src/tools/engines/data/xml.ts tests/codeFormat.test.ts`
  - Result: PASS.
- Command: `node /tmp/c08compiled/tests/codeFormat.test.js`
  - Result: PASS — 3,000 seeded property checks (300 generated cases per language) plus hand-made, malformed-input, limit, Unicode, and descriptor cases.
- Coverage includes JSON exact number literals, duplicate keys and order; CSS nesting, selector/value/operator spacing, strings, URLs, comments and `!important`; HTML void elements, preserved attribute spelling, and exact `pre`, `textarea`, `script` and `style` contents; XML mixed content, declarations, CDATA, comments, processing instructions, malformed roots and nesting; idempotence and minify equivalence properties.

### NOT RUN / blocked
- `npx --no-install tsx tests/codeFormat.test.ts`: did not complete; no locally installed `tsx` is available and the command timed out attempting to resolve it.
- `npm exec --offline -- tsx --version`: FAILED with `ENOTCACHED`; `tsx` is not present in the offline npm cache.
- `tsc --noEmit -p tsconfig.json`: FAILED before checking the project because the base has no installed dependencies/types; TypeScript reported `TS2688: Cannot find type definition file for 'vite/client'`.
- Full `test:kernel`: NOT RUN because its script depends on `tsx`, which is unavailable. Existing kernel tests therefore have not been claimed as passing.
- Dependency installation: NOT RUN; offline npm cache does not contain `tsx`, and no successful installation was available.

## Known limits

- JavaScript and TypeScript are deliberately unsupported and return `unsupported-language`.
- The markup scanner enforces matching tags and a single XML root; it is a bounded formatter, not a complete standards validator for every HTML/XML grammar rule.
- XML pretty-printing of element-only content introduces structural whitespace between elements. Mixed content is kept together and its text is preserved. XML applications where whitespace-only text nodes are significant should retain the original input or use minify mode cautiously.
- Whole-project type checking and the repository kernel suite still need to be run in the project's dependency-equipped environment before merge.

## Package script line to add

Add this command to the `test:kernel` script in `package.json` (do not change `package.json` as part of this lane):

`tsx tests/codeFormat.test.ts`

## Unfinished

The code and test files are complete, but prescribed `tsx` execution, the full kernel suite, and project-wide type check remain unverified for the environmental reasons above.
