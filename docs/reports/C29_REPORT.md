# C29 — Physics Engine report

## Status and evidence

**PARTIAL DELIVERY — NOT READY TO MERGE.** The implementation and regression test file are created, but the required project test runner and project-configured type check could not be run in this mini-base environment. The Director must inspect this return and run `verify_return.py` before merge.

Evidence labels: **MEASURED** = command was run and output observed; **NOT RUN** = command could not be run; **HYPOTHESIS** = not established by execution.

## LAW CHECK

### Foundation laws FL1–FL13 (plus relevant FL14–FL15)
- **FL1 Top view:** C29 is the pure physics engine in the Tools/Execution layer (roadmap §§6, 7E, 8); later callers include video/motion work. Main risks are units, multiple roots, and estimates being mistaken for facts.
- **FL2 Exact scope:** inspected the attached v20.0 roadmap and the named unit engine/index; changed only the three C29 lane files.
- **FL3 End-to-end plan:** no descriptor or registration added; this engine is a later tool-bus dependency.
- **FL4 Progress/no repeats:** kept the implementation in the named lane; the test runner failed to start, so no repeated runner attempts were made after the environment limitation was identified.
- **FL5 Dictionary core:** untouched and not omitted from AXON.
- **FL6 Searchable compression:** no data stores or large data added.
- **FL7 Measure why:** independent equations and direct runtime smoke checks were used; unrun project checks are explicitly disclosed.
- **FL8 Export home:** not applicable to this isolated builder delta; repository/export comparison remains for Director verification.
- **FL9 Plan first:** implements the specified C29 physics scope only.
- **FL10 Capability truth:** no registry claim, descriptor, or chat action was added.
- **FL11 Every-stage:** this law check is included; unresolved test-runner limitation is reported.
- **FL12 One designed brain:** engine has no independent UI/chat response path.
- **FL13 Structure before vocabulary:** no brain files, phrase lists, or language matching added.
- **FL14 One source, no copies:** imports `convert` from the existing shared `unitConvert.ts`; does not copy its conversion table or function.
- **FL15 Verified foundation:** project-wide validation and mutation checks are not claimed; they remain explicit merge gates.

### Building Rules 1–13
- **Rule 1 (capacity):** kept to one engine, one test, one report.
- **Rule 2 (foundation):** depends on the existing shared unit engine.
- **Rule 3 (foundation-up):** pure engine only; no screen or registry.
- **Rule 4 (one builder, sized job, proof):** scoped to C29 and contains regression cases; full proof remains incomplete because `tsx` is unavailable.
- **Rule 5 (plan):** limited to the named motion, force/energy, and projectile functions.
- **Rule 6 (measure → design → build → prove):** TypeScript engine check and 12 direct runtime smoke assertions passed; full proof not run.
- **Rule 7 (lossless compression):** no data compression or media assets added.
- **Rule 8 (weakest phone):** bounded object keys and numeric magnitudes; no unbounded loops or allocations.
- **Rule 9 (verify returned zip):** required for Director; not run by this builder.
- **Rule 10 (roadmap cap/ownership):** roadmap was not edited.
- **Rule 11 (future compatibility):** no registration or descriptor assumptions; exported types/constants included.
- **Rule 12 (guards/ratchets):** guard and tests were not edited; new test is supplied for later inclusion.
- **Rule 13 (migration):** repository-relative paths and existing shared engine import only.

## Files created

1. `src/tools/engines/science/physics.ts` — motion, force/energy and projectile calculations; exported types, `STANDARD_GRAVITY`, and `PHYSICS_LIMITS`.
2. `tests/physics.test.ts` — regression cases and independently written expected values.
3. `docs/reports/C29_REPORT.md` — this report.

No existing files were changed.

## Commands and results

- **MEASURED PASS:** `tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck src/tools/engines/science/physics.ts src/tools/engines/numbers/unitConvert.ts` — clean.
- **MEASURED PASS:** compiled the engine and shared unit converter to temporary CommonJS output with `tsc --target ES2022 --module commonjs --moduleResolution node --skipLibCheck --outDir /tmp/c29compiled src/tools/engines/science/physics.ts src/tools/engines/numbers/unitConvert.ts` — clean.
- **MEASURED PASS:** direct Node runtime smoke test — 12 assertions passed, including dropped-stone motion, braking, two-root motion, no-real-root, work cosine and projectile energy conservation.
- **NOT RUN:** required `npx tsx tests/physics.test.ts` — no project `node_modules`/`tsx`; `npx --no-install tsx --version` timed out. The global `ts-node` attempt failed with `ERR_UNKNOWN_FILE_EXTENSION`; this is not reported as a test pass.
- **NOT RUN:** `npx tsc --noEmit -p tsconfig.json` — project dependencies are absent (`vite/client` and project type packages are not installed); the strict project check could not be established from this mini-base.
- **NOT RUN:** existing `test:kernel` suite — the mini-base does not contain the listed existing tests or installed runner.
- **NOT RUN:** mutation checks replacing `STANDARD_GRAVITY` with 9.8 and removing the work cosine. No mutation result is claimed.
- **NOT RUN:** full 30-case independent Python proof suite and energy check across every projectile test. The included test file is not yet executed.

## Test script line to add

Add this command to `test:kernel` in `package.json` (builder did not edit that file):

`tsx tests/physics.test.ts`

## Known limitations / unfinished proof

- **Do not merge yet.** Run the required test file, full project type check and mutation tests in an environment with the project toolchain. Expand the independent Python reference cases to the requested 30 cases and run projectile energy conservation for every projectile fixture.
- The shared unit engine has no acceleration, force, energy, momentum, or power categories. Acceleration is therefore accepted only as `m/s²` or `m/s^2`; force/energy/power values are accepted only in SI spellings (`N`, `J`, `W`) rather than converted from other units. This is a known gap versus broad arbitrary-unit input/output.
- Motion's quadratic branches retain both real mathematical roots; negative calculated time can appear as a valid mathematical branch. Negative *input* time is rejected.
- `forceAndEnergy` returns the quantities derivable from the supplied subset; it does not yet return a structured list of every missing quantity when some optional fields are omitted.
