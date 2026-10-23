# C21A: QR decoder (modules to text)

WHO THIS IS FOR: ChatGPT (a NEW chat; it writes code and runs it in its own sandbox). It writes engines and tests only; it never designs screens.
WHAT THIS DOES: Builds the pure engine that READS a QR code once its black and white squares are known: it turns a grid of modules into the text inside, correcting damaged squares. It is the first half of the QR Scanner (the second half, C21B, finds the grid in a camera picture).
WHAT YOU DO: Start now, in parallel with C21B, C22, C23, C24 and B03A, each in its own chat. Attach: this file, AXON_ROADMAP_V17_1.md (the newest roadmap) and BASE.zip (GitHub: Code, Download ZIP of the repository, taken AFTER the TF6 and A15 update is merged and the cloud build is green). It only CREATES files. Paste the one line.
WHAT TO BRING BACK: ONE zip named C21A-qr-decoder.zip (new files only; report at docs/reports/C21A_REPORT.md). Give it to Claude (the Director) to inspect with verify_return.py before anything goes into the repository.
PASTE THIS ONE LINE INTO CHATGPT (then attach the files above): Do the job in the attached file C21A_FOR_CHATGPT_QR_DECODER.md, exactly, using the attached roadmap and the attached BASE zip. Follow the standing rules in it, run and type-check everything yourself, and return one zip.
IF CHATGPT REPLIES WITH ONLY A REVIEW AND A LAW CHECK AND BUILDS NOTHING, paste this in the SAME chat (do not start a new one, do not send it a third time): "Continue now, in this same chat. Do not report again. Write the first file, run its test, then the next, in the priority order. Your next message must contain the zip. If you cannot finish everything, deliver the finished items complete and tested and list the rest."

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB C21A: QR DECODER (a grid of modules to text)

FILES THAT MUST EXIST (stop and say which is missing): src/tools/engines/create/qrCode.ts (the maker; it exports `makeQr`, `QrLevel`, `QR_LIMITS`; its `modules` is a `boolean[][]`, true = dark), tests/qrCode.test.ts.

WHAT TO BUILD (priority order; deliver finished items complete):
1. `src/tools/engines/create/qrDecode.ts` exporting `decodeQr(modules: boolean[][]): QrDecodeResult` with `QrDecodeResult = { ok: true; text: string; version: number; level: QrLevel; mask: number; correctedCodewords: number; mode: 'numeric'|'alphanumeric'|'byte'|'mixed'; transformed: 'none'|'inverted'|'mirrored'|'inverted-mirrored' } | { ok: false; error: 'not-square'|'bad-size'|'format-unreadable'|'version-unreadable'|'too-damaged'|'unsupported-mode'|'bad-data'; message: string }`. All versions 1 to 40 (size 21 + 4 x (version - 1)), all four levels, all eight masks.
2. The full standard decoding, written by you from the ISO 18004 rules, NOT by calling a library: read both copies of the format information (15 bits, BCH checked, pick the closest valid code within 3 errors); version information for versions 7 and up (18 bits, BCH checked); remove the mask; read the codewords in the zigzag order skipping the function patterns (finder, separators, timing, alignment, format, version, dark module); split into blocks by the standard block table for that version and level; correct each block with Reed-Solomon over GF(256) with polynomial 0x11D (Berlekamp-Massey or Euclid, Chien search, Forney); then read the segments: numeric, alphanumeric, byte (valid UTF-8 returns text; invalid UTF-8 is read as ISO-8859-1 and the result says so), ECI header skipped. Kanji and structured-append segments return the typed error `unsupported-mode`; never guess.
3. Tolerance: if the matrix fails as given, try it inverted (light on dark), then mirrored (transposed), then both, and say which one worked in `transformed`. Never more than these four tries.
4. `QR_DECODE_DESCRIPTOR` (toolId `qr-maker`, because the scanner shares that screen), with honest purpose and two examples.

LIMITS: input at most 177 x 177 modules; anything else is `bad-size`. MEASURE and print the time to decode a version 40 symbol. No dependency may be added.

PROOF (derive independently; never from memory):
- Round trip: `makeQr` then `decodeQr` for versions 1 to 10, all four levels, at least 600 seeded random payloads (digits only; uppercase and symbols for alphanumeric; ASCII; accented letters; emoji; the maximum length of each version and level). The text must come back identical.
- Independent vectors for versions above 10: generate at least 40 symbols (versions 11 to 40, all levels) with an independent library in YOUR sandbox (for example Python `qrcode` or `segno`; say which and its version) and store them as `tests/fixtures/qr-vectors.json` (version, level, payload, modules as strings of 0 and 1). Decode them. If no such library can be installed, say NOT RUN for this item and deliver the rest.
- Damage: for each of 60 symbols, damage whole codewords up to the correction capacity of its block (it must still decode and report `correctedCodewords`), then one more than the capacity (it must return `too-damaged`, never wrong text). Count how many times wrong text was returned: it must be 0 in 5,000 damaged cases.
- Garbage: 2,000 random matrices of valid sizes must return a typed failure and never throw or return text.
- Mutation check: break the Reed-Solomon step on purpose and show the tests fail; restore it.

LANE (the only files you may touch; all NEW): src/tools/engines/create/qrDecode.ts, tests/qrDecode.test.ts, tests/fixtures/qr-vectors.json, docs/reports/C21A_REPORT.md. Do not edit qrCode.ts.

DONE MEANS: the round-trip, damage and garbage suites pass with the printed counts; the strict type check is clean; the report lists the exact `test:kernel` line (`tsx tests/qrDecode.test.ts`).

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
