# M0A — Charter and Permission Broker report

## Result

Created the pure TypeScript Charter, permission broker and Charter-change engine. No screen, storage, brain import, registry entry, catalog change or package change was added. The Charter defaults contain all eleven lanes and default money actions plus `system.edit-charter`, `system.edit-permissions`, `system.disable-journal` and `system.self-update` to `never`; spend ceilings start at zero. Unknown actions and invalid requests fail closed. The broker uses an injected hash function for approval hashes and a caller-supplied integrity verdict.

## LAW CHECK (FL11)

- **FL1 Top view:** M0A is placed at the beginning of mind system 7A, ahead of the loop, journal, memory and hands.
- **FL2 Read everything, then act:** The complete supplied roadmap and relevant project architecture were reviewed before building.
- **FL3 Plan reaches the end:** APIs support later loop, approval UI and audit integration without implementing those layers here.
- **FL4 Progress first / Two-Strike Rule:** Work was checked incrementally; no third attempt was made at a failing issue.
- **FL5 Dictionary is core:** No dictionary data, loader or interface was changed or omitted.
- **FL6 Searchable compression:** No dictionary data was changed; inputs and logs have explicit bounds.
- **FL7 Measure why:** Only observed command results are labelled MEASURED; environment limitations are listed below.
- **FL8 Source export:** Export tooling was not changed.
- **FL9 Plan first:** Broker order is explicit: charter lookup, trust, NEVER, costs, target fence, origin fence, then rule level.
- **FL10 Truthful capabilities:** The descriptor is exported only; no registry or menu registration was performed.
- **FL11 Every-Stage Law:** This check is included in the report as required.
- **FL12 One designed brain:** The new engine imports neither `src/brain` nor any component and does not bypass the brain.
- **FL13 Structure before vocabulary:** Examples are documentation only; no fixed phrase list was added to the brain.
- **Rule 1 — Size the job:** Only the eight files named in the job lane were created.
- **Rule 2 — Protect the foundation:** Explicit typed outcomes, caps, approval hashes and fail-closed decisions protect the foundation.
- **Rule 3 — Foundation up:** Charter and broker precede later mind-system integration.
- **Rule 4 — One builder, one proof:** Each new test was run, then the engine type-check was run.
- **Rule 5 — Plan before work:** The implementation stayed within the stated M0A scope and priority order.
- **Rule 6 — Measure, design, build, prove:** Tests and compiler checks were executed; blocked commands are not described as passing.
- **Rule 7 — Compress without degrading:** No large assets were changed; logs are capped.
- **Rule 8 — Weakest-phone support:** Data sizes, lane/action counts, fence counts and log entries are bounded; no recursion is used.
- **Rule 9 — Verify output:** The archive contains only the allowed files and this report.
- **Rule 10 — Roadmap cap:** No roadmap file was edited.
- **Rule 11 — Future accounted for:** Injected hashing, one-use approval tokens, integrity checks and unsigned changed Charters are exposed for later integration.
- **Rule 12 — Locks and tests grow:** Three focused test files were added; guards and lock files were not changed.
- **Rule 13 — Portability:** Relative imports and no new dependencies; archive paths are repository-relative.

## Files created

- `src/mind/charter/charter.ts`
- `src/mind/charter/broker.ts`
- `src/mind/charter/change.ts`
- `src/mind/charter/index.ts`
- `tests/charter.test.ts`
- `tests/broker.test.ts`
- `tests/charterChange.test.ts`
- `docs/reports/M0A_REPORT.md`

## Commands and evidence

### MEASURED — passed

- `node --experimental-strip-types tests/charter.test.ts` — PASS, 18 checks.
- `node --experimental-strip-types tests/broker.test.ts` — PASS, 1,955 checks; 1,920 truth-table requests; eight mutation probes.
- `node --experimental-strip-types tests/charterChange.test.ts` — PASS, 22 checks plus a seeded 5,000-operation invariant walk across owner, axon, tool and external origins.
- `python /tmp/m0a_independent_truth.py` — PASS, 1,920 independently derived expected decisions compared with broker output; zero mismatches. The script uses a separate Python implementation of the broker rules.
- `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions src/mind/charter/charter.ts src/mind/charter/broker.ts src/mind/charter/change.ts src/mind/charter/index.ts` — PASS.
- `node --experimental-strip-types tests/brainBoundary.test.ts` — PASS.
- `node --experimental-strip-types tests/roadmapSize.test.ts` — PASS.

Node printed its expected experimental TypeScript type-stripping warning for the test commands; it did not affect their exit status.

### NOT RUN / blocked by this sandbox

- `npx tsx tests/charter.test.ts`, `npx tsx tests/broker.test.ts`, and `npx tsx tests/charterChange.test.ts` — NOT RUN because `tsx` is not installed in the sandbox and network installation was unavailable. The tests above were executed with Node 22's built-in type stripping instead.
- `npx tsc --noEmit -p tsconfig.json` — BLOCKED, TypeScript reports `TS2688: Cannot find type definition file for 'vite/client'`; the repository's dependencies are not installed in this sandbox. The four new engine files pass the strict standalone check above. The Charter-change test also verifies that a forged `widens: false` flag cannot bypass approval.
- `npm run test:kernel` — BLOCKED immediately with `sh: 1: tsx: not found`.
- The 30 existing `test:kernel` test files were also attempted one by one with `node --experimental-strip-types`. `brainBoundary.test.ts` and `roadmapSize.test.ts` passed; the other 28 could not be executed under that substitute runner because the existing project uses extensionless imports and directory imports that Node's built-in TS runner does not resolve like `tsx`. This is not reported as a pass or as a product-test failure. Re-run the full project suite in the normal installed project environment before merge.
- Cloud build and device tests: NOT RUN.

## Exact `test:kernel` additions

Add these entries to the `test:kernel` script, preserving the existing command order and separators:

```text
tsx tests/charter.test.ts
tsx tests/broker.test.ts
tsx tests/charterChange.test.ts
```

## Limitations and later work

This is a pure decision engine. It cannot know that a human physically pressed an approval button; the later Permissions screen must provide real confirmation and issue the approval object. This job does not persist the Charter, persist or journal decisions, implement the execution loop, implement the journal, connect device permissions, or register the descriptor. A changed Charter is deliberately unsigned until the owner approval path calls `signCharter`. Integrity verification must be performed by the caller and passed as `context.integrity.ok` to the broker.

## Merge status

**Not yet merge-certified.** Focused tests and standalone strict engine type-check passed. Full-project `tsx` tests and project-configured type-check remain blocked by missing sandbox dependencies; the Director should rerun them in the normal project environment before accepting the zip.
