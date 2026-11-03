# J6 — Currency Convert report

**Result:** BUILT; focused tests and strict TypeScript compilation passed. Candidate only; not integrated.

**New files:** `src/finance/currencyConvert.ts`, `tests/currencyConvert.test.ts`.

**Contract delivered**
- `convertCurrency` uses only the caller-supplied dated rate table; rates mean units of each currency per one unit of the declared base currency, whose rate must equal exactly 1.
- Amounts and rates are plain decimal strings; conversion uses integer `BigInt` rational arithmetic, not binary floating-point arithmetic.
- HALF UP rounding is performed at caller-selected 0–8 fraction digits; negative midpoint values round away from zero.
- Rate age is calculated from caller-supplied dates. Staleness is reported against caller-supplied `staleAfterDays`; stale rates are not silently refreshed or hidden.
- Missing/invalid currencies, rates, dates, amounts and future-dated rate tables return typed errors.

**Measured:** EUR-to-NGN conversion, positive/negative midpoint rounding, zero-decimal rounding, rate age/staleness, missing-rate rejection, scientific-notation rejection and future-rate rejection passed.

**Limits:** no live exchange-rate source, ISO currency metadata, rate freshness policy or financial advice is included. The caller chooses rates, rate date, stale threshold and fraction digits. Stale output remains marked stale and must be handled by the caller.

**LAW CHECK (FL11; touched laws, max 12 lines)**
1. FL1/FL3 — placed in the finance computation layer; rate acquisition remains external.
2. FL2 — used the named roadmap, repository intake tags, board tail and relevant source conventions.
3. FL4 — bounded one-card engine; strict compile and focused regression cases run.
4. FL5/FL6 — dictionary and knowledge archives untouched.
5. FL8/N3 — repository source/export untouched; this is a separate candidate file.
6. FL10/FL12 — no registry, chat action, brain or screen wiring.
7. FL11 — this report states evidence and NOT RUN items.
8. FL13 — no phrase lists or brain matching logic added.
9. FL14 — no existing engine or shared implementation copied/changed.
10. FL15/7F — stale/fresh status is explicit; no rate is invented or called current.
11. 7Q — invalid and future-dated inputs fail closed.
12. 7N — owner source and repository remain unchanged.

**NOT RUN:** Director mutant/independent verification; live FX lookup; comparison with a financial provider; integration with a currency tool/screen; `test:kernel`; full suite; Vite/cloud/Android build; phone/device test.
