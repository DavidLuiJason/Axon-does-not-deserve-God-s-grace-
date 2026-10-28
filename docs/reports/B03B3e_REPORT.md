# B03B3e — Contradiction Check and Replaced-Memory History Report

## Top view

Finished AXON contains the core dictionary, a staged and traced understanding brain, exact tool engines and chat-controlled capabilities, voice/media, memory, and permission-governed reach. B03B3e sits in Meaning/Mind memory notes (roadmap 7B and 7D) and supplies the contradiction/history engine before the notes system is wired into the app. Later breakage could occur if the existing notes API or note-state rules change, if consumers ignore replacement markers, or if log limits are exceeded; this job does not wire the engine into the app.

## LAW CHECK (FL11)

### Foundation laws

- **FL1 — Top view:** Read the full supplied v20.0 roadmap and the complete job prompt before building; this job is placed in roadmap 7B/7D.
- **FL2 — Read exact scope:** Read the prompt and roadmap fully and read the mini-base `notes.ts`, `notesTypes.ts`, package configuration and test-style file. No files outside the mini-base were used.
- **FL3 — End-to-end plan:** The engine leaves app wiring and UI to later jobs and preserves the existing notes API.
- **FL4 — Progress/no repeats:** Built one bounded engine and its tests; recorded the failed `npx tsx` route and used the available Node TypeScript-strip runner instead, without repeating the same failed install attempt.
- **FL5 — Dictionary is core:** No dictionary file or dictionary behavior was changed.
- **FL6 — Searchable compression:** No shelf or large data was added; the replacement log has explicit record and serialized-size limits.
- **FL7 — Measure why:** Differential tests, mutation checks, type checks and a measured 2,000-note timing check were run; evidence is labelled below.
- **FL8 — Export is the way home:** No source export/repository comparison can be run from this mini-base; no export files were touched.
- **FL9 — Plan first:** This is the roadmap's B03B3e prerequisite to notes wiring, with only the named new engine, test and report created.
- **FL10 — Chat is control surface:** No capability registry or tool menu was changed; this engine is not registered or wired.
- **FL11 — Every-Stage:** This law check is included here and covers the applicable foundation and building rules.
- **FL12 — One designed brain:** Pure engine only; no independent screen, tool answer or execution path was added.
- **FL13 — Structure before vocabulary:** No phrase matching or fixed phrase list was added. Closed decision/verdict labels are encoded as one space-separated string and split for validation.

### Building rules

- **Rule 1 — Capacity:** Kept to one engine and one test file plus this report; used the supplied mini-base and global TypeScript compiler.
- **Rule 2 — Foundation size:** No higher-level wiring or UI was placed on this engine.
- **Rule 3 — Foundation-up:** Reuses `topicKey`, `proposeNote`, `keepNote`, `removeNote` and the existing note types rather than duplicating their logic.
- **Rule 4 — One builder, sized job, proof:** One pure TypeScript engine, bounded inputs and deterministic tests.
- **Rule 5 — Plan before work:** Followed the named priority order and file lane.
- **Rule 6 — Measure → design → build → prove:** Ran type checks, the test suite, differential tests, mutation tests and timing measurement.
- **Rule 7 — Compress losslessly:** No large data is introduced; log serialization/parsing has explicit limits.
- **Rule 8 — Weakest intended phone:** Caps note scans at 5,000 and log records at 5,000; measured the 2,000-note judge-less path.
- **Rule 9 — Verify returned zips:** This is the builder return, not a Director merge; no repository-vs-return comparison tool is present in the mini-base.
- **Rule 10 — Roadmap ownership:** The roadmap was not edited.
- **Rule 11 — Future compatibility:** Public types and existing notes functions are reused; replacement history retains old text and term.
- **Rule 12 — Guards/tests/ratchets:** Added deterministic differential, refusal, history, serialization, malformed-input and speed coverage. The source guard scan found no regex literal and no runtime array of three-or-more string literals; closed labels are split from a single string.
- **Rule 13 — Migration:** Only relative imports and the three requested relative paths are used; no hidden dependency or package change was added.

### Additional applicable foundation laws

- **FL14:** Uses the existing pure notes engine as the single source of truth; no copied note-operation implementation was introduced.
- **FL15:** Failure paths are typed, limits are explicit, old memory remains recoverable, and tests check that replacement history is retained. This engine does not independently verify whether two claims contradict; it needs the injected judge for comparisons outside the same-term/different-meaning rule.

## Files created

- `src/brain/mind/memory/notes/contradiction.ts` — pure contradiction check, owner decision flow, replaced-history records, reminder line and bounded log serialization.
- `tests/contradiction.test.ts` — independent naive differential reference, seeded cases and behavior/regression tests.
- `docs/reports/B03B3e_REPORT.md` — this report.

No existing files were changed in the deliverable. No package file was edited.

## Commands and evidence

- **MEASURED — PASS:** `tsc --noEmit -p tsconfig.json` — exit 0.
- **MEASURED — PASS:** `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck src/brain/mind/memory/notes/contradiction.ts` — exit 0.
- **NOT RUN as specified:** `npx --yes tsx tests/contradiction.test.ts` did not complete; the attempt stalled while resolving/installing `tsx` and was interrupted after the execution limit. No claim is made that this command passed.
- **MEASURED — PASS (equivalent runner):** `node --experimental-strip-types tests/contradiction.test.ts` — 644 assertions passed, including 300 seeded differential stores and 300 malformed-input probes. Because Node's built-in TypeScript stripping requires explicit `.ts` import suffixes, suffixes were applied temporarily for this run and restored immediately; the delivered source retains the repository's extensionless import style.
- **MEASURED — PASS:** 2,000 kept notes, judge-less path: 4.06 ms on this sandbox, below the 50 ms requirement. This is a sandbox measurement, not a phone/device result.
- **MEASURED — PASS:** Mutation checks detected all three intentional faults: removed log append; skipped `removeNote`; changed store on cancel. Each mutation made the test fail, and the original source was restored after each check.
- **MEASURED — PASS:** Source guard scan: 0 regex literals; 0 runtime arrays containing three or more string literals; 0 fixed phrase lists.
- **NOT RUN:** Existing `test:kernel` suite and repository-wide tests. The supplied mini-base intentionally does not include them, so they cannot honestly be run here.

## `test:kernel` addition

Add this command to the `test:kernel` script in the Director's repository (do not edit `package.json` in this return):

`tsx tests/contradiction.test.ts`

## Limits and unfinished checks

- The engine cannot decide by itself that two facts are opposites. The injected `NoteJudge` must make that judgment; without one, only same-term/different-meaning conflicts are detected.
- This engine is not wired into app flows, persistence or UI; that is deliberately outside this job.
- The prescribed `npx tsx` invocation and existing repository test suite remain **NOT RUN** as detailed above.
