# B03B1b report — PARTIAL DELIVERY

Evidence: MEASURED for all commands below. This is not an accepted full pass.

## LAW CHECK
FL1–FL3: scoped to values in the planned reading layer; compatible with later stages.
FL4: bounded work; no third repair attempt on the same failure.
FL5–FL6: dictionary untouched.
FL9–FL10: no tool dispatch or screen logic.
FL11–FL12: law check included; value reader remains in brain.
FL13: no fixed phrase list added.
FL14: unit names, symbols, factors from ctx.units; no copied unit table.

## Design
Unit matching searches shared-table names and case-sensitive symbols; derives plurals and spelling variants, then checks a unique last word. Longer matches take priority. Duration chains join adjacent time quantities, including the coordinator, with milliseconds derived from time unit factors. Article and half forms are recognized separately.

## Files
Changed: src/brain/mind/meaning/values/quantities.ts
Created: tests/valuesQuantities.test.ts; docs/reports/B03B1b_REPORT.md

## Measured commands
- `node run.mjs tests/valuesRunner.test.ts --jobs a,b,d`: FAILED. 30/30 a, 21/22 b, 6/6 d core items. V22 (`set 1h30m`) still returns two values. Hostile 20k input speed limit also fails; see runner log in chat. 195614 checks reported, six failures in last run.
- `node run.mjs tests/valuesGuard.test.ts`: PASSED, 20 checks.
- `node run.mjs tests/romanNumeral.test.ts`: PASSED, 27641 checks.
- `tsc -p tsconfig.values.json`: PASSED (exit 0).
- `node run.mjs tests/valuesQuantities.test.ts`: PASSED, see output; limited own test, not the full requested fuzz.

## Unfinished
V22 attached time chain; hostile-input speed budget; 2,000-string seeded fuzz; full requested focused unit-variant tests. No source file outside the assigned lane was modified. Proposed PERCENT_WORDS still requires owner approval as specified by roadmap.
