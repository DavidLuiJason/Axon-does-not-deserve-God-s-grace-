# B03B1c — Dates and times report

## Scope and placement

B03B1c is the dates-and-times reader inside B03B1 Values (pure TypeScript). It receives the caller-supplied clock, reads only the language ranges, and reuses the shared `dateCalc.ts` calendar engine. It does not change the Director-owned assembler, contract, closed word sets, or earlier readers.

AXON's six layers remain: Ground, Knowledge, Reading, Understanding, Voice, Reach. Later brain work can use the typed date/time values and their alternatives. Future break risk: ambiguous slash dates and yearless dates must remain uncertain rather than silently becoming a single date; downstream scheduling must respect `error`, `confidence`, and alternatives.

## LAW CHECK (FL11)

- **FL1:** Keep this job within the approved B03B1 Values stage and consider the later brain stages.
- **FL2:** Use the roadmap and named mini-base files only.
- **FL3:** Preserve typed results and alternatives so later understanding can use them.
- **FL4:** Build and test this sized job; do not repeat a failed approach indefinitely.
- **FL9:** Reuse the existing date engine rather than fixing symptoms in another layer.
- **FL10:** Return explicit values, confidence and reasons; do not claim unsupported certainty.
- **FL11:** Include this check in the handover report.
- **FL13:** Use grammar and existing closed sets, not a new fixed phrase list.
- **FL14:** Reuse the shared calendar engine instead of copying calendar truth.

## Implementation

- Reads ISO dates, slash dates, written month/day/year and day/month/year, ordinal days adjacent to month names, relative days, and strictly next weekday names.
- Keeps ambiguous slash dates weak with both calendar readings; yearless month/day dates keep the current-year and next-year readings open where both are valid.
- Reads numeric clock forms, explicit am/pm, 24-hour forms, noon/midnight, half past, quarter past/to, and numeric minutes past an hour.
- Only interprets a bare hour as a time after `at`; a bare number elsewhere remains a number. Combines adjacent date/time spans into a datetime and preserves consumed number values as `parts`.
- Invalid calendar dates and invalid explicit clock forms return error-bearing values rather than throwing.
- Uses no regex literals, `Date`, wall-clock reads, network calls, randomness, or new phrase-list arrays in the new source file.

## Files delivered

1. `src/brain/mind/meaning/values/datetimes.ts` — implemented date/time reader (replaces the mini-base placeholder).
2. `tests/valuesDatetimes.test.ts` — dedicated behavior and invariant tests.
3. `docs/reports/B03B1c_REPORT.md` — this report.

No other files were changed in the mini-base working tree for this delivery.

## Verification results

Commands run from the mini-base root; results are measured in this session:

- `node run.mjs tests/valuesRunner.test.ts --jobs a,c,d` — **PASS**, 203,358 checks. Job a: 30/30 core items; job c: 26/26; job d: 6/6. Includes the runner's date/time round trips, 2,000 seeded fuzz cases, hostile inputs, invariants, and speed check. Reported average was 0.039 ms/message over 1,700 calls in the final run.
- `node run.mjs tests/valuesDatetimes.test.ts` — **PASS**, 73 checks.
- `node run.mjs tests/valuesGuard.test.ts` — **PASS**, 20 checks; guard scanned 10 files.
- `node run.mjs tests/romanNumeral.test.ts` — **PASS**, 27,641 checks.
- `tsc -p tsconfig.values.json` — **PASS**, exit code 0 (no diagnostics).

## Limits and handover

The shared date engine's calendar range and the supplied clock are authoritative. Ambiguous dates intentionally remain ambiguous. A bare hour outside the `at` construction is not interpreted as a time. Weekday names mean the strictly next occurrence, not today when the supplied clock already falls on that weekday. The full repository/cloud build and phone behavior were not part of this mini-base job and are **NOT RUN** here.
