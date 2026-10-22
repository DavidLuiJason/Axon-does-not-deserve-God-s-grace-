# C08: Code formatter engine: JSON, CSS, HTML, XML

WHO THIS IS FOR: ChatGPT (a NEW chat; it writes code and runs it in its own sandbox). It writes engines and tests only; it never designs screens.
WHAT THIS DOES: Builds an engine that pretty-prints and minifies JSON, CSS, HTML and XML without changing their meaning.
WHAT YOU DO: Only after the wave 1 jobs it depends on were inspected and merged. Attach: this file, AXON_ROADMAP_V16_3.md and a FRESH BASE.zip (GitHub: Code, Download ZIP after the merge). Paste the one line. Depends on C02 (the JSON tokenizer).
WHAT TO BRING BACK: ONE zip named C08-code-format.zip (new files only; report at docs/reports/C08_REPORT.md). Give it to Claude (or the next Director account) to inspect before anything goes into the repository.
PASTE THIS ONE LINE INTO CHATGPT (then attach the files above): Do the job in the attached file C08_FOR_CHATGPT_CODE_FORMATTER.md, exactly, using the attached roadmap and the attached BASE zip. Follow the standing rules in it, run and type-check everything yourself, and return one zip.
IF CHATGPT REPLIES WITH ONLY A REVIEW AND A LAW CHECK AND BUILDS NOTHING, paste this in the SAME chat (do not start a new one, do not send it a third time): "Continue now, in this same chat. Do not report again. Write the first file, run its test, then the next, in the priority order. Your next message must contain the zip. If you cannot finish everything, deliver the finished items complete and tested and list the rest." 

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB C08: CODE FORMATTER ENGINE

FILES THAT MUST EXIST IN THE BASE (stop if missing): src/tools/engines/data/jsonTokens.ts (made by job C02), tsconfig.json.

THE JOB. `src/tools/engines/code/codeFormat.ts`, test `tests/codeFormat.test.ts`. `formatCode({ language: 'json' | 'css' | 'html' | 'xml', mode: 'pretty' | 'minify', indent: 2 | 4 | 'tab', input })` returns `{ ok: true, output } | { ok: false, error, line, column, message }`. Never a half-formatted result on invalid input.
JSON: use `jsonTokens.ts` (pretty and minify there), exact number text, key order and duplicate keys kept.
CSS: rules, selectors lists, declarations, nested at-rules such as @media and @supports, @font-face, comments kept in pretty mode, strings and url() untouched, `!important`, custom properties; minify removes comments and unneeded whitespace without changing meaning (keep the spaces that matter, for example in selectors like `a b` and values like `1px -2px`, and the space before `(` in `and (`).
HTML: block elements on their own lines and indented, inline elements stay inline, void elements (br, img, input, meta, link, hr and so on) handled, comments kept, attributes kept exactly as written, the content of pre, textarea, script and style left EXACTLY as written, case of tag names kept. Minify collapses whitespace between block elements only and never inside pre or textarea.
XML: elements, attributes, text, CDATA, comments, declaration, processing instructions; mixed content (text next to elements) keeps its text exactly.
JavaScript and TypeScript are NOT supported: return a typed error 'unsupported-language' (do not fake it). Descriptor `CODE_FORMAT_DESCRIPTOR` (toolId 'code-formatter'). Limits: 2 MB, depth 200, explicit stacks.
PROOF: over at least 300 seeded random inputs per language: pretty is idempotent (pretty of pretty equals pretty); minify of pretty equals minify of the original; for JSON and XML the parsed value is equal before and after (compare with an independent parse in the test; for XML you may use the engine from job C03 only if it exists in the base, otherwise compare a normalised token stream); plus hand-made cases whose expected output you derive independently, plus hostile inputs (unterminated strings and comments, unbalanced braces, deep nesting, huge lines, odd unicode).

LANE: NEW src/tools/engines/code/codeFormat.ts, tests/codeFormat.test.ts, docs/reports/C08_REPORT.md. Nothing else.

DONE MEANS: all four languages pass their properties and cases, the type check and the whole `test:kernel`; the report lists the test line to add.

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
