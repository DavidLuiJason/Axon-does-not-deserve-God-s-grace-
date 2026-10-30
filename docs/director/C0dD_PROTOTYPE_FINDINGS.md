# C0d-D [weigh the verb and the details]: throwaway prototype (Director, nineteenth account, 2026-10-29)
Scratch only; nothing in the repository changed. Labels: MEASURED = real stack and real dictionary in my sandbox; DIRECTOR READING = my judgment.

## What I tried
Where the score comes from (read in `resolve/resolve.ts`): each matched concept adds `similarity / (number of tools that share that concept)`. A noun or format name owned by ONE tool therefore scores 1.00 (qr-maker for "image", json-viewer for "json"), and a verb shared by many tools scores a small fraction ("convert" is shared by 12 of 63 tools).
Prototype (13 lines, `C0dD_prototype.diff.txt`): when at least one tool matches a verb of the clause, every tool that matches none of the clause's verbs has its score multiplied by a penalty. An unknown verb counts against nobody (my first version penalised everybody and was wrong; a coding slip in my first run also meant it did nothing).

## Numbers (MEASURED, dev corpus of 57; penalty 0.5 / 0.25 / 0.1)
| | Baseline | With prototype |
|---|---|---|
| exact | 31 | **29** / 29 / 29 |
| asked with the right choice | 10 | 16 / 15 / 15 |
| wrong tool (confident and wrong) | 10 | 6 / 7 / 7 |
| nothing | 6 | 6 |
dev2 and golden were not reached: the test stops at the ratchet (29 is below the baseline of 31). Held-out: the file is lost.
Gained exact: **0**. Lost exact: "Give me the hash of 'hello'" and "Make this text lowercase: 'LOUD NOISE'".
The three format cases moved from a confident wrong answer to an ask that contains the right tool ("Convert this image file from PNG to JPEG", "Change my file from CSV to JSON", "Convert this Word document to PDF").

## Why the two exact cases were lost (MEASURED + DIRECTOR READING)
In those clauses the verb is generic ("give", "make") and the object carries the meaning ("hash", "lowercase"). The same structure as the format cases (a tool on an object only, against a tool on a verb plus a weak object) appears in both, so the matched concept sets cannot tell them apart. I measured whether a verb's breadth separates the two kinds: it does not. "make" is shared by 3 tools, "convert" by 12, "give" and "turn" by none. A word list of generic verbs is forbidden (FL13).

## Decision
**NO-GO on the verb-agreement penalty as built.** Exact falls 31 to 29 with no gain, so the ratchet rule applies ("a change that does not keep or raise the score is questioned"). It does cut confident wrong answers from 10 to 6 or 7 by turning them into asks, but that goes against the owner decision of 2026-10-28 (confirm, do not ask; OPEN_ITEMS 55), so it is the owner's call, not mine.
**Two-Strike status:** the verb-guard idea (Part 2) failed once; this scoring idea failed once. Common failed assumption: that one structural signal can separate the verb that matters from the noun that matters in these requests. I will not tune a third variant.

## What this tells us (DIRECTOR READING)
The dev corpus misses are mostly of three kinds that no single scoring tweak fixes: (1) missing concepts (counting, comparing, correctness, arithmetic, file type or size), (2) whether the verb or the object carries the meaning, (3) ties. Chasing the 57-case score is giving small returns. The better use of the next turns is outside this loop (see the reply).

## Board lines (copy into `docs/JOB_BOARD.md` when you next merge)
2026-10-29 (Director, nineteenth account): **B04C0d-D [weigh verb and details] throwaway prototype DONE, result NO-GO.** MEASURED dev: baseline 31/57; a verb-agreement penalty (13 lines in `resolve.ts`) gives 29/57 at 0.5, 0.25 and 0.1, with 0 gained and 2 lost ("hash of 'hello'", "lowercase"); confident wrong answers fall 10 to 6 or 7, asks with the right choice rise 10 to 15 or 16. Breadth of a verb across tools does not separate generic from content verbs (make 3, convert 12, give 0). Two failed attempts (Part 2 verb guards, this penalty): no third variant; the brain scoreboard loop (dev 57) stops here. OWNER QUESTION: would you accept more asks instead of confident wrong answers (it conflicts with OPEN_ITEMS 55)? NOT RUN: held-out (file lost), machine check, cloud build. No repository change.
