# B03P report — synset ids through the knowledge slot

## Status

**Implementation prepared; validation incomplete; do not merge until the Director reruns the checks.** The supplied BASE archive is present and the edits are limited to the B03P lane. The sandbox could not install the repository's test runner because the npm registry was unreachable (`EAI_AGAIN`). I will not claim tests or type-checks passed when they did not run.

## Top view

AXON's finished design (roadmap Part 5E, section 6) is a dictionary-backed staged assistant with understanding, tools, memory and controlled execution. B03P is in Layer 1, the knowledge slot, feeding Layer 2 Analysis and the upcoming Layer 3 Meaning stage. The principal future risks are losing dictionary order, accidentally applying the five-sense display cap to identifiers, changing lookup counts, or changing legacy replies.

## LAW CHECK (FL11)

- **FL1:** Read the full supplied roadmap and the brain plan/design/vision and job-board/handbook materials before changing direction; this is a narrow foundation-layer change.
- **FL2:** Read the supplied roadmap and relevant repository files before editing; this report records the validation limitation rather than guessing.
- **FL3:** The slot remains source-neutral so later user dictionary and taught-meaning sources can use the same contract.
- **FL4:** One small change; no repeated repair attempts. Stop and report if a defect fails twice.
- **FL5:** Dictionary data and attribution are untouched and remain core.
- **FL6:** No data files or extra dictionary reads are added; identifiers are derived from the already-loaded lookup result and capped at 40.
- **FL7:** Lookup-call measurements and regression tests are specified, but baseline measurements could not be executed in this sandbox and are explicitly marked NOT MEASURED.
- **FL8:** No source-export or repository files are changed; export equivalence still needs the normal Director/cloud validation.
- **FL9:** The change stays in the knowledge slot and Analysis stage, before Meaning; no unrelated repair is attempted.
- **FL10:** No capability registry or chat response behaviour is changed.
- **FL11:** This numbered Law Check is repeated in the report; validation gaps are stated plainly.
- **FL12:** No import-boundary changes and no screen/provider chat bypasses are introduced.
- **FL13:** No fixed word or phrase list is added to `src/brain/mind`; only dictionary-provided identifiers are propagated.
- **Rule 1:** The job is kept small and bounded; a full test run was blocked by unavailable dependencies.
- **Rule 2:** The knowledge-slot contract is the foundation for later stages; no later stage is implemented here.
- **Rule 3:** Only existing lookup results are reused; no new lookup operation is introduced in Analysis.
- **Rule 4:** One builder and one scoped job; tests are included, but test execution remains pending.
- **Rule 5:** This work is the B03P prerequisite immediately before B03A in the brain plan.
- **Rule 6:** The intended proof is the new data-derived test plus all named regression tests and strict TypeScript checking; those commands are listed below with honest outcomes.
- **Rule 7:** Only small string metadata is added; dictionary data is not compressed or degraded.
- **Rule 8:** No device-specific or hardware-dependent code is added.
- **Rule 9:** The package is a lane-only delta from the supplied BASE; Director verification remains required.
- **Rule 10:** The roadmap is not edited.
- **Rule 11:** The exact optional fields are exposed for B03A and remain usable by later knowledge sources.
- **Rule 12:** No guard, test ratchet, or locked file is weakened.
- **Rule 13:** Paths are relative; no new dependencies are added.

## Files changed

1. `src/brain/knowledge/slot.ts` — adds optional `KnowledgeSense.synset` and optional `synsetIds` on found slot/backend results; `createKnowledgeSlot` passes ids only when present.
2. `src/brain/knowledge/dictionarySlot.ts` — attaches each sense's synset and derives unique ids in dictionary order from all matched senses before applying the existing five-meaning display slice; caps ids at 40.
3. `src/brain/mind/analysis/analyze.ts` — copies ids from direct results, accepted irregular/rule base-form results, and phrase hits onto the first phrase token. No lookup call was added.
4. `src/brain/mind/analysis/needs.ts` — corrects the comment so it no longer says the slot cannot expose synset ids; no other requirement flags widened.
5. `tests/synsetIds.test.ts` — new integration test deriving expected ids from real dictionary lookup results; covers order/uniqueness, the five-sense display limit, the 40-id cap, irregular plural base form, unknown word, phrase hit, 30 lookup-count samples, and existing result fields.
6. `docs/reports/B03P_REPORT.md` — this report.

No existing tests were edited. `package.json`, `tools/files.lock`, `tools/guard.mjs`, `.github`, `public/dictionary`, screens, `src/brain/mind/stages.ts`, and the roadmap were not changed.

## Test and command results

- `npm ci --ignore-scripts --no-audit --no-fund` — **BLOCKED**: timed out while npm registry requests failed with `EAI_AGAIN`; `node_modules` was left incomplete.
- `tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck src/brain/knowledge/slot.ts src/brain/knowledge/dictionarySlot.ts src/brain/mind/analysis/analyze.ts src/brain/mind/analysis/needs.ts tests/synsetIds.test.ts` — **BLOCKED**, exit 2: TypeScript reported missing type definition packages `fs-extra`, `jszip`, `node`, `react`, `react-dom`, and `slice-ansi` from the incomplete dependency tree. This is not a successful type-check.
- `tests/synsetIds.test.ts` — **NOT RUN**; `tsx` is unavailable because dependency installation failed.
- `tests/knowledgeSlot.test.ts` — **NOT RUN**, same reason.
- `tests/dictionarySlot.test.ts` — **NOT RUN**, same reason.
- `tests/dictionaryProvider.test.ts` — **NOT RUN**, same reason.
- `tests/analysis.test.ts` — **NOT RUN**, same reason.
- `tests/mindPipeline.test.ts` — **NOT RUN**, same reason.
- `tests/brainGolden.test.ts` — **NOT RUN**; golden replies are therefore **not verified identical**.
- `tests/brainBoundary.test.ts` — **NOT RUN**, same reason.
- `tests/matcher.test.ts` — **NOT RUN**, same reason.
- `git diff --check` — **NOT AVAILABLE** because the supplied repository ZIP has no `.git` directory; this command reported “Not a git repository”.

The new test prints the 30 post-change `lookupCalls` values when it runs. **BASE-before-change values were not measured**, so no before/after equality claim is made here. Mutation testing by reverting each changed file was **NOT RUN** for the same dependency limitation. A Director with the normal Node/tsx environment must run the complete test list, record BASE lookup counts first, compare them, and perform the requested revert checks before merge.

## Exact fields B03A can rely on

- Each displayed `KnowledgeSense` may have `synset?: string`.
- A found `KnowledgeLookupResult` and a found `KnowledgeBackend.lookup` result may have `synsetIds?: string[]`.
- `synsetIds` contains unique ids in matched dictionary order, limited to the first 40 ids, independent of the five-sense display limit.
- Each Analysis `Token` already has `synsetIds?: string[]`; this change fills it for direct hits, accepted irregular/rule base-form hits, and phrase hits on the phrase's first token. Unknown words receive no ids.
- Analysis reuses cached/direct/base/phrase results and introduces no new lookup call by design. The measured before/after equality remains pending.

## `test:kernel` line for the owner

Add `tsx tests/synsetIds.test.ts &&` to the `test:kernel` command, immediately before `tsx tests/knowledgeSlot.test.ts`. `package.json` was deliberately not edited.

## Director verification (Claude, 2026-10-23) — ACCEPTED with one test correction
- BASE and AFTER lookupCalls for the same 30 samples are IDENTICAL (MEASURED): 3,8,5,3,8,6,5,6,1,3,6,8,6,6,5,6,9,12,10,3,6,6,10,10,6,18,9,4,6,8.
- Existing tests pass identically before and after (knowledgeSlot, dictionarySlot, dictionaryProvider, analysis, mindPipeline, brainGolden, brainBoundary, matcher). Whole suite: 82 of 86 files pass in the Director sandbox; the other four (capabilityTruth, engineTruth, userDictionaryImport, zipTool) fail the same way on BASE because the sandbox lacks the jszip package (not a code fault; the cloud build is the proof).
- One test defect fixed by the Director: the irregular-plural check compared ids of "mice" with ids of "mouse". The dictionary resolves "mice" to the noun senses only (4 ids; "mouse" has 6 including the verb), so the code was right and the expectation was wrong. The test now compares with the lookup of "mice" itself. New test: 111 checks pass.
- Mutation check (MEASURED): reverting slot.ts, dictionarySlot.ts or analyze.ts to BASE makes the new test fail each time.
- Single-file strict tsc of the four source files: no error in them (one unrelated import.meta.env error in an untouched file, because the sandbox has no Vite types).
- `tests/synsetIds.test.ts` added to `test:kernel` (package.json) by the Director.
