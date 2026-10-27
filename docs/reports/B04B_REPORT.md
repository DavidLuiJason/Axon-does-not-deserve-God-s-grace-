# B04B Resolution — Builder Report

The finished brain reads a message through typed stages, resolves the understood clause to a declared capability, plans and executes only later, verifies the result, and answers honestly. B04B implements Resolution (stage 5), between Meaning and Dialogue/Judgment: it selects a schema by concept overlap and never runs the selected tool.

## Proof

- Runner: `RESOLVE RUNNER OK (1571 checks, 0 failures; schemas 63; shared-key asks 40)`
- Strict type check: `tsc -p tsconfig.values.json` — PASS (exit 0; no diagnostics).
- Performance: the runner's 500-resolution-under-2-seconds check passed.

## LAW CHECK

- **FL1 Top view:** Resolution is placed between Meaning and Dialogue/Judgment and returns a decision only; execution remains later in the brain.
- **FL3 Plan reaches the end:** output preserves candidates, confidence, missing required slots, and unavailable status for downstream planning and judgment.
- **FL4 Progress first:** one resolver file added; contract, schemas, runner, and launch files were not changed; the supplied proof was run.
- **FL10 Chat control surface:** this resolves against the declared action-schema registry rather than introducing a separate capability list.
- **FL11 Every-Stage Law:** this report records the touched-law check and the exact test/type-check results.
- **FL12 One designed brain:** the resolver does not execute tools; it returns typed resolution data for later stages.
- **FL13 Structure before vocabulary:** no example phrases or tool-specific branches were added; matching uses schema concept keys and the contract's scoring rule.
- **FL15 Verified foundation:** malformed input fails safely, similarity values outside 0..1 are ignored, outputs are deterministic, and the supplied runner passed; this is not a claim that the wider brain is verified.

## Three least-certain real-clause cases

1. A clause whose verb is broad and whose object is omitted may share a common action across several schemas, so asking may be safer but slower than a direct match.
2. A real clause may use a dictionary sense or morphology that Meaning has not normalized to the exact `lemma:pos` key; this resolver cannot recover that missing normalization by itself.
3. A technical name may be mistyped or used in a different sense; exact-only name matching can miss it, while relaxing it could create false matches.

## Known limits (required)

Every current schema accepts both `command` and `ask`, so the act filter cannot be shown to work on the real data. `related` is only a hook; the dictionary-distance function is wired in a later job. The supplied proof does not establish end-to-end brain integration, live registry status correctness, or phone performance.
