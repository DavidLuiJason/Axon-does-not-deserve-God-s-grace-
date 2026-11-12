# Round 14 Continuation 3 — P6 / WP2 + WP5 + WP12 Storage and Recovery

## Package verdict

**State: DONE for the requested Node-provable storage, recovery, trust, approval and redaction checks.** Browser/Android persistence and real browser IndexedDB quota behaviour remain NOT RUN.

## What was proved

- **File-backed KeyValueStore:** a new source implementation stores canonical JSON records through an atomic file-host boundary, preserves `Uint8Array`, serializes same-process mutations, enforces a total-byte quota and verifies SHA-256 on every read.
- **Kill during save:** the test first commits an old record, starts a child Node process to update it, then the real file host fsyncs the temporary file and sends the child a real `SIGKILL` before rename. Reopening the store returns the old committed record; the torn update is not published.
- **Interrupted import:** the real `IndexedDbProjectExtractionSink` and `IndexedDbProjectReader` run against the vendor's `fake-indexeddb` implementation. A second import is interrupted after writing only a partial chunk; a reconstructed reader still sees the previously committed project version because the active pointer was not advanced.
- **Two-tab conflict:** two independent `IndexedDbKeyValueStore` / `IndexedDbWorkspaceFileStore` instances share one `fake-indexeddb` database. The first compare-and-write succeeds; the stale second tab is refused.
- **Quota:** the file-backed store refuses an over-quota replacement without replacing the committed value. A concurrent two-key quota test proves the global quota check is serialized and only one write is admitted.
- **Corruption:** tampering with the persisted JSON payload without updating its SHA-256 is detected on read.
- **Workspace trust:** unknown and mismatched projects resolve to `RESTRICTED`; only a matching, valid, unexpired trust record resolves to `TRUSTED`.
- **Approvals:** exact-request approval is consumed once; replay, cross-project use and changed-request use are refused.
- **Secrets corpus:** synthetic GitHub, AWS, bearer, private-key, URL-password and refresh-token patterns are checked across logger records, diagnostics, diagnostic exports and crash reports.

The redaction corpus exposed a real defect: a refresh-token key embedded in a JSON-encoded crash message was not redacted because the text pattern did not accept a quoted key. The text pattern was corrected to accept quoted JSON keys, and the regression test now passes.

## Test evidence

| Measure | Result |
|---|---:|
| P6 targeted tests | 12 |
| Passed / failed / skipped | 12 / 0 / 0 |
| Negative tests | 7 (58.3%) |
| Real compiled-module mutant caught | YES — removing the real file-store SHA-256 guard allows the mutated store to return tampered content |
| IndexedDB engine | `fake-indexeddb` 6.2.8 (Node-only polyfill) |
| File operations | Real Node filesystem; real child process killed with SIGKILL |

## FAKE_BOUNDARY / NOT RUN

- `fake-indexeddb` is the explicitly requested Node IndexedDB polyfill. It proves the real `IndexedDbKeyValueStore`, `IndexedDbWorkspaceFileStore` and project sink logic against the IndexedDB API, but **does not prove Chromium, Android WebView or device persistence**.
- `fake-indexeddb` does not emulate browser quota pressure. The app-enforced quota was tested on the real file-backed store; real browser IndexedDB quota-exceeded behaviour is **NOT RUN**.
- Chromium/browser lifecycle and Android device process-death recovery are **NOT RUN**.
- The Node file host uses actual filesystem reads, fsync, atomic rename and process kill; it is not a storage fake.

## Commands and counts

- `npm run typecheck` — exit 0.
- `npm run build` — exit 0.
- `node --test tests/r14-wp02-wp05-wp12-storage-recovery.test.mjs` — exit 0; 12/12 passed; 0 failed; 0 skipped; 7 negative tests; real mutant caught.
- Before P6: **1,211/1,211** retained Node tests passed.
- After P6: all 41 files matching `tests/*.test.mjs` were run serially with `node --test <file>` in separate processes — **1,223/1,223 passed; 0 failed; 0 skipped**.
- Clean-copy delta verification: all P6 replacement base hashes matched; `npm run typecheck` and `npm run build` passed; P6 targeted tests passed 12/12; the full 41-file suite again passed **1,223/1,223**, with 0 failures and 0 skips.
- Clean-copy delta verification: all P6 replacement base hashes matched; `npm run typecheck` and `npm run build` passed; P6 targeted tests passed 12/12; the full 41-file suite again passed **1,223/1,223**, with 0 failures and 0 skips.

Full machine evidence is in `results/r14-full-regression-per-file.json` and `results/r14-full-regression-summary.json`. P6-specific evidence is in `results/r14-p6-storage-recovery.json`.

## Files changed

- Added `src/storage/fileBackedKeyValueStore.ts` and exported it from `src/index.ts`.
- Added `tests/r14-wp02-wp05-wp12-storage-recovery.test.mjs` and the real Node file-store host helper.
- Updated `src/security/secretRedactor.ts` to redact quoted JSON secret keys.
- Added machine-readable P6 and full-regression result files.
- Updated the ledger, derived capability registry, manifest, checksums and merge set.

## Closing — what this prompt missed

The prompt asks for IndexedDB quota proof but the mandated Node polyfill does not model browser quota enforcement. This package proves the real configured file-store quota and leaves real browser IndexedDB quota pressure explicitly NOT RUN for Chromium/device validation.
