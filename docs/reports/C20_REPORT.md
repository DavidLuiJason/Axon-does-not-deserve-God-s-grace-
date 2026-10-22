# C20 Report — Video Frames and Video to Audio Planners

## Result

**Status: PARTIAL TOOLCHAIN VERIFICATION; both C20 deliverables are implemented and their direct tests pass.** The two engine files and two test files are complete. No video is decoded, no audio is extracted, and no device capability is assumed. The caller supplies the audio capability probe result and device tier.

## Base and roadmap check

Read the supplied AXON roadmap v16.8 in full and revisited Section 3 (FL1–FL13). Read `docs/JOB_BOARD.md`, the relevant `docs/DIRECTOR_HANDBOOK.md` guidance, and the four required base files. All required files were present:

- `src/tools/engines/images/convertPlan.ts`
- `src/tools/engines/files/zipTool.ts`
- `src/tools/engines/files/inspect.ts`
- `tsconfig.json`

Optional `src/tools/engines/files/batchPlan.ts` was absent; no cross-job import was used. Existing `planBatchNames`, `ZIP_TOOL_LIMITS`, and repository conventions were reviewed. The roadmap's latest Section 8.5 explicitly includes C20 after the V1 device probe, so no conflict was found. Registry/catalog wiring remains intentionally out of scope.

## LAW CHECK (FL11)

- **FL1:** C20 is placed in the roadmap's Media layer, after the V1 capability probe and before later screens/native work.
- **FL2:** The full supplied roadmap and Section 3 were read; the board, handbook and required base files were inspected.
- **FL3:** The planners account for future frame decoding, measured capability tiers, bounded output retention and ZIP export.
- **FL4:** Work followed the frame planner then audio planner order; direct tests were run after implementation. The two-strike rule remains binding.
- **FL5:** No dictionary data or dictionary code was changed or omitted from the base project.
- **FL6:** No dataset or media assets were added; only rough output-size estimates are calculated.
- **FL7:** Tier and encoding capability are explicit caller inputs; validation results below distinguish measured checks from unavailable checks.
- **FL8:** Only the five named lane files are in this return; no source export or existing file was altered.
- **FL9:** The work is confined to pure planning logic; no speculative UI or media-decoding changes were made.
- **FL10:** Descriptors are exported but not registered; no claim is made that media was decoded or extracted.
- **FL11:** This LAW CHECK is included in the report; no roadmap conflict was found.
- **FL12:** Both engines are standalone pure TypeScript and do not import or execute brain stages.
- **FL13:** Descriptor examples are documentation only; no brain phrases or fixed phrase lists were added.
- **Rule 1:** The supplied ZIP and available runtime were checked; absent dependencies are reported rather than concealed.
- **Rule 2:** Frame naming borrows the existing image conversion naming approach and ZIP output limits align with the existing ZIP tool's entry/size ceilings.
- **Rule 3:** Frame planning was implemented and tested before audio planning was verified.
- **Rule 4:** The two engines and tests are isolated; no screen work is included.
- **Rule 5:** Only the C20 lane is delivered.
- **Rule 6:** Generated expected cases were calculated independently in Python and embedded as fixed fixtures; direct tests and strict source type-check were run.
- **Rule 7:** Media quality is not modified; estimates are labelled and describe their assumptions.
- **Rule 8:** Tier caps (300/1,500/5,000), 5,000 absolute frame cap and 48 MiB default held-output cap protect low-memory devices.
- **Rule 9:** The return contains only new in-lane files; full project verification is limited by missing dependencies as documented below.
- **Rule 10:** No roadmap file was edited.
- **Rule 11:** The descriptors and pure inputs leave capability probing, UI and integration to later jobs.
- **Rule 12:** No guard, lock, package manifest, catalog, registry or existing test gate was changed.
- **Rule 13:** Imports are relative and no dependency was added.

## Files created

- `src/tools/engines/video/framePlan.ts` — time parsing, frame selection, arithmetic preflight caps, rough estimates, unique names, bounded run state machine, held-output draining, report rows, ZIP entry validation, descriptor.
- `src/tools/engines/video/audioPlan.ts` — explicit measured-capability checks, copy/re-encode planning, no-audio and unsupported errors, range-aware size estimates, descriptor.
- `tests/framePlan.test.ts` — time parsing, 300 independent Python-generated frame cases, selection/range/tier edge cases, 2,000-operation seeded run-state walk, naming, ZIP duplicate and five mutation checks.
- `tests/audioPlan.test.ts` — 300 independent Python-generated size cases and capability/error checks.
- `docs/reports/C20_REPORT.md` — this report.

## Commands and evidence

- **MEASURED — PASS:** `node --experimental-strip-types tests/framePlan.test.ts` — all test groups passed; reports 2,348 checks before the additional five mutation assertions, and the mutation group passed. Node printed its experimental type-stripping warning.
- **MEASURED — PASS:** `node --experimental-strip-types tests/audioPlan.test.ts` — all test groups passed; 316 checks. Node printed its experimental type-stripping warning.
- **MEASURED — PASS:** `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler src/tools/engines/video/framePlan.ts src/tools/engines/video/audioPlan.ts` — exit 0.
- **MEASURED — FAIL / environment limitation:** `tsc --noEmit -p tsconfig.json` — exit 2: `TS2688: Cannot find type definition file for 'vite/client'`. The repository ZIP has no `node_modules`, and network installation was not available in this sandbox.
- **NOT RUN:** `npx tsx tests/framePlan.test.ts` and `npx tsx tests/audioPlan.test.ts` could not be run because `tsx` is not installed locally and `npx --no-install tsx --version` timed out. The two tests were instead executed successfully using Node 22's built-in TypeScript stripping.
- **NOT RUN (exact command):** the `test:kernel` script via its `tsx` commands; `tsx` is absent. As a fallback, all 30 listed kernel tests were attempted with `node --experimental-strip-types`. Two passed (`tests/brainBoundary.test.ts`, `tests/roadmapSize.test.ts`); 28 could not resolve extensionless TypeScript imports or directory imports under Node's native loader. These are runtime-loader failures, not confirmed test failures in project tooling.
- **NOT RUN:** Full project lint/type-check with installed project dependencies, because `vite/client` type definitions and `node_modules` are absent.

No files are reported as deleted or changed outside the five listed lane files. No work remains unfinished within the C20 implementation; the whole-project checks still need rerunning in the project's normal dependency-equipped environment.

## Exact `package.json` test:kernel lines to add

Do not edit `package.json` in this return. Add these commands to the `test:kernel` script:

```text
tsx tests/framePlan.test.ts && tsx tests/audioPlan.test.ts
```
