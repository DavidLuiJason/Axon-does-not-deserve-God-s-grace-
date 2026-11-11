# AXON Code Round 14 — WP3 continuation delta report

**State:** WP3 PARTIAL. This is a continuation delta, not a Phase A or Phase B completion package.  
**Scope:** `axon-code/` only. No AXON main-app source was edited.

## Baseline freeze (§2.1)

The progress ledger records the original Round 12 archive as SHA-256 `f0482b17075b779481d19b1c815215af698eccbdb9e3e16413f58c54fef2becd`, 425 files, and 424/424 historical hashes verified. This continuation was instructed to use only the checkpoint merge ZIP; the original Round 12 ZIP was not attached, so I did not independently repeat that original archive extraction. The checkpoint merge ZIP is a merge subset, not a replacement full Round 12 archive.

## Work-package results

| Work package | State | Tier | Tests added | Checks passed | Negative tests | Mutant caught | BLOCKED / NOT RUN |
|---|---|---:|---:|---:|---:|---|---|
| WP0 / C1 | BLOCKED | T1 | 1 new migration test (17 cumulative WP0 checks recorded) | 11/11 in `r14-wp00-baseline.test.mjs` | 1 new negative migration/rollback check | Yes | Clean `npm ci` still BLOCKED: no verified TypeScript 5.8.3 integrity/tarball; prior offline `ENOTCACHED`, registry DNS failure. |
| WP3 / CodeMirror workbench | PARTIAL | T1 | 3 | 3/3 static engine/endpoint tests | 1/3 | Yes | Actual Chromium CodeMirror/xterm mount NOT RUN because browser navigation returns `ERR_BLOCKED_BY_ADMINISTRATOR`. Required rename/move/clear/cut/paste/share/download controls are not all complete. |
| WP4 / xterm terminal | PARTIAL | T1 | 0 dedicated lifecycle tests | 0 full acceptance checks | 0 | No | Host bootstrap, two independent sessions, process listing, safe kill, reconnect and editor-to-terminal `open` workflow remain incomplete. The adapter speaks the existing PTY provider's session/data/resize/exit protocol. |
| WP7 / Pyodide assets | PARTIAL | T1 | 2 | 2/2 vendor asset tests | 1/2 | Yes | Actual CPython Worker execution and optional offline-pack installation/removal in a real browser/WebView NOT RUN. The real vendor distribution is available as a dependency; it is not copied into the 8 MB merge set. |

Unchanged packages: WP1 DONE; WP2 PARTIAL; WP5 PARTIAL; WP12 PARTIAL; WP14 BLOCKED. Android-native WP9 and all Android host capabilities remain NOT RUN. Phase A is BLOCKED, and Phase B is IN_PROGRESS.

## Exact commands and results

| Command | Exit / result |
|---|---|
| `npm run typecheck` | 0 — PASS (host-global TypeScript 5.8.3) |
| `npm run build` | 0 — PASS (host-global TypeScript 5.8.3) |
| `npm test` | 0 — 1,114/1,114 passed; 0 failed; 0 skipped |
| `npm run verify:director` | 2 — BLOCKED only by clean-install evidence; all other verifier checks pass |
| `node tools/derive-capability-status.mjs` | 0 — 26 capabilities derived from 171 result records |
| `python3 tests/round12-workbench-ui.integration.py` | 0 — 9/9 retained UI checks; this suite uses test-only storage/engine shims and is not proof of real engine mounting |
| `python3 tests/round12-browser-runtime.integration.py` | 0 — 6/6 browser runtime checks |
| `python3 tests/r14-wp02-wp12-browser.integration.py` | 0 — IndexedDB reload and job-recovery rows are both NOT RUN due Chromium navigation policy |
| `python3 tools/test-round12-pty.py` | 0 — PASS |
| `python3 tests/test-r14-pty-websocket.py` | TIMEOUT — did not finish within 120 seconds in this continuation; prior checkpoint evidence is not re-labelled as a fresh pass |
| `npm run verify:browser` | TIMEOUT — did not finish within 120 seconds; its result file records two PASS suites and IndexedDB NOT RUN |

## Capability registry and budget

- Registry: 26 capabilities — 14 TESTED, 8 NOT RUN, 4 BLOCKED.
- Result records: 171.
- Merge set: 204 files, 1,572,277 bytes; limit 600 files / 8,388,608 bytes — PASS.
- Files over budget: none.
- Manifest: 205 entries. SHA-256 file: 206 entries, zero mismatches in `verify:director`.
- `dist/` and `node_modules/` are excluded from the delta ZIP.

## Deviations from this prompt

1. Phase A was not completed before beginning the requested vendor-engine wiring. WP0 clean-install and WP2 IndexedDB evidence are blocked by environment constraints; WP5 quota/isolation work is still incomplete. The vendor pack was integrated to make useful progress on the explicitly requested CodeMirror/xterm/Pyodide work, but this is a phase-order deviation and is recorded as such.
2. The original Round 12 ZIP was not attached in this continuation; the ledger's prior baseline freeze was retained rather than reconstructed.
3. Real CodeMirror/xterm UI mounting and Pyodide CPython execution are NOT RUN; static tests and package-asset inspection are not substituted for those host proofs.
4. No competitor trials were run. No superiority claim is made.

## What this prompt missed

The prompt does not define the host-side `window.axonCodeHost.startTerminal` contract, including its exact input/output schema and lifecycle for launching, authenticating, reconnecting and terminating the bridge. It also does not define the exact semantics and approval rules for every workbench file operation (especially move, rename, share and delete). These must be frozen before the remaining WP3/WP4 controls can be completed safely.
