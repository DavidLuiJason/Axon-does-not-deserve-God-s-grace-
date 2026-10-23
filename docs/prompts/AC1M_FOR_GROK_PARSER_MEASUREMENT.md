# AC1M: Measure the code parsers for AXON Code (Code Reader)

WHO THIS IS FOR: Grok (shell work and measurements). It builds nothing for the app and changes no AXON file.
WHAT THIS DOES: Measures, with real numbers, which small parser could read JavaScript and TypeScript inside AXON for the Code Reader (AXON Code step AC1), so the Director can choose by evidence and not by memory.
WHAT YOU DO: Open a NEW Grok chat with a working shell and internet. Attach: this file and AXON_ROADMAP_V17_1.md. No repository zip is needed. Paste the one line.
WHAT TO BRING BACK: ONE file `AC1M_REPORT.md` (the tables and the plain-words findings below) and the small script files you used, in one zip `AC1M-measure.zip`. Give it to Claude (the Director).
PASTE THIS ONE LINE INTO GROK (then attach the files above): Do the measurement job in the attached file AC1M_FOR_GROK_PARSER_MEASUREMENT.md exactly, in a temporary folder, and return one zip with the report.

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB AC1M: PARSER MEASUREMENT (at most seven steps; do not mix installing, measuring and judging)

WHY: the Code Reader must find syntax errors and an outline (functions, classes, imports, exports) with line and column, run inside a phone app (Android web view), on the weakest phone (Infinix Note 10), with a small download. The app target size is 50 MB in total and today's APK is about 24 MB, so every megabyte counts. We must not guess which parser to take.

CANDIDATES (measure all that install; say which did not): acorn, acorn-walk, meriyah, esprima, @babel/parser, sucrase (parse only), typescript (the compiler, as the TypeScript reference), @swc/wasm-web, tree-sitter with the javascript and typescript grammars compiled to wasm (web-tree-sitter). Also name any other small parser you find that reads TypeScript and JSX, with its licence.

STEPS
1. In a temporary folder, `npm init -y` and install each candidate separately (record version and the exact command). Record the licence of each (read the package's licence file, do not guess).
2. SIZE: for each candidate bundle ONE import with esbuild (`--bundle --minify --format=esm`) into one file and record the minified bytes and the gzip bytes (`gzip -9`). For wasm candidates record the .wasm bytes and gzip bytes too. Print a table.
3. FEATURES (a small script per candidate): can it parse (a) modern JavaScript (classes, async, optional chaining, private fields), (b) TypeScript (types, interfaces, generics, enums), (c) JSX and TSX, (d) JSON, (e) a file with ONE syntax error in the middle: does it report the line and column, and does it keep going and still give an outline of the rest (error recovery) or stop at the first error? Table of yes, no, partial, with the exact error text for (e).
4. SPEED: generate three files of valid JavaScript (1,000, 5,000 and 20,000 lines; write the generator and keep it) and the same in TypeScript where supported. Measure parse time in Node 22 (median of 20 runs, after 3 warm-up runs) and the peak memory (`process.memoryUsage().rss` difference). Print a table. State plainly that Node on this machine is much faster than the target phone; do not convert the numbers.
5. OUTLINE: for the two best candidates by size and features, write a 40-line script that lists the top-level functions, classes, imports and exports with line numbers for a sample file, to prove the outline is reachable from the parse result.
6. LOAD IN A WEB WORKER: for the two best candidates, show that the bundle loads and parses inside a browser Web Worker created from a blob (use a headless browser such as Playwright's Chromium if you can install it; if not, say NOT RUN).
7. FINDINGS: write `AC1M_REPORT.md` with the tables, the licences, what was NOT RUN and why, and a short recommendation of at most 8 lines (which parser for JavaScript and TypeScript, which for the rest, and what the size cost is). Label every statement MEASURED, NOT RUN or HYPOTHESIS.

RULES: never invent a number; if a step fails twice, stop that candidate and say so (two-strike rule); do not install anything outside the temporary folder; do not edit any AXON file; keep every script so the Director can rerun it.
