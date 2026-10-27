# B04B3 PROMPT (written by Claude, the Director of the AXON project, 2026-10-27)

**WHO IT IS FOR:** a builder AI (ChatGPT or Grok). Start your reply with one line: "I am <your name>."
**WHAT THIS DOES:** asks you to write ONE small pure TypeScript file, `src/brain/mind/resolve/options.ts`, that gives AXON's Resolution stage two helpers it is still missing: a "how close are two dictionary concepts" function and a "which tools are really built" map. A fixed test runner (already written) tells you whether it is right.
**WHAT YOU DO (the owner):** attach the file `B04B3-MINIBASE.zip` and paste the one line at the bottom of this file. Nothing else.
**WHAT TO BRING BACK:** ONE zip containing `src/brain/mind/resolve/options.ts` and `B04B3_REPORT.md`. Give the owner that zip to hand to Claude.

**ONE LINE TO PASTE (the owner pastes this, with the zip and this file attached):**
`Read B04B3_prompt.md completely, unzip B04B3-MINIBASE.zip, do the job exactly as written, and return one zip with options.ts and B04B3_REPORT.md.`

---

## STANDARD PREAMBLE (unchanged)
Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. Open ONLY the files this prompt names and the files you are asked to create or change; do not read any other document, folder or archive. AXON is a foundation-first project and its foundation is being reopened. Answer in at most five lines: (1) what the finished AXON contains (section 6 of the roadmap), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list only the laws this job touches (by number, one line each, at most 12 lines) and say how the job complies; repeat it in your report; if a law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

("Part 00" means roadmap section 3, the Foundation Laws; "Part 5E" means section 6.)

---

## THE JOB: B04B3 [Resolution options: closeness and tool status]

**Where it sits:** the brain's Resolution stage (B04B, merged) matches a clause to the tool it MEANS. It accepts two optional helpers that B04B2 left out on purpose: `options.related` (concept closeness) and `options.status` (tool id to Status). You build the two makers. You do NOT build the dictionary, the registry, the stages or any screen: the dictionary arrives later as an injected function, the registry as plain records. The Director wires them afterwards. A person's "change", "convert" and "turn" can then reach the same tool by MEANING, and a tool that exists only in the plan is answered honestly as "unavailable".

**Best common app and the gap (owner rule 9):** ordinary assistants match tools by remembered phrases; AXON matches by dictionary meaning with a number that can be proven. The gap this job closes: today a synonym of a tool's verb finds nothing.

**LANE (the only file you may create):** `src/brain/mind/resolve/options.ts`. You change NO other file. You never edit package.json, tools, .github, tests, fixtures or any contract.

**FILES YOU HAVE (all in the mini-base; if any is missing, STOP and say which):**
1. `AXON_ROADMAP_V19_2.md`  2. `run.mjs`  3. `register.mjs`  4. `tsconfig.values.json`
5. `src/brain/mind/schema/schemaTypes.ts` (types and `deriveStatus`)
6. `src/brain/mind/schema/actionSchemas.ts` (the 63 schemas; read only)
7. `src/brain/mind/resolve/resolveTypes.ts` (what `related` and `status` must fit)
8. `src/brain/mind/resolve/resolve.ts` (how Resolution calls them; read only)
9. `src/brain/mind/resolve/optionsTypes.ts` (THE CONTRACT: read it to the end; it wins over this prompt if they differ)
10. `tests/resolveOptionsRunner.test.ts` (THE PROOF; never change it)
11. `tests/fixtures/toolFacts.json` (63 real tool facts)

**WHAT TO WRITE:** `options.ts` with exactly two NAMED exports, as described by `OptionsApi` in `optionsTypes.ts`:

1. `makeRelated(lookup)`: returns a NEW function `(inputKey, schemaKey) => number`. Keys look like "lemma:pos" with pos v, n or a. The result is always one of 0, 0.25, 0.5, 0.8, 1:
   - identical keys: 1
   - synonyms (either key lists the other in `synonyms`): 0.8
   - one step (either key lists the other in `broader` or `narrower`): 0.5
   - two steps in the SAME direction (broader of broader, or narrower of narrower), seen from either end: 0.25. Siblings through a shared parent, and "narrower then broader", are NOT related: 0.
   - different parts of speech, unknown keys, empty or non-string arguments: 0 (two identical non-empty strings are 1)
   - symmetric: the answer for (a, b) equals the answer for (b, a); the best applicable value wins.
   - read at most the FIRST 8 entries of each list a lookup returns (use the constant `MAX_LIST_ENTRIES`); ignore entries that are not strings.
   - the lookup may return null, return junk, or THROW: treat each as "no relations"; never throw yourself, never return NaN.
   - never change what the lookup returns (it may be frozen); the same inputs always give the same output; at most 34 lookup calls for one comparison.
   Tiny worked example (invented keys): if `aa:v` lists `cc:v` as broader and `cc:v` lists `ee:v` as broader, then related(aa:v, cc:v) = 0.5, related(aa:v, ee:v) = 0.25 and related(ee:v, aa:v) = 0.25.
2. `statusMapFrom(facts)`: returns a NEW FROZEN object with NO prototype (`Object.create(null)`, then freeze) mapping each tool `id` to `deriveStatus(fact)` (import it from the schema file; do not rewrite its rule). Skip facts whose id is not a non-empty string or is "__proto__"; if an id repeats, the FIRST fact wins; skip null entries; a non-array input gives an empty map.

Import the constants from `./optionsTypes` (never retype the numbers) and the types from `../schema/schemaTypes`. Expected size: roughly 40 to 80 lines.

**GUARDS FOR EVERYTHING UNDER `src/brain/mind` (the build checks them; you cannot see the guard, so obey these):**
- no regular-expression literal and no `new RegExp`
- no array literal holding three or more string literals, no phrase or word lists of any kind (FL13)
- no `Date`, `Math.random`, `localStorage`, DOM, network, timers or I/O; no imports except the three named above
- the project's strict settings: `erasableSyntaxOnly` (no `enum`, no `namespace`, no constructor parameter properties), `noUncheckedIndexedAccess`; imports without file extensions
- names, comments and strings in plain English

**HOW TO PROVE IT (no install; Node 22 or newer):**
1. Put your file at `src/brain/mind/resolve/options.ts`.
2. `node run.mjs tests/resolveOptionsRunner.test.ts` must end with `RESOLVE OPTIONS RUNNER OK: <N> checks`.
3. `tsc -p tsconfig.values.json` must print nothing (if `tsc` is not available, say "NOT RUN" for this step; do not fake it).

**DONE MEANS:** step 2 ends with OK and its check count is shown in the report; the file exists at exactly that path; no other file changed.

**START RULE:** do the LAW CHECK, then the job, in that order; no extra tools, scripts, frameworks or "improvements".

**HONEST DELIVERY RULE:** label everything you could not run as NOT RUN. If the runner fails, do not edit the runner: fix your file once; if the same failure remains after a second attempt, STOP and report which check fails and why. A partial delivery that is honest is a success; a claimed pass that was not run is a breach.

**REPORT (`B04B3_REPORT.md`, plain words, at most 60 lines):** the LAW CHECK; the exact runner output line; the `tsc` result or NOT RUN; how you handled throwing lookups, the cap of 8 and the two-step rule (one line each); anything in this prompt that was unclear.
