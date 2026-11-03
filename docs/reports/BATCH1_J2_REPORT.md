# Batch 1 — J2 report: daily data-use ledger

**Result:** BUILT; targeted test passed. Independent Director verdict remains pending.

**Files**
- Engine: `src/tools/engines/data/dataUseLedger.ts`
- Test: `tests/batch1J2DataUseLedger.test.ts`

**What it does**
- Stores daily buckets keyed by calendar date and source.
- Adds incoming samples to the existing date/source bucket without mutating the caller's array.
- Produces sorted monthly (`YYYY-MM`) and yearly (`YYYY`) totals, including received bytes, sent bytes, total bytes, record count and distinct active days.
- Applies explicit retention against an explicit `asOfDate`; the window includes that date and the preceding `N-1` calendar days.
- Validates Gregorian dates (including leap years), non-negative safe-integer byte values and safe-integer aggregation.
- Uses no clock, device API, permissions, persistence or network access. Historical values are not invented: callers must supply the daily records they actually have.

**Measured checks**
- `node run.mjs tests/batch1J2DataUseLedger.test.ts` — PASS.
- 400 consecutive synthetic daily records, spanning 2023 and 2024, were rolled up. Independent expected totals: received `80,200`, sent `160,400`, combined `240,600` bytes.
- Leap day `2024-02-29`, month/year grouping, active-day counts, duplicate date/source aggregation, 30-day retention, invalid dates, sparse arrays and overflow were exercised.

**Important limits / interpretation**
- This engine tracks only records passed to it. It does not read Android network usage statistics or recover months before its first real recording.
- Retention is deterministic and caller-driven; no data is persisted or automatically pruned by this pure engine.
- Up to 100,000 daily source records and 36,600 retention days are allowed.
- The native usage-access permission and data-source adapter remain separate, unbuilt integration work.

**Law check (FL11; laws touched)**
- FL1/FL3/FL9: a pure ledger sits in the tools/data layer; Android usage-access integration is deliberately not claimed.
- FL4: deterministic date arithmetic and checked integer sums; 400-day fixture.
- FL7: totals are computed from records, not inferred from absent history.
- FL10/FL12: no registry, brain schema or chat action was changed.
- FL13: no phrase lists or vocabulary matching added.
- FL5/FL6/FL8/FL15 and N3: dictionary, archives, export and original source untouched.

**NOT RUN:** native Usage Stats permission/reader, persistence adapter, full `test:kernel`, full suite, app/cloud build, phone measurement, independent Director mutants.
