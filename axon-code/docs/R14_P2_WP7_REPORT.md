# Round 14 Continuation 3 — P2 / WP7 Real Pyodide Execution

## Package verdict

**P2 Node execution proof: DONE. Product/browser integration: PARTIAL / NOT RUN.**

The supplied Vendor Pack V2 contains the real Pyodide 314.0.7 distribution. The test runner loads that package from its local `node_modules/pyodide` directory inside a real Node `worker_threads` Worker. No Python imitation or fake interpreter is involved. The provider already accepted an injectable `PyodideWorkerFactory`; this package uses that seam with a real Node Worker adapter.

## Real execution evidence

The targeted suite executes the real CPython/WebAssembly runtime and proves:

- `print()` output and a separate returned expression value (`42`).
- Syntax errors and Python traceback context.
- Runtime errors and traceback.
- Caller-provided stdin through Python `input()`.
- An infinite loop is killed by the host wall-clock timeout after the program has started.
- Output byte cap stops excess output and terminates the worker.
- Source larger than 512 KiB is refused before a worker is created.
- Two executions use separate Workers; Python globals do not leak between runs.
- Files are read from and written back through the `/project` virtual directory.
- Host filesystem paths are not mounted; the Python `js` bridge does not expose Node `process`; socket-connect audit events and writes outside `/project` are denied.
- Unsafe workspace paths and working-copy access without an explicit project-scoped write provider are refused.

## Test evidence

| Measure | Result |
|---|---:|
| Targeted P2 tests (helper suite + existing provider/vendor suites) | 22 |
| Passed | 22 |
| Failed | 0 |
| Skipped | 0 |
| Negative tests | 10 |
| Real compiled-module mutants caught | 1 |

The real mutant test writes a temporary modified copy of the compiled `dist/runtime/pyodideWorkerProvider.js`, removes the actual 512 KiB source-size guard, and proves the mutated provider starts CPython with an oversized comment while the unmodified provider refuses it before creating a Worker.

## FAKE_BOUNDARY items

**None for P2 execution.** The Node worker_threads runner, Pyodide distribution, CPython execution, filesystem, stdin, stdout/stderr, timeout and worker termination are real. The tests do not use a fake worker or fake interpreter.

## Isolation grade and security limits

**Grade 1 — Worker/process separation.** This is not an OS-enforced sandbox and is not Grade 2 or Grade 3. The Node proof uses an empty JavaScript global bridge, an in-memory Pyodide filesystem, Python audit restrictions for socket operations and writes outside `/project`, and no host directory mounts. These controls are meaningful for the tested Node runner but do not create an OS security boundary against hostile native/WASM escape techniques.

## BLOCKED / NOT RUN

- Chromium browser Worker execution and browser-host parity: NOT RUN.
- Android WebView execution, 4 GB Android memory/performance, device recovery and native Python: NOT RUN.
- Production integration of the optional offline pack with the app's persistent pack store and restart lifecycle: NOT RUN. The Node runner reads the actual vendor package directly; it does not claim that the app has installed the pack for end users.

## Commands and counts

**Before P2 (P1 accepted baseline):**
- `npm run build` — exit 0.
- `node --test tests/*.test.mjs` — 1,147 tests, 1,147 passed, 0 failed, 0 skipped.

**P2 targeted proof:**
- `npm run build` — exit 0.
- `node --test tests/helpers/pyodide-node-suite.mjs tests/r14-wp04-pyodide-provider.test.mjs tests/r14-wp04-pyodide-vendor.test.mjs` — exit 0; 22/22 passed; 0 failed; 0 skipped; 10 negative; one real mutant caught.

**After P2:**
- `npm run build` — exit 0.
- `node --test tests/*.test.mjs` — exit 0; 1,147/1,147 passed; 0 failed; 0 skipped. The dedicated real-Pyodide helper suite is run explicitly as part of the P2 targeted command rather than being folded into the root glob; the root regression ratchet remains at 1,147.

## Replaced files and base hashes

See `BASE_HASHES.txt` at the delta root for SHA-256 values from the exact Director base for every replaced file. Added files have no base hash.

## Capability registry

Regenerated from `results/*.json` using `node tools/derive-capability-status.mjs`: **30 capability rows from 177 result records**. The Node worker runtime is `TESTED` at Grade 1. Browser Worker execution remains `NOT RUN`; this evidence does not upgrade the product's browser or Android capability.

## Closing — what this prompt missed

The phrase “memory-heavy input refused” did not specify whether it meant an oversized source payload or a hard Pyodide WebAssembly linear-memory quota. This implementation proves refusal of source larger than 512 KiB before Worker creation. It does **not** claim a hard cap on Pyodide's WebAssembly linear memory; the Director should define a numeric runtime-memory ceiling if that is required for P2 acceptance.
