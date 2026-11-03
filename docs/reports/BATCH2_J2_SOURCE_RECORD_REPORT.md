# J2 — Source Record report

**Result:** BUILT; focused tests and strict TypeScript compilation passed. Candidate only; not integrated.

**New files:** `src/web/sourceRecord.ts`, `tests/sourceRecord.test.ts`.

**Contract delivered**
- `createSourceRecord(input, asOf, staleAfterDays)` validates publisher, date, SHA-256 digest and an explicit as-of date/age threshold.
- URLs are restricted to HTTP(S), reject credentials and control/whitespace characters, normalize host casing/default ports and remove fragments.
- Source identity is the normalized URL plus the supplied SHA-256 digest. Hash input is normalized to lowercase.
- Age is calendar-day based. `stale` is computed against the caller-supplied threshold; no clock is read.
- Every record carries the literal truth label `REPORTED`; record creation never upgrades a source to VERIFIED.

**Measured:** normalization, source age, stale/fresh boundary, future-date rejection, malformed digest, credential-bearing URL and unsupported protocol cases passed.

**Limits:** the engine does not fetch a page, inspect content, calculate the hash or verify the publisher. The caller must supply the digest, source date, publisher and as-of date. A source record is provenance, not proof of a claim.

**LAW CHECK (FL11; touched laws, max 12 lines)**
1. FL1/FL3 — placed in the web/provenance layer before claims can consume source records.
2. FL2 — used the named roadmap, repository intake tags, board tail and relevant source conventions.
3. FL4 — bounded one-card engine; strict compile and focused regression cases run.
4. FL5/FL6 — dictionary and knowledge archives untouched.
5. FL8/N3 — repository source/export untouched; this is a separate candidate file.
6. FL10/FL12 — no registry, chat action, brain or screen wiring.
7. FL11 — this report states evidence and NOT RUN items.
8. FL13 — no phrase lists or brain matching logic added.
9. FL14 — no existing engine or shared implementation copied/changed.
10. FL15/7F — source records remain REPORTED; age does not confer verification.
11. 7R — URL, publisher, date and hash provenance are represented; no web fetch is claimed.
12. 7N — owner source and repository remain unchanged.

**NOT RUN:** Director mutant/independent verification; hash calculation/content retrieval; source-to-claim integration; `test:kernel`; full suite; Vite/cloud/Android build; phone/device test.
