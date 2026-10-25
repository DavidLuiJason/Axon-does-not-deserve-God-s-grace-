# B03B2c Report — References and Relays

## Result

Implemented `src/brain/mind/meaning/structure/references.ts` as a pure `readReferences` function. It imports all four closed word groups from `REF_WORDS`, preserves input data, returns an entry for each range position, identifies pointers in word order, marks `needsPrevious`, and detects the specified speech-verb infinitive relays.

## Proof results

- `node run.mjs tests/refRunner.test.ts` — **PASS**; `refRunner: 96 checks, 0 failures`; printed `REF RUNNER OK`.
- `node run.mjs tests/valuesGuard.test.ts` — **PASS**; `valuesGuard: 7 files scanned, 16 checks passed`.
- `tsc -p tsconfig.values.json` — **PASS**; exited successfully with no diagnostics.
- Extra `tests/refOwn.test.ts` and mutation tests — **NOT RUN**; no optional test file added.

## LAW CHECK (FL11)

- **FL1:** This job fits the approved Meaning Stage and its existing sequence.
- **FL2:** Read the complete supplied roadmap and inspect only the named mini-base files and permitted deliverables.
- **FL3:** Keep pointer and relay output suitable for later meaning and reference resolution.
- **FL4:** Run the specified proof and stop after two failed attempts at the same problem.
- **FL9:** Implement the defined structural rules without moving work into later stages.
- **FL11:** Include this law check in the report.
- **FL13:** Import the approved closed word groups from `REF_WORDS`; add no fixed phrase lists.

## Not done / limitations

- The optional independent 15-case suite and six mutation tests were not created or run.
- Integration into the Meaning pipeline was not attempted; the prompt assigns that wiring to the Director.
- Sentence type not covered by the runner that may expose a limit: coordinated or elliptical relay content such as “Tell Tom to call me and Anna to text you” may need a later clause-structure rule to distinguish the two reported actions.
