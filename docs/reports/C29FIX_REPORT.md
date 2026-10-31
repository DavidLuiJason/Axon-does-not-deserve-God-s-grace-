# C29-FIX Report — Physics and Unit Repair

## 1. Five-line AXON overview

1. Finished AXON contains six layers: Ground, Knowledge, Reading, Understanding, Voice and Reach (tools, memory, media, device files, optional AI and AXON Code).
2. C29-FIX sits in section 8, the pure-engine/tool foundation: shared number conversion and physics.
3. Later additions include more scientific unit categories, brain integration and Converter integration.
4. The main compatibility risk is changing `UNITS`, which would affect the brain quantity scanner and the existing Converter.
5. The implementation preserves the original eight public categories and exposes five additional physics-only groups through the shared engine.

## 2. LAW CHECK (FL11)

- FL1 — Preserve the whole-system architecture and identify later dependencies.
- FL2 — Read the complete roadmap and all named files; no unrelated files.
- FL3 — Keep the shared engine compatible with future brain and screen consumers.
- FL4 — Two-Strike Rule; no repeated third fix or invented test results.
- FL5 — Preserve the dictionary and its integration; do not remove or bypass it.
- FL9 — Repair the shared unit foundation before dependent systems.
- FL11 — Apply and document the relevant foundation laws.
- FL13 — Add unit definitions, not fixed brain phrase lists.
- FL14 — Use one shared conversion engine, without duplicated conversion logic.
- FL15 — Independently derived expected values, regression tests and mutant coverage.

No roadmap conflict identified.

## 3. R1–R7 evidence

| Requirement | Status | Command output / evidence (maximum five lines) |
|---|---|---|
| R1 — Separate physics table; 13-category conversion/listing; preserve public table | MEASURED | `tsc --target ES2022 --module commonjs --strict --skipLibCheck ...` → exit 0. `node compiled/tests/unitCategories.test.js` → `unitCategories.test.ts: 54 checks passed.` Public `UNITS` key/list checks passed. |
| R2 — Five groups and independently derived factors | MEASURED | `node compiled/tests/unitCategories.test.js` → 54 checks passed. All 21 units checked against independently written factors; lbf, hp, kWh, cal, ft/s² and lb·ft/s derived checks passed. |
| R3 — Exact-case symbol matching and two aliases | MEASURED | `node compiled/tests/unitCategories.test.js` → 54 checks passed. `kN` → 1000 N; `kn` → 0.514444444444 m/s; both caret aliases passed. |
| R4 — Physics consumes shared conversions | MEASURED | `node compiled/tests/physics.test.js` → `C29 physics tests: 171 checks passed.` Includes acceleration, force, power, energy and momentum inputs. |
| R5 — Missing-input text and negative-time handling | MEASURED | Original-source `node -e solveMotion(...)` → case 1 time roots `[-0.450289856949618, 4.5291547088613315] s`; case 2 → `no-real-solution: These values give no real final velocity.` Updated suite → 171 checks passed. |
| R6 — Independent regression tests | MEASURED | `node compiled/tests/unitCategories.test.js` → 54 checks passed. `node compiled/tests/physics.test.js` → 171 checks passed. Expected values are arithmetic in the tests, not copied from engine output. |
| R7 — M1–M8 mutant coverage | MEASURED | Each mutant was applied to an isolated copy, compiled, and run. All eight runs exited on a failing assertion (caught); exact check names are in section 5. |

**Runner note:** `tsx` is not available on PATH in this environment. The requested `tsx tests/physics.test.ts` and `tsx tests/unitCategories.test.ts` commands are therefore NOT RUN. I used global `tsc` to compile the two tests and their two engine dependencies to JavaScript, then ran the compiled tests with Node 22.16.0. The targeted strict TypeScript compile exited 0.

**Compatibility tests:** `tests/toolsNumbers.test.ts` and `tests/valuesQuantities.test.ts` are NOT RUN because `tsx` is unavailable. The source files and tests were not edited. The exact legacy `UNITS` key order and all eight legacy unit-symbol lists are covered by the new test.

## 4. R5 — before measurements and repaired behavior

Measured by compiling the original, unmodified `physics.ts` and `unitConvert.ts`, then calling `solveMotion` with the two specified inputs.

- `u=20 m/s, a=-9.80665 m/s², s=-10 m`: original result was `ok: true`; velocity roots `[24.41583502565497, -24.41583502565497] m/s`; time roots `[-0.450289856949618, 4.5291547088613315] s`. The original result included a negative-time answer.
- `u=0, a=2 m/s², s=-10 m`: original result was `no-real-solution`, message: `These values give no real final velocity.`

After repair, the first case returns only the non-negative-time branch (`v=-24.41583502565497 m/s`, `t=4.5291547088613315 s`) and adds: `Discarded a negative-time solution (t = -0.45028985695 s, before the start).` The second case remains a no-real-solution result because its discriminant is negative, not because real roots were discarded. A separate all-negative-roots regression returns `no-real-solution` with a before-the-start message.

**Existing-check correction:** the original dropped-stone test expected both mathematical time roots, including the negative-time root. That expectation directly contradicted R5, so the same three checks were retained but updated to assert one non-negative-time result. The other original checks were kept.

## 5. R7 — mutant results

| Mutant | Result | Exact check that caught it |
|---|---|---|
| M1 — `STANDARD_GRAVITY = 9.8` | FAILED (caught) | `standard gravity remains independently correct at 9.80665 m/s²` |
| M2 — remove cosine from work | FAILED (caught) | `work includes cosine` |
| M3 — remove one-half from kinetic energy | FAILED (caught) | `kinetic energy` |
| M4 — interpret projectile angle as radians | FAILED (caught) | `projectile time independent` |
| M5 — remove negative-time rejection | FAILED (caught) | `dropped stone discards the negative-time branch` |
| M6 — set lbf factor to 4.448 | FAILED (caught) | `force/lbf independently converts to SI by its derived factor` |
| M7 — resolve `kN` and `kn` as the same unit | FAILED (caught) | `exact-case kn still resolves to knot` |
| M8 — add a physics group to `UNITS` | FAILED (caught) | `public UNITS keys remain exactly the original eight categories` |

Each mutant was run against a separate copy of the final source and tests. `FAILED (caught)` means the test process failed at the named assertion; none was a pass-through gap.

## 6. Files changed

- `src/tools/engines/numbers/unitConvert.ts` — physics-only unit groups, exact-first lookup, two aliases, 13-group conversion/listing.
- `src/tools/engines/numbers/index.ts` — exports the new table and types.
- `src/tools/engines/science/physics.ts` — shared unit conversion, missing-input messages, non-negative solved times.
- `tests/physics.test.ts` — preserved the original check count and added C29-FIX regression coverage.
- `tests/unitCategories.test.ts` — new conversion, compatibility, alias, derived-factor and round-trip checks.
- `docs/reports/C29FIX_REPORT.md` — this report.

## 7. Exact `test:kernel` line to add

`tsx tests/unitCategories.test.ts`

## 8. WHAT THIS PROMPT MISSED

Time-derived quantities outside the five requested groups remain on their existing categories and conversion paths; no new time-derived group was introduced. Runtime verification of `tests/toolsNumbers.test.ts` and `tests/valuesQuantities.test.ts` remains outstanding because `tsx` is unavailable in this environment. The new test verifies the exact original eight `UNITS` categories and unit lists, but the Director should still run those two existing tests in the repository environment.
