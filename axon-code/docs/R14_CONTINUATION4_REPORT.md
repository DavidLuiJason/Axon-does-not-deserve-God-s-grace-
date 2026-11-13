# AXON Code — Round 14 Continuation 4 Report

Date: 2026-11-13  
Role: ChatGPT builder; Claude remains Director/verifier.

## Start gate and regression

The Director's ruling accepted the correct baseline as 1,231. The two environment-dependent file-level failures in the earlier 1,209 sandbox were replaced by the 24 real jsdom/fake-indexeddb tests: `1,209 - 2 + 24 = 1,231`. `tests/ratchet.json` now has `minimumNodeTests: 1231`.

- Vendor dependencies adopted exactly: `esbuild@0.28.2`, `fake-indexeddb@6.2.8`, `jsdom@31.0.0`, `typescript-language-server@6.0.3` as devDependencies.
- `npm ci --ignore-scripts --dry-run`: PASS, but this is not a full install. A real isolated `npm ci --offline --ignore-scripts` attempt was BLOCKED (exit 1): `ENOTCACHED` for `https://registry.npmjs.org/xmlchars/-/xmlchars-2.2.0.tgz`; the current npm cache has no copy. The existing dependency migration also records that TypeScript 5.8.3 has no verified lockfile integrity hash. The package manifests and lock entries are adopted, but a clean install is not claimed.
- Baseline after dependency adoption: 1,231/1,231 PASS, 0 failed, 0 skipped. The exact full-suite command completed in a background runner.
- Final `npm run build`: PASS.
- Final exact command `node --test tests/*.test.mjs`: 1,313/1,313 PASS, 0 failed, 0 skipped (68.9 seconds; background runner output captured). The independent sequential per-file runner also reports 1,313/1,313 across 49 files (79.7 seconds).
- Seven package suites: 82/82 PASS, 55 negative tests. P7 12/12; P8 14/14; P9 9/9; P10 14/14; P11 6/6; P12 23/23; P13 4/4.

## P7 — WP14 UI packaging

**State: PARTIAL.** esbuild bundles CodeMirror, xterm and workbench glue into hashed JS/CSS. The import map and inline scripts are removed; no bare package imports remain. All five required offline Pyodide assets are copied with SHA-256 hashes. Two independent clean builds produced identical hashes. Bundle size: 14,795,325 bytes; budget: 16,777,216 bytes. The loopback static server confines paths and refuses encoded traversal, dot segments, malformed encodings, NUL, symlink escapes and non-loopback binding. jsdom checks all control IDs. One real compiled-module mutant removing the symlink check was caught.

**Not run:** Chromium engine mount and actual button interaction; Android WebView.

## P8 — WP8 WASM provider

**State: PARTIAL.** Real plain WASM and a hand-authored WASI `fd_write` hello-world fixture execute in `worker_threads`. Tests cover non-terminating CPU kill, declared memory maximum, output cap, arbitrary host import refusal, separate workers and invalid module inputs. WASI receives only the explicit `/workspace` preopen. Isolation grade is T1 worker-thread isolation, not an OS sandbox. A real compiled-module mutant removing the module-size check was caught.

**Blocked:** Native compiler provider. Host probes found `/usr/bin/gcc`, `/usr/bin/g++`, `/usr/local/go/bin/go`; `rustc` is absent. No AXON Code native compiler provider with timeout and OS process confinement exists, so no compiler was invoked. OS-level filesystem/process isolation is not proven.

## P9 — WP11 managed preview

**State: PARTIAL.** Per-instance loopback virtual-file preview server with path checks, CSP, frame restrictions, fixed MIME, `nosniff`, file/byte caps and repeated clean start/stop. A real compiled-module mutant removing the project-size cap was caught. Console/error events have bounded recording methods, but are not yet connected to a browser iframe message channel.

**Not run:** Chromium and Android WebView.

## P10 — WP13 project services

**State: PARTIAL.** Bounded literal text search skips binary and oversized files, refuses unsafe query strings, skips symlinks, opens files with `O_NOFOLLOW`, and caps file count, total bytes and directory depth. Real TypeScript language service provides semantic diagnostics, definitions, references and rename preview with conservative declaration-conflict refusal. A real compiled-module mutant removing unsafe-query refusal was caught.

**Blocked:** Project `node --test` execution is deliberately refused because OS-level process confinement is unavailable. Formatter is BLOCKED because no formatter package exists in Vendor Pack V2.

## P11 — WP10 language server

**State: PARTIAL.** Real `typescript-language-server@6.0.3` process completed initialize, open, change, diagnostics, completion, hover, definition and shutdown. A real process crash was followed by one restart. Oversized outbound messages are refused and stop kills the process. A real compiled-module mutant removing the outbound-size guard was caught.

**Incomplete:** Malformed/oversized inbound frames and out-of-order response rejection do not yet have direct hostile-frame fixtures; these must not be treated as verified.

## P12 — WP1/WP5/WP12 Brain Gateway and jobs

**State: PARTIAL.** Independent JSON gateway with a file-backed job store; complete-request hash-bound single-use approvals; expiry and atomic consumption; caller/scope/permission checks; audit of successful and refused calls; owner and `origin` (`user`/`AXON`); payload quota, deadline and output cap; job status/results/cancel and interrupted recovery. A real compiled-module mutant removing the permission check was caught. A running job cancellation test confirms the executor receives an abort signal and the persisted state remains cancelled. The TypeScript contract now lists all nine requested operations.

**Incomplete/blocked:** Existing Node, Pyodide and WASM providers are not yet wired into a production dispatcher; host project-inspection/export adapters must be supplied. Pause and resume return `NOT_SUPPORTED` because no process suspension/checkpoint adapter is configured. Android background execution needs a native foreground service and remains NOT RUN.

## P13 — WP9/T3 Android sources

**State: BUILT, SOURCE ONLY.** Added Gradle project skeleton and Capacitor `MainActivity`; existing Capacitor SAF plugin source is retained. Four source-contract tests pass. No APK is claimed. No compiled Kotlin mutant was run because Android toolchain prerequisites are absent.

**Not run:** `gradle` is not installed; `ANDROID_HOME` and `ANDROID_SDK_ROOT` are unset. Android plugin compilation, SAF on device, foreground service, APK build/install and WebView are all NOT RUN.

## Clean-base delta reapply verification

All ordered package, ledger/report, and workstream-board deltas were applied to a fresh extraction of `AXON_CODE_R14_DIRECTOR_BASE_2.zip`, followed by the vendor V2 `node_modules` copy. On that clean reapply, `npm run build` passed and the exact `node --test tests/*.test.mjs` command passed 1,313/1,313 with 0 failures and 0 skips (78.6 seconds). The re-applied source tree matched the working source tree; all 271 SHA-256 entries verified, all 270 merge-set paths existed, and no `.github/workflows` path was included.

## Hostile-project coverage

- P7: encoded dots/slashes, malformed encodings, dot segments, NUL, symlink escape, non-loopback binding.
- P8: invalid modules, arbitrary host imports, memory maxima, infinite CPU, output cap and separate workers; WASI preopens one workspace. No OS sandbox claim.
- P9: absolute/dot/encoded paths, control characters, file-count and byte limits. No ZIP extraction or filesystem-backed project serving.
- P10: symlinks, binary files, oversized files, file-count/byte/depth caps, control characters and `O_NOFOLLOW` file open; search is literal-only.
- P11: oversized outbound frames and a crashed process. Inbound malformed/out-of-order direct fixtures NOT RUN.
- P12: approval replay, altered caller/request, wrong project/scope, expiry, concurrent use, permissions, owner, quotas, deadlines, output cap and restart recovery.
- P13: source contract only; Android runtime hostile-project cases NOT RUN.

## Director approval context

Parallel workstreams are AXON Web, Tools-to-Brain, AI Studio screens, and AXON Apps/Games. This builder changed only `axon-code/` plus `workstreams/AXON_CODE.txt`; the AXON main app and all other workstream files remain out of scope. The product architecture must remain job service/provider first and screen second; P7 packaging is a Node-proven shell, not proof of a working browser mount.

## What this prompt missed

The prompt did not specify a minimum Node.js version for the supplied vendor set. The host is Node `v22.16.0`, while `typescript-language-server@6.0.3` declares Node `>=22.22.2` and some transitive packages declare `>=22.19.0`; npm emits `EBADENGINE` warnings even though the real LSP tests passed here. The prompt also did not supply a verified TypeScript 5.8.3 registry integrity artifact or an npm cache containing `xmlchars@2.2.0`, so a clean offline `npm ci` remains BLOCKED.

The seven packages are delivered in Node-provable scope with honest BLOCKED/NOT RUN boundaries. They are not all complete: browser mount, Android execution, OS-level confinement, native compiler execution, formatter, confined project test runner, full provider dispatch, preview event bridge and host pause/resume remain open for Director review.
