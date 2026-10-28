# PROMPT LEDGER (Director, updated 2026-10-28): every job, who builds it, how big, what it needs
Roadmap 7H asked for this. One row per job. The Director updates STATUS after every merge; the board keeps the story, this file keeps the plan.

## OWNER ORDER (2026-10-28, BINDING): SYSTEMS FIRST, AI STUDIO LATER
Rows that need no AI Studio (brain, engines, tests) go first. The AI Studio rows (L08, L09, L10, L29, PT1b, the screen part of L28 and the tool screens of day 4 onward) wait until the systems are in the repository, then run together, one by one, in a steady flow. Builder note (owner-measured): Grok takes much larger jobs than ChatGPT and is slightly more flexible; ChatGPT is also flexible. The red-team row Z1 goes to Grok or ChatGPT, never Claude.

## How sizes were set (from `docs/AI_CAPACITY.md`; nothing here is a guess about the builders, only about the jobs)
- **S** = one new file up to about 9,000 characters, prompt under 8,000, mini-base of up to 6 files. **M** = one new file up to about 18,000 characters, prompt under 16,000, mini-base of up to 10 files (PROVEN on ChatGPT: B03B3c was S, B03B3d was M). **Never L:** a job that does not fit M is split before it is written.
- Every job: a contract file and a no-install runner written by the Director, a corpus of right AND wrong cases, mutation checks, the golden transcript unchanged. Builders only CREATE files in their lane; hot files (App.tsx, toolCatalog.ts, package.json) are the Director's or run one at a time.
- Builder column: **C** = ChatGPT or Grok (either may take any C job; run the same job in both when the owner wants speed), **S** = AI Studio (screens, from exact text, repository link, design check first), **D** = Director (Claude; kept small: contracts, corpora, inspection).
- The sizes are DIRECTOR ESTIMATES from proven jobs; the first returned job of each kind confirms or corrects its row.

## Why 15 to 30 a day needs a plan (dependencies, MEASURED from the job tables)
The brain chain B04A, B04B, B04C is sequential, so day 1 can only run the independent jobs below (about 11). From the day B04B is accepted the chain fans out into six B04C families plus J0 to J3 plus M1, all parallel (about 13 at once). The Director's review time is the limit, not the builders: day 1 measures how many returns can be inspected in a day.

## DAY 1: independent jobs (start all at once)
| ID | Job | By | Size | Needs | Proof |
|---|---|---|---|---|---|
| L01 | DONE **B04A** action schemas: every tool declares meaning, typed slots, accepted speech acts, EFFECTS, PRECONDITIONS, COST, UNDO; unbuilt tools marked unbuilt | C | M | B03B4 | every one of the 60 menu tools has a schema; validity test; no fixed phrases |
| L02 | **B03B3e** CONTRADICTION CHECK AND REPLACED-MEMORY HISTORY on `notes.ts`: detect a conflict with a kept note, ask replace, keep both or cancel; a replaced note stays with a bracket description and can be recalled | C | M | B03B3d | corpus of conflicts and non-conflicts; replaced note always recoverable; mutants |
| L03 | **B03B5** COMPOUNDS AND EXPLAIN SIMPLER: dictionary phrase first, else compose head and modifier senses (labelled composed); explain a word one definition level at a time | C | M | B03B4 (mini-base with the dictionary slot) | corpus (lucid dream, sit down); labelled composed; no word lists |
| L04 | **SH0** SHELF FORMAT: manifest (sources, licence, counts, hashes, test set, kill switch), block index, startup self-check, quarantine states CANDIDATE, CHECKED, ADMITTED (roadmap 7F) | C | M | none | a tampered block and a missing shelf are caught loudly; kill switch works |
| L05 | **CO1** COLOUR ENGINE: name, hex, rgb, hsl conversions; swatch dot plus hex string for replies (first check whether `src/tools/engines/create` already holds one) | C | S | none | known-answer table; round trips |
| L06 | **PH1** PHYSICS ENGINE: speed, distance, time, acceleration, forces, simple projectile, with units and ESTIMATE labels | C | M | units engine | known-answer physics cases, independent reference |
| L07 | **CI1** DC CIRCUIT SOLVER: resistor networks and sources by nodal analysis, errors for impossible circuits | C | M | none | textbook cases; shorted and open circuits caught |
| L08 | **A15a** CALCULATOR KEYPAD REDO: keypad fixed in place (typing never shifts the page), live result, quiet equals key, matches the app design | S | M | owner design check | owner approves in the preview |
| L09 | **A15b** DEVICE PROFILE plain words (rewrite the Options note, scan every screen for developer wording) | S | S | none | no screen shows navigator, API or runtime |
| L10 | **A15c** VIDEO FRAMES listed under Media, Video (editor stays a placeholder) | S | S | owner design check | tool reachable on the phone |
| L11 | **J0** Judgment corpus: situation types and known answers (the boulders, a deadline, undo before delete, works but differently) | D | S | none | reference written separately |

## DAY 2 (after B04A is accepted): resolution, then the fan-out
| ID | Job | By | Size | Needs |
|---|---|---|---|---|
| L12 | DONE **B04B** Resolution: Frame to schema by concept distance, confidence with reason, ask-with-choices | C | M | L01 |
| L13 to L18 | REPLACED by the B04C rows below (2026-10-28, evidence in `docs/B04C_PLAN.md`) **B04C** typed execution, ONE family per job, each retiring a legacy handler: text, numbers, time, create (with CO1), files, converter | C x6 | M each | L12 |
| L19 to L22 | **J1** look-ahead search, **J2** verdicts and chances, **J3** pace and critical path (pure) | C x3 | M | L01, L11 |
| L23 | **M1** loop skeleton with fake tools: step budget, success test first, journal | C | M | L01 |

## DAY 3
| L24 | **B05** Dialogue: pending questions, follow-ups, "it", "that", bounded history, trace kept | C | M | L13 |
| L25 | **B06A** Planning: order several instructions, missing slots with choices, confirm destructive, undo copy | C | M | L24 |
| L26 | **B06B** Verification: compute never recall, provenance, evidence labels, request-versus-result, abstain, contradiction hook to L02 | C | M | L25 |
| L27 | **B07** Response composer: answer, label, risk, next step; explain-simpler hook | C | M | L26 |
| L28 | **B08** Memory and state: notes wired, replaced-memory history, My Dictionary second source, export and erase | C + S | M + M | L02, L27 |
| L29 | **BX** "how did you understand me" view | S | M | L24 |
| L30 | **M2** memory stores and standing files; corrections become tests | C | M | L23 |
| L31 | **M3** truth gates and tool certification | C | M | L30 |
| L32 | **M4** COUNCIL (roadmap 7E seats: purpose, method, advocate, critic with contradictor, gaps, outsider, time) | C | M x2 (split: seats 1 to 4, seats 5 to 7) | L26, L31 |

## DONE BUT NOT IN THE ORIGINAL TABLE (small Director-sized jobs)
B04B2 adapter + SHADOW Resolution; B04B3 synonyms feed Resolution; B04B4 live tool facts: P1 data and facts builder, P2 oracle and `options.status` wiring, P3a/P3b hand-over, P4 app registry fix (all merged, all checks green, OWNER-REPORTED 2026-10-28).

## NEW ROWS (owner yes 2026-10-28; roadmap 7E, 7F rule 7, 7I and section 8)
| ID | Job | By | Size | Needs | Proof |
|---|---|---|---|---|---|
| R1 | **ROUTER** per clause from signals: fast, ask or deep from Resolution result, schema EFFECTS/UNDO/COST, linked clauses, close senses; unsure goes up; success condition on every Frame; mixed messages | C | M | L12, C1 | corpus of simple, complex and mixed messages; no phrase lists; golden transcript unchanged |
| SC1 | **SCOREBOARD** whole-conversation set (clear, ambiguous, several instructions, corrections, contradictions, false assumptions, tools, impossible) plus a runner that prints the pass count; the 79-message transcript is the seed | D + C | M | none | pass count recorded on the board after every brain job |
| CAP1 | **PROOF record** field on every tool fact (VALIDATED, CONDITIONAL, UNVALIDATED, CANNOT) reported by "what can you do" | D | S | L12 done | oracle test extended; unvalidated tools never described as reliable |
| PT1a | **PHONE TIMING, sandbox half**: time each brain stage on the 79-message transcript (estimate only) | C | S | none | table per stage against the half-second budget |
| PT1b | **PHONE TIMING, phone half**: screen showing the same table measured on the owner's phone (DEVICE) | S | S | PT1a | owner reads the numbers on the phone |
| Z1 | **RED TEAM** (after the app is built): whole repository zip to Grok or ChatGPT to simulate tests, break the code, talk to the brain, report faults | owner + Grok | one run | the finished app | faults become sized fix jobs plus regression tests |
Truth vocabulary (roadmap 7F rule 7): the code names migrate when row L26 (B06B) touches them.

## B04C ROWS (replace L13 to L18; `docs/B04C_PLAN.md`; owner order: systems first)
| ID | Job | By | Size | Needs | Proof |
|---|---|---|---|---|---|
| C0a | **measure and ratchet** Resolution on 57 requests (DONE 2026-10-28: dev 21/57, held-out 11/57) | D | done | none | test in `test:kernel` |
| C0b-D | design **typed values as evidence** for a tool (DONE 2026-10-28: dev prototype 21 to 27 exact) | D | done | C0a | contract plus value corpus |
| C0b-C | build it in Resolution scoring (DONE 2026-10-28: builder return accepted, dev 27/57; held-out pending the owner's run) | C | M | C0b-D | dev exact at least 27, wrong tool at most 11; golden unchanged |
| C0c-1 | schema vocabulary fixes: text-writing and create-encode | C | M | C0b-C | dev and held-out up; no hard-coded phrases |
| C0c-2 | schema vocabulary fixes: numbers, time, converter | C | M | C0b-C | same |
| C0c-3 | schema vocabulary fixes: files-convert and the rest | C | M | C0b-C | same |
| C1 | **execution contract**, binder, runner registry, per-tool switch, SHADOW, pilot text-counter | D | M | C0c-1 | pilot reply identical on 50 requests |
| C2a | runners: text-counter, find-replace, case-converter, text-cleaner | C | M | C1 | equals the engine on 50 requests |
| C2b | runners: sort-lines, text-compare, rephraser, grammar-helper | C | M | C1 | same |
| C2c | runners: calculator, number-to-words, percentage-helper, converter | C | M | C1, C0c-2 | same |
| C2d | runners: timer, stopwatch, date-calculator, tally-counter | C | M | C1, C0c-2 | same |
| C2e | runners: qr-maker, password-generator, random-picker, encoder-decoder, hash-tool | C | M | C1, C0c-1 | same |
| C2f, C2g | runners: the 7 file tools (PARKED: needs files in chat) | C x2 | M | C1, C0c-3, permission | same |
Go-live of each family is a small Director step (no prompt): the changed replies are listed and the owner approves.

## DAY 4 AND AFTER (counted from the plans, not yet sized in detail)
M5 to M9 (about 9 jobs), J4 and J5, shelves (history, health, philosophy and quotes, human nature, AI prompting, code security, audio; each: a source-gathering job by the owner and Director, then a build job, then a test job), shapes and faces, body and motion notes, video scene engine, AXON Code AC1 to AC4, remaining tools and screens, cleanup. Each gets its row when the job above it is accepted (Rule 3: never from the sky down).

## COUNT (honest, 2026-10-28, after the B04C split)
Done: L01, L12, C0a, C0b-D, plus B04B2, B04B3, B04B4. **Sized rows left: 42** = the original table minus the 6 B04C rows it replaces (24) + 6 new rows (R1, SC1, CAP1, PT1a, PT1b, Z1) + 13 B04C rows (counting C0b-D to C2g, with C2f and C2g parked) = 43 before C0b-D, 42 after. Of the 42: **5 AI Studio** (L08, L09, L10, L29, PT1b), **3 Director-only** (L11, CAP1, C1), **1 red-team run** (Z1), **33 ChatGPT/Grok prompts** (L28 and SC1 are mixed; C2f and C2g are parked). **Not yet sized: about 55** (day 4 onward). **Total left: about 97 (range 79 to 111).** The split of B04C grew the count by 7: the evidence showed Resolution accuracy has to be fixed first.
How many a day is UNKNOWN: it is limited by how many returns the Director can inspect, not by the builders. Start with 4 to 6 independent systems rows a day and record how many were inspected.

## STATUS
2026-10-28: L01 and L12 DONE, B04B2 to B04B4 DONE, all merged and green. Not started: everything else. C0b-D DONE (2026-10-28). Next: the C0b-C prompt (Director writes it, ChatGPT or Grok builds), then C0c-1 to C0c-3.
