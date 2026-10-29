# C31 Report — Loop Skeleton with Fake Tools

## Top-view placement
AXON's finished architecture (roadmap §6) has Ground, Knowledge Slot, Reading Language, Understanding, Voice, and Reach. C31 sits in the §7A brain loop above the tool engines and schema foundation; the Director will wire it later. Later risk: if status/permission facts drift from `ActionSchema`, or if the Director bypasses this loop, unsafe tools could run or tasks could stop without an honest reason. The supplied `AXON_ROADMAP_V20_1.md` and `BATCH-C31-MINIBASE.zip` were used; all five required base files were present.

## LAW CHECK (FL11)
1. **FL1–FL3:** Mapped the loop to §7A and the complete AXON layer view; kept it a pure, isolated brain engine with explicit future wiring risk.
2. **FL4–FL5:** Worked incrementally; preserved the dictionary and all existing files. The loop adds no dictionary or data changes.
3. **FL6–FL8:** Added bounded state, input, journal and step sizes; no shelf format, export, or repository-lock changes.
4. **FL9–FL10:** Implements one plan/action cycle and schema-driven tool checks only; no registry claims, screens, or chat actions are added.
5. **FL11–FL13:** This check is recorded here; the engine adds no phrase lists, fixed language patterns, or regex literals under `src/brain`.
6. **Rules 1–3:** Kept the change to the three named lane files, with no stubs/placeholders; errors from planner, tool and success test are explicit.
7. **Rules 4–6:** Used deterministic seeded tests and bounded limits; tested malformed values and hostile input. The phone memory limit is supported by caps on state keys, input keys, strings, journal entries and steps.
8. **Rules 7–9:** The action schema remains the permission/effect source; no registration or app wiring was added; state changes are validated before acceptance.
9. **Rules 10–11:** Tool output cannot inject nested values into state; repeated identical tool/input with unchanged state is stopped; the success test runs before planning and after every executed tool.
10. **Rules 12–13:** The output is a small repository-relative zip for Director review; the report states measured results, blocked checks and the exact package test line.

## Files created
- `src/brain/mind/loop/loop.ts`
- `tests/loop.test.ts`
- `docs/reports/C31_REPORT.md`

No existing file was changed. No descriptor, registration, UI, or app wiring was added.

## Implementation notes
- `runLoop` injects planner, tool map, permission grants, and clock; success is tested before planner/tool activity and after each executed tool.
- Step budget is bounded by `LOOP_LIMITS.maxSteps = 50`; journal entries are bounded by `LOOP_LIMITS.maxJournalEntries = 200`; state, input, and string limits are exported.
- Effects are read from `ActionSchema.effects`, using the shared `APPROVAL_EFFECTS` and `PERMISSION_EFFECTS` definitions. Approval effects and irreversible tools are not run. Permission effects require `options.granted` to contain `permission`.
- Unknown tools and schema status `unbuilt`/`left-out` are refused. Note: the provided `ActionSchema` interface does not declare a `status` property; the implementation checks that field defensively at runtime for schemas carrying the status from a wider schema source.
- Returned journal entries and final state are defensive, frozen copies. State accepts only string, finite number, and boolean values.

## Commands and results

### MEASURED — passed
- `node --experimental-strip-types tests/loop.test.ts` — **16/16 test groups passed**, including **1,000 seeded fake-task runs**. Node emitted its expected experimental type-stripping warning.
- `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions --skipLibCheck src/brain/mind/loop/loop.ts src/brain/mind/schema/schemaTypes.ts` — **passed** for the engine and its schema dependency.
- Mutation check script (`python3 /tmp/mutate_c31.py`, run in the working sandbox) — **5/5 mutations caught by a failing test run**: ignored initial success test, ignored step budget, allowed approval-effect tool, skipped unbuilt check, and dropped a journal entry. The original implementation was restored after each mutation and at the end.

### NOT RUN / blocked
- `npx --no-install tsx tests/loop.test.ts` — **NOT RUN to completion**; the command timed out because `tsx` is not installed/cached in this mini-base and package installation was not available in the time window.
- `tsc --noEmit -p tsconfig.json` — **failed before project checking** with `TS2688: Cannot find type definition file for 'vite/client'`; the mini-base has no `node_modules`.
- Strict type-check including `tests/loop.test.ts` — **NOT RUN successfully**: this mini-base lacks Node type definitions, so `node:assert/strict` types cannot be resolved. The engine and schema themselves pass the strict standalone check above.
- Existing `test:kernel` suite — **NOT RUN**: the mini-base archive does not include the referenced existing `tests/` files or installed `tsx` dependency. No existing kernel test is claimed as passed.
- `tools/guard.mjs` — **NOT RUN** against a full repository; this mini-base is an intentionally partial source archive and is not a merge checkout.

## Mutation check detail
Each of the five mutations caused the test process to fail as expected. Mutations were applied only in the temporary working copy, never to the returned files.

## Unfinished / limitations
- Canonical `npx tsx`, full-project `tsc`, and existing kernel suite remain unverified due to missing dependencies and tests in the supplied mini-base. Director review should require these checks in the complete repository before merge.
- The prompt asks for schema status `unbuilt`/`left-out`, but the provided `ActionSchema` type has no status field. The runtime guard is defensive; the schema contract should be reconciled by the Director if status is expected to be statically typed.
- No files outside the named lane were touched.

## Package test line to add to `test:kernel`
`tsx tests/loop.test.ts`

## DIRECTOR ADDENDUM (eighteenth+ account, 2026-10-29): inspection and fixes
Inspected per 5.2: `verify_return.py` against BATCH-C31-MINIBASE.zip: 3 new files, 0 out of lane, 0 placeholder hits. Builder's 16/16 reproduced (MEASURED, Node 22, real `schemaTypes.ts`, identical to the repository's).
**Defect found:** the loop ignored `ActionSchema.preconditions`: a tool with precondition `owner-approval` or `permission` but harmless effects would have run without asking. **Fixed** in `loop.ts` (both now stop with NEEDS_OWNER; `permission` needs `granted` to contain `permission`).
**Test gaps found by Director mutants (3 survived):** tool name must match its schema; NaN in tool changes; state-key limit on the starting state. **Fixed:** two new test groups (now 18).
MEASURED after the fix: 18/18 groups incl. 1,000 seeded runs; 9 of 9 Director mutants caught (permission check, both preconditions, no-progress, name mismatch, NaN, state-key limit, post-step success test, irreversible undo). No regex literals or 3+ string-literal arrays in the file.
Also MEASURED: `tsx tests/loop.test.ts` passes (18 groups); strict `tsc --noEmit` of `loop.ts` + `schemaTypes.ts` passes. NOT RUN: project `tsc`, `test:kernel`, `guard.mjs` in the full repository, cloud build: the owner's machine check does these.
Open (OPEN_ITEMS proposal): preconditions `network-on` and `device-capable` are NOT checked by the loop (it has no device facts yet); wiring needs the Director's later job. `granted` holds the single word `permission`, not per-effect grants: owner may want per-effect grants later.
