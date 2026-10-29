# C30 Report — Shelf Format

## Scope and files
Created only the three files named in the C30 lane:
- `src/knowledge/shelf/shelfFormat.ts` — bounded manifest validation, block verification, index lookup, promotion/demotion, load gate, startup self-check.
- `tests/shelfFormat.test.ts` — focused regression tests including deliberate faults.
- `docs/reports/C30_REPORT.md` — this report.

No existing file was edited. `package.json` was not changed.

## LAW CHECK (FL11)
1. **FL1–FL3:** C30 is mapped to the Knowledge Slot foundation; the format supports later brain stages and lazy-loaded shelves.
2. **FL4:** Build incrementally, test completed code, and stop after two failures of the same problem.
3. **FL5:** The dictionary remains required and untouched; this job neither removes nor replaces it.
4. **FL6:** Use bounded, independently hash-checked blocks, a searchable index, and manifest validation.
5. **FL7:** Use independent hash calculations and deliberate fault injection as evidence.
6. **FL8–FL10:** Preserve repository/export integrity; add no registration, screen, or chat behavior.
7. **FL11–FL13:** Record the law check; use explicit typed validation, not fixed brain phrase lists.
8. **FL14–FL15:** Keep one pure implementation; enforce staged admission, owner approval, and visible failures.
9. **Rule 1:** The supplied mini-base was inspected; no capacity measurements were available in the archive.
10. **Rules 2–4:** Narrow lane, independent hash expectations, repeatable tests, hostile-input cases.
11. **Rules 5–8:** Complete bounded functions; cap blocks, strings, source/index counts and declared bytes; keep the engine platform-independent.
12. **Rules 9–13:** Do not edit protected files; preserve tests; account for future blocks; use relative paths and explicit handover details.

## Implementation behavior
- `validateManifest(m)` returns all discovered structural gaps without intentionally throwing on hostile input. It validates required source/licence fields, counts, duplicate IDs, hashes, block limits, index references, missing index entries, reversed/overlapping/unsorted ranges, test set and kill switch shape.
- `verifyShelf(m, readBlock, sha256)` reports each block's status, including missing file, size mismatch and hash mismatch; callbacks are injected.
- `findBlock(index, key)` uses binary search and returns `null` on misses or malformed input.
- `promote` only allows CANDIDATE → CHECKED with recorded-source independent confirmation plus a passing known-answer test, and CHECKED → ADMITTED with owner approval naming a recorded source. It returns a copied manifest; it does not mutate the original.
- `demote` returns a copied CANDIDATE manifest, enables the kill switch and records the reason.
- `canLoad` requires a valid ADMITTED manifest and a kill switch that is not off.
- `startupSelfCheck` reports each named shelf as loaded, blocked or damaged and names missing/damaged blocks when the verification report identifies one.

## Evidence and exact commands

### MEASURED — tests executed
- `node --experimental-strip-types tests/shelfFormat.runtime.ts` — **11/11 test groups passed**. The temporary runtime copy used the same test source with an explicit `.ts` import extension because Node's direct TypeScript loader requires it. That temporary file was removed and is not included in the return zip.
- `python3` using `hashlib.sha256` for bytes `ABC` and `DE` — independently printed and matched the expected hashes in the test.
- `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler src/knowledge/shelf/shelfFormat.ts` — **PASS**, standalone strict check of the engine.

### NOT RUN / environment limitation
- `npx tsx tests/shelfFormat.test.ts` — NOT RUN successfully: invocation timed out while no local `node_modules` or `tsx` executable was present. `npm exec --offline --package=tsx -- tsx tests/shelfFormat.test.ts` confirmed `tsx` was not cached (`ENOTCACHED`).
- `tsc --noEmit -p tsconfig.json` — attempted, **BLOCKED** because `vite/client` type definitions are absent from the mini-base environment (`TS2688`). This is an environment/dependency limitation, not a passing project type check.
- Existing `test:kernel` suite — NOT RUN: the mini-base contains no `tests/` directory or existing test files, and `tsx` is unavailable. No claim is made that the full kernel suite passed.
- `tools/guard.mjs` — NOT RUN; this is a builder mini-base, not a complete repository, and guard verification is expected during Director return inspection.

## Printed test counts
- Executed C30 test groups: **11 passed, 0 failed** under Node's built-in TypeScript stripping.
- Standalone engine strict type check: **passed**.
- Full project type check and repository kernel suite: **NOT RUN successfully** for the dependency/base reasons above.

## Independent hash values
- `ABC`: `b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78`
- `DE`: `6814ef46f686990cf4e946f966167b0507e1d642c44e51f61bffb0bba2d4672b`

## Package script line to add
Append this command to the `test:kernel` chain in `package.json` (do not replace the existing chain):

`tsx tests/shelfFormat.test.ts`

## Unfinished / handover
- No implementation item was intentionally left unfinished.
- Before merge, the Director should run the canonical `npx tsx tests/shelfFormat.test.ts`, the repository `npx tsc --noEmit -p tsconfig.json`, relevant kernel tests, and `tools/guard.mjs`/`verify_return.py` against the full repository. The full project type check remains unverified in this mini-base environment.
