# C21B: QR locator (camera picture to a grid of modules)

WHO THIS IS FOR: ChatGPT (a NEW chat; it writes code and runs it in its own sandbox). It writes engines and tests only; it never designs screens.
WHAT THIS DOES: Builds the pure engine that FINDS a QR code inside a picture (pixels from the camera or a photo) and returns its grid of black and white squares, ready for the decoder (job C21A). It is the second half of the QR Scanner.
WHAT YOU DO: Start now, in parallel with C21A, C22, C23, C24 and B03A, each in its own chat. It does not need C21A: it returns the grid and stops. Attach: this file, AXON_ROADMAP_V17_1.md (the newest roadmap) and BASE.zip (GitHub: Code, Download ZIP of the repository, taken AFTER the TF6 and A15 update is merged and the cloud build is green). It only CREATES files. Paste the one line.
WHAT TO BRING BACK: ONE zip named C21B-qr-locator.zip (new files only; report at docs/reports/C21B_REPORT.md). Give it to Claude (the Director) to inspect with verify_return.py before anything goes into the repository.
PASTE THIS ONE LINE INTO CHATGPT (then attach the files above): Do the job in the attached file C21B_FOR_CHATGPT_QR_LOCATOR.md, exactly, using the attached roadmap and the attached BASE zip. Follow the standing rules in it, run and type-check everything yourself, and return one zip.
IF CHATGPT REPLIES WITH ONLY A REVIEW AND A LAW CHECK AND BUILDS NOTHING, paste this in the SAME chat (do not start a new one, do not send it a third time): "Continue now, in this same chat. Do not report again. Write the first file, run its test, then the next, in the priority order. Your next message must contain the zip. If you cannot finish everything, deliver the finished items complete and tested and list the rest."

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB C21B: QR LOCATOR (pixels to a grid of modules)

FILES THAT MUST EXIST (stop and say which is missing): src/tools/engines/create/qrCode.ts (`makeQr` gives test grids; `modules` is a `boolean[][]`, true = dark), tests/qrCode.test.ts.

WHAT TO BUILD (priority order; deliver finished items complete):
1. `src/tools/engines/create/qrLocate.ts` exporting `locateQr(image: { width: number; height: number; data: Uint8ClampedArray }, options?: { maxMilliseconds?: number; now?: () => number }): QrLocateResult`. `data` is RGBA like a browser `ImageData`. `QrLocateResult = { ok: true; candidates: { modules: boolean[][]; version: number; corners: [Pt, Pt, Pt, Pt]; score: number }[] } | { ok: false; error: 'bad-image'|'too-large'|'no-code-found'|'time-limit'; message: string }`. Candidates are sorted best first; at most 3 are returned.
2. The method (write it yourself, no library): grey level; adaptive threshold from a local mean using an integral image (so uneven light and shadows do not break it); find the three finder patterns by run-length ratio 1:1:3:1:1 along rows AND columns and cross-check each hit in both directions; group three finders into a right-angled corner (use the distances, never assume the picture is upright); estimate the version from the distance between finders (versions 1 to 40, grid size 21 + 4 x (version - 1)); for version 2 and up find the alignment pattern near its expected place and use it to correct the bottom-right corner; build a perspective transform (a homography from four corner points) and sample the centre of every module, deciding dark or light by the mean of a small patch, not one pixel; return the grid.
3. Also accept dark-on-light and light-on-dark pictures (try the inverse threshold when the first fails), and a mirrored picture (return the grid as seen; the decoder tries mirroring itself).
4. A work cap for the weakest phone (Infinix Note 10): pictures larger than 1.5 million pixels are processed on a block-averaged copy (an integer factor), never a bigger buffer; every loop is bounded; `maxMilliseconds` (default 250) is checked with the INJECTED clock `now` and returns `time-limit` if passed. No `Date.now()` or `performance` inside the engine except as the default for `now`.
5. `QR_LOCATE_DESCRIPTOR` (toolId `qr-maker`, because the scanner shares that screen), honest purpose, two examples.

PROOF (derive independently; never from memory):
- Build a test renderer in the test file that draws a `makeQr` grid into an RGBA picture: any module size from 2 to 12 pixels, a quiet zone of 4 modules or less, rotation of any angle (test 0, 15, 45, 90, 137, 200, 271 degrees), perspective tilt up to 25 degrees, blur (box blur of radius 1 and 2), random noise of 8 and 20 grey levels, a left-to-right brightness slope, dark-on-light and the inverse, and the symbol placed anywhere with clutter around it (stripes, a second small box).
- For versions 1, 3, 7 and 10 (all four levels) and every condition above singly and in three seeded random combinations, the returned grid must be EXACTLY the original for at least 95 percent of cases. PRINT the success table per condition and the cases that failed, and say honestly which condition is weakest. Do not tune the test until it passes: the numbers you print are the proof.
- False positives: 300 seeded pictures with no code (blank, noise, gradients, text-like stripes, a finder-pattern look-alike) must all return `no-code-found`.
- Garbage: wrong sizes, empty `data`, `data` shorter than width x height x 4, NaN sizes: typed `bad-image`, never a throw.
- Speed: MEASURE the time for a 640 x 480 and a 1280 x 720 picture on your machine and print it; say clearly that your machine is faster than the target phone (HYPOTHESIS for the phone).
- HONEST LIMIT to write in the report: real camera pictures (motion blur, glare, curved surfaces) are NOT testable here; the owner's phone test decides.

LANE (the only files you may touch; all NEW): src/tools/engines/create/qrLocate.ts, tests/qrLocate.test.ts, docs/reports/C21B_REPORT.md. Do not edit qrCode.ts.

DONE MEANS: the success table is printed with the counts above, false positives are 0 of 300, the strict type check is clean; the report lists the exact `test:kernel` line (`tsx tests/qrLocate.test.ts`).

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
