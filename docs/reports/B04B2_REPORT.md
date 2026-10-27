# B04B2 — Resolution Wiring Report

## Result

**PARTIAL DELIVERY: adapter and stage wiring implemented; required runner proofs for the adapter and resolver pass.** The repository integration test and whole-project checks could not be run in this sandbox because the supplied BASE has no installed project dependencies (`tsx` and the `vite/client` type package are missing). The new integration test is included but is **NOT RUN**; it is not claimed to pass.

The finished brain is a ten-stage, typed and traced pipeline: it reads a message, analyses language, builds Meaning, resolves each meaning piece to a schema without executing it, then later dialogue/planning/execution/checking/response stages continue. This job sits at the bridge from stage 4 Meaning to stage 5 Resolution. Resolution is shadow-only: the legacy executor still supplies the reply; no tool is run and the frame/reply are not changed by the new stage.

## Proof results

- `node run.mjs tests/clauseInputsRunner.test.ts`: **PASS** — `CLAUSE INPUTS RUNNER OK (277 checks, 0 failures)`.
- `node run.mjs tests/resolveRunner.test.ts`: **PASS** — `RESOLVE RUNNER OK (1571 checks, 0 failures; schemas 63; shared-key asks 40)`.
- `tsc -p tsconfig.values.json`: **PASS**, strict, clean (run against the mini-base containing the new adapter and fixed resolver contracts).
- `npx tsc --noEmit`: **BLOCKED / NOT CLEANLY RUN** — TypeScript exits on missing `vite/client` type definitions (`TS2688`). This is an environment/dependency absence; the project-wide check therefore gives no reliable verdict on other files.
- `npm run test:kernel`: **NOT RUN** — the first command fails because `tsx: not found`.
- `tests/resolutionStage.test.ts`: **NOT RUN** — the repository's required `tsx` runner is absent. It is included for execution in the normal repository environment; no pass is claimed.
- `tests/mindPipeline.test.ts`: **NOT RUN** for the same missing-`tsx` reason. One assertion was adjusted only: Resolution is expected to remain `not-built` when Meaning itself is `not-built`; dialogue, planning and verification retain their prior assertions.
- `tests/brainBoundary.test.ts`, `tests/brainGolden.test.ts`, `tests/meaningA.test.ts`, `tests/structureGlue.test.ts`: **NOT RUN** — `tsx` is unavailable.
- Repository type check known pre-existing screen errors (`VideoFramesScreen.tsx`, `ZipToolScreen.tsx`) could not be evaluated because the project check stops first at missing `vite/client`.

## Files and changes

- **NEW** `src/brain/mind/resolve/clauseInputs.ts`: exports exactly `buildResolveInputs` and `resolveMessage`; maps one piece to one resolver input; respects word-index spans, first token whose start is inside the word, POS-based object concepts, sanitized names, values and material segments; guards hostile inputs; uses no vocabulary/phrase list and no tool-specific branches.
- **CHANGED** `src/brain/mind/types.ts`: imports `PieceResolution` as a type and adds only `resolutions?: PieceResolution[]` to `MindContext`.
- **CHANGED** `src/brain/mind/stages.ts`: imports `extractValues` and `resolveMessage`; adds private UTC clock conversion; Resolution now stays `not-built` with a reason if analysis or Meaning structure is missing, otherwise records resolutions and counts in a `ran` trace entry; errors are caught and recorded as `not-built`. It deliberately does not pass `options.status` or `options.related`.
- **NEW** `tests/resolutionStage.test.ts`: eight varied messages; checks stage state, one well-formed resolution per piece, unchanged reply/frame versus the prior not-built stage, and empty/symbol-only non-throwing behavior. **NOT RUN** in this sandbox.
- **CHANGED** `tests/mindPipeline.test.ts`: one assertion only, to reflect that Resolution remains not-built when Meaning cannot complete.

The stage uses UTC year/month/day/hour/minute from `now()`; **the device's time zone is not applied yet**. If `extractValues` fails, it supplies no values and records the failure in the trace note. The trace note includes piece count and counts of matches, questions, unavailable and none; it contains no tool names. Resolution is shadow-only, and the legacy executor remains the answer source.

## Three least-certain real-clause inputs

1. **Copular clauses** (for example, a clause with “is”): the current structure may identify the copula as the verb, but resolver concepts depend on dictionary token POS and may produce no useful verb key.
2. **Relay clauses** (for example, telling one person to do something): the adapter intentionally maps only the explicit `parts.verb`, object and detail spans; it does not reinterpret relay/reference metadata as extra concepts.
3. **Condition/reason-linked pieces**: the adapter resolves each piece for trace purposes even when `mayRunAlone` is false; downstream stages must preserve the contract that such a piece never executes alone.

## LAW CHECK

- **FL1 Top view:** this adds only the Meaning-to-Resolution bridge; the later dialogue, judgment, planning and execution layers remain separate.
- **FL3 Plan reaches the end:** resolution stores a typed shadow result without assuming later execution, verification, memory or permissions are complete.
- **FL4 Progress first:** used the fixed mini-base contract and its runner; both runner proofs passed; the missing project dependencies are reported rather than worked around by changing project files.
- **FL10 Registry/chat truth:** this stage does not claim that a schema is an executable capability and does not execute a tool.
- **FL11 Every-Stage Law:** this report includes the law check and all required check outcomes, including NOT RUN reasons.
- **FL12 One designed brain:** Resolution is a pipeline stage only; execution and reply remain on the existing path.
- **FL13 Structure before vocabulary:** no phrase lists, tool IDs or tool-specific branches were added to the adapter or stage.
- **FL15 Verified foundation:** adapter/resolver have known-answer runner proofs; unrun integration/project checks are explicitly labelled and not treated as verified.

## Limits of this proof

The adapter runner proves contract behavior on fixtures and schema-driven cases, but because the real-dictionary integration test and full kernel suite could not run here, this delivery does not yet prove end-to-end stage behavior against the repository's installed dependency environment or on an Android device.
