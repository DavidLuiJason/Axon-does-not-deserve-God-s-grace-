# Batch 1 — J1 report: ordered many-pair find and replace

**Result:** BUILT; targeted test passed. Independent Director verdict remains pending.

**Files**
- Engine: `src/tools/engines/text/findReplaceMany.ts`
- Test: `tests/batch1J1FindReplaceMany.test.ts`

**What it does**
- Applies up to 100 literal `{ find, replace }` pairs in caller-supplied order.
- Each pair is applied to the text produced by the previous pair; therefore order is observable and later pairs may match earlier replacement output.
- Matches within a pair are non-overlapping and left-to-right.
- Supports optional case-insensitive matching without interpreting regular-expression syntax or replacement tokens.
- Parses one pair per line using a caller-provided non-empty separator. The first separator divides find from replace; later separators stay in the replacement field. Whitespace is preserved.
- Rejects empty find values, malformed pairs, unsafe input sizes and output expansion before materializing an oversized result.

**Measured checks**
- `node run.mjs tests/batch1J1FindReplaceMany.test.ts` — PASS (19 assertions).
- Pair-order and overlapping-match answers are asserted explicitly.
- Literal `$&` / `$1` replacement text remains literal.

**Important limits / interpretation**
- This is literal find/replace, not regular-expression replacement.
- The parser uses one record per non-empty line and one separator between find and replacement. A separator inside the find field is not escaped; use a different separator for that input.
- Engine limits: 200,000 input characters, 1,000,000 output characters, 100 pairs, 500 characters per find value and 2,000 per replacement value.
- This is a new pure engine only. It is not wired into the runner registry, brain or screen.

**Law check (FL11; laws touched)**
- FL1/FL3/FL9: new engine sits in the existing text-engine layer and does not bypass later brain integration.
- FL4: bounded pair count and output construction; tests cover order and overlap.
- FL10/FL12: no registry or chat path was added; the engine alone is not a live tool.
- FL13: no phrase or fixed-pattern list was added; examples exist only in tests.
- FL5/FL6/FL8/FL15: dictionary, knowledge blocks and source-export logic untouched.
- N3: this is a separate candidate return; the source repository was not overwritten or merged.

**NOT RUN:** full `test:kernel`, full test suite, app/cloud build, phone test, independent Director mutants.
