# J4 — Screen Tree to Text report

**Result:** BUILT; focused tests and strict TypeScript compilation passed. Candidate only; not integrated.

**New files:** `src/device/screenTreeText.ts`, `tests/screenTreeText.test.ts`.

**Contract delivered**
- `screenTreeToText(tree, options?)` traverses a supplied node tree in stable depth-first order and returns visible text with explicit extraction counters.
- Text fields are `text`, `contentDescription`, `label` and `value`; child nodes are visited in source order.
- Nodes marked `visible: false`, `hidden: true` or `displayed: false` are skipped with their entire subtree.
- Password/sensitive nodes are replaced with `[REDACTED]`; their values and children are not traversed.
- Node, depth and output-character ceilings are validated and reported; malformed node/children shapes fail closed.

**Measured:** visible text order, hidden subtree omission, password redaction, character truncation, depth ceiling, node ceiling and malformed children cases passed.

**Limits:** this is a pure converter for a caller-supplied tree. It does not capture Android screens, infer visibility, access accessibility services or perform app actions. Unknown node fields are ignored.

**LAW CHECK (FL11; touched laws, max 12 lines)**
1. FL1/FL3 — placed in the device-read layer; actual capture/permissions remain outside this engine.
2. FL2 — used the named roadmap, repository intake tags, board tail and relevant source conventions.
3. FL4 — bounded one-card engine; strict compile and focused regression cases run.
4. FL5/FL6 — dictionary and knowledge archives untouched.
5. FL8/N3 — repository source/export untouched; this is a separate candidate file.
6. FL10/FL12 — no registry, chat action, brain or screen wiring.
7. FL11 — this report states evidence and NOT RUN items.
8. FL13 — no phrase lists or brain matching logic added.
9. FL14 — no existing engine or shared implementation copied/changed.
10. FL15/7R — hidden nodes are omitted and password content is redacted; no capture permission is assumed.
11. 7Q — bounded traversal and invalid tree shapes fail closed.
12. 7N — owner source and repository remain unchanged.

**NOT RUN:** Director mutant/independent verification; Android accessibility capture; permission/consent flow; app integration; `test:kernel`; full suite; Vite/cloud/Android build; phone/device test.
