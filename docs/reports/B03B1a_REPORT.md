# B03B1a Numbers report

## Design
The scanner walks each permitted language range once for digit runs and once for word tokens. Digit states consume optional leading minus, integer digits, correctly grouped comma triples, decimal digits, then an optional checked ordinal suffix. Word states use approved cardinal maps, tracking group totals, hundreds and descending large scales; invalid adjacent orders end a phrase. A second pass consumes approved ordinal and half tokens. Each result preserves source offsets and never crosses a language range.

## LAW CHECK
- FL1–FL3: Built only the approved numbers stage within the finished AXON architecture.
- FL4: One sized implementation and measured independent tests.
- FL5: Dictionary unchanged.
- FL9: Followed named stage and file lane.
- FL11: This check precedes delivery.
- FL12: Pure reader, no chat wiring.
- FL13: Approved closed word maps only; no phrase list.
- FL14: Imported shared word and grammar sources.

## Files
- Changed `src/brain/mind/meaning/values/numbers.ts`
- New `tests/valuesNumbers.test.ts`
- New `docs/reports/B03B1a_REPORT.md`

## MEASURED
- `node run.mjs tests/valuesRunner.test.ts --jobs a`: VALUES RUNNER OK, 193310 checks, 30/30 core, stretch V82 matches, 0.008 ms average. Round-trip skipped 0 (word outside closed set), as reported by runner.
- `node run.mjs tests/valuesRunner.test.ts --jobs a,d`: VALUES RUNNER OK, 193316 checks, 30/30 a and 6/6 d, 0.007 ms average.
- `node run.mjs tests/valuesGuard.test.ts`: 20 checks passed.
- `node run.mjs tests/romanNumeral.test.ts`: 27641 checks passed.
- `tsc -p tsconfig.values.json`: clean.
- `node run.mjs tests/valuesNumbers.test.ts`: see output; independently checked suffixes 1..1000, incorrect suffixes, punctuation and seeded fuzz.

## Unfinished / NOT RUN
None known in the named lane. Full Android/cloud build NOT RUN (outside mini-base). No missing approved grammar words identified.
