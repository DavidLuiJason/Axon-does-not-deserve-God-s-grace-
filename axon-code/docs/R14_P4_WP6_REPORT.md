# Round 14 Continuation 3 — P4 / WP6 Real Package Managers

## Package verdict

**State: PARTIAL.** The real npm adapter and the real pip T2 adapter were built and exercised against local-only package fixtures. The product-managed install gate remains blocked because this host does not provide OS process confinement. The adapters do not claim a hostile-code sandbox.

## npm — T1 local-registry proof

The test starts a loopback HTTP registry fixture and builds a real npm package tarball with `npm pack`. `NpmPackageManagerAdapter` uses the real npm CLI; it is not an npm imitation.

Verified:
- Real install from the local registry.
- Exact package version in `package-lock.json`.
- Lockfile `resolved` URL remains on the approved local registry origin.
- Lockfile SHA-512 integrity matches the registry metadata.
- A preinstall script declared by the fixture package does not run (`--ignore-scripts`).
- A tarball with the wrong SHA-256 is refused before npm starts.
- A tarball redirected to another origin is refused.
- A tarball that changes after preflight is rejected by npm's integrity check; the staged install is rolled back and the previous committed environment remains unchanged.
- `npm ci --offline` restores a clean `node_modules` from the local npm cache after the registry is stopped.
- `npm uninstall` removes the package and updates package metadata.
- Floating versions, missing hashes, duplicate requirements and foreign sources are refused.

## pip — T2 local-index proof

`pip3` was present: version **25.1.1**, Python **3.13.5**. A real pure-Python wheel was generated for the fixture and served through a loopback PEP 503 index. The `PipPackageManagerAdapter` invoked the real pip CLI with `--require-hashes`, `--no-deps`, and `--no-input`.

Verified:
- Real pip installation from the local PEP 503 index.
- The installed module bytes are present in the staged environment.
- A wrong wheel SHA-256 is rejected by pip and the staged environment is rolled back.
- Non-loopback indexes and floating versions are refused.

This is T2 host evidence only. It is not Android Python support or a claim of production isolation.

## Test evidence

| Measure | Result |
|---|---:|
| P4 targeted tests | 13 |
| Passed / failed / skipped | 13 / 0 / 0 |
| Negative tests | 9 (69.2%) |
| Real compiled-module mutant caught | YES — removing the actual npm tarball SHA-256 guard lets the mutated adapter pass tampered bytes to its package host |
| npm-specific tests | 10/10 |
| pip-specific tests | 3/3 |

## Security boundary and blocked managed execution

The adapters use fixed npm/pip command entry points, temporary staging transactions, no shell command strings, exact versions, approved local registry/index URLs and disabled npm lifecycle scripts. However, both CLIs still run as the host OS user. A temporary directory is not OS process confinement.

Accordingly:
- npm adapter direct local-registry proof: **TESTED**.
- pip adapter direct local-index proof: **TESTED (T2)**.
- `PackagePlanService` managed npm installation: **BLOCKED** because the host probe honestly reports `isolatedEnvironment=false` and `childProcessConfinement=false`.
- `PackagePlanService` managed pip installation: **BLOCKED** for the same reason.
- No OS sandbox or hostile-code isolation claim is made.

## FAKE_BOUNDARY items

No fake npm or pip implementation was used. The HTTP registry and PEP 503 index are local test fixtures; the actual npm and pip binaries downloaded and installed the real fixture artifacts. The Node filesystem transaction host is test harness infrastructure, not a package-manager substitute.

## Commands and counts

- `npm run typecheck` — exit 0.
- `npm run build` — exit 0.
- `node --test tests/r14-wp06-package-manager.test.mjs` — exit 0; 13/13 passed; 0 failed; 0 skipped; 9 negative tests; real mutant caught.
- Before P4 (P1–P3 merged): **1,186/1,186** retained Node tests passed.
- After P4: each of the 39 files matching `tests/*.test.mjs` was run once, serially, with `node --test <file>` in a separate process — **1,199/1,199 passed; 0 failed; 0 skipped**.
- Clean-copy delta verification: all 8 replacement base hashes matched; `npm run typecheck` and `npm run build` passed; the full 39-file suite again passed **1,199/1,199**, with 0 failures and 0 skips.
- Runtime versions: Node v22.16.0; npm 10.9.2; pip 25.1.1; Python 3.13.5.

The final full-regression evidence is in `results/r14-full-regression-per-file.json` and `results/r14-full-regression-summary.json`. P4-specific evidence is in `results/r14-wp06-package-manager.json`. The aggregate `node --test tests/*.test.mjs` command was not used for post-delta validation; per-file serial execution covered every matching test file. `npm run verify:director` was attempted but did not finish within the execution harness timeout, so it is not claimed as PASS.

## Files changed

- Added `src/environment/npmPackageManagerAdapter.ts`.
- Added `src/environment/pipPackageManagerAdapter.ts`.
- Exported both adapters from `src/index.ts`.
- Added `tests/r14-wp06-package-manager.test.mjs`.
- Added real npm/pip host and local-registry/index test helpers.
- Added machine-readable P4 and full-regression result files.
- Updated `AXON_CODE_PROGRESS.json`, `docs/CAPABILITY_REGISTRY.json`, `FILES_MANIFEST.txt`, `SHA256SUMS.txt` and `MERGE_SET.txt`.

## Closing — what this prompt missed

The prompt did not define whether transactional staging alone satisfies package-manager process confinement. This implementation does not interpret it as OS isolation: real npm and pip package operations are proven, while managed execution through `PackagePlanService` remains BLOCKED until a host-enforced process-confinement provider exists.
