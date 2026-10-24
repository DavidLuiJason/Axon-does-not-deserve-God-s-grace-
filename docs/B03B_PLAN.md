# B03B PLAN v2: how AXON understands what is INSIDE a message (Director, 2026-10-24)

[B03B = brain job "Meaning stage, part B". B03A (part A) already finds each instruction and decides ask, command, greet, thanks, chat. B03B reads what each instruction is made of. B04A/B04B later choose the tool.]
Status: owner approved the closed number-word list and confirmed both safety rules (2026-10-24). Nothing of B03B is built yet except the B03B1 prompt.

## 1. The idea, and the one change
Owner idea: go through the words one by one, understand each, then put them together. Kept. One change, because a word can have up to 40 meanings: B03B does NOT pick one meaning per word first. It keeps the choices open and builds the STRUCTURE and the VALUES. The meaning is chosen late (B04B), by asking which real tool AXON has, and the words AROUND a word help (B03B4). Rule: keep the alternatives, decide as late as possible, always say how sure and why.

## 2. The jobs (each small enough to be proven alone)
B03B0 LANGUAGE KIT (pure code, ChatGPT). The basics of a writing system, by rule and not by long lists: the alphabet and its order (a to z, upper and lower case), vowels and consonants (and the cases where a letter is both, such as y), digits, counting and "what comes next", how Roman numerals work (the seven letters and the subtract-before rule, shared with B03B1), how English number words are built, and the CONTRACT every future language pack must fill (its letters, its order, its digits, its number grammar, its closed grammar words). Reason (owner): a new language pack must start from the same primitives, or AXON cannot learn a language.
B03B1 VALUES (pure code, no dictionary, ChatGPT; prompt written). Numbers (digits, words, ordinals, half, decimals, negatives), quantities with units, percents, durations, dates, times of day, Roman numerals. All computed by tested code. Units come from the unit engine, dates from the date engine, Roman numerals from one new shared Roman engine (FL14). The clock is given to it, never read.
B03B2 STRUCTURE (needs the dictionary, the Director). Per clause: main verb, what it acts on, details (for, in, to, by, at as raw markers), linked clauses typed CONDITION (if, unless), TIME (when, after, before, while), REASON (because). A clause with a condition is marked "may not run alone". Also: asks-for-a-reference (it, that, again, "the last one", and a clause with no verb after a command), and who it is for ("tell Tom to call me" is not an order about Tom; quoted words are never orders).
B03B3 TEACH, CORRECT, PROPOSE, TONE, LANGUAGE (needs the dictionary, the Director). The acts teach ("serendipity means a happy accident") and correct ("no, I meant kilometres"); preference statements as PROPOSALS only; tone ("SET A TIMER!!!" is urgent, "this is wrong" is frustration; it changes how AXON answers, not what it does); not-English text answered "I read English only". NEW (owner): a word can be taught to stand for a sentence ("lunch run means go and buy food"), and a sentence can be re-expressed with other words that keep the meaning; every taught pair is visible, can be changed tomorrow and can be undone. Never saved without the owner's yes.
B03B4 SENSE BY CONTEXT (needs the dictionary, the Director). NEW (owner idea: "fill the gaps"): when a word has several meanings, use the words around it. The dictionary glosses of each meaning are compared with the neighbouring words and with the tools AXON really has; the meanings are ranked; the alternatives stay with a confidence and a reason. If it still cannot tell, AXON asks with choices.

Order: B03B1 and B03B0 (ChatGPT, can run side by side), then B03B2, B03B3, B03B4 (Director). Each is proven alone: right AND wrong messages, confusion table, golden transcript unchanged, no word lists, mutation tests.

## 3. Gaps found by testing B03A (all real)
1 Conditions and timing ("if it rains, cancel the trip" is read as two separate pieces; the cancel could run anyway). 2 Teaching and correcting. 3 Numbers, units, times. 4 References (it, that, again). 5 Who it is for and quoted words. 6 Statements about you. 7 Tone. 8 Not English. 9 Everything explainable for the "how did you understand me" view (BX).

## 4. Safety rules (CONFIRMED by the owner)
(a) A clause with a condition never runs alone. (b) "I prefer..." is only a proposal to remember, never saved without the owner's yes.

## 5. Word lists (FL13 allows only closed grammar sets, each owner-approved)
APPROVED: zero to nineteen, twenty thirty forty fifty sixty seventy eighty ninety, hundred, thousand, million, first to tenth, half. PROPOSED (the owner approves group by group when B03B1 returns; each carries its reason): sign words (minus, negative); percent words (percent, per, cent); clock words (quarter, past, noon, midnight, am, pm, o'clock); calendar words (today, tomorrow, yesterday, the seven weekday names, the twelve month names and their usual three-letter forms). The nine conversation words (hey, heya, hiya, yo, thx, thanx, thankyou, ty, cheers) still wait for the owner.

## 6. Tools must never be out of date (FL14, proposed)
Anything a tool already does (units, dates, Roman numerals, summarizing, calculating) is done by that tool's engine, and the brain imports the same engine. Today the Summarizer has its own sentence picker and the brain will have its own reading of instructions; FL14 means the Summarizer will use the brain's reading (job S2) and the brain will call the unit and date engines. A test fails when a copy appears.

## 7. Honest limits
B03B understands STRUCTURE and VALUES; it cannot say what "it" means (B05) or which tool is meant (B04B). Open chat at a large model's level is not promised: AXON says "I did not understand" and asks, instead of guessing.
