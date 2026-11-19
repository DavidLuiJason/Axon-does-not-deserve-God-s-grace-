# AXON CODE: WHAT RUNS WHERE (Director, 2026-11-14)

Written from the capability registry (77 rows: 44 TESTED, 19 NOT RUN, 2 BUILT, 12 BLOCKED at the time of writing) and a read of `ui/` and `src/`. "TESTED" below always means tested in Node on a desktop-class host unless a phone is named. Nobody has run any of it in a real browser or on a phone.

Three places code can run: **WebView** (the page inside the AXON Android app, no Node, no host programs), **Desktop host** (Node on Linux, real processes), **Android native host** (a native service, not built or run).

| Capability | WebView on the phone | Desktop host (Node) | Android native host |
|---|---|---|---|
| Edit files (CodeMirror), file actions, save, import, export | PARTIAL: logic tested in Node with a DOM; browser mount NOT RUN | tested | not needed |
| Durable workspace in the browser (IndexedDB) | NOT RUN (tested in Node with a fake) | tested | not needed |
| Run JavaScript | BUILT: Run/Stop, bounded stdin, output/status, fresh opaque-origin worker per run, 5 s timeout and 256 KiB output cap; real Chromium proof NOT RUN | n/a | n/a |
| Run Python (Pyodide) | NOT BUILT: only a Node-worker version exists and is tested; no browser-worker version, no Run button | tested (Node worker) | n/a |
| Run WebAssembly | NOT BUILT in the UI; the Node worker provider is tested | tested | n/a |
| Jobs list, pause, resume, cancel | PARTIAL BUILT: IndexedDB job state service and jobs panel; Cancel supported; Pause/Resume disabled with reason; multi-provider browser dispatch and real browser proof NOT RUN | tested | needs the foreground service (source only) |
| Terminal (xterm) | NOT AVAILABLE: needs a host process; the bridge is for a desktop Linux host | tested | NOT BUILT |
| Git, npm and pip adapters, confined project tests, debugger, language server | NOT AVAILABLE on a phone: they spawn real programs | tested | NOT BUILT |
| TypeScript diagnostics and symbol navigation | possible in the browser (the compiler is JavaScript) but NOT wired or run there | tested | n/a |
| Managed preview | the loopback server does NOT exist in a WebView; a page-based preview (iframe with an opaque origin) is NOT BUILT | tested (server) | n/a |
| Capability status, trust, approval | PARTIAL: engine tested; screen not built | tested | n/a |
| Brain gateway and job rules | engine tested; integration into the AXON app is OPEN | tested | n/a |

**What this means for the owner's goal.** To "go there and run some code" on the phone, the missing pieces are all in the WebView column: a Run path (JavaScript and Python in browser workers), an output panel, stop, a jobs list, and a low-memory budget. They are specified in `ROUND14_CONTINUATION6_PROMPT.md` and need a real browser to prove, which is what the cloud verify workflow and then the phone are for.

## Continuation 6 implementation checkpoint (2026-11-17)

- JavaScript browser Run/Stop and bounded stdin are present in the workbench and use the existing attested opaque-origin worker provider. Node contract tests pass. Chromium integration is NOT RUN because the Playwright Chromium executable is absent.
- Browser jobs are persisted in IndexedDB; the state machine, concurrency ceiling, per-owner quota, ownership rule and reload interruption are covered by fake-indexeddb tests. The workbench Run action currently starts one JavaScript job at a time; a real browser dispatch/queue proof is NOT RUN. Pause and Resume remain explicitly unsupported.
- Python-in-a-browser-worker is NOT BUILT. The existing opaque worker policy intentionally disables `importScripts` and network fetch; this continuation did not weaken that boundary or substitute a fake interpreter.
- Bundle measurement: initial JavaScript (834,327 bytes), lazy xterm chunks (432,996 bytes), Pyodide pack (13,532,188 bytes) and total assets (14,817,006 bytes) are measured in `build/ui/size-report.json`. Browser 4x CPU performance and phone measurements are NOT RUN.
- The Director's `docs/AXON_CODE_SCREEN_READINESS.md` was not present in the supplied base, so its table was not edited or recreated.
\n- Continuation 6 result derivation: `docs/CAPABILITY_REGISTRY.json` now contains 86 rows from `results/*.json`; browser/phone capabilities remain NOT RUN where no real browser/device evidence exists.\n