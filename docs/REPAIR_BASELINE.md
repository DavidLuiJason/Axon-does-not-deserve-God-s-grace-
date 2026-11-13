**Source ZIP:** `Axon-does-not-deserve-God-s-grace--main (35).zip`.
**First line of MERGE_TAG.txt (date and tag):** `2026-11-11 | CONNECT2-W4 + NAP LAWS [D471]`.
**Source ZIP test count:** 247 `tests/*.test.ts` files (matches the owner’s stated count; the working tree now has 248 after adding this baseline test).

# AXON Repair Baseline — Wave 0-B

**Status:** MEASURED against the current brain; no repair engine was added.
**Corpus:** 180 hand-authored cases: 60 R1, 60 R2, 60 well-formed controls.
**Measurement:** sequential replay in isolated toolchain worker processes (10 independent cases per worker), each with a fresh dictionary slot and brain. A correct result requires the expected runner source (or the legacy `local-rules` path where the expected output is exact), a task record and the hand-written result fragment.

| Kind | Cases | Should change | Must stay | Correct as is | Wrong | Asked instead | Error |
|---|---:|---:|---:|---:|---:|---:|---:|
| R1 | 60 | 60 | 0 | 4 | 56 | 0 | 0 |
| R2 | 60 | 60 | 0 | 0 | 60 | 0 | 0 |
| CONTROL | 60 | 0 | 60 | 60 | 0 | 0 | 0 |
| **TOTAL** | **180** | **120** | **60** | **64** | **116** | **0** | **0** |

**Split of "wrong" (D84):** refused = the brain said it has no way to do it; ran wrong = it ran a tool and gave a wrong answer (the dangerous kind).

| Kind | Wrong | Refused | Ran wrong |
|---|---:|---:|---:|
| R1 | 56 | 45 | 11 |
| R2 | 60 | 60 | 0 |
| CONTROL | 0 | 0 | 0 |

**Replay completeness:** 180/180 cases produced an observation. **Deterministic totals:** counts only; task IDs and elapsed milliseconds are intentionally excluded.

## Wrong-reading IDs

- R1: R1-001, R1-002, R1-003, R1-004, R1-005, R1-006, R1-007, R1-008, R1-009, R1-010, R1-011, R1-012, R1-013, R1-014, R1-015, R1-016, R1-017, R1-018, R1-019, R1-020, R1-021, R1-022, R1-023, R1-024, R1-025, R1-026, R1-027, R1-028, R1-029, R1-030, R1-032, R1-036, R1-037, R1-038, R1-039, R1-040, R1-041, R1-042, R1-043, R1-044, R1-045, R1-046, R1-047, R1-048, R1-049, R1-050, R1-051, R1-052, R1-053, R1-054, R1-055, R1-056, R1-057, R1-058, R1-059, R1-060
- R2: R2-001, R2-002, R2-003, R2-004, R2-005, R2-006, R2-007, R2-008, R2-009, R2-010, R2-011, R2-012, R2-013, R2-014, R2-015, R2-016, R2-017, R2-018, R2-019, R2-020, R2-021, R2-022, R2-023, R2-024, R2-025, R2-026, R2-027, R2-028, R2-029, R2-030, R2-031, R2-032, R2-033, R2-034, R2-035, R2-036, R2-037, R2-038, R2-039, R2-040, R2-041, R2-042, R2-043, R2-044, R2-045, R2-046, R2-047, R2-048, R2-049, R2-050, R2-051, R2-052, R2-053, R2-054, R2-055, R2-056, R2-057, R2-058, R2-059, R2-060
- CONTROL: none
## Interpretation and limits

- “Correct as is” means the current brain returned the exact expected live tool, a task ID and the hand-written output fragment. It does not claim a repair occurred.
- R1 and R2 cases have `shouldChange: true`; CONTROL cases have `shouldChange: false`. The baseline measures present behavior only; it does not repair or rewrite any message.
- The 60 controls include requests for Text Counter, Case Converter, Sort Lines, Number to Words, Encoder/Decoder, Hash Tool and QR Maker, all read as live in this repository snapshot.
- The held-out half described in the repair design cannot be independently authored by another person in this builder run; these are builder-authored cases and are not a held-out set.
- No R1/R2 repair implementation, phrase list, runner, wiring, source index or existing test was changed.
