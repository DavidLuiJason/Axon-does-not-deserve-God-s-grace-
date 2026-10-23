# C24: Tool manual builder (every tool describes itself)

WHO THIS IS FOR: ChatGPT (a NEW chat; it writes code and runs it in its own sandbox). It writes engines and tests only; it never designs screens.
WHAT THIS DOES: Builds the pure engine that turns the tools' own descriptions into ONE source of truth for three things: the "what can you do" answer, the user manual in settings, and a check that every open tool is properly described. Adding a tool later then means adding its one description; nothing else is edited by hand.
WHAT YOU DO: Start now, in parallel with C21A, C21B, C22, C23 and B03A, each in its own chat. Attach: this file, AXON_ROADMAP_V17_1.md (the newest roadmap) and BASE.zip (GitHub: Code, Download ZIP of the repository, taken AFTER the TF6 and A15 update is merged and the cloud build is green). It only CREATES files. Paste the one line.
WHAT TO BRING BACK: ONE zip named C24-tool-manual.zip (new files only; report at docs/reports/C24_REPORT.md). Give it to Claude (the Director) to inspect with verify_return.py before anything goes into the repository.
PASTE THIS ONE LINE INTO CHATGPT (then attach the files above): Do the job in the attached file C24_FOR_CHATGPT_TOOL_MANUAL_BUILDER.md, exactly, using the attached roadmap and the attached BASE zip. Follow the standing rules in it, run and type-check everything yourself, and return one zip.
IF CHATGPT REPLIES WITH ONLY A REVIEW AND A LAW CHECK AND BUILDS NOTHING, paste this in the SAME chat (do not start a new one, do not send it a third time): "Continue now, in this same chat. Do not report again. Write the first file, run its test, then the next, in the priority order. Your next message must contain the zip. If you cannot finish everything, deliver the finished items complete and tested and list the rest."

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB C24: TOOL MANUAL BUILDER

FILES THAT MUST EXIST (stop and say which is missing): src/tools/toolCatalog.ts (groups, tools, `status` available or coming-soon, `opens`), src/tools/engines/legacyDescriptors.ts, src/capabilities/ (the capability registry and `registerEngineTools.ts`), tests/engineTruth.test.ts and tests/capabilityTruth.test.ts (read them: they already keep the menu, registry and engines in step; your job reuses what they know and does not repeat them). Read roadmap FL10 first: every capability is declared once, described only from the registry, and the chat never claims an unbuilt ability.

WHAT TO BUILD (priority order; deliver finished items complete):
1. `src/tools/manual/manualBuilder.ts` exporting `buildManual(input: ManualInput): Manual`, pure, with `ManualInput = { groups; tools; descriptors; chatActions }` taking the REAL shapes from the catalog and registry (import their types; the engine receives the data as arguments and never imports a screen or reads storage). `Manual` = per group, per tool: name, one-line "what it does" (from the descriptor's `purpose`), "what you give it" (descriptor `inputs`, in plain words), "what you get back", `availability` (`open`, `not-built`, `left-out`), `chatState` (`ready`, `not-built`), and the descriptor's examples marked as examples only (documentation, never matched: FL13). The output is data, plus `toMarkdown(manual)` for the settings page; never JSX.
2. `describeCapabilities(manual): string[]` for the chat's "what can you do" answer: lists EXACTLY the open tools, says in one sentence which are not built and which chat actions do not exist yet, and never names a tool or action that is not in the data. No fixed sentences about a specific tool: every sentence is assembled from fields.
3. `checkManualComplete(input): { ok: boolean; gaps: Gap[] }` where a Gap is a tool id plus the missing field (no descriptor, empty purpose, no inputs although the tool has screen fields, `toolId` not equal to its catalog id, a registry entry without a catalog tool, a catalog tool that is open but has no descriptor). It never throws and lists EVERY gap.
4. Growth proof: the test must show that adding ONE new fake catalog entry plus ONE fake descriptor to the input data makes it appear in the manual and in `describeCapabilities`, and that removing its descriptor makes it appear in the gap list, with no other file changed.

PROOF (derive independently):
- Run the builder over the REAL catalog and descriptors of this repository (read-only). PRINT the real gap list. Do NOT make the test fail on real gaps (they are information for the next brain job); the test fails only if the builder itself is wrong.
- Truth tests: every open tool in the catalog appears with `availability: 'open'`; every coming-soon tool appears as `not-built`; `describeCapabilities` mentions each open tool exactly once and no tool that is not in the data; the counts of open and not-built tools in the output equal the counts computed independently from the catalog file by a plain script.
- Mutation checks: make `describeCapabilities` invent a tool name, and make it skip one open tool; both must fail the tests; restore.
- Hostile data: descriptors with missing fields, duplicate ids, a descriptor for a tool that does not exist, empty arrays: typed gaps, no throw.
- Size: the Markdown for the whole manual is measured and printed (characters); it must stay a calm, short page (one line per tool); add no more fields than the ones above.

LANE (the only files you may touch; all NEW): src/tools/manual/manualBuilder.ts, tests/manualBuilder.test.ts, docs/reports/C24_REPORT.md. Do not edit the catalog, registry or any screen. Do not wire it into the chat: a later brain job does that (FL12).

DONE MEANS: all suites pass with printed counts, the strict type check is clean, the report lists the exact `test:kernel` line (`tsx tests/manualBuilder.test.ts`) and the real gap list in plain words.

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
