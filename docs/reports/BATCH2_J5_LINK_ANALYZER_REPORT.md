# J5 — Link Analyzer report

**Result:** BUILT; focused tests and strict TypeScript compilation passed. Candidate only; not integrated.

**New files:** `src/web/linkAnalyzer.ts`, `tests/linkAnalyzer.test.ts`.

**Contract delivered**
- `analyzeLink` accepts bounded HTTP(S) URLs only; invalid and unsupported schemes return typed errors.
- Userinfo is removed from both returned URL representations and flagged; common tracking keys (`utm_*`, `mc_*` and a fixed set of common click IDs) are removed and their names reported.
- Fragments and default ports are removed; host casing is normalized.
- Fixed flags report insecure HTTP, credentials, removed tracking parameters, removed fragments, nonstandard ports, IP hosts, loopback/localhost hosts and punycode hosts.
- Flags are descriptive hygiene observations, not a maliciousness or safety verdict. No URL is fetched.

**Measured:** credential redaction, tracking removal, fragment/default-port normalization, HTTP/IP/loopback/nonstandard-port flags, punycode flag and invalid/unsupported URL rejection passed.

**Limits:** no DNS resolution, redirect inspection, certificate check, reputation lookup, malware scan or network access. The tracking-key list is deliberately finite and cannot identify every tracking parameter.

**LAW CHECK (FL11; touched laws, max 12 lines)**
1. FL1/FL3 — placed in the web link-inspection layer before any future fetch/browse action.
2. FL2 — used the named roadmap, repository intake tags, board tail and relevant source conventions.
3. FL4 — bounded one-card engine; strict compile and focused regression cases run.
4. FL5/FL6 — dictionary and knowledge archives untouched.
5. FL8/N3 — repository source/export untouched; this is a separate candidate file.
6. FL10/FL12 — no registry, chat action, brain or screen wiring.
7. FL11 — this report states evidence and NOT RUN items.
8. FL13 — no phrase lists or brain matching logic added.
9. FL14 — no existing engine or shared implementation copied/changed.
10. FL15/7R — URL hygiene flags are not presented as verification or a safety verdict.
11. 7Q — malformed/unsupported URLs fail closed; credentials are not exposed in output.
12. 7N — owner source and repository remain unchanged.

**NOT RUN:** Director mutant/independent verification; DNS, redirects, TLS, reputation or malware checks; live web access; app integration; `test:kernel`; full suite; Vite/cloud/Android build; phone/device test.
