# AXON Code Round 14 — Continuation 5 Final Builder Report

**Builder:** ChatGPT. **Base:** `AXON_CODE_R14_DIRECTOR_BASE_3.zip`. **Vendor:** V2 with executable permissions preserved. **Date:** 2026-11-14. **Scope:** AXON Code only. **Q0:** SKIPPED because `axon-code-ci-results.zip` was not attached.

## Start gate and regression

- The Director-approved start baseline was **1,317 tests, 1,317 pass, 0 fail, 0 skipped**. The start gate used `npm run build` and the full suite in the background. The copied esbuild binary retained mode `755`; no project change or ratchet adjustment was needed to fix the previous `EACCES` environment problem.
- The ratchet remains **1,231**. It was not changed.
- After Q1–Q8, `npm run typecheck` passed, `npm run build` passed, and two repeated `node tools/build-ui.mjs` runs produced identical size reports and asset SHA-256 hashes.
- Final exact suite command: `nohup node --test tests/*.test.mjs > /tmp/r14c5-final-full.txt 2>&1` — **1,381 tests, 1,381 pass, 0 fail, 0 skipped** (58 test files; 61,402.20 ms).
- Q1–Q8 package suites add **64 tests**, all passed. There are **35 negative tests** and **8/8 real compiled-module mutants caught**.
- `npm run verify:director` completed its serial per-file run: **1,381/1,381 pass across 58 files**. Its overall status is **BLOCKED, not FAIL**, solely because clean offline `npm ci` returned `ENOTCACHED` and the online registry probe failed DNS. It verified 314 hashes (0 bad), 313 manifest entries (0 missing), 312 merge files (2,208,162 bytes; 0 forbidden), the 1,231 ratchet, import boundary, registry status validity and merge budget.

## Per-package report

| Package | State | Tests | Negative | Real mutant | Result / remaining limit |
|---|---|---:|---:|---|---|
| Q1 — Cancel, Pause, Background | PARTIAL | 16/16 | 5 | YES | Real Linux SIGSTOP/SIGCONT, workspace user control over AXON jobs, explicit AXON permission/audit, fair bounded queue, 1,000 real child spawn/cancel cycles. Android and Pyodide/WASM pause remain NOT RUN/NOT_SUPPORTED. |
| Q2 — Confined Project Tests | PARTIAL | 10/10 | 7 | YES | Real `node --test` under Node v22.16 permission model, project read/scratch write, sanitized environment and time/output caps. Process-level permission confinement only, not an OS sandbox. |
| Q3 — LSP Hostile Frames | TESTED | 9/9 | 8 | YES | Strict bounded frame decoder; malformed/oversized/truncated/out-of-order/duplicate/flood/no-answer cases rejected; real TypeScript LSP regression remains green. |
| Q4 — Preview Console Bridge | PARTIAL | 7/7 | 5 | YES | Real preview server + nonce-bound console/error bridge tested in jsdom; exact source/origin/token checks and volume caps. Android WebView NOT RUN. |
| Q5 — Integration and Screen Contract | PARTIAL | 5/5 | 2 | YES | All nine gateway operation examples executed; every source and built UI element ID checked. Two AXON-side IDs remain OPEN. |
| Q6 — Performance Budgets | PARTIAL | 6/6 | 2 | YES | Node provider start, WASM guest memory, UI bundle size and queue throughput measured. Phone performance NOT RUN. |
| Q7 — Android Background Sources | PARTIAL — SOURCE ONLY | 7/7 | 3 | YES | Foreground service, notification channel/actions and SAF source; FAKE_HOST contract only. No Gradle/APK/device run; dispatcher registration remains OPEN. |
| Q8 — Round 15 Handover | PARTIAL | 4/4 | 3 | YES | Handover verifier and device checklist with ten named tasks, lifecycle proof and competitor protocol. Device and competitor trials NOT RUN. |

Package-specific reports: `docs/R14_Q1_REPORT.md` through `docs/R14_Q8_REPORT.md`.

## Performance evidence

From `docs/Q6_PERFORMANCE_MEASUREMENTS.json` on Linux x64 / Node v22.16.0:

- WASM provider start: **39.56 ms** (budget < 3,000 ms).
- WASM guest linear memory: **65,536 bytes** (budget ≤ 2,097,152 bytes).
- UI bundle: **14,795,325 bytes** (budget ≤ 16,777,216 bytes).
- Queue: **500 jobs in 47.77 ms**, **10,466.19 jobs/s** (budget > 100 jobs/s).

Memory is guest WASM linear memory, not total worker RSS or Android RAM. Phone performance is **NOT RUN**.

## Capability registry

The registry was derived from **247 machine-result records** and contains **77 capabilities**: 44 TESTED, 2 BUILT, 12 BLOCKED, 19 NOT RUN, 0 NOT IMPLEMENTED. These are whole-project totals, including earlier Round 14 evidence.

## Files, deltas and clean reapply

- The combined Continuation 5 delta was reapplied to a fresh extraction of Director Base 3 after verifying every `BASE_HASHES.txt` entry. Vendor `node_modules` retained esbuild mode 755. `npm run typecheck`, `npm run build`, and the UI build passed; the clean-base full suite passed **1,381/1,381, 0 fail, 0 skipped** (62,391.20 ms).
- Eight ordered package deltas are provided, each with only that package's changed/added files and `BASE_HASHES.txt` for replaced files.
- A Continuation 5 combined delta-only ZIP contains only the work from this continuation, common ledgers/reports, and the AXON Code workstream board. It does not contain earlier P1–P6/C4 implementation or `node_modules`.
- No `.github/workflows` files are included.
- Clean-base reapplication and its build/full-suite result are recorded separately in the final verification section after the package deltas are assembled.

## BLOCKED / NOT RUN summary

- Q0 cloud-browser CI logs: NOT AVAILABLE; optional ZIP absent.
- Android Gradle build, APK/AAB, installation, physical device, foreground-service lifecycle, notification actions and SAF grants: NOT RUN.
- Android WebView preview bridge: NOT RUN.
- Termux, Pydroid 3 and Acode competitor trials: NOT RUN. No superiority claim is made.
- Formatter remains BLOCKED because no formatter package was supplied.
- Project test runner has Node permission confinement but is not an OS sandbox; native hostile-code isolation is not proven.
- The clean npm install limitation from Continuation 4 remains: the offline clean install returned `ENOTCACHED` for the TypeScript 5.8.3 tarball, and the online registry probe failed DNS resolution (`Could not resolve host: registry.npmjs.org`). Continuation 5 did not alter dependencies or claim this gate passed.

## What this prompt missed

The prompt did not provide the actual AXON Tools screen-routing capability ID or the AXON-side background dispatcher contract. Those mappings are left `OPEN` in the integration contract rather than invented. It also asked for Android foreground-service source but did not provide a real Android host registration interface; `JobActionDispatcher.current` is an explicit registration hook and is not wired by this source-only package. Device proof and competitor comparison require an owner-supplied signed build and a physical device.
