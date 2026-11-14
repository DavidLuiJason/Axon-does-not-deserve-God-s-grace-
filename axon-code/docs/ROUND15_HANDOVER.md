# AXON Code — Round 15 Handover (Continuation 5)

**Builder:** ChatGPT. **Director:** Claude. **Scope:** AXON Code only. **Base:** `AXON_CODE_R14_DIRECTOR_BASE_3.zip` plus vendor pack V2. **Q0:** SKIPPED — `axon-code-ci-results.zip` was not attached.

## What is proven

- Start gate: `npm run build` passed; the full suite was run in the background with `nohup node --test tests/*.test.mjs`. Exact baseline: **1,317 tests, 1,317 pass, 0 fail, 0 skipped**. The vendor archive preserved esbuild executable mode 755.
- After Q1–Q8 and clean-base reapplication: **1,381 tests, 1,381 pass, 0 fail, 0 skipped**; `npm run typecheck`, `npm run build`, and repeated deterministic UI builds passed.
- `npm run verify:director` also passed all 1,381 tests serially across 58 files and verified 314 hashes, 313 manifest entries, 312 merge files and the 1,231 ratchet. Overall verifier status is **BLOCKED only by clean `npm ci`** (`ENOTCACHED` plus registry DNS failure), not by tests or integrity checks.
- Q1: real Linux child-process SIGSTOP/SIGCONT was measured using `/proc/<pid>/stat`; paused CPU ticks remained unchanged, resumed CPU ticks advanced, and SIGTERM/SIGKILL cleanup was observed. The background queue passed concurrency, per-owner quota, global cap, priority/fairness and 1,000-job lifecycle tests; 1,000 real child-process spawn/cancel cycles left no retained child/timer resources.
- Q2: Node v22.16.0 `--permission` with project-only read, scratch-only write, no child-process/worker/addon grants, bounded output/time, and a sanitized environment ran real `node --test` files. Isolation grade: **process-level permission confinement**, not an OS sandbox.
- Q3: strict LSP framing rejected malformed/duplicate headers, oversized lengths, truncated frames, out-of-order/duplicate responses and notification floods; a no-response server timed out and was terminated. The real TypeScript language-server suite also passed.
- Q4: the real preview server injected a nonce-bound console/error bridge. jsdom captured console and runtime errors; the host accepted only matching origin and iframe source and bounded the event channel. WebView behaviour: NOT RUN.
- Q5: all nine documented gateway operation examples were executed against `AxonCodeJobGateway`; a real child process was paused, resumed and cancelled. Every source HTML element ID was checked against the built UI.
- Q6: Node-measured performance budgets passed. The measured figures are in `docs/Q6_PERFORMANCE_MEASUREMENTS.json`; guest WASM memory is not total process RSS.
- Q7: Android foreground-service, notification channel/actions and SAF source were added; FAKE_HOST contract tests passed. FAKE_HOST is not provider evidence.

## What is not proven

- Android device / Android 11 execution: **NOT RUN**. No APK was built, installed or launched.
- Android foreground service lifecycle, notification permission behaviour, notification pause/cancel actions and persisted SAF grants: **NOT RUN** on a real Android host.
- WebView preview console bridge and browser mount of the full workbench: **NOT RUN** in this continuation.
- The Android background service's `JobActionDispatcher` must still be registered by a real host integration. A source declaration and FAKE_HOST contract do not prove the dispatcher is wired.
- Node permission confinement is not a kernel/OS sandbox. It does not provide a hostile-native-code isolation boundary.
- WASM worker memory metric is guest linear memory only. It is not worker RSS or phone RAM.
- AXON main-app wiring, Tools tile activation, and Tools-to-Brain capability ID mappings remain OPEN for the other Directors.
- Q0 cloud-browser CI logs could not be reviewed because the optional results ZIP was not supplied.
- Competitor trials against Termux, Pydroid 3 and Acode: **NOT RUN**. No superiority claim is made.

## Capability registry counts

The authoritative registry was derived from **247 machine-result records** in `results/` and contains **77 capabilities**:

| Status | Count |
|---|---:|
| TESTED | 44 |
| BUILT | 2 |
| BLOCKED | 12 |
| NOT RUN | 19 |
| NOT IMPLEMENTED | 0 |
| **Total** | **77** |

These are whole-project registry totals, including historical Round 14 evidence and Continuation 5 results. No capability is upgraded to Android/device TESTED from source-only or FAKE_HOST evidence.

## Next device verification

Use `docs/DEVICE_PROOF_CHECKLIST.md` only after the owner supplies a signed, installable Android build and the screen/host integration is wired. Record PASS, FAIL or NOT AVAILABLE for each step; preserve logs and device details. Phone performance, Android background survival and competitor comparison remain unmeasured until that evidence exists.
