# C18 — My Dictionary (UD1) engine report

## Result and evidence labels

**PARTIAL DELIVERY — NOT READY FOR MERGE.** The three engine files and three test files are present, and the focused engine type-check and directly runnable tests pass. The repository's own project type-check could not run because the supplied ZIP's dependencies are incomplete. Also, `parseImportChunks` currently produces progress yields after `parseImport` has completed; it does not yet interrupt parsing at each 1,000-row boundary. That sub-requirement is unfinished, so do not merge until it is corrected and re-tested.

## Top view

AXON's finished architecture is the Android assistant with the permanent English dictionary, a shared knowledge slot, a staged brain, and truthful tested tools. C18 belongs in user data and adds a second, separate dictionary source. Later risks are import safety, storage/schema changes, memory on low-tier phones, and future combination through the knowledge slot. This implementation does not wire into the brain or alter the English dictionary.

## LAW CHECK (FL11)

- **FL1:** Located this job in the complete v16.8 architecture before choosing the design.
- **FL2:** Read all 103 lines of the supplied v16.8 roadmap, including section 3 (the prompt's Part 00); inspected all named base contracts.
- **FL3:** Uses the knowledge slot and versioned user-data pattern to preserve later integration.
- **FL4:** Worked in the requested priority order; the incremental chunk/cancel behavior remains unfinished and is disclosed rather than hidden.
- **FL5:** English dictionary is never edited or removed.
- **FL6:** Owner data is searchable and bounded to 20,000 entries and 3 MiB serialized; no lossy compression. Trade-off: imports/exports are subject to explicit caps and ZIP contents must be extracted to read.
- **FL7:** Only claims supported by commands run are marked MEASURED; unavailable checks are marked NOT RUN.
- **FL8:** No source export or repository synchronization was performed in this engine-only lane.
- **FL9:** Kept this work in the tool-engine stage, before brain integration.
- **FL10:** Exports `MY_DICTIONARY_DESCRIPTOR`; does not edit menu or capability registry.
- **FL11:** This law check is included and must accompany the returned report.
- **FL12:** Adapter implements the existing `KnowledgeBackend`; it is not wired into the brain.
- **FL13:** No fixed phrase list was added to the brain; descriptor examples are documentation only.
- **Rule 1:** Kept the job to three engine modules and three focused tests; the repository's full toolchain could not be restored in this sandbox.
- **Rule 2:** Reused the established knowledge slot, word book, tool store, ZIP and CSV interfaces.
- **Rule 3:** Added a separate user-data source rather than changing the core dictionary.
- **Rule 4:** Built and tested in small modules; no screen work.
- **Rule 5:** Stayed in the planned tools stage.
- **Rule 6:** Ran focused tests and a strict targeted TypeScript check; full project proof remains blocked.
- **Rule 7:** Applies entry, file, row and serialized-store limits without lossy compression. Trade-off: the owner must split data exceeding those caps.
- **Rule 8:** Uses bounded sizes and list limits for low-memory Android devices.
- **Rule 9:** No repository push or merge was attempted; this is a delta ZIP.
- **Rule 10:** Did not edit or replace the roadmap.
- **Rule 11:** Keeps the backend interface compatible with later knowledge-source composition.
- **Rule 12:** No guards, locks or existing tests were weakened.
- **Rule 13:** All returned paths are relative to repository root and no new dependency is introduced.

## Files created (only files in the lane)

- `src/tools/engines/dictionary/userDictionary.ts`
- `src/tools/engines/dictionary/userDictionaryImport.ts`
- `src/tools/engines/dictionary/userDictionaryBackend.ts`
- `tests/userDictionary.test.ts`
- `tests/userDictionaryImport.test.ts`
- `tests/userDictionaryBackend.test.ts`
- `docs/reports/C18_REPORT.md`

No existing files were edited. No package.json changes are included.

## MEASURED commands and results

- `node --experimental-strip-types tests/userDictionary.test.ts` — PASS, 38 checks.
- `node --experimental-strip-types tests/userDictionaryImport.test.ts` — PASS, 24 checks. Used the installed JSZip copy at `/opt/nvm/versions/node/v22.16.0/lib/node_modules/pptxgenjs/node_modules/jszip` via a temporary sandbox-only symlink; no symlink is in the returned ZIP.
- `node --experimental-strip-types tests/userDictionaryBackend.test.ts` — PASS, 9 checks.
- `tsc -p /tmp/c18-tsconfig.json` — PASS, strict type-check of all three engine files and all three new test files using the installed Node type definitions and a temporary JSZip declaration. This is a targeted check, not the repository's own project check.
- `node --experimental-strip-types tests/toolStore.test.ts` — PASS, 67 checks.
- Independent Python calculation for the 20,001-row JSON fixture: 20,001 records; compact UTF-8 JSON size 668,925 bytes, below 5 MiB. The test measures the import behavior separately and expects a 20,000 accepted-row ceiling.
- Total checks reported by the three new tests: 71.

## NOT RUN / failed environment checks

- `npx --no-install tsc --noEmit -p tsconfig.json` — FAIL before project checking: TypeScript cannot find `vite/client`. The dependency install attempt timed out and left an incomplete `node_modules` tree.
- `npx --no-install tsx tests/userDictionary.test.ts` — NOT RUN to completion; command timed out while resolving the unavailable `tsx` executable.
- `node --experimental-strip-types tests/wordBook.test.ts` — NOT RUN successfully; native Node resolution fails on that existing test's extensionless import of `src/brain/dictionary/wordBook`. This is a runner limitation; no existing file was modified.
- The complete `test:kernel` script was NOT RUN because `tsx` is unavailable and project dependencies are incomplete.
- Phone/device behavior and cloud build: NOT RUN.
- `parseImportChunks` true incremental parsing/cancellation at every 1,000 rows: NOT COMPLETE; see result statement above.

## English dictionary integrity: SHA-256 before and after

Hashes below were calculated from the supplied BASE ZIP and the extracted working tree. All 10 files match exactly.

| File | Before SHA-256 | After SHA-256 | Result |
|---|---|---|---|
| `src/brain/dictionary/dictionary.ts` | `0d3f3d4d1f111c3ac993ce601d05624af78c179ea1e12c6502857769e24f622a` | `0d3f3d4d1f111c3ac993ce601d05624af78c179ea1e12c6502857769e24f622a` | SAME |
| `src/brain/dictionary/fetchReader.ts` | `998c861ae481d847eb2fb647ebf45f9eda988e3ca9cef13df9a631fdef90e680` | `998c861ae481d847eb2fb647ebf45f9eda988e3ca9cef13df9a631fdef90e680` | SAME |
| `src/brain/dictionary/index.ts` | `a4d05ed2a9754ca221afbd3ebef351c8313582bc7d3f5ee4e6e876ef3ac09ee6` | `a4d05ed2a9754ca221afbd3ebef351c8313582bc7d3f5ee4e6e876ef3ac09ee6` | SAME |
| `src/brain/dictionary/irregulars.ts` | `34161549671e1fa6b81b39a98377e3269abe82483353a53ea8df0de4e9ce122e` | `34161549671e1fa6b81b39a98377e3269abe82483353a53ea8df0de4e9ce122e` | SAME |
| `src/brain/dictionary/keys.ts` | `51b66f9e522e3ad70b0418b3f9e91ebd3d59a7a2947a5ab4e188f583291b0176` | `51b66f9e522e3ad70b0418b3f9e91ebd3d59a7a2947a5ab4e188f583291b0176` | SAME |
| `src/brain/dictionary/morphology.ts` | `6525d97a92e4c7df345485cf5a73144f644a0d038c4aee42648000d770696b4b` | `6525d97a92e4c7df345485cf5a73144f644a0d038c4aee42648000d770696b4b` | SAME |
| `src/brain/dictionary/packReader.ts` | `7d0afaff17d7f216a22efeb071abf933db70b8ac91b69ebbffd312b22bcc032b` | `7d0afaff17d7f216a22efeb071abf933db70b8ac91b69ebbffd312b22bcc032b` | SAME |
| `src/brain/dictionary/pickHeadword.ts` | `136cc136cd6586cb174b7f6138cc9bdf83b2ed4e4d3d890ba9d7c9eb911ef5c1` | `136cc136cd6586cb174b7f6138cc9bdf83b2ed4e4d3d890ba9d7c9eb911ef5c1` | SAME |
| `src/brain/dictionary/types.ts` | `56f5303f9e1a69fbb39e17b8b54d5e5558d0910d7520437a5e53e9abdad72f43` | `56f5303f9e1a69fbb39e17b8b54d5e5558d0910d7520437a5e53e9abdad72f43` | SAME |
| `src/brain/dictionary/wordBook.ts` | `ddee289c9659c7c8d553c75dac4de0c6c0b6ecab60c13a1ae5b99238fed63eaa` | `ddee289c9659c7c8d553c75dac4de0c6c0b6ecab60c13a1ae5b99238fed63eaa` | SAME |

## Exact `test:kernel` lines to add

Add these entries to the existing `test:kernel` script (do not edit package.json in this job):

```text
tsx tests/userDictionary.test.ts
tsx tests/userDictionaryImport.test.ts
tsx tests/userDictionaryBackend.test.ts
```

## Remaining work before acceptance

1. Make `parseImportChunks` genuinely incremental and cancellable, yielding between files and every 1,000 rows without first parsing the entire import.
2. Restore the project dependencies/toolchain and run the exact three `npx tsx` tests, the complete applicable `test:kernel` sequence, and `npx tsc --noEmit -p tsconfig.json`.
3. Rebuild the return ZIP after those checks pass.
