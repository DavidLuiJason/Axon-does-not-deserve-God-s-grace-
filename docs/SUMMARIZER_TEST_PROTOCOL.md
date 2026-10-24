# SUMMARIZER MEANING TEST (Director, 2026-10-24, v2)

WHO IT IS FOR: the owner (phone) and then ANY other AI chat.
WHAT THIS DOES: tests whether a prompt that goes through AXON's Summarizer still tells another AI exactly what to do.
WHAT YOU DO (10 minutes): the four steps below. Files: SUMMARIZER_TEST_TEXT.txt (the prompt to summarize) and this file.
WHAT TO BRING BACK: three numbers (how many of the 16 requirements survived at each setting).

## What the Director measured already
MEASURED in the Director sandbox with the SAME Summarizer engine the app uses (src/tools/engines/text/summarize.ts) on SUMMARIZER_TEST_TEXT.txt (34 sentences, 16 requirements K1 to K16). "Survived" here means the sentence that states the requirement is still in the output. That is the BEST case: the other AI can only understand what is still written.

| Summarizer setting | Sentences kept | Requirements still written |
|---|---|---|
| about half (ratio 0.5) | 17 of 34 | 3 of 16 (K5, K6, K10) |
| about a third (ratio 0.3) | 11 of 34 | 1 of 16 |
| 8 sentences | 8 of 34 | 1 of 16 |

NOTE: the first protocol (previous account) measured 12, 7 and 5 on a DIFFERENT test text, which was lost when that account ended. The numbers depend on the text, so use only the table above with THIS text. The verdict is the same in both: most "never" and "must" rules are lost.
Lost already at half: the three files, never touch other files, never edit package.json, integers in cents, tip before tax, round half up, 20 tests with Python Decimal, five mutation tests, run the tests yourself, stop after two failures, the zip name, no code in the chat, stop if the roadmap conflicts.

VERDICT: the Summarizer as it is today is NOT safe for prompts. It keeps the sentences with the most repeated words. A rule such as "never do X" is a short sentence with few repeated words, so it is dropped. Those are exactly the sentences that must never be lost. The Summarizer was built for articles and does what it was built for.

THE FIX (a later job, S2 "Prompt-safe mode"): sentences that carry an instruction, a "never" or "must", a condition (if, unless), a limit or a number are marked MUST KEEP and are never dropped. The brain's Meaning stage (B03A, B03B) already finds those, so the Summarizer should USE the brain's reading and not keep its own copy (one engine, many users). Until then: do not summarize prompts.

## What you do
1. Open AXON, Summarizer. Open SUMMARIZER_TEST_TEXT.txt, copy ALL of it, paste it in.
2. Run the Summarizer three times: about half, about a third, and 8 sentences. Copy each output.
3. For each output, open a NEW chat with ANOTHER AI and send exactly this, then paste the output under it:
   "You will receive instructions. List (a) every file you may create or touch, (b) every thing you must never do, (c) every number or limit, (d) every condition, (e) what you must return. Do not do the work."
4. Compare the AI's answer with this key. A requirement SURVIVED only if the AI states it correctly.
   K1 the exact three files (receiptSplit.ts, receiptSplit.test.ts, R7_REPORT.md)
   K2 must not touch any other file
   K3 never edit package.json (report the test line instead)
   K4 all money in integer cents, never floating point
   K5 leftover cents go to the first people, one cent each
   K6 an item with no people returns the typed error no-people
   K7 tip is applied to the sum BEFORE tax, never on the tax
   K8 round half up on cents
   K9 at least 20 test cases computed independently in Python with Decimal
   K10 maximum 200 items and 50 people, above that the typed error too-large
   K11 at least five mutation tests
   K12 run every test yourself before handing over
   K13 stop after the same problem fails twice, no third fix
   K14 return one zip named R7-receipt-split.zip
   K15 do not paste code in the chat
   K16 if the prompt conflicts with the roadmap, stop and say so
5. Write the number that survived for each setting and send me the three numbers. If they are at or below my table (3, 1, 1), my measurement is confirmed. If they are much higher, tell me: the other AI guessed some rules from the sentences around them (that is also a finding, because a guess is not a rule).

## Why an AI can still guess wrong when a sentence survives
The summary removes the sentences around it, so "never on the tax" may stay while "tax is applied to the sum of the items" is gone, and the other AI guesses. This is why the test asks the other AI to LIST the rules and not to do the work: it shows what it understood before any damage is done.
