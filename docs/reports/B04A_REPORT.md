# B04A — Action Schemas Report

## Result

- **Delivered:** `src/brain/mind/schema/actionSchemas.ts`.
- **Schema count:** 63 schemas for 63 facts, in the same order as `tests/fixtures/toolFacts.json`.
- **Runner:** `node run.mjs tests/actionSchemasRunner.test.ts` — `ACTION SCHEMAS RUNNER OK`; 472 checks, 0 failures. All 44 deliberate mutants were caught; 0 were inapplicable or unrun.
- **FL13 guard:** `node run.mjs tests/valuesGuard.test.ts` — PASS; 2 files scanned, 6 checks passed.
- **Type check:** `tsc -p tsconfig.values.json` — PASS.
- **Derived statuses reported by the runner:** ready 3, built 37, unbuilt 18, left-out 5.
- **Own extra test:** not added; the supplied proof runner was used unchanged.

## LAW CHECK (repeated from the build)

- **FL1 Top view:** B04A is the first Resolution-stage schema layer; B04B will match requests by meaning, and Judgment later relies on declared effects, preconditions, cost and undo.
- **FL2 Read what the job needs:** read the roadmap, this job prompt, the contract, all 63 facts, the runner, the guard and run scripts; did not inspect unrelated mini-base files.
- **FL3 Plan reaches the end:** every fact receives an honest schema, including unbuilt and left-out abilities; effects and undo are available for later planning.
- **FL4 Progress first / Two-Strike Rule:** ran the requested proof and guard, then the configured TypeScript check; one source-guard failure was corrected once, then the full proof passed.
- **FL5 Dictionary is core:** concepts are checked against the supplied lemma list; no dictionary data was changed or omitted from the package's source context.
- **FL10 Declare capabilities once:** schemas use each fact's stable ID and exact input names; status remains derived from the facts, not duplicated in schema data.
- **FL11 Every-Stage Law:** this visible law check is included here and was considered before building.
- **FL12 One designed brain:** this is pure schema data and lookup logic only; it does not execute tools or answer chat directly.
- **FL13 Structure before vocabulary:** meaning uses dictionary lemma concepts and only three technical names absent from the dictionary (`pdf`, `qr`, `json`); no example phrases or fixed phrase routing were added.
- **FL15 Verified foundation:** the runner checks every schema, lookup behaviour, dictionary concepts, cross-field safety rules and 44 deliberate mutants; all passed. Costs remain labelled estimates.

## Five schemas with the greatest uncertainty

1. **Interface Capture (`interface-capture`):** its fact has no input descriptor, so the schema can only describe capture/export at a broad level.
2. **Background Proof (`background-proof`):** the fact mentions native heartbeats but exposes no typed inputs or engine descriptor.
3. **AI Assistant (`ai-assistant`):** the description is broad and does not establish which underlying operations or external services are actually available.
4. **Voice Library (`voice-library`):** the description names adjustable voice properties but provides no descriptor to establish which changes persist or which controls are implemented.
5. **Voice Cloner (`voice-cloner`):** consent is reflected as an owner-approval precondition, but the fact does not specify the actual capture, model, or storage mechanism.

## A situation this proof does not cover

The proof cannot establish that a schema's declared effects, permissions, or estimated phone cost match the eventual runtime implementation; a descriptor can be internally consistent while the real tool behaves differently.

## Scope and limitations

No schema wires a chat action into execution. Network and device preconditions are declarations for later stages, not proof that a service, permission broker, sensor, or native engine is installed. The job's required files were the only deliverables in the zip; the contract, facts, lemma list, runner, and guard were not modified.
