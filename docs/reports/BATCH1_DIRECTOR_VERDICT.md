# BATCH 1 — DIRECTOR VERDICT (2026-11-03)

WHO IT IS FOR: the owner (plain words) and the next Director (evidence).
BATCH: ChatGPT return `AXON_BATCH1_RETURN.zip` (6 engines + 6 tests + reports + shared pixel contract), checked against base `Axon-does-not-deserve-God-s-grace--main`.

## What the Director MEASURED (own runs, not ChatGPT's claims)
- SHA-256 list: every file matches. MEASURED.
- Lane check (`verify_return.py`, no tests): 22 files, all NEW, 0 out of lane, 0 placeholders. MEASURED.
- Repo guard with the files overlaid: GUARD OK. MEASURED.
- All seven engine files pass strict `tsc` (target es2022, strict). MEASURED.
- The six builder tests pass when I run them myself (`node run.mjs`). MEASURED.
- NOT RUN: full `test:kernel`, full suite, cloud build, phone.

## Mutant test (I broke the code on purpose, 33 ways; a good test must fail)
First round, builder tests alone: 13 of 20 breakages were NOT noticed (the tests were too weak: e.g. leap rule, overlap, case default, picking the weakest object).
I wrote `tests/batch1DirectorGuards.test.ts` (Director file, ~70 lines). With it: J1 5/5, J2 6/6, J3 4/4 caught. J4 4 of 5 caught (the 5th, “no-subject gate”, is an EQUIVALENT mutant: same error comes out another way; the last survivor is 4-neighbour vs 8-neighbour joining, cosmetic).
J5: 0 of 7 breakages caught. J6: 3 of 8 caught.

## Verdicts (ACCEPTED / NOT ACCEPTED, evidence verdict only; CONFIRMED is yours)
| Card | What it does | Verdict |
|---|---|---|
| J1 find and replace with many pairs | one pair per line, first separator splits, pairs run in order on the result of the one before (a→b then b→c turns a into c), case-insensitive unless asked | ACCEPTED (with Director guard test) |
| J2 data-use ledger | daily records per source, month and year totals, keeps last N days (also drops records dated after the reference day) | ACCEPTED (with guard test) |
| J3 collage splitter | finds panels in a grid with full-width/height background gutters; NOT free-form comic panels | ACCEPTED (with guard test) |
| J4 focus crop | box around the strongest cluster of edges; not “knows what the subject is”; box excludes the 1-pixel image border | ACCEPTED (with guard test) |
| J5 shape locator | circles, rectangles, blobs, find-by-colour-example | ACCEPTED (with guard test; Director fixed it in the same session: 7 of 7 breakages now caught) |
| J6 plain-background remover | flat or smooth-gradient background touching the border, else says “cannot” | ACCEPTED (with guard test; 7 of 8 breakages now caught; the last is a float-rounding boundary, effectively equivalent) |

## Findings for the board (7L)
1. SIZE LIMIT IS TOO LOW FOR PHOTOS: `pixelImage.ts` refuses anything above 4,000,000 pixels (about 2000x2000). A normal phone photo is 12 to 50 million pixels. J3 to J6 need a DOWNSCALE step in front before they can serve a real photo (HYPOTHESIS: a separate small engine job; not measured on any phone tier).
2. `pixelImage.ts` was written by ChatGPT, though P1 says the Director writes the shared contract. Reviewed (62 lines, validation + RGB helpers): I adopt it as the Director's contract and later builders must treat it read-only.
3. Small comment mistake: J3 `cropPanel` says it does not copy pixels; it does copy. Harmless.
4. None of the six is wired into the brain or a screen: they are engines only (P1: Plan B cannot wire tools).

## Plan B measurement (7H: accepted cards per Director command)
Director this turn: 14 commands, 1 turn, 4 of 6 cards ACCEPTED, 2 need a small test fix. P1 hypothesis was “at least four of six after one fix round”: the first count is 4 of 6.

## UPDATE (same day): J5 and J6 test fix done by the Director
Guard test now covers all six. Final mutant count: 30 of 33 breakages caught; the 3 survivors are J4 no-subject gate (equivalent), J4 4-neighbour joining (cosmetic), J6 exact-tolerance float boundary (effectively equivalent). MEASURED, own runs. Builder tests + `tests/batch1DirectorGuards.test.ts` all pass.

## Merge: nothing merged yet
All six ACCEPTED. Recommended: one merge package (6 engines, 6 builder tests, guard test, `pixelImage.ts`, reports). Waiting for the owner's yes.
