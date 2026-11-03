# J3 — Claim Label report

**Result:** BUILT; focused tests and strict TypeScript compilation passed. Candidate only; not integrated.

**New files:** `src/web/claimLabel.ts`, `tests/claimLabel.test.ts`.

**Contract delivered**
- Supported labels: `UNKNOWN`, `INFERRED`, `REPORTED`, `VERIFIED`, `DISPUTED`.
- Evidence records carry a unique evidence id, independence-group id, stance (`supports`/`refutes`) and kind (`inference`/`reported`/`verified`).
- No evidence yields UNKNOWN. Any refuting evidence yields DISPUTED; conflicting support/refutation is explicitly described.
- VERIFIED requires verified supporting evidence from at least two distinct independence groups. Repeated items from one group count as one group and cannot cross the threshold.
- Reported support remains REPORTED; inference-only support remains INFERRED. Duplicate evidence IDs and oversized collections are rejected.

**Measured:** empty evidence, inference, reported, one-group repetition, two independent verified groups, conflicting evidence, refuting evidence and duplicate-ID rejection passed.

**Limits:** independence-group IDs and evidence kinds are supplied by the caller and are not independently authenticated. This engine labels supplied evidence; it does not search, fetch, verify or decide whether two sources are truly independent.

**LAW CHECK (FL11; touched laws, max 12 lines)**
1. FL1/FL3 — placed in the understanding/truth layer after evidence collection.
2. FL2 — used the named roadmap, repository intake tags, board tail and relevant source conventions.
3. FL4 — bounded one-card engine; strict compile and focused regression cases run.
4. FL5/FL6 — dictionary and knowledge archives untouched.
5. FL8/N3 — repository source/export untouched; this is a separate candidate file.
6. FL10/FL12 — no registry, chat action, brain or screen wiring.
7. FL11 — this report states evidence and NOT RUN items.
8. FL13 — no phrase lists or brain matching logic added.
9. FL14 — no existing engine or shared implementation copied/changed.
10. FL15/7F — repetition never upgrades truth; disputed and unknown states remain explicit.
11. 7Q — evidence is bounded and invalid/duplicate records fail closed.
12. 7N — owner source and repository remain unchanged.

**NOT RUN:** Director mutant/independent verification; authentication of source independence; integration with source records or claim store; `test:kernel`; full suite; Vite/cloud/Android build; phone/device test.
