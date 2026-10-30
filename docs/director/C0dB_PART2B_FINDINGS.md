# C0d-B PART 2b: which layer loses each miss (Director, nineteenth account, 2026-10-29)
Measure only. No repository change, no code to merge. Evidence labels: MEASURED = printed by the real stack and real dictionary in my sandbox (a throwaway trace script, deleted with the sandbox); DIRECTOR READING = my judgment; HYPOTHESIS = not tested.
Run twice on 10 of the Part 1 misses (the 9 cause-A cases plus 3 cause-B cases, minus two I did not trace): once with the Part 2 prototype, once with the original code.

## What each case showed (MEASURED)
| Request | Original result | With prototype | Layer that loses it |
|---|---|---|---|
| How many characters are in this sentence | ask: grammar-helper / rephraser / summarizer, all on `sentence:n` alone (0.33) | none, no candidates | **Concepts:** no concept for counting or for "characters" as the thing counted reaches text-counter |
| What is different between these two texts | none, no candidates | none | **Concepts:** nothing recognised ("different", "texts") |
| Is this sentence correct | none, no candidates | none | **Concepts:** nothing recognised ("correct", "sentence" as the object) |
| What is 12 times 7 plus 3 | none, no candidates | none | **Concepts:** no arithmetic concept (OPEN_ITEMS 50) |
| What is the date 30 days after 5 March | ask: date-calculator vs timer, both exactly 1.0 (`date` vs `duration`) | same | **Tie:** two tools with one matched concept each; nothing breaks it |
| What type of file is this and how big is it | ask on `file:n` among 4+ tools at 0.17 | none | **Concepts:** "type" and "big" reach no file-inspector concept |
| Batch convert my photos to jpg | ask: collage-maker vs picture-to-table (0.40, `picture:n` only) | ask: picture-to-table 0.48 (`convert:v` + `picture:n`) | **Concepts + scoring:** "batch" and "jpg" match nothing; batch-convert is not a candidate |
| Convert this image file from PNG to JPEG | match **qr-maker 1.00** (`image:n` only) | same | **Scoring:** a one-concept tool beats tools that also match the verb (picture-to-table 0.48, file-converter 0.34) |
| Change my file from CSV to JSON | match **json-viewer 1.00** (`json` only) | same | **Scoring:** same; file-converter 0.34 matched `convert:v`, `change:v`, `file:n` |
| Convert this Word document to PDF | unavailable **pdf-tools 1.33** (`document:n` + `pdf`) | same | **Scoring:** document-converter 0.51 matched the verb and `document:n` and still lost |

## Five findings
1. **The verb pick was not the main lever (MEASURED).** In the original code the verb "convert" is already right in the three format cases, and they still fail. In five of the clause cases there is no candidate at all, so a better verb has nothing to land on.
2. **My Part 2 prototype also had a defect (DIRECTOR READING from the code and the empty candidate lists).** When the guards chose the copula as the verb, `clauseParts.ts` gives a copula clause no object span, so its nouns ("characters", "texts") never reach Resolution. That is why "characters" fell from a wrong ask to nothing. Part 2 was a no-go for two reasons: the lever was elsewhere, and the guard dropped objects.
3. **Cause B is a scoring problem, with numbers (MEASURED).** Tools whose only concept is a noun or a format name score 1.00 or more (qr-maker, json-viewer, pdf-tools) and beat tools that matched the verb and the object (0.34 to 0.51). The verb "convert" is matched but not weighed against what the winning tool does. How the score is built I have not read in `resolve.ts`: HYPOTHESIS that it divides by the tool's own concepts, so a one-concept tool reaches 1.0.
4. **Cause A cases are mostly missing concepts, not wrong verbs (MEASURED).** Counting, comparing, checking correctness and arithmetic have no recognised concept in these phrasings. Under FL13 this cannot be fixed by adding phrases; it needs senses from the dictionary or a closed set the owner approves (a decision for later, not for me).
5. **Two cases are plain ties** (date-calculator vs timer; the file cases at 0.17) that need evidence from the clause, not a better verb.

## Revised order (Director's choice; the roadmap says the Director picks brain jobs)
1. **C0d-D [weigh the verb and the details], design and throwaway prototype, next turn.** Target: cause B (3 dev misses) and the 0.17 and 1.0 ties. Method: change how a tool's score is built so a matched verb counts and a tool that ignores the clause's verb is penalised; measure dev, dev2, golden, and expect a few exact gains, not a jump.
2. **C0d-C [closeness without a sense check]** after that, as planned (4 misses).
3. **Concept gaps (counting, compare, correct, arithmetic, file type/size)** go to the owner as a question, because they touch vocabulary (FL13): no phrase lists, only dictionary senses or an approved closed set.
4. **C0d-B Part 3 (verb and clause design) is shelved.** The verb guards are dropped. I recommend not building them; the board row stays open until you confirm.
Honest limit: none of this is a held-out number; the held-out file is still missing. Expect dev to rise by at most about 3 to 6 from C0d-D (HYPOTHESIS), and the rest of the gap is concept gaps.

## Board lines (copy into `docs/JOB_BOARD.md` when you next merge)
2026-10-29 (Director, nineteenth account): **B04C0d-B Part 2b [which layer loses each miss] DONE (measure only).** MEASURED on 10 dev misses, original vs prototype: the verb is not the main lever; 5 clause cases have no concept at all (counting, compare, correct, arithmetic, file type), 3 format cases lose on scoring (a one-concept tool at 1.00 beats verb-plus-object tools at 0.34 to 0.51), 2 are ties. The Part 2 prototype also dropped nouns of copula clauses (DIRECTOR READING). NEW ORDER: C0d-D [weigh verb and details] next, then C0d-C; concept gaps become an owner question (FL13); C0d-B Part 3 shelved (owner to confirm). NOT RUN: held-out, machine check, cloud build. No repository change.
