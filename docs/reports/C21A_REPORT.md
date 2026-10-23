# C21A Report — QR decoder

## Status
DIRECTOR-REPAIRED (2026-10-23). ChatGPT's original status was: INCOMPLETE — do not merge. The decoder and independent fixture set were created, but the independent-vector run exposed version-information failures for versions 15, 23, 27, 29, 30, 31 and 39. The required damage-capacity suite and Reed–Solomon mutation check were not completed. This is not a passing delivery.

## Roadmap and placement
The supplied roadmap is `AXON_ROADMAP_V17_0(2).md` (v17.0), not the requested v17.1. C21A belongs to the Create and Encode tool family and decodes an already-known module grid; camera-image grid finding remains outside this engine.

## LAW CHECK (FL11)
- FL1: placed the decoder in AXON's tool architecture.
- FL2: read the supplied roadmap and inspected required maker/test files and project guidance files.
- FL3: kept the output contract suitable for the future camera-grid stage.
- FL4: incremental verification; unresolved version-information failures remain unresolved and must not be merged.
- FL5: dictionary untouched.
- FL6: no dictionary data or dependencies added; matrix dimensions bounded.
- FL7: timing and tests measured where possible; failures recorded.
- FL8: export mechanism untouched.
- FL9: changes limited to the declared lane.
- FL10: descriptor states that this decodes a known grid, not a camera image; no registry/menu claims.
- FL11: this law check is included in the report.
- FL12: pure engine, no brain or screen imports.
- FL13: no phrase lists added to the brain; examples are documentation only.
- Rule 1: scoped to decoder and tests, with actual run limitations reported.
- Rule 2: used the existing QR maker contract.
- Rule 3: implemented matrix structure, error correction and segment parsing in the engine.
- Rule 4: kept the job to its engine/test/fixture/report lane.
- Rule 5: followed the priority order, but the full proof is unfinished.
- Rule 6: compiled engine files strictly and ran a JavaScript harness against independent vectors, seeded round trips and garbage matrices.
- Rule 7: no new dependency; fixtures are independent test data.
- Rule 8: input capped at 177×177.
- Rule 9: only lane files are included in this return.
- Rule 10: roadmap unchanged.
- Rule 11: supports intended version range in structure, but known version-information failures mean the all-version requirement is not proven.
- Rule 12: guard and lock files untouched.
- Rule 13: repository-relative paths and no new dependency.

## Files created
- `src/tools/engines/create/qrDecode.ts` — decoder implementation; incomplete due to the failing versions noted above.
- `tests/qrDecode.test.ts` — test suite source; not executed through `tsx`.
- `tests/fixtures/qr-vectors.json` — 120 independently generated vectors for versions 11–40 and all four levels.
- `docs/reports/C21A_REPORT.md` — this report.

## Commands and evidence
- `tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --skipLibCheck --lib ES2022,DOM src/tools/engines/create/qrDecode.ts src/tools/engines/create/qrCode.ts` — **PASS**, engine files only.
- `tsc --noEmit -p tsconfig.json` — **NOT PASS**: environment lacks `vite/client` type definitions (`TS2688`).
- `npx --yes tsx tests/qrDecode.test.ts` — **NOT RUN**: command timed out while trying to obtain `tsx`; no `node_modules/.bin/tsx` is present in the supplied sandbox.
- Temporary CommonJS compile and Node harness — **PARTIAL**: 92 of 120 independent vectors decoded correctly; 28 failed version-information checks across versions 15, 23, 27, 29, 30, 31 and 39. Do not interpret this as a passing suite.
- Same temporary harness — **MEASURED**: 221 of 600 seeded maker round-trip attempts were encodable and passed; remaining attempts exceeded maker limits and were skipped by the temporary harness. The committed test does not skip failed encodes, so its behavior still needs an actual run.
- Same temporary harness — **MEASURED**: 2,000 random valid-size matrices returned typed failures without throwing.
- Same temporary harness — **MEASURED**: version 40/H vector decoded in approximately 3.75 ms in this sandbox; one sample only, not a performance guarantee.
- Damage tests at correction capacity and one beyond — **NOT RUN**.
- 5,000 damaged-case wrong-text count — **NOT RUN**.
- Reed–Solomon mutation check — **NOT RUN**.
- Full `test:kernel` — **NOT RUN**.
- Whole-project type check — **NOT RUN** because required Vite type definitions are unavailable.

## `test:kernel` line to add
`tsx tests/qrDecode.test.ts`

## Unfinished work
1. Diagnose and fix version-information decoding for versions 15, 23, 27, 29, 30, 31 and 39, then rerun all 120 independent vectors.
2. Run `tests/qrDecode.test.ts` with the project's `tsx` runtime.
3. Complete damage-capacity and 5,000-case wrong-text tests, garbage tests, and Reed–Solomon mutation check.
4. Run the affected existing kernel suite and full project type check in a toolchain-complete environment.
5. Recheck UTF-8 versus ISO-8859-1 reporting against the required result contract.


## Director repair and inspection (2026-10-23, MEASURED in the Director sandbox with the project's tsx)
Two real bugs fixed in `qrDecode.ts`: (1) version information was compared with only the remainder instead of the full 18-bit word (versions 15, 23, 27, 29, 30, 31, 39 failed); (2) the error-locator polynomial was evaluated with a reversed Horner loop, so Reed-Solomon correction almost never worked (a single flipped module defeated the decoder 88 percent of the time; now 600 of 600 single flips recover).
Results: 120 of 120 independent vectors (versions 11 to 40, all levels); seeded maker round trips; 2,000 garbage matrices typed failures; DAMAGE: 5,000 damaged symbols: wrong text 0, decoded exactly 4,987 (4,932 with corrections), typed failures 13; version 40/H decode about 9 ms on the Director machine (HYPOTHESIS for the phone); mutation check: with `rsCorrect` forced to return null the tests fail (restored).
Added to the test file: the damage-safety block (random module flips never produce wrong text).
Known limits: the round-trip suite skips payloads the maker refuses (versions above 10 are covered by the independent vectors); kanji and structured append return `unsupported-mode`.
