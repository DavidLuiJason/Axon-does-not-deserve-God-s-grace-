# C19 Calculator Upgrade Report

## Outcome

**Delivered in-lane files:** the calculator engine upgrade, a new upgrade test, a test-only copy of the original calculator, and this report. No screen, catalog, registry, descriptor, package manifest, dictionary, guard, lock, or roadmap file was changed.

The upgraded engine supports phone-style relative percentages, `%` remainder compatibility when an operand follows, `of` and the requested word/symbol operators, factorial, combinations/permutations, implicit multiplication, `√`/`π`, `ans`, scientific notation, the requested scientific functions, degree-angle exact trig values, and a `interpreted` string on every result. It retains the 512-character and 256-token caps and adds a 64-level nesting cap plus bounded evaluation work.

## LAW CHECK — FL1–FL13 and Rules 1–13

- **FL1 — Top view:** C19 is the calculator-engine stage before screen job A13; only the specified engine lane was edited.
- **FL2 — Read everything, then act:** The supplied v16.8 roadmap was read; the base calculator, percentage engine, numbers index, project test configuration, job board, handbook, engine truth test, and existing `evaluate` tests were inspected.
- **FL3 — Plan reaches the end:** The result contract includes `interpreted` for A13 to display; old callers still receive `ok`, `value`, `formatted` or a typed error.
- **FL4 — Progress first:** Work was verified in small steps; no problem received a third fix attempt.
- **FL5 — Dictionary is core:** No dictionary file or dictionary behavior was touched.
- **FL6 — Searchable compression:** No data packs or assets were added.
- **FL7 — Measure why:** The report separates measured runs from commands blocked by unavailable dependencies.
- **FL8 — Source export:** Export/build machinery was untouched; no export-equivalence claim is made.
- **FL9 — Plan first:** Changes are confined to the C19 lane.
- **FL10 — Truthful capabilities:** `CALCULATOR_DESCRIPTOR` remains untouched in its existing file; no registry or menu claims were added.
- **FL11 — Every-stage law:** This complete law check is recorded here.
- **FL12 — One designed brain:** The engine remains pure TypeScript and does not import or call the brain, screen, DOM, storage, or network.
- **FL13 — Structure before vocabulary:** No phrases were added to the brain; supported operator words are handled only by the calculator parser.
- **Rule 1 — Size to capacity:** Input length, token count, parenthesis depth, calculation work, factorial, and combination/permutation bounds are explicit.
- **Rule 2 — Foundation capacity:** The existing engine API and exact-rational arithmetic approach were preserved; no dependency was added.
- **Rule 3 — Build from the foundation:** Only the engine, its tests, the original-engine test helper, and report are included; no screen was built.
- **Rule 4 — One job, one proof:** The C19 engine and its test suite were built and checked independently of UI work.
- **Rule 5 — Plan before work:** Work follows the C19 lane and acceptance list.
- **Rule 6 — Measure, design, build, prove:** Python `fractions.Fraction` generated 500 expected-value fixtures; a seeded 5,000-expression old/new comparison was run.
- **Rule 7 — Compress without degrading quality:** No compression or lossy transformation was needed.
- **Rule 8 — Weakest supported phone:** Evaluation and parsing are bounded; large factorial/combination results are guarded.
- **Rule 9 — Test the project connection:** The return archive contains only the four named in-lane files at repository-relative paths.
- **Rule 10 — Roadmap size:** The roadmap was not edited.
- **Rule 11 — Account for the future:** `interpreted` is part of both success and error results so A13 can display how the expression was read.
- **Rule 12 — Locks grow:** Guards and locks were not edited; the new test is listed for addition to `test:kernel`.
- **Rule 13 — Survive being moved:** Imports and archive paths are repository-relative; no new dependency is required.

## Files created or changed

1. `src/tools/engines/numbers/calculator.ts` — changed.
2. `tests/calculatorUpgrade.test.ts` — new.
3. `tests/helpers/calculatorOld.ts` — new exact copy of the base calculator for test-only compatibility comparison.
4. `docs/reports/C19_REPORT.md` — new.

No other file is included in the archive.

## Test evidence

### MEASURED — passed

- `node --experimental-strip-types tests/calculatorUpgrade.test.ts` — **PASS, 632 checks**. Includes the required examples, errors/hints/positions, 30 exact `interpreted` expectations, 500 independently generated Python fixtures (exact rational cases via `fractions.Fraction`, with Python `math` for π), six deliberate percentage-rule mutation comparisons, limits and adversarial inputs, plus 5,000 seeded compatibility expressions.
- Compatibility differential — **5,000 generated expressions compared; 0 value/format differences** against `tests/helpers/calculatorOld.ts`. The generated expressions cover old numbers, arithmetic operators including remainder, parentheses, unary signs, old functions and constants. Two deliberate edge-case differences are separately tested and justified below.
- `node --experimental-strip-types tests/.toolsNumbers.c19-temp.test.ts` — **PASS, 67 existing number-tool checks**. This was a temporary copy of `tests/toolsNumbers.test.ts` with explicit `.ts` import extensions for Node's built-in TypeScript stripping; the temporary file was removed afterward. The tracked existing test was not edited.
- `tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --skipLibCheck --allowImportingTsExtensions src/tools/engines/numbers/calculator.ts tests/calculatorUpgrade.test.ts tests/helpers/calculatorOld.ts` — **PASS**, strict type-check of all C19 TypeScript files.
- `node --experimental-strip-types` spot checks confirmed the explicit required percent examples and read-as output, including `200 + 10 + 5%` → `220.5` and `50% of 100 times 10` → `500`.

### NOT RUN / blocked by the sandbox

- `npx tsx tests/calculatorUpgrade.test.ts` — attempted but timed out while `npx` tried to resolve/download TSX; no network/cache was available. The same test file was executed successfully with Node 22's built-in TypeScript stripping instead.
- `npm ci --offline` — **FAIL, exit 1**: required `yauzl-2.10.0.tgz` was not cached (`ENOTCACHED`); dependencies could not be installed offline.
- `npx tsc --noEmit -p tsconfig.json` — **FAIL before project checking, exit 2**: `TS2688 Cannot find type definition file for 'vite/client'` because project dependencies are absent. The strict targeted type-check above passed.
- `npm run test:kernel` — **FAIL before the first test, exit 127**: `tsx: not found`. No kernel test in that script ran.

These are environment/toolchain limits, not reported as passing project-wide checks. The Director should rerun the project type-check and full kernel suite after dependencies are available.

## Compatibility exception caused by the required percent rule

The old parser evaluates `10%+3` and `10%-3` as remainder operations, both returning `1`. The new requirement explicitly defines `%` after a number or `)` as percentage when the next token does not begin an operand; `+` and `-` do not begin operands in that rule. Therefore the upgraded engine intentionally reads these as `10% + 3 = 3.1` and `10% - 3 = -2.9`. Both outcomes are covered by tests. This is a narrow, documented conflict between the new mandatory percent syntax and absolute old-expression compatibility; ordinary remainder forms such as `10%3` and `10 % 3` remain unchanged.

## Mutation checks

Six intentionally incorrect outcomes were checked against the expected table: treating a lone percent as unscaled (`50%`), using absolute instead of relative percent (`100 + 10%`), multiplying without dividing by 100 (`200 * 15%`), applying a later percentage to the original rather than accumulated left value (`200 + 10 + 5%`), changing `of` precedence (`100 / 50% of 10`), and changing remainder semantics (`10 % 3`). Each mutated outcome differs from the expected value, and the live engine passes the expected case.

## Exact `test:kernel` line to add

Add this command to the `test:kernel` script in `package.json` (do not replace or remove existing commands):

`tsx tests/calculatorUpgrade.test.ts`

`package.json` was not edited, as required.

## Remaining hand-off checks

- Run `npx tsc --noEmit -p tsconfig.json` and `npm run test:kernel` in an environment with the project dependencies installed.
- Inspect the four-file delta and run the Director's return verifier before merging.
- Screen work is not part of C19; A13 should display the returned `interpreted` string.

## DIRECTOR ADDENDUM (Claude, 2026-10-21): inspection result and one fix

Inspected with `docs/director/verify_return.py` (in lane, 0 placeholder hits) and rerun independently: the delivered test passes (632 checks); `tests/toolsNumbers.test.ts` (67 checks) and the converter tests still pass with the new engine.
Independent check of VALUES: a separate Python Fraction reference of the percent, `of` and precedence rules, 30,000 random expressions, 0 mismatches.
DEFECT FOUND (MEASURED): the "read as" string (`interpreted`) was wrong when a parenthesised group contained a percent step and was used inside a larger expression. The value was right but the string meant something else: `100 - (50 + 10%)` is 45 but read as `100 − 50 + (50 × 10 ÷ 100)` (which is 55); `2 * (100 + 10%)` is 220 but read as `2 × 100 + (...)` (210). 4,424 of 30,000 random percent expressions had a misleading string. Cause: two places (`renderNode` and `evaluateNode`) returned the percent add or subtract text without outer parentheses.
FIX (two lines): both now return `(${a} ± (${a} × b ÷ 100))`; the root still strips its outer parentheses, so top-level strings are unchanged. After the fix: 0 of 30,000 strings disagree with their value; the delivered 632 checks still pass.
NEW TEST: `tests/calculatorReadAs.test.ts` (6 fixed cases and 3,000 random expressions). Add `tsx tests/calculatorReadAs.test.ts` to `test:kernel` next to `tsx tests/calculatorUpgrade.test.ts`.
ACCEPTED COMPATIBILITY CHANGE: `10%+3` and `10%-3` are now percent (3.1 and -2.9), not remainder (1); the spec rule makes this unavoidable and the builder disclosed it. `10 % 3` and `10%3` remain remainder.
COSMETIC, NOT FIXED: the percent step prints an ASCII `-` or `+` where other places print `−`; harmless.
NOT RUN HERE: strict project type check and `npm run test:kernel` (no dependencies installed in the Director sandbox); the cloud build is the proof. FOUND ELSEWHERE (not C19): `tests/tools.test.ts` line 104 asserts that only five tools are marked available; the catalog now has 31, so that kernel test fails on the base code too and needs a small update before any build with the test gate on.
