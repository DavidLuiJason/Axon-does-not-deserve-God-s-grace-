# MR0 SPLITTING REPORT (Director, 2026-11-01; MEASURED, no code changed)

WHO IT IS FOR: the owner and the next Director. WHAT THIS DOES: says how often AXON finds ALL the requests in a message with several, where it loses them and why, and what the fix (MR1) would be. Script: `docs/director/mr0_split_measure.ts` (run `tsx docs/director/mr0_split_measure.ts`; needs the dictionary).

## Result: 31 of 50 right (62%); 19 messages lost at least one request
Corpus: 40 two-request messages (8 first requests x 5 connectors, systematic) and 10 three-request messages, through the real Meaning stage with the real dictionary.
| connector | right | lost a request |
|---|---|---|
| full stop ("X. Y") | 8 of 8 | 0 |
| and | 5 of 8 | 3 |
| then (", then") | 5 of 8 | 3 |
| semicolon | 5 of 8 | 3 |
| also | 5 of 8 | 3 |
| three requests | 3 of 10 | 7 |
A lost request is not answered and not mentioned (the second hole in `docs/MULTI_REPLY_DESIGN.md`). No message produced MORE pieces than intended.

## Where requests are lost (pattern, from the 19 failures)
1. `define serendipity and define ephemeral`, `count words in "a b c" and count words in "x y"`, `count characters in "abc", then define ephemeral`: the second request is a verb followed by a BARE noun (no "the", "a", "my", number or quote after the verb).
2. The same after a greeting or thanks: `hello and count lines in "q"`, `thanks also count words in "x y"`, `thanks; define ephemeral`.
3. The same inside three-request messages, so most of them lose two requests.
What works: a full stop or `?` (always a boundary), and a second request whose verb is followed by a quote, a number or a determiner (`convert "hi" to uppercase`).

## Cause (MEASURED by reading `src/brain/mind/meaning/clauses.ts`)
A comma, semicolon, "and", "or", "but" or "then" is a clause boundary ONLY when the words after it `startsClause`. For a verb that test needs `strongObjectCue`: material right after the verb, or a determiner, object pronoun, possessive or digit next. A bare noun after the verb gives no cue, on purpose: it protects "salt and pepper" and "5 miles and 3 feet" from being cut. The word "also" is not a coordinator or sequencer, so it is never a boundary candidate. Same cost on both sides: the rule is safe, and it is too strict for plain requests.

## Proposed MR1 (design only; a behaviour change, so it waits for the confirmed cloud build, FL15 rule 6)
SPLIT SECOND READING, the same shape as the owner-approved "word count" compound reading (adapter rule 17): where a boundary candidate (comma, semicolon, and/or/but/then/also) is REJECTED by `startsClause`, also build the split reading. Resolve both readings. Take the split ONLY when every resulting piece resolves to a match or ask (never none) AND the unsplit reading is not a single clean match; mark the message `reading: 'split'` (loud, FL15 rule 3). No phrase list, no new word list: the closed connector words already exist; "also" joins the sequencer set (owner approves, FL13). "salt and pepper" stays whole because "pepper" resolves to no tool, so the split fails the test.
Proof: the 50-message corpus (target: no lost request, still no extra piece), the existing Meaning tests, the 79-message golden transcript, 20 non-request sentences with "and" that must NOT split ("salt and pepper", "5 miles and 3 feet", "bread and butter"), 8 deliberate breakages. Size ESTIMATE 5 (Director, one turn).
Risk: a sentence like "count the days and nights" splits only when "nights" resolves to a tool, which it does not; a risk remains for words that are also tool words ("count and define"). Said honestly, not claimed solved.

## Status
MR0 DONE. MR1 designed, NOT built, waits for the cloud build confirmation and the owner's yes on adding "also". MR2 (the composer) can start now: it is new pure code with no dependency.
