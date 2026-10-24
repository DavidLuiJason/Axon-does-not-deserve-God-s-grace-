# B03B1b: Values, step b: QUANTITIES, PERCENTS, DURATIONS

[B03B1b = brain job "Meaning stage, part B, piece 1, step b". B03A (done) finds clauses and speech acts; B03B1 reads the VALUES inside a message (numbers, quantities, durations, dates, times, Roman numerals) in four small steps a to d, each proven alone; B03B2 later reads structure. The steps share one contract and one test runner written by the Director, so each builder only fills ONE file.]

WHO THIS IS FOR: ChatGPT or Grok (either one, in a NEW chat; both can run code and return a zip). It writes pure code and tests only; it never designs screens. (Vibe and DeepSeek are not used for this job.)
WHAT THIS DOES: Fills ONE file, `values/quantities.ts`, so that a number followed by a unit becomes a quantity (`5 miles`), a percent (`15%`) or a duration (`2 hours 15 minutes`, `half an hour`), through the unit engine that already exists. Nothing is wired into the chat.
WHAT YOU DO: START ONLY AFTER step a was accepted. Attach: this file, AXON_ROADMAP_V17_5.md, and `B03B1-MINIBASE-b.zip` (the Director builds it from step a's accepted numbers). Do not attach anything else.
WHAT TO BRING BACK: ONE zip named `B03B1b-units.zip` containing `src/brain/mind/meaning/values/quantities.ts`, your test file and `docs/reports/B03B1b_REPORT.md`. Give it to Claude (the Director) to inspect.
PASTE THIS ONE LINE (then attach the files above): Do the job in the attached file B03B1b_FOR_CHATGPT_OR_GROK_UNITS.md, exactly, using the attached roadmap and the attached mini-base zip. Run everything yourself with `node run.mjs` as the file says, and return one zip.
IF THE BUILDER REPLIES WITH ONLY A REVIEW AND A LAW CHECK AND BUILDS NOTHING, paste this in the SAME chat (once only): "Continue now, in this same chat. Do not report again. Write the first file, run its test, then the next. Your next message must contain the zip. If you cannot finish everything, deliver the finished files complete and tested and list the rest."

---
## STANDARD PROMPT PREAMBLE (v17.5, unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. Open ONLY the files this prompt names and the files you are asked to create or change; do not read any other document, folder or archive. AXON is a foundation-first project and its foundation is being reopened. Answer in at most five lines: (1) what the finished AXON contains (section 6 of the roadmap), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list only the laws this job touches (by number, one line each, at most 12 lines) and say how the job complies; repeat it in your report; if a law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

(In the roadmap "Part 00" means section 3, the Foundation Laws.)

---

## THE CONTRACT (already written by the Director; read it, do not change it)
Files in the mini-base you must read: `src/brain/mind/meaning/values/types.ts` (the types and the `ValueReader` contract), `values/index.ts` (the assembler: it validates input, builds `ctx.ranges` from the language segments only, calls the four readers in order readNumbers, readQuantities, readDatesTimes, readRoman, then sorts and removes overlaps), `values/charClass.ts` (character helpers), `tests/valuesRunner.test.ts` (the proof you must pass) and `tests/fixtures/values-corpus-b1.json` (the corpus; each item has a `job` field a, b, c or d; you are responsible for yours, and the items of the other jobs must not get worse).
`ExtractedValue` fields: kind, text, start, end, confidence, reason, computed:true, and optionally value, form, unit, unitSymbol, category, ms, date, dateAlternatives, times, error, alternatives, parts. Dates are ISO `YYYY-MM-DD`; times are `HH:MM` 24-hour. The test clock in the corpus is Saturday 2026-10-24 10:30. Corpus matching rules: `expect` lists the values in order; an item passes only when the list has exactly those values (same kind and text, in order) and every field the expectation names matches; `weak: true` means confidence below 0.5, and when `weak` is absent confidence must be at least 0.5 (items with `error` are exempt); `alt` means `alternatives` contains that kind; `alternatives` on a date means `dateAlternatives` (same members, any order); `time` as a string means `times` equals that one candidate, as a list it equals that list.

---

## JOB B03B1b: QUANTITIES, PERCENTS AND DURATIONS

MINI-BASE (attached as `B03B1-MINIBASE-b.zip`; unzip it, work inside it): the mini-base of step a PLUS the accepted `values/numbers.ts` of step a (it already finds the numbers and is not yours). The Director builds this zip after step a is accepted. Files you use: `unitConvert.ts` (UNITS and `listUnits`, imported only through `ctx.units`), `closedSets.ts` (isDeterminer, isPreposition, isCoordinator, isGrammarWord, normalizeWord), `valueWords.ts` (PERCENT_WORDS is PROPOSED, still used here; HALF_WORD, CARDINAL_WORDS approved), the placeholder `values/quantities.ts` (yours).

LANE: REPLACE `src/brain/mind/meaning/values/quantities.ts` (it exports `readQuantities(ctx, found)` and `lookupUnitWord`; keep both exports and make `lookupUnitWord(word, units = UNITS)` accept an optional second parameter). NEW, if you want them: `src/brain/mind/meaning/values/quantities*.ts`; NEW `tests/valuesQuantities.test.ts`; NEW `docs/reports/B03B1b_REPORT.md`. Nothing else.

WHAT `readQuantities(ctx, found)` DOES: `found` is the list of numbers from step a. It returns the COMPLETE list: a number that becomes part of a quantity, percent or duration is REMOVED from the list and kept in the new value's `parts`; every other value passes through unchanged. It never decides what a unit means for a tool (that is a later stage).

THE RULES:
1. QUANTITY. A number directly followed by a unit (one space or none): `kind: 'quantity'`, text covers number and unit, `value` is the number, `unit` is the CANONICAL NAME from UNITS (`mile`, `foot`, `Fahrenheit`, `kilometre`), `unitSymbol`, `category`; confidence 0.9; `parts: [the number]`. Match the unit word to ctx.units by: the full name (case-insensitive, `fahrenheit` matches `Fahrenheit`); the symbol (case-SENSITIVE; a symbol of ONE letter such as `m`, `s`, `h`, `g`, `t`, `L` counts only when it touches the number: `5m` yes, `5 m` no); the plural (`s`, `es`: `miles`, `inches`); the English vowel change `eet` to `oot` (`feet` is foot); the spelling swap of final `er` and `re` (`meter` is metre, `liter` is litre); and the single last word of a multiword name ONLY when that word is unique across ALL unit names (derived from the data, never listed). A multiword name (`cubic metre`, `US cup`, `metre per second`, `mile per hour`) is matched as a whole phrase and its words may take the plural (`3 cubic metres`, `60 miles per hour`). Symbols can contain odd characters (`°C`, `m²`, `m/s`, `km/h`): read them when attached (`30°C`, `3m²`, `10km/h`). The runner proves EVERY unit in UNITS this way (by name and by symbol), so there is no exception for odd ones; the symbols that contain a space or are shared by two units are skipped there.
2. GRAMMAR-WORD UNITS. When the unit word is also a grammar word (`in` is a preposition and an inch; test with `isGrammarWord`/`isPreposition`) and it is NOT attached to the number, the primary reading stays the plain NUMBER and the quantity is listed in that number's `alternatives` with `kind: 'quantity'` and a note (`write 1994 in roman numerals`). Attached (`5in`) it is a quantity.
3. PERCENT. `%` directly after a number (`15%`, also `15 %`), and the words from PERCENT_WORDS after a number: `15 percent`, `15 per cent`. `kind: 'percent'`, `value` 15, confidence 0.9, parts: the number.
4. DURATION. A quantity whose unit category is `time` becomes `kind: 'duration'` with `ms` COMPUTED from the UNITS factor (find the unit of the second in the table and derive; never retype 1000, 60, 3600); `value` and `unit` as for a quantity. Chains are ONE duration: `2 hours 15 minutes` (8,100,000), `5 minutes and 30 seconds` (the joiner `and` via isCoordinator), `1h30m` (attached pairs; step a gives you the 1 and a WEAK 30 because the 30 follows the letter `h`, you merge them), with `ms` the sum, `value` and `unit` absent, and `parts` the pieces (each a duration with its own ms). Words: `ten minutes` (number words arrive from step a), `half an hour` (1,800,000: `half`, then an article, then a time unit), `an hour and a half` (5,400,000), `a week` (604,800,000), `1.5 hours` (5,400,000), `90 seconds`. A or an directly before a time unit's FULL NAME (not its symbol) means 1 (confidence 0.7); before other units it means nothing (`a cup` is not a quantity). `a second` is special: weak (confidence 0.4), 1000 ms, with `alternatives: [{ kind: 'number', note: 'the ordinal second' }]` because step a read `second` as an ordinal; `wait a second` and `the second one` must differ.
5. The word `one` that step a left weak becomes STRONG when a unit follows (`one mile`, `one hour`): the result is a normal quantity.
6. Months and years are not fixed lengths, so they are NOT durations (they are not in UNITS; do not add them). `5 years` stays the plain number 5.
7. Typos and non-units stay numbers: `10 minits` is the number 10; `tennis minutes` reads nothing. Never fix spelling.
8. An ordinal number (`2nd`) never merges with a unit. A unit word must lie in the same range as its number. Several quantities in one message are separate values (`10 feet ... 10 yards`, `5 miles and 3 feet`: the `and` joins only time units into a duration chain).

DONE MEANS (all MEASURED and printed in your report):
- `node run.mjs tests/valuesRunner.test.ts --jobs a,b,d` ends with `VALUES RUNNER OK`: every core item of jobs a, b and d passes (b has 22 core items: V02 to V04, V07, V11, V12, V15 to V25, V39, V42, V66, V81, V83), the unit round trip passes for every unit in UNITS, the SINGLE-SOURCE check (no unit name or symbol of two or more characters appears as a string literal in any values file) and the INJECTION check (a unit added to a copy of the table in the runner is found) pass, and the speed budget holds.
- `node run.mjs tests/valuesGuard.test.ts` and `node run.mjs tests/romanNumeral.test.ts` pass.
- Your own `tests/valuesQuantities.test.ts` (print its check count): plural, `eet`/`oot` and `er`/`re` rules derived from the table; the unique-last-word rule shown on at least two units (one that works, one that is refused because the word is shared); `5m` against `5 m`; `in` attached and detached; chains with and without `and`; `1h30m`; the percent forms; a decimal duration; a seeded fuzz of 2,000 strings built from numbers, unit names, symbols and joiners with the same invariants as the runner.
- `tsc -p tsconfig.values.json` clean, or NOT RUN with the reason.
- Before you build, write a short design note in the report: how a unit word is matched (the order of the rules) and how a chain is read.

IF YOU CANNOT FINISH: deliver the tiers that pass in this order (quantities by name, then symbols and attached forms, then percent, then durations and chains, then the special `a second` and `half an hour` forms), say which corpus items are NOT done, and list the failing runner lines.

---

## STANDING RULES (apply to every step)

START RULE: after the short answer and the LAW CHECK, START BUILDING IN THE SAME REPLY. Do not ask permission, do not restate a plan, do not end your turn with a status report. A reply that contains only a review and a Law Check is a FAILED delivery. Work in small verified steps: write ONE file, run it, fix it, then the next.

HONEST DELIVERY: whatever you cannot run is labelled NOT RUN in the report and never blocks the zip. Delivering finished files that pass is success, even if you could not finish everything (list what is missing plainly). Delivering nothing is the only failure. Never write "should work" or "tested" for something you did not run. Evidence labels: MEASURED (you ran it and saw it), NOT RUN, HYPOTHESIS.

HOW TO RUN (nothing needs installing; do NOT run npm install, it may hang):
- `node run.mjs tests/NAME.test.ts [args]` runs any TypeScript test with plain Node 22 (type stripping; it is already in the mini-base). If `npx tsx` happens to work, that is fine too.
- Because Node only strips types, write ERASABLE TypeScript only: no `enum`, no `namespace`, no constructor parameter properties, and use `import type` for every type-only import.
- Type check, if a `tsc` exists in your sandbox: `tsc -p tsconfig.values.json` (offline, strict). If there is no tsc, write NOT RUN. Do not try to install one.

CODE RULES (the static guard `tests/valuesGuard.test.ts` enforces the first two):
1. NO regular-expression literal anywhere under src/brain/mind (scan character by character; the helpers in values/charClass.ts are there for that). Methods such as `.replace(/x/g, ...)` count as regex literals; so does `.split(/ /)`.
2. NO word list: no array or Set of three or more string literals in any file you write. The only files that may hold word lists are closedSets.ts, concepts.ts and valueWords.ts, and they are Director-owned: you import from them, you never edit them. If you need a word that is not in them, say so in the report; do not add it anywhere.
3. PURE TypeScript: no React, no DOM, no `window`, no `Date.now`, no `new Date`, no network, no randomness. Anything time-like arrives through `ctx.clock`.
4. Never throw for bad input and never loop without a bound. The input is at most 20,000 characters; every loop must move forward; avoid anything that rescans the whole text for every word (the runner has a 1.5-second limit on hostile 20,000-character inputs and a 1 ms average budget per message).
5. Reuse, never copy (FL14): number words come from valueWords.ts, grammar words from closedSets.ts, units from `ctx.units` (which is UNITS from unitConvert.ts), dates from dateCalc.ts, Roman numerals from romanNumeral.ts. Do not retype a unit name, a factor, a month length or a Roman rule.
6. A reader never reads across the edge of a range in `ctx.ranges` (quoted text and code are material and never read) and never returns values that overlap each other.
7. Every value has `text === ctx.text.slice(start, end)`, `computed: true`, a `confidence` from 0 to 1, and a `reason` in plain words naming the structural facts that decided it. A malformed or impossible value is returned with `error` and no value; it is never skipped silently and never thrown.
8. Keep alternatives open: when a reading is unclear, return the most natural reading with a lower confidence and list the other in `alternatives`. Never decide for a tool what a value means.

LANE AND FILES: create or change ONLY the files named in LANE. Never touch: values/types.ts, values/index.ts, values/charClass.ts, values/roman.ts, valueWords.ts, closedSets.ts, tests/valuesRunner.test.ts, tests/valuesGuard.test.ts, tests/fixtures/*, tsconfig.values.json, run.mjs, tools/*, package.json, or any file under src/tools. If you believe one of them is wrong, say so in the report with evidence; do not edit it.

RETURN: ONE zip of the NEW and CHANGED files only, paths relative to the repository root (the mini-base root), no top folder, no nested zips, containing the report. Create it with your code tool and give the download link. REPORT (docs/reports/<job>_REPORT.md): your LAW CHECK; every file created or changed; the exact commands you ran with the real results and counts; anything NOT RUN; anything unfinished; any word you needed that the closed sets lack; any corpus item you think is wrong (quote it, with your evidence).

CHECK THE BASE FIRST: the files named under MINI-BASE must exist. If one is missing, STOP and say which.
