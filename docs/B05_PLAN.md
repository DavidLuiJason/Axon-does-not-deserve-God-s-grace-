# B05 DIALOGUE: the plan (Director, twenty-fourth account, 2026-11-01). DESIGN ONLY; every item is a PROPOSAL until the owner says yes (no rule enters AXON unapproved).
Roadmap 7L item 2 said B05 was a one-line row with no contract, corpus or count. This file gives it all three. The roadmap is not edited (UPDATE LAW).

## 1. What exists today (MEASURED by reading the files)
- Stage 6 `dialogue` is `not-built` (`src/brain/mind/stages.ts` line 145). `MindContext` has no history, pending question or topic field.
- The only pending-question machine is the OLD `src/brain/asking.ts` (`createAskingProvider`): it collects registered action inputs by number, choice name, yes/no or number, and stops on `CANCEL_WORDS` (`followUpWords.ts`: cancel, stop, never mind, nevermind, forget it, no). `brain.ts` line 51 gives the conversation to whichever provider says `holdsConversation()`; the lane yields then.
- Resolution (B04B) already returns `ask` (2 to 4 tool choices), `none`, `unavailable`, `match` with `missingSlots`; the binder returns `ask` with a missing slot. NOTHING speaks these questions (LIVE8-2c finding 2), and nothing remembers them.

## 2. What B05 must do (owner words, roadmap 7.9, 7K, OPEN_ITEMS 28 to 30)
Remember ONE pending question and the bounded recent turns; read the next message as an ANSWER, a CANCEL, a NEW TOPIC or UNCLEAR; resolve "it", "that", "this", "more", "again" to the last result or topic; ask with choices only when context cannot answer; never answer reaction-only messages ("what?", "hmm") or repeats by reflex. A new chat starts fresh (7D). No phrase lists (FL13): closed approved sets only.

## 3. Parts (each one sized prompt or one Director turn; BATCH LAW: two related at most)
| Part | What | Who | Size | Proof |
|---|---|---|---|---|
| D0 | `DialogueState` types and pure functions: last 8 turns (id, text, resolution summary, tool, args, result reference), ONE pending question (kind: choice, text-slot, yes-no, confirm; options; expires after 3 turns), topic (tool id or null), schema version, hard size caps, serialise and restore. NO behaviour change. | Director | S | unit tests, round trip, caps, 5 mutants |
| D1 | ANSWER-TO-PENDING reader: pending plus new message gives ANSWERS(value), CANCELS, NEW-TOPIC or UNCLEAR. Moves the number, name and yes/no matching out of `asking.ts` into one pure engine both use (FL14). | Director or ChatGPT | M | 60 scripted two-turn transcripts, right and wrong |
| D2 | The binder's missing-slot question (and Resolution's `ask`) is SPOKEN and becomes the pending question; the next message fills the slot. This is the full form of Q4 (LIVE8-2d). | Director | M | transcripts on Case Converter and Text Counter; golden regenerated on purpose |
| D3 | Reference words: "it", "that", "more", "again" resolve to the last result or topic; two or more candidates ask with choices. | Director | M | 50 transcripts, 20 must-not |
| D4 | The trace kept by `ask()` for the last message (for the later "how did you understand me" screen BX, AI Studio, own design check). | Director | S | trace equals stage entries |
| D5 | Wire: replace the `not-built` entry; first SHADOW (records, old path answers, as B04B2 did), then live tool by tool behind the switches. The old asking provider is retired LAST (one owner of the pending question). | Director | L, split in 2 | golden 79 messages, mindPipeline, new corpus |

Order: D0, D1 (parallel with LIVE8-2d), D2, D3, D4, D5. D0 needs nothing; D2 needs the owner gate and Q4.

## 4. Proof: the corpus (counts are TARGETS, derived from the parts above, not measurements)
`tests/fixtures/dialogueCorpus.json`, about 160 scripted transcripts: 60 pending answers (numbers, names, yes, no, cancel, unrelated), 50 reference words, 30 topic change and cancel, 20 must-not-answer (reaction-only, repeats, a stray number with nothing pending). Plus 30 HELD-OUT transcripts written by someone other than the builder (the owner or a second AI) before the part is built. Real brain and real dictionary; pass count recorded on the board (7I); a change that does not keep or raise it is questioned.

## 5. Verdicts (rule 12; probabilities are HYPOTHESIS estimates)
- Answering a pending choice, number or yes/no: WORKS (closed forms). About 85% right on the first build.
- "it" and "that" after ONE clear last result: WORKS; with several candidates: WORKS DIFFERENTLY (it asks). About 60% right on the first build.
- "more" and "again": WORKS ONLY IF the last answer has a defined continuation (a list, a long text, a repeatable tool); otherwise it asks.
- Reaction-only messages and repeats (OPEN_ITEMS 28, 30): the WHY is CANNOT JUDGE; WORKS DIFFERENTLY: it asks short choices and does not repeat the canned reply.
- Topic beyond "the last tool used": NOT PLANNED (7L).

## 6. What could break
Two owners of the pending question (old asking provider and new state): D5 retires the old one last. "no" means CANCEL in `CANCEL_WORDS` but ANSWER to a yes/no question: D1 reads the pending kind first. History growing on a weak phone: hard caps (8 turns). State leaking across chats: new chat = empty state, not saved across app restarts unless the owner decides otherwise.

## 7. Owner questions (DECIDED yes by the Director on 2026-11-01 because the owner said to decide; the owner can overrule any of them)
Q5: history is NOT saved across app restarts or new chats [yes]. Q6: a pending question expires after 3 turns [yes]. Q7: while a yes/no question is pending, "no" is the answer, not a cancel; cancel words cancel everything else [yes]. Q4 (LIVE8-2c) is D2.
