Written by ChatGPT for job C21B

# C21B report — Summarizer speed, indentation, and unspaced-script scoring

## Outcome

**MEASURED:** implemented all three requested fixes in `src/tools/engines/text/summarize.ts`. The extractive contract and exported fields are unchanged. The 80-case regression replay passes exactly, including indexes, scores, keywords, and sentence counts. The Document Reader engine and screens were not changed.

## LAW CHECK (FL11)

- **FL1 — Top view:** the change stays in AXON's existing text-engine layer.
- **FL2 — Read everything, then act:** read the full supplied v16.9 roadmap, section 3 (the foundation laws / Part 00), the full job prompt, and the base's live Job Board, Director Handbook, Brain Design, Brain Plan, and AXON Vision.
- **FL3 — Plan reaches the end:** preserve the engine result shape and the fields used by the Summarizer screen and Document Reader.
- **FL4 — Progress first:** work followed speed, indentation, then unspaced-script scoring; the temporary mutation checks were used to expose regressions.
- **FL5 — Dictionary is core:** no dictionary file or dictionary interface was changed or omitted.
- **FL6 — Searchable compression:** no data packs or dependencies were added; scanning and code-block indexing are bounded by the 300,000-character input cap.
- **FL7 — Measure why:** baseline and post-fix timings were measured and are recorded below.
- **FL8 — Source export:** export and repository infrastructure were not changed.
- **FL9 — Plan first:** fixes are in the engine where the measured defects originate, not in screens or the Document Reader.
- **FL10 — Truthful capabilities:** output remains extractive; warnings describe the approximation and code/prose limitation honestly.
- **FL11 — Every-stage law:** this checklist is included in the report.
- **FL12 — One designed brain:** no brain, mind, registry, or chat-routing files were touched.
- **FL13 — Structure before vocabulary:** no phrase lists were added to the brain; script-aware tokens and syntax signals are structural rules.
- **Rule 1 — Size the job:** used the supplied repository base and retained its limits.
- **Rule 2 — Protect the foundation:** preserved all exported names and the existing output fields.
- **Rule 3 — Build upward:** changed only the engine and the three named new tests plus this report.
- **Rule 4 — One builder, one proof:** verified each acceptance area with targeted tests before final regression replay.
- **Rule 5 — Plan before work:** followed the prompt's priority order.
- **Rule 6 — Measure, design, build, prove:** recorded baseline timings, measured post-fix timings, ran tests, and type-checked the engine.
- **Rule 7 — Compress without degrading quality:** bounded regex input to 256 characters, removed per-terminator paragraph copies, and made code-block indexing linear without simplifying sentence scoring.
- **Rule 8 — Weakest phone:** retained the 300,000-character and 5,000-sentence limits and typed error results.
- **Rule 9 — Verify the returned ZIP:** the archive contains only in-lane files and this report.
- **Rule 10 — Roadmap size:** did not change the roadmap.
- **Rule 11 — Account for the future:** kept screen-facing fields and exported contracts stable.
- **Rule 12 — Locks and tests:** added speed, indentation, and CJK acceptance tests; the 80-case regression remains exact.
- **Rule 13 — Portable work:** all archive paths are repository-relative and no dependency was added.

**Conflict check:** none found between the requested changes and the supplied roadmap.

## Files created or changed

1. **CHANGED** `src/tools/engines/text/summarize.ts`
   - Sentence splitting no longer runs URL/e-mail regexes against the growing paragraph. It tracks `http` and `@` in the current whitespace-delimited token and only tests a bounded suffix of at most 256 characters. The regex is gated by the relevant marker.
   - Removed repeated `indexOf` / prefix-filter scans from the `code: 'keep'` path; code-block indexes are now assigned in one pass.
   - An indented run of two or more nonblank lines is code only when at least half (rounded up) are code-like. Otherwise the block is dedented and processed as prose. Fenced blocks remain code.
   - Added script-aware overlapping pairs for Han, Hiragana, Katakana, Thai, Lao, Khmer, and Myanmar runs. Pairing iterates Unicode code points, and U+30FC and U+3005 are kept inside an active run.
   - CJK/other unspaced-script tokens bypass the English minimum-length filter and stop list. `stats.wordsIn` / `stats.wordsOut` count code points in those runs, not the overlapping-pair token count.
   - Suppresses the English-looking warning when at least half of tokens are from those scripts and adds the specified approximation warning.
   - **Honest limit in code:** indented code with none of the defined syntax signs (for example only `import os` lines) is read as text.

2. **NEW** `tests/summarizeSpeed.test.ts`
3. **NEW** `tests/summarizeIndent.test.ts`
4. **NEW** `tests/summarizeCjk.test.ts`
5. **NEW** `docs/reports/C21B_REPORT.md`

No existing tests were changed. `tests/summarize.test.ts`, `tests/summarizeUnicode.test.ts`, `tests/summarizeRegression.test.ts`, and `tests/documentReadPolish.test.ts` are byte-identical to the supplied base. `package.json` was not changed.

## Baseline measurements (C21 version, Node 22 built-in TypeScript stripping)

These are measurements of the supplied C21 implementation, run before the fix. Times vary by machine.

| Input shape | Input length | Baseline time/result |
|---|---:|---:|
| `'a.'` repeated | 20,000 | **NOT FINISHED in 12 seconds**; the combined baseline measurement process was terminated |
| `'hello. world.  '` repeated | 19,995 | 229.11 ms; 1 sentence |
| `'hello. world.  '` repeated | 39,990 | 834.01 ms; 1 sentence |
| `'x@y.z. '` repeated | 21,000 | 430.66 ms; 1 sentence |
| 4,999 ordinary sentences | 269,946 | 42.90 ms; 4,999 sentences |

The ordinary baseline string is 269,946 characters, not the Director's 261,000-character sample. The `a.` baseline run did not finish within 12 seconds; I do not claim a more precise baseline duration.

## Post-fix speed measurements

**MEASURED:** `tests/summarizeSpeed.test.ts` takes the median of three measured runs at each size, after one warm-up call. All listed inputs returned in under 1 second; the doubling-ratio guard passed. Times are milliseconds, ordered by 20,000 / 40,000 / 80,000 / 160,000 / 300,000 characters.

| Input shape | 20k | 40k | 80k | 160k | 300k |
|---|---:|---:|---:|---:|---:|
| `'a.'` repeated | 6.92 | 13.80 | 38.56 | 64.40 | 102.94 |
| `'hello. world.  '` repeated | 5.32 | 7.68 | 14.95 | 44.74 | 70.22 |
| `'x@y.z. '` repeated | 5.98 | 11.49 | 25.57 | 57.32 | 98.55 |
| `'abc def '` repeated | 4.49 | 8.42 | 21.78 | 42.18 | 69.88 |
| lone-backtick pattern | 8.50 | 8.61 | 18.40 | 38.40 | 72.71 |
| URL-like pattern | 5.85 | 9.94 | 21.18 | 46.67 | 90.53 |
| `'Mr. a. '` repeated | 5.53 | 3.82 | 8.14 | 20.95 | 35.97 |
| periods only | 5.96 | 11.53 | 22.56 | 44.91 | 88.32 |
| blank lines only | 0.03 | 0.04 | 0.13 | 0.17 | 0.33 |
| bullet lines | 2.28 | 5.69 | 8.22 | 22.92 | 31.92 |
| fenced blocks with `code: 'keep'` | 4.33 | 5.12 | 15.17 | 32.93 | 17.80 |

The `Mr. a.` series crosses the 5 ms ratio-exemption boundary between samples; ratios are checked only where the previous measurement is at least 5 ms. The fenced-block 300k case returns quickly through the sentence-limit path.

Additional fixed acceptance measurements:

| Case | Measured result |
|---|---:|
| 4,999 ordinary sentences, `sentences: 20` (264,947 chars) | 37.21 ms |
| 300,000-character CJK text, within 5,000 sentences | 203.32 ms |
| Exactly 5,000 blank lines | 0.01 ms; typed `empty-input` result |
| Exactly 5,000 bullet lines (294,999 chars) | 63.85 ms; 5,000 sentences |
| 3,000 fenced code blocks plus prose, `code: 'keep'` (144,000 chars) | 23.11 ms; 3,000 code blocks |

These are sandbox measurements, not a promise of identical phone timings.

## Test results and commands

### Summarizer and compatibility tests

The sandbox has Node 22 and global TypeScript, but no usable project-local `tsx` installation or `node_modules`. `npx tsx tests/summarizeRegression.test.ts` did not complete within 35 seconds. To execute the actual test logic anyway, I made a temporary copy of the repository, adjusted extensionless imports only in that temporary copy for Node's built-in TypeScript stripper, and ran the tests there. No such import edits are in the returned files.

| Temporary-runtime command | Result |
|---|---|
| `node --experimental-strip-types tests/summarizeRegression.test.ts` | PASS — all 80 regression cases; indexes, scores, keywords, sentence counts exact |
| `node --experimental-strip-types tests/summarize.test.ts` | PASS — 47+ assertions |
| `node --experimental-strip-types tests/summarizeUnicode.test.ts` | PASS — existing Unicode, abbreviation, code, coverage, ratio, and code-point checks |
| `node --experimental-strip-types tests/documentReadPolish.test.ts` | PASS — Document Reader polish checks unchanged |
| `node --experimental-strip-types tests/summarizeSpeed.test.ts` | PASS — 11 speed shapes, fixed 5,000-line cases, 3,000 fenced blocks, CJK 300k, median and ratio guards |
| `node --experimental-strip-types tests/summarizeIndent.test.ts` | PASS — prose/code classification and indentation acceptance cases |
| `node --experimental-strip-types tests/summarizeCjk.test.ts` | PASS — Chinese/Japanese scoring, U+30FC, mixed English/CJK, astral Han, one-character run, script warning and stats |

### Independent Python comparison

**MEASURED:** an independent Python implementation, using fixed seed `21022`, generated and compared 80 cases: 40 indented blocks and 40 Chinese/Japanese cases. The indentation implementation independently counted code-like lines against the half-up threshold. The script tokenizer independently counted CJK code points using Unicode ranges and checked the expected CJK warning. **80/80 agreed.** The CJK cases also checked repeated topic pairs in engine keywords. This Python runner was temporary and is not an extra repository file, respecting the lane.

### Mutation checks

Each mutation was applied only to a temporary copy of the engine, and the original source was restored after the run.

| Mutation attempted | Test that caught it | Result |
|---|---|---|
| Make e-mail regex inspect the entire paragraph | Temporary `mutationSpeed.test.ts`, 20k vs 40k e-mail-like input | CAUGHT — 447.64 ms vs 1,696.92 ms; ratio/absolute guard failed |
| Remove the `@` pre-check | Temporary 300k `'a.'` speed guard | CAUGHT — 10,815.96 ms; 1-second guard failed |
| Change “at least half code-like” to “all lines code-like” | `summarizeIndent.test.ts` | CAUGHT — exact-half block no longer treated as code |
| Drop `~` from code-like characters | `summarizeIndent.test.ts` | CAUGHT — tilde-only code-like block misclassified |
| Remove U+30FC from active CJK runs | `summarizeCjk.test.ts` | CAUGHT — expected `スー` pair missing |
| Emit single characters instead of overlapping pairs | `summarizeCjk.test.ts` | CAUGHT — expected repeated topic-pair keyword missing |
| Keep the three-character minimum filter for CJK tokens | `summarizeCjk.test.ts` | CAUGHT — short pair keywords missing |
| Keep the English warning for CJK-majority text | `summarizeCjk.test.ts` | CAUGHT — forbidden English warning present |
| Count CJK pairs rather than code points in stats | `summarizeCjk.test.ts` | CAUGHT — expected 4 input/output units, got 2 |

## Type check and whole-kernel test status

- **PASS — strict engine type-check:** `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler src/tools/engines/text/summarize.ts`.
- **NOT PASS / environment limitation — project type-check:** `npx tsc --noEmit -p tsconfig.json` returned `TS2688: Cannot find type definition file for 'vite/client'`. The base has no `node_modules`; the project dependencies were unavailable. This is not a successful whole-project type-check.
- **NOT RUN as requested — `npm run test:kernel`:** it exited with `sh: 1: tsx: Permission denied`.
- As a fallback only, 30 `test:kernel` test files were attempted individually with Node's built-in TypeScript stripper in the temporary runtime: 17 passed, and 13 could not be run reliably under that fallback because Node's resolver does not match `tsx`'s extensionless/directory resolution or Node's strip-only mode rejects some TypeScript syntax. These are **NOT RUN / runner-incompatible**, not reported as application test failures: `askChoices`, `brain`, `mindPipeline`, `brainGolden`, `brainBoundary`, `lexicon`, `tools`, `dictionarySlot`, `dictionaryProvider`, `dictionary`, `capabilityTruth`, `pickHeadword`, and `dictionaryEnumerate`. The official `test:kernel` result remains unverified.
- **NOT RUN:** phone-device tests and the full cloud build. These cannot be confirmed from this sandbox.

## Compatibility notes and known limits

- `documentRead.ts` was not changed. Its `words` count remains as before and is **not yet consistent** with the new code-point unit used for these scripts in Summarizer stats.
- Thai sentence splitting is **out of scope**; this job changes Thai token scoring only.
- Indented code with none of the specified code-like syntax markers (for example only `import os` lines) will be read as prose; the code comment states this limit.
- No screens, dictionary files, `package.json`, brain files, or other files were changed.

## `test:kernel` lines to add

Add these exact lines to the `test:kernel` script; `package.json` was deliberately not edited:

```text
tsx tests/summarizeSpeed.test.ts
tsx tests/summarizeIndent.test.ts
tsx tests/summarizeCjk.test.ts
```

## Unfinished items

The requested engine fixes and their targeted tests are complete. The official `npx tsx` test invocations, project-wide TypeScript check, full `test:kernel`, cloud build, and phone tests remain unverified because the sandbox lacks a working project dependency installation.
