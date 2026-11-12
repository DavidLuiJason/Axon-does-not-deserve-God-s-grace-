# Round 14 Continuation 3 — P3 / WP10 TypeScript Diagnostics and Debugger

## Package verdict

**P3 Node-provable work: PARTIAL.** The TypeScript compiler diagnostics engine and Node Inspector debugger are implemented and tested. A real language server is **BLOCKED** because no compatible language-server package is present in Vendor Pack V2.

## TypeScript compiler diagnostics

- Uses the real pinned TypeScript compiler API, version **5.8.3**.
- Compiles bounded virtual projects without reading arbitrary host project paths.
- Supports multi-file imports, syntax diagnostics, semantic diagnostics, compiler-option diagnostics and tsconfig parsing.
- Golden corpus: **30 separate projects** covering one clean project, common syntax/type errors, generic constraints, null safety, implicit any, overloads, module resolution, duplicate identifiers, readonly/indexing/enum/JSX errors, cross-file export/type/module errors, and tsconfig target/extends/JSON/include/unknown-option problems.
- All 30 golden projects matched their expected diagnostic result.

## Real Node Inspector debugger

The adapter communicates with a real Node child process launched with `--inspect-brk=127.0.0.1:0` and a real WebSocket connection to the Node Inspector Protocol. It proves:
- Breakpoint by URL/line.
- Continue/resume.
- Step over, step into and step out.
- Stack frames.
- Local variables via `Runtime.getProperties`.
- Expression evaluation via `Debugger.evaluateOnCallFrame`.
- Stop/termination.
- Uncaught target exception detection via `Runtime.exceptionThrown`, with the crashed target terminated after the exception is captured.

**Isolation grade: Grade 1 only.** The debug target is a separate Node process but runs with the same OS user privileges. This adapter is not an OS-enforced sandbox and must not be used to claim hostile-code isolation.

## Test evidence

| Measure | Result |
|---|---:|
| P3 targeted tests | 39 |
| Passed | 39 |
| Failed | 0 |
| Skipped | 0 |
| Negative tests | 36 |
| Real compiled-module mutants caught | 1 |
| Golden TypeScript projects | 30 |

The mutant test alters a temporary copy of the real compiled diagnostics module, removes the source-size guard, and demonstrates that the mutant accepts an oversized project that the production module refuses.

## FAKE_BOUNDARY items

**None.** TypeScript diagnostics use the real compiler API. Debugging uses a real Node child process, real Inspector WebSocket protocol, and real Inspector commands. No fake compiler, fake debugger, or simulated target was used.

## BLOCKED / NOT RUN

- Real Language Server Protocol server: **BLOCKED**. Vendor Pack V2 does not contain `typescript-language-server`, `vscode-languageserver`, `vscode-languageserver-protocol`, `@volar/language-server`, or `@typescript-eslint/language-service`. No hand-written LSP substitute was created.
- Browser debugger UI, Chromium integration, Android WebView and physical Android device debugger validation: NOT RUN.
- Node Inspector debugging is Grade 1 and does not establish sandbox isolation.

## Commands and counts

**Before P3 (P2 full regression):**
- `npm run build` — exit 0.
- `node --test tests/*.test.mjs` — 1,147/1,147 passed, 0 failed, 0 skipped.

**P3 targeted proof:**
- `npm run build` — exit 0.
- `node --test tests/r14-wp10-typescript-debugger.test.mjs` — 39/39 passed, 0 failed, 0 skipped; 36 negative tests; one real mutant caught.

**After P3:**
- `npm run build` — exit 0.
- `node --test tests/*.test.mjs` — 1,186/1,186 passed, 0 failed, 0 skipped.

## Capability registry

Regenerated from `results/*.json` using `node tools/derive-capability-status.mjs`: **33 capability rows from 180 result records**. TypeScript project diagnostics and the Node Inspector adapter are `TESTED`; the TypeScript language server is `BLOCKED`.

## Clean-copy delta verification

The first default-concurrency full-suite invocation on the clean P1+P2+P3 merge copy was interrupted by the execution harness at test 565. A serial rerun passed **1,186/1,186**, and a retry of the exact `node --test tests/*.test.mjs` command also passed **1,186/1,186** with zero failures and zero skips.

## Closing — what this prompt missed

The prompt did not specify a debugger UI/DAP transport contract or whether the Node Inspector target must be sandboxed. This package supplies a real Inspector Protocol controller and explicitly grades it as Grade 1; it does not claim DAP compatibility or OS sandboxing. The LSP package absence is a concrete dependency blocker, not a missing mock.
