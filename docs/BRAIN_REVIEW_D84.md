# BRAIN REVIEW (Director D84, first review of my own work), 2026-11-16

This is the "basic review" you asked me to do myself. It is NOT independent: I wrote what I reviewed. It lists what I checked, what I found, what is still weak, and what I could not check. A second director should still look at it.

## What I checked, and how
| Check | Result |
|---|---|
| Every part has hand-derived worked cases, written before the code, plus seeded random invariants | yes, 12 test files for the brain parts |
| Deliberate breaks (mutants): the test must fail when the code is broken | P01 6+, P02 10, P03 12, P04 12, P06 10, P07 10, P10 10, orchestrator 20, dialogue helpers 6, store 4, adapter 3: every one caught after I added missing cases (6 gaps found and closed in total) |
| Independent second implementations | P01, P02, P03: my own private versions agree with the builder's code on 30000, 40000 and 60000 random inputs |
| Repository guards: no regex, no arrays of 3+ string literals, no fixed phrases in src/brain/mind | pass (mindPipeline, meaningNoPhrases, valuesGuard, brainBoundary); this was MISSED in my earlier deliveries and fixed in FIX1 |
| Whole repository suite | all 260 test files pass (summarizeSpeed and valuesRunner only fail when run in parallel; both pass alone) |
| Real brain, real tools: shadow mode changes nothing | 31 of 31 messages identical to the plain brain (task numbers and run times ignored) |
| False alarms of the independent tool re-check | 0 in 400 earlier generated runs and 0 in 88 end-to-end rechecks |
| Strict type check, erasable syntax only | clean |

## Measured end to end (tests/brainEndToEnd.test.ts, 140 messages through the real brain)
44 tool answers; 88 re-checks run (83 PASSED, 5 UNCLEAR because the case converter has no independent check yet, 0 FAILED); repair: 64 kept, 50 repaired, 12 asked first (risky); dialogue: 12 questions asked, 13 answers placed, 1 cancelled, 1 parked; judgment: 88 PROCEED, 0 ASK; 26 learning candidates noted; shadow equals plain brain on 31 of 31.

## Findings from this review (all fixed)
1. Guard tests broken by my merged parts (see FIX1).
2. Tests too weak in 6 places (a flag's next step, resolvable and evidence fields; "hold" accepted as a restart word; REDESIGN on an incomplete job; negative counts hiding a real count; and others). Closed with added cases.
3. The first orchestrator tests compared whole replies, which differ run to run (task numbers, times, taught words are process-wide). Fixed by comparing everything except those.

## Weak points I still see (honest list)
1. NOT independent: one author, no second implementation for P04, P06, P07, P08, P10 and the dialogue part. Hand-derived expectations and mutants reduce, but do not remove, shared-blindspot risk.
2. Judgment is a first slice only: the 8 seats and the no-voting rule work, but the full design (J0 to J5: situation types, consequence simulation, long-term effects, cost of inaction as separate engines) is NOT built. In the orchestrator it only judges tool answers as harmless READs; it never sees a destructive action because the seven tools have none.
3. The tool re-check covers only the text counter, sort lines and base64. The case converter, hash, number-to-words and QR maker have no independent check, so their answers stay UNVERIFIED (never blocked).
4. The re-check reads the quoted text in the message. If the brain took its text from somewhere else, the check is skipped or could disagree. 0 false alarms so far, but only on quoted payloads.
5. A missing-text question accepts ANY next message as the answer unless it resolves as a request of its own, and a question dies after 3 turns. An answer containing curly quotes cannot be placed and is asked again. A reply like `say "hi"` was treated as a new request, not an answer.
6. The dialogue question is generic ("Which text should I use?"); it does not name the tool.
7. Planner and loop: the planner now drives the existing step loop in tests, but nothing in the live brain makes multi-step plans yet (the seven tools are single steps), so the planner has no real multi-step use today.
8. Reflection candidates are kept in memory and can be exported as text; nothing persists them and nothing promotes them to knowledge (by design: owner rules).
9. The Mind pipeline's own stages still say "not built" for planning and verification in a plain brain. The orchestrator's trace copy shows real notes; the stage code in stages.ts was NOT edited (other directors own it, and a zip merge would overwrite their changes).
10. No screen calls the brain yet, and no code in src calls the orchestrator, so none of this is visible in the app. Switching from shadow to on is the owner's call after seeing shadow numbers.
11. Repair's two closed word lists live in repair.ts as keyed lookups, not in closedSets.ts.
12. The orchestrator test takes about 30 seconds; the end-to-end test about 30 seconds.

## What I could not check
Android and cloud builds; behaviour on a real phone and speed on the weakest tier (the half-second target is unmeasured); any D471, D321, D204 work newer than the zip I was given.

## Decisions only the owner can make
Charter tie rule (NEVER beats ASK beats ALLOW); the other-people check in the council; go-ahead for the full Judgment design; who builds the real AI connections (Axon Web director); when to switch the orchestrator from shadow to on.
