# AXON BRAIN PLAN (Director, 2026-10-20; read with roadmap section 7)

Status: B1 Intake and Reading and B2 Analysis are built. Everything below starts ONLY after every tool is finished and one cloud build of the whole project passes (owner order, 2026-10-20). Each job is written only after the job below it is accepted (Rule 3: never from the sky down); the first, B03A, is already written.

## Why this order
A message must be read before it is understood, understood before it is matched to an ability, matched before it is planned, planned before it runs, checked before it is answered. Each stage can be tested alone with a written corpus of right AND wrong messages. The golden transcript (79 messages) is replayed after every job: only the stage names in the trace may change, never a reply, until a job is meant to change replies (B04C onward).

## The jobs (each sized to what ChatGPT has been proven to carry: one engine family, one proof)
| Job | What | Builder | Needs | Proof |
|---|---|---|---|---|
| BM1 | Measure the understanding time of B1 to B2 on the owner's Infinix Note 10 (a tiny timing readout in Background Proof, AI Studio) and the dictionary block reads per message | AI Studio, then owner | tools done | numbers on the board; the budget is under half a second for the whole understanding |
| B03A | Clauses, material attachment, speech act (ask, command, greet, thanks, chat, unknown), polarity. WRITTEN | ChatGPT | BM1 | 46-message corpus, confusion table, golden unchanged, no phrase lists, mutation tests |
| B03B | teach and correct acts; typed slots: number, quantity with unit, date or time, text span, material, file, choice, reference to an earlier turn | ChatGPT | B03A accepted | new corpus (Director writes it first), slot extraction tests derived independently |
| B04A | Action schemas: every capability declares what it MEANS (concepts, typed slots, accepted speech acts). One schema per tool family, derived from the registry and the 40 engine descriptors. Examples stay documentation only | ChatGPT | B03B | schema validity test; every open tool has a schema; no fixed phrases |
| B04B | Resolution: match a clause's Frame to schemas by concept distance (synonym 1.0, then hypernym and hyponym decay), act match and slot completeness; confidence with reason; ask-with-choices output | ChatGPT | B04A | corpus of positive AND negative requests per tool, confusion table, near-miss cases, ASK_AT and RUN_AT behaviour |
| B04C | Typed Execution: tools run from chat with typed arguments only (never the raw text), one tool family per job (text, numbers, time, create, files, converter), each retiring a legacy handler. A tool is done when its chat action is declared AND tested | ChatGPT (one family at a time) | B04B | replies identical to the screen's engine for 50 requests per family |
| B05 | Dialogue: pending questions, follow-ups, "more", "it", "that", topic, bounded history, the trace kept by ask() | ChatGPT | B04C | scripted multi-turn transcripts |
| B06A | Planning: order several instructions, ask for what is missing with choices, confirm anything destructive, permissions, undo copy | ChatGPT | B05 | transcripts and mutation tests |
| B06B | Verification: compute never recall (second independent path when cheap), provenance on every claim, evidence labels PROVEN, CHECKED, REPORTED, UNSURE, request-versus-result check, abstain as a first-class result | ChatGPT | B06A | "it says it does not know" suite, mutation tests that must be killed |
| B07 | Response composer: answer or verdict, evidence line, meaning and risk, next step, fallback; AXON's calm voice from sentence structures, not phrase lists | ChatGPT, screens by AI Studio | B06B | structure tests, no repeated stock lines, honesty tests |
| B08 | Memory and state: taught meanings and corrections visible and undoable, My Dictionary as a second knowledge source, size caps, export, erase | ChatGPT + AI Studio screen | B07 | schema, migration, erase and undo tests |
| BX | "How did you understand me?" view: shows the trace of the last message | AI Studio | B05 | owner approves in the preview |

## Rules that bind every brain job
FL10, FL12 and FL13 above all: everything through the chat is understood by these stages; nothing is added as a fixed word or phrase list (only the small closed sets of English grammar words, in one named file); abilities declare meaning, never phrases. A concept anchor (for example greeting, thanks) is derived from the dictionary by a recorded lookup, never remembered. Every job: positive AND negative corpus first (written by the Director), confusion table as proof, mutation tests, golden transcript replay, a static test forbidding regular-expression literals and word lists under src/brain/mind, strict type check, measured milliseconds. If a concept cannot be derived from the dictionary after two attempts the job stops and reports (Two-Strike): it never falls back to word lists.

## Honest limits (to say plainly to the owner)
AXON's own rule-based brain can read a DEFINED domain reliably (its tools, the dictionary, its own settings) and says "I did not understand" or "I do not know" otherwise. It will not chat about anything like a large trained model does. The optional model tier (7.12) is a later owner decision after B06; it could only propose a Frame or a Plan that the stages above check.

## What the owner can do to help the brain
Collect real messages you would type to AXON (commands, questions, greetings, mistakes, messy ones, several instructions at once, things you expect it to refuse). They become the corpus for B03B and B04B: real examples beat invented ones. Put them in a plain text file, one per line, and mark the ones you expect AXON NOT to obey.


## ADDENDUM 2026-10-20: the mind system jobs (read docs/AXON_VISION.md first; roadmap 7A)
These wrap the stages above. Each is written only when the job below it is accepted; the Director writes the corpus of right AND wrong cases first.
| Job | What | Builder | Needs | Proof |
|---|---|---|---|---|
| M0 | Charter and permission broker: the fence (ALLOWED, ASK, NEVER per lane and action), owner-signed, AXON cannot edit or widen it; decision log; a Permissions screen later | ChatGPT engine, AI Studio screen | tools done | tests that no path widens a permission; every action goes through the broker |
| M1 | Loop skeleton: observe, understand, plan one step, act, check, remember; step budget; success test written first; stop reasons; JOURNAL of every step; fake tools only | ChatGPT | M0, B04A | scripted tasks with fake tools; budget and approval gates tested; journal complete |
| M2 | Memory stores and standing files; corrections become regression tests and ledger lines; export, erase, undo | ChatGPT + AI Studio screen | M1 | a correction given once changes the next answer and is a test that fails if it regresses |
| M3 | Truth gates (nine) and tool certification: known-answer self-tests per tool, known-bad registry that lists past answers touched | ChatGPT | M2 | gate corpus of true, false, stale, copied and contradictory claims; mutation tests |
| M4 | Council: independent deterministic reviewers, Chair, veto, disagreement shown | ChatGPT | M3, B06B | reviewer corpus; the Chair never overrides a veto |
| M5 | Objective model (goal, success test, audience) and the Writer (Reading Comfort, human versus AI-tool readers, Tool Knowledge Packs, Dictation Cleaner) | ChatGPT, AI Studio | M4, B07 | readability measures; prompts for outside tools pass a checklist; dictation corpus with raw and cleaned text |
| M6 | Lanes, tasks, priorities, schedule, parallel workers, preemption | ChatGPT | M5 | scheduler simulations, no starvation, preemption saves state |
| M7 | Hands: tool bus (built-in, API, MCP over network, remote CLI), then AXON Web, then AXON App (screen read, accessibility, capture) with every permission visible | ChatGPT engines, Android native by the Director's steps, AI Studio screens | M6, M0 | each hand behind the broker, logged, measured on real phones |
| M8 | Growth path and growth log, Style profiles (consent), Tool Knowledge Packs, scripture packs | ChatGPT | M7 | each turn of the path leaves measurable improvement or is rolled back |
| M9 | AXON Code harness (loop, read, search, patch, test runner, sandbox, approvals, standing file, Coder slot), Security lane, Challenge Lab | ChatGPT, AI Studio | M8 | tasks solved against owner-written tests; scope file respected |
Order with the stages: B3, then M0, M1 early, B04A, B04B, B04C, M2, M3, M4, B05, B06A, B06B, M5, B07, M6, M7, B08, M8, M9.
