# AXON Code Round 14 — WP3 continuation delta report

**Scope:** Continue from the merged `axon-code/` checkpoint ledger. This delta advances WP3 only. It does not declare Phase B complete and does not change the AXON main app.

## Work-package result

| Work package | State | Tier | Tests added this delta | Checks passed | Negative tests | Mutant caught | Blocked / not run |
|---|---|---:|---:|---:|---:|---|---|
| WP3 Workbench | PARTIAL | T1 | 22 | 22/22 | 13 | Yes | Real CodeMirror/xterm browser mount and live click interactions NOT RUN; Chromium harness timed out, with the prior `ERR_BLOCKED_BY_ADMINISTRATOR` navigation restriction still in force. |

## Implemented

- Added explicit Rename and Move controls. Rename is constrained to the same directory; Move changes the project-relative path.
- Added a pure preflight planner that rejects traversal, absolute paths, backslashes, invalid portable names, missing sources, collisions, no-op operations and incorrect rename/move semantics.
- File relocation writes the destination and source tombstone in one IndexedDB read-write transaction. Dirty content is saved before relocation. The active buffer and tab path are then updated.
- Added Clear, Select all, Copy, Cut, Paste, Download and Share controls, each with an event handler.
- Copy/Cut/Paste fail visibly when the relevant Clipboard API permission is unavailable. Cut requires an actual selection. Share uses the native file share API when available and falls back to ZIP export.
- Added the corresponding command-palette actions.
- Added a CodeMirror clear operation; no textarea editor fallback was introduced.

## Exact commands and results

| Command | Exit | Result |
|---|---:|---|
| `npm run verify:director` | 2 | BLOCKED as expected from ledger: clean `npm ci` cannot be proven because TypeScript 5.8.3 package integrity is unavailable and registry DNS failed. Existing verifier checks pass; no package/network workaround was fabricated. |
| `npm run build` | 0 | PASS |
| `node --test tests/r14-wp03-control-wiring.test.mjs tests/r14-wp03-file-operations.test.mjs` | 0 | 22/22 PASS; 13 negative tests; deliberately broken path-validation and control-binding mutants detected. |
| `npm test` | 0 | 1,136/1,136 Node tests PASS; zero failures; zero skips. |
| `npm run typecheck` | 0 | PASS |
| `npm run status:derive` | 0 | PASS — 27 capability statuses derived from 173 machine result records. |
| `npm run verify:director` (after refreshed manifest/checksums) | 2 | BLOCKED only by the pre-existing clean-install gate; 1,136/1,136 Node tests, typecheck/build, import boundary, honesty scan, manifest, hashes, registry and merge budget pass. |
| `python3 tests/round12-workbench-ui.integration.py` | 124 / timeout | NOT RUN to completion. The command was terminated by the 120-second execution limit. Existing browser evidence documents Chromium navigation failure `ERR_BLOCKED_BY_ADMINISTRATOR`; no real engine mount or user interaction is claimed. |

The exact browser mount remains NOT RUN. Static source assertions prove the controls exist and have handlers; they do not prove successful runtime interactions in Chromium.

## Registry and budget

- The capability registry is regenerated from `results/*.json` only.
- The refreshed merge set contains **209 files / 1,592,749 bytes**, within the 600-file / 8-MB limits. The source manifest has 210 entries and the checksum file has 211 entries (the manifest itself is hashed; the checksum file and generated verification summary are excluded). The delta contains source, tests, results, documentation and the progress ledger. It excludes `dist/`, `node_modules/` and `docs/history/`.

## Deviations

- No new dependencies were added. The exact vendor engine versions already exist in the merged package manifest and lockfile.
- WP3 remains PARTIAL because real browser mounting and interaction evidence are unavailable. No static test was promoted to browser proof.
- WP4 has not been advanced; work stopped at the WP3 continuation checkpoint.

## What this prompt missed

The prompt requires each visible control to be tested with a real browser, but the execution host blocks Chromium navigation. A browser-enabled verification host is required to finish that acceptance criterion. It also does not specify whether file sharing should require a separate confirmation for sensitive files; existing export sensitivity confirmation is reused for ZIP fallback, while native share uses the platform share sheet.
