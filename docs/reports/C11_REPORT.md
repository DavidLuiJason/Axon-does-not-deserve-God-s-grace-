# C11 — Three Small Engines Report

## Delivery status

All three requested engine files and their tests are present. No existing repository file was edited. The only unverified acceptance items are the project's native `tsx` test path, the full `test:kernel` suite, and the repository-wide `tsc -p` check; the sandbox does not contain the project dependencies.

## LAW CHECK (FL11)

### Foundation laws
- **FL1:** Followed the whole-project view in roadmap v16.5 and the C11 position in the live job board.
- **FL2:** Read the supplied complete roadmap, revisited its foundation laws (section 3), and inspected the job board, handbook, and named base files before coding.
- **FL3:** APIs are bounded and intended for later screens, storage export, and future schema handling.
- **FL4:** Built and tested each engine in priority order; one syntax/test defect and one WebView parsing defect were corrected before delivery. No unresolved problem was given a third fix attempt.
- **FL5:** Dictionary files and behaviour were not changed or omitted.
- **FL6:** Tool-store values and serialized data are capped at 200 KiB; dictionary compression was not changed.
- **FL7:** Results below distinguish executed checks from checks blocked by missing project dependencies.
- **FL8:** Only the seven permitted new files are in the returned ZIP; all paths are repository-relative.
- **FL9:** Used existing pure-engine and injected-storage patterns and preserved C11's priority order.
- **FL10:** Added honest descriptors for `pattern-tester` and `device-profile`; did not change the registry or menu.
- **FL11:** This report repeats the applicable laws and rules.
- **FL12:** No brain imports, chat handlers, or direct chat execution were added.
- **FL13:** No vocabulary or phrase list was added to the brain; examples are documentation only.

### Building Rules
- **Rule 1:** Pattern, text, replacement, match count, key and serialized-store sizes have explicit limits.
- **Rule 2:** No unrelated architecture or existing file was changed.
- **Rule 3:** All three engines are pure TypeScript; environment, storage, clock and timeout runner are injected.
- **Rule 4:** Three focused engines, three focused test files, and one ZIP are delivered.
- **Rule 5:** Work was based on the roadmap, job board, handbook and exact required base paths.
- **Rule 6:** New tests and a strict targeted type check were run; unavailable native checks are marked NOT RUN.
- **Rule 7:** Data is stored losslessly as JSON; unsafe or oversized writes are rejected.
- **Rule 8:** Inputs, matches and storage are bounded for low-memory devices. A hostile regex must run in an interruptible worker runner; a synchronous JavaScript regex cannot be safely interrupted on the calling thread.
- **Rule 9:** ZIP contents were checked against the exact seven-file lane; no dependency or base-file edits are included.
- **Rule 10:** The roadmap remains unchanged; this report is included.
- **Rule 11:** Store schema version and future-version rejection support later upgrades without silent reinterpretation.
- **Rule 12:** Tests cover invalid, empty, oversized, Unicode, timeout, storage-failure and schema-failure cases; exact kernel test lines are listed below.
- **Rule 13:** Paths are relative to the repository root; no new dependencies or nested ZIPs are included.

## Files created

1. `src/tools/engines/code/patternTest.ts`
2. `tests/patternTest.test.ts`
3. `src/tools/engines/device/deviceProfile.ts`
4. `tests/deviceProfile.test.ts`
5. `src/tools/shared/toolStore.ts`
6. `tests/toolStore.test.ts`
7. `docs/reports/C11_REPORT.md`

## Test and type-check evidence

Evidence labels: **MEASURED** means the command was run and its result observed; **NOT RUN** means it could not be completed in this sandbox.

### MEASURED — new tests

The repository has no installed `tsx` binary. The three test files were executed with the globally available `ts-node` ESM loader in transpile-only mode, using Node 22.16.0 and the compiler options shown here:

`TS_NODE_TRANSPILE_ONLY=true TS_NODE_COMPILER_OPTIONS='{"module":"ESNext","moduleResolution":"Bundler","allowImportingTsExtensions":true}' node --loader /opt/nvm/versions/node/v22.16.0/lib/node_modules/ts-node/esm.mjs tests/patternTest.test.ts`

Result: **PASS — 18 checks passed**.

Same command with `tests/deviceProfile.test.ts`: **PASS — 43 checks passed**.

Same command with `tests/toolStore.test.ts`: **PASS — 35 checks passed**.

Total: **96 checks passed** across the three new tests.

### MEASURED — targeted strict type check

Command:

`tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --strict --skipLibCheck --allowImportingTsExtensions --typeRoots /opt/nvm/versions/node/v22.16.0/lib/node_modules/ts-node/node_modules/@types src/tools/engines/code/patternTest.ts src/tools/engines/device/deviceProfile.ts src/tools/shared/toolStore.ts tests/patternTest.test.ts tests/deviceProfile.test.ts tests/toolStore.test.ts`

Result: **PASS — no diagnostics**.

### NOT RUN / blocked

- `npx --no-install tsx tests/patternTest.test.ts`: **NOT RUN**; the command timed out while attempting to resolve the missing `tsx` package. The same test was then executed successfully using the global `ts-node` loader described above.
- `npm run test:kernel`: **NOT RUN**; it stopped immediately with `sh: 1: tsx: not found` (exit code 127). No kernel tests ran.
- `tsc --noEmit -p tsconfig.json`: **NOT RUN to completion**; it stopped with `TS2688: Cannot find type definition file for 'vite/client'`, because the project dependencies are not installed in the sandbox. The targeted strict type check above did pass.
- Exact required `npx tsx tests/NAME.test.ts` invocations: **NOT RUN** because `tsx` is absent. Equivalent test sources passed under the global ESM TypeScript runner.

### Independent expected-value checks

A separate Python calculation confirmed the test text's match starts `[0, 7]`, the UTF-16 offsets for `😀a` as `[0, 2, 3]`, and the store cap as `200 × 1024 = 204800` bytes. These values were not computed by the engine under test.

## Behaviour covered

- **Pattern Tester:** numbered and named groups, replacement, empty pattern, zero-width Unicode progression, invalid/duplicate flags, invalid pattern, empty text, oversized pattern/text, match-count cap, right-to-left text and emoji, invalid input, fake timeout and runner failure. The injected runner must enforce interruption (normally by terminating a Web Worker); the engine does not claim it can interrupt a synchronous regex on the same thread.
- **Device Profile:** 11 realistic user-agent strings, including strings with no Android/browser version, missing fields as `unknown`, CSS-pixel dimensions, rounded `navigator.deviceMemory` with its note, plain-text copy, fake clocks and failed work.
- **Tool Store:** namespaced key and schema, get/set/remove/export/erase, zero and Unicode values, `__proto__` as data, invalid IDs/keys/values, circular values, value and aggregate size caps, corrupt JSON, invalid structure, newer schema, read/write/remove exceptions, and safe in-memory fallback.

## Unfinished work

No engine is intentionally partial. The native project test suite and whole-project type check remain unverified because `tsx`, `vite/client`, and project dependencies are missing from this sandbox. They must be run after the ZIP is applied in a fully installed repository.

## Exact `test:kernel` lines to add

Append these entries to the existing `test:kernel` command (do not edit `package.json` in this delivery):

`tsx tests/patternTest.test.ts && tsx tests/deviceProfile.test.ts && tsx tests/toolStore.test.ts`


## Director addendum (2026-10-20)
Inspected with verify_return.py (all pass, strict tsc passes). One defect fixed by the Director: toolStore.eraseAll() could never clear corrupt, oversized or newer-schema data, leaving a tool broken for good; it now accepts { force: true } for an explicit user action (67 checks pass). Real Infinix WebView user agents parse correctly. Test lines to add: tsx tests/patternTest.test.ts ; tsx tests/deviceProfile.test.ts ; tsx tests/toolStore.test.ts
