# C22: Backup and Restore engine

WHO THIS IS FOR: ChatGPT (a NEW chat; it writes code and runs it in its own sandbox). It writes engines and tests only; it never designs screens.
WHAT THIS DOES: Builds the pure engine of Backup and Restore: it packs the owner's own data (tool stores, My Dictionary, anything a later job registers) into ONE checked zip with a manifest, shows what a backup contains, and restores only the kinds the owner ticks, with an undo copy first. It never touches the English dictionary or the source code.
WHAT YOU DO: Start now, in parallel with C21A, C21B, C23, C24 and B03A, each in its own chat. Attach: this file, AXON_ROADMAP_V17_1.md (the newest roadmap) and BASE.zip (GitHub: Code, Download ZIP of the repository, taken AFTER the TF6 and A15 update is merged and the cloud build is green). It only CREATES files. Paste the one line.
WHAT TO BRING BACK: ONE zip named C22-backup-restore.zip (new files only; report at docs/reports/C22_REPORT.md). Give it to Claude (the Director) to inspect with verify_return.py before anything goes into the repository.
PASTE THIS ONE LINE INTO CHATGPT (then attach the files above): Do the job in the attached file C22_FOR_CHATGPT_BACKUP_AND_RESTORE_ENGINE.md, exactly, using the attached roadmap and the attached BASE zip. Follow the standing rules in it, run and type-check everything yourself, and return one zip.
IF CHATGPT REPLIES WITH ONLY A REVIEW AND A LAW CHECK AND BUILDS NOTHING, paste this in the SAME chat (do not start a new one, do not send it a third time): "Continue now, in this same chat. Do not report again. Write the first file, run its test, then the next, in the priority order. Your next message must contain the zip. If you cannot finish everything, deliver the finished items complete and tested and list the rest."

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB C22: BACKUP AND RESTORE ENGINE

FILES THAT MUST EXIST (stop and say which is missing): src/tools/engines/files/zipTool.ts (exports `createZip`, `listZip`, `extractEntry`, `ZIP_TOOL_LIMITS`), src/tools/shared/toolStore.ts (exports `createToolStore`, `TOOL_STORE_SCHEMA_VERSION`, `TOOL_STORE_LIMITS`, the `ToolStoreStorage` interface), src/tools/engines/dictionary/ (the My Dictionary engine, job C18; read its export and import API and its schema version constant). Find the repository's SHA-256 helper (look under src/tools/engines for a hash and checksum engine); if none exports SHA-256 for bytes, take it as an injected function parameter.

WHAT TO BUILD (priority order; deliver finished items complete):
1. `src/tools/engines/backup/backupPlan.ts` exporting a SOURCE model: `BackupSource = { id: string; label: string; schemaVersion: number; read(): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; message: string }>; write(bytes: Uint8Array, schemaVersion: number): Promise<{ ok: true } | { ok: false; message: string }>; }`. Storage is INJECTED: the engine never touches `localStorage`, files or the network. Include ready adapters `toolStoreSource(toolId, storage)` and `userDictionarySource(...)` built on the real APIs you read.
2. `createBackup(sources, ctx): Promise<BackupResult>` where `ctx = { now: () => number; appVersion: string; sha256: (b: Uint8Array) => Promise<string> }` returns ONE zip (through `createZip`) holding `manifest.json` (format version, created time from `ctx.now`, appVersion, and per source: id, label, schemaVersion, byte size, SHA-256) and one file per source under `data/`. Total cap 24 MB (the owner's GitHub and phone limit); a source over its cap is reported by name, never silently dropped. The manifest never contains the contents of any source. There is no encryption in this job; say so plainly in the descriptor.
3. `inspectBackup(zipBytes, ctx)` returns the manifest and, for every source, whether its file is present and its hash matches, WITHOUT restoring anything. A zip without a valid manifest, a manifest from a NEWER format version, an entry name with path tricks (`..`, absolute, backslash) or a hash mismatch each return a typed, plain-words result.
4. `planRestore(inspection, currentSources, chosenIds)` returns what WOULD change per ticked source (new, replaced, same, newer-schema-refused, older-schema-needs-migration). `runRestore(plan, sources, ctx)` does, for each ticked source in order: read the CURRENT bytes and keep them as an UNDO COPY (returned in the result so the screen can offer Undo), write the backup bytes, read back and compare the hash; if any step fails it puts that source's undo copy back and reports it. Unticked sources are never touched. A backup with a NEWER schema than the app is refused for that source. `undoRestore(result, sources)` puts every undo copy back.
5. `BACKUP_RESTORE_DESCRIPTOR` with toolId `backup-restore` (the exact catalog id), honest purpose, two examples, and inputs.

PROOF (derive independently):
- Round trip with in-memory fake sources: backup then restore into different fake sources gives byte-identical data for 200 seeded random source sets (0 to 8 sources, sizes 0 bytes to 200 KB, binary and text).
- Failure injection: a source whose `write` fails halfway, whose read-back differs, whose schema is newer; a zip with a flipped bit; a truncated zip; a zip with a path-trick entry; a manifest edited by hand. Each must give a typed result, leave unticked sources untouched and put the undo copy back where a write had started. Prove with counters on the fakes that no unticked source was written and that every started write was either completed and verified or rolled back.
- Undo: restore then `undoRestore` returns every source to its exact earlier bytes.
- Size: a set over the 24 MB cap names the offending source.
- Mutation check: remove the read-back comparison on purpose and show the test fails; restore it.

LANE (the only files you may touch; all NEW): src/tools/engines/backup/backupPlan.ts, tests/backupPlan.test.ts, docs/reports/C22_REPORT.md. Do not edit toolStore.ts, the dictionary engine or zipTool.ts.

DONE MEANS: all suites pass with printed counts, the strict type check is clean, the report lists the exact `test:kernel` line (`tsx tests/backupPlan.test.ts`). The report must also LIST, in plain words, which of the app's real stores exist and have no adapter yet (chat history, settings, word book: find out from the code, do not guess) so the Director can plan them.

---

## STANDING RULES (apply to every step of the job)

START RULE: after the one short paragraph and the LAW CHECK, START BUILDING IN THE SAME REPLY. Do not ask permission, do not stop to restate a plan, do not end your turn with a status report. Your next deliverable after the LAW CHECK is working files and, at the end, the zip. A reply that contains only a review and a Law Check is a FAILED delivery (this has happened before). Work in small verified steps: write ONE file, run its test, fix it, then the next file.

QUALITY LAW (owner, ABSOLUTE): the result must be perfect on its FIRST delivery. Do not hand back anything that merely looks finished.
1. RUN everything yourself in your sandbox before you hand anything over: unpack the repository zip you were given, install what it needs (package.json, tsconfig.json, tsx and the tests under tests/ are there), run every new test with `npx tsx tests/NAME.test.ts`, run the existing tests the job could affect (at least every command in the `test:kernel` script of package.json that does not depend on this job being merged), and run the type check with the project's own options (`npx tsc --noEmit -p tsconfig.json`; this is the project's `lint` script). A returned file that fails the type check is a failed delivery.
2. If your sandbox cannot run something (no internet to install, no tsx, no tsc), say exactly which step was NOT RUN and why, and do the strictest manual check you can. Never write "should work" or "tested" for something you did not run. Evidence labels: MEASURED (you ran it and saw the result), NOT RUN, HYPOTHESIS.
3. NO stubs, NO placeholders, NO "TODO", NO empty functions, NO hard-coded or fake results, NO simplified version that only works for the happy path, NO file that compiles but does nothing. Every error path returns a typed, honest error. Never claim an ability the code does not have.
4. Derive every expected number in a test by an INDEPENDENT calculation (Python with Decimal, hashlib, zlib and so on), never from memory. Break each new behaviour on purpose (empty input, huge input, odd characters, emoji, right-to-left text, zero, negative, wrong types) and keep those cases as tests. Seeded random tests use a fixed seed so they repeat.
5. If you cannot finish everything in one run, work in the PRIORITY ORDER given, deliver the finished items complete and tested, and list the unfinished ones plainly. NEVER deliver a half-built item. A smaller perfect delivery beats a larger broken one. Redoing work is worse than anything.
6. The weakest phone we support is an Infinix Note 10 (low memory). Cap input sizes with an honest typed error, never loop without a bound, never allocate without a bound.

ENGINE CONTRACT (every engine file in this job):
- PURE TypeScript. No React, no JSX, no DOM, no `window`, no `localStorage`, no network. Anything that needs time, randomness or storage is INJECTED as a parameter so tests control it. (The only exception is a job that names a .tsx file in its LANE.)
- Exported limit constants (for example `LOAN_LIMITS`) and exported types. Functions never throw for bad input: they return a typed result such as `{ ok: true, ... } | { ok: false, error: 'code', message: 'plain words' }`.
- Each tool-facing engine file also exports ONE descriptor object named `<TOOL>_DESCRIPTOR` = `{ toolId, displayName, purpose, examples: string[], inputs: { name: string; kind: 'text' | 'choice' | 'file' | 'yes-no'; choices?: string[]; prompt?: string }[] }` with 2 or 3 honest examples (documentation and tests only; the brain never matches on them: FL13). The `toolId` MUST be the exact catalog id from `src/tools/toolCatalog.ts`: loan-calculator, split-bill, pattern-tester, device-profile, json-viewer, file-inspector, qr-maker, zip-tool, code-formatter, file-compare (a new entry added later), and 'converter' for the format hubs and image planning. Do NOT register anything in the capability registry and do NOT edit the tool menu: a later job does both.
- No new dependency (jszip is already installed; only a job that names it may use it). No regular-expression literal inside `src/brain/mind`. Never add words or phrases to the brain.

LANE AND FILES: create or change ONLY the files named in the LANE section. Never edit package.json, tools/files.lock, tools/guard.mjs, .github, public/dictionary, src/App.tsx, src/tools/toolCatalog.ts or anything under src/components (unless the LANE names it). Never delete, rename or shorten an existing file. Do NOT edit package.json: REPORT the exact new lines to add to the `test:kernel` script (each as `tsx tests/NAME.test.ts`).

RETURN: ONE zip of NEW and CHANGED files only, paths relative to the repository root, no top folder needed, no nested zips, containing the report file named in the job. Create it with your code tool and give the download link. The report must contain: your LAW CHECK; every file created or changed; the exact commands you ran with the real pass or fail results and check counts; anything NOT RUN; anything unfinished; the package.json test lines to add.

CHECK THE BASE FIRST: the job names files that must exist in the repository zip you were given. If any is missing, STOP and say which.
