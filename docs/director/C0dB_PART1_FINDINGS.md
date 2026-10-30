# C0d-B PART 1 of 4: where the misses come from (Director, nineteenth account, 2026-10-28)
Evidence labels: MEASURED = printed by the real stack on the dev corpus; DIRECTOR READING = my sorting of those traces into causes (a judgment, not a measurement). Scratch tool only; nothing in the repository changed.

## What was run
`SHOW_FAILURES=1 tsx tests/toolRequestAccuracy.test.ts` on the repo zip "main": dev **31/57 exact**, asked with the right choice 10, wrong tool 10, nothing 6 (matches the board). A throwaway script then printed, for each miss, the speech act, the verb and object the clause reader chose, and the top three tool candidates with the concepts that matched.
Not available this turn: the HELD-OUT file (it was not attached to this chat), so nothing here is a held-out number. 22 of the 26 dev misses are traced; 4 are not (below).

## Result: 22 traced misses by cause (DIRECTOR READING)
| Cause | Count | Misses |
|---|---|---|
| **A. Wrong verb or clause** (a noun or adjective taken as the verb, a verb lost, a clause split wrongly) | **9** | "How many characters are in this sentence" (verb read as "characters"); "What is different between these two texts" ("texts"); "Is this sentence correct" ("correct"); "What is 12 times 7 plus 3" ("times"); "Time how long this takes with laps" (act unknown); "What is the date 30 days after..." ("is"); "What type of file is this and how big is it" ("type"); "Batch convert my photos to jpg" ("batch" read as the verb, confidence 0.65); "Find the word apple and change it to pear" (two clauses; the second read as a converter) |
| **B. A noun or format name beats the verb** (the best tool is chosen from one noun; the verb and details are ignored) | 3 | "Convert this image file from PNG to JPEG" gave qr-maker (matched only image:n, score 1.0); "Change my file from CSV to JSON" gave json-viewer; "Convert this Word document to PDF" gave pdf-tools |
| **C. Closeness without a sense check** | 4 | "words" reaching the translator (language:n) in "Count the words in 'the quick brown fox'" and "Turn the words 'forty two' into a number"; "Say ... in other words" reaching read:v; "Write 1250 in words" reaching write, spell and language tools |
| **D. A tie with no evidence to break it, or a missing word** | 6 | "Compare 'the red car' with 'the blue car'" (the quoted text is not used as evidence); "Work out 450 divided by 15" (four tools share calculate:v); "Zip these files together" (zip-tool is not even a candidate); "Turn my document into Markdown" ("turn" has no concept); "Convert all these files in one go"; "Explain how this sentence is built" (read as chat) |
| Not traced yet | 4 | "Show me what is inside this file" (gave background-proof); "Compare these two files"; "How many differences are there between these two files" (looks like the same noun-as-verb pattern as the characters case, HYPOTHESIS); "Convert 255 to binary" |

## What this means
1. **C0d-B is worth doing.** Cause A is the largest single group (9 of 22) and it is the part of the job that is truly "verb and clause choice". It touches the clause reader, not Resolution scoring.
2. **Cause B is a new finding and is not in the plan.** A noun or format name decides the tool and the verb is ignored. I propose a new row, **C0d-D "weigh the verb and the details"**, after C0d-B. It is a proposal; you decide.
3. **C0d-C stays as planned** (cause C, 4 misses).
4. Cause D (6) is not one fix: part is vocabulary (C0c), part is using quoted text as evidence (C1), part is a missing arithmetic value type (OPEN_ITEMS 50).
5. Honest limit: fixing A alone will not move dev by 9. Several A cases also have another cause behind them ("What is 12 times 7 plus 3" has no arithmetic concept; "How many characters" would still need a counting tool match). Part 2 measures the real gain before any design.

## The four parts of C0d-B (for the board)
1. **Part 1, measure: DONE** (this file).
2. **Part 2, prototype:** a throwaway fix for cause A on the real dictionary; dev, dev2, golden checked; go or no-go with numbers.
3. **Part 3, design and tests:** contract edits, a right-and-wrong test corpus, plan text; merge zip.
4. **Part 4, reference code and proof runner,** or a builder prompt if it is too big for me.

## Board line (copy into `docs/JOB_BOARD.md` when you next merge)
2026-10-28 (Director, nineteenth account): **B04C0d-B Part 1 [measure verb and clause misses] DONE.** MEASURED dev 31/57; 22 of 26 misses traced: 9 wrong verb or clause, 3 noun or format name beats the verb, 4 closeness without sense, 6 ties or missing words, 4 not traced. NEW proposed row C0d-D (weigh verb and details). NOT RUN: held-out corpus (file not attached), machine check, cloud build. NEXT: Part 2 (prototype).
