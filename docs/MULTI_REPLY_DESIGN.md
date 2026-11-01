# MULTI-REPLY DESIGN (W24): answering several things in ONE reply (Director, 2026-11-01; DESIGN ONLY, no code)

WHO IT IS FOR: the owner (decisions) and the Director (builds it later). Not a builder prompt.
WHAT THIS DOES: gives your wish "AXON replies to several things or situations in one message and one reply" a how, a size and a proof, so it leaves the unplanned list (7L 5) and builders may get sized parts of it.

## 1. What happens today (MEASURED 2026-11-01, real stages, real dictionary, 4 messages)
- The Mind reads the message into pieces and resolves each piece (Resolution, Router shadow). BUT the reply still comes from the old executor, which gets the WHOLE text and returns ONE answer from the first provider that matches. The pieces are never answered one by one.
- `count words in "a b c" and convert "hi" to uppercase`: two pieces found (count = fast, convert = ask); the old executor answered once with the counting handler; the convert part is not answered and not mentioned.
- `hello, and count words in "a b"` and `count words in "a b" then count lines in "x"`: Meaning found only ONE piece each, so the second request is not even seen. `thanks. what can you do?`: two pieces (thanks fast, question deep), one fallback reply.
- So there are two separate holes: (a) splitting is not reliable (a request after "and" or "then" can vanish), (b) nothing composes one reply from several answers, and a part that is not answered is dropped silently, which breaks the loud-never-silent law (FL15 rule 3).

## 2. The design (one new pure part plus wiring; no new engines)
**Piece answers.** For a message with two or more pieces, each piece gets its own PieceAnswer: `answered` (text from a tool runner or the old handler for that piece's own words), `asks` (one plain question, from the Router's ASK), `waits` (DEEP: conditional, linked, no fit, risky), or `failed` (the tool refused; the reason is kept). A piece is answered through the SAME lanes a single message uses today (direct lane when its switch is on, otherwise the old executor run on that piece's own words), so no tool is rebuilt (FL14).
**The composer (pure, tested).** `composeReply(pieceAnswers)` returns ONE reply text:
1. Answered parts first, in the order the owner asked them (default; question Q1), each beginning with a short echo of what it answers taken from the piece's OWN words (no stored phrases, FL13). With one part there is no echo and nothing changes.
2. Then ONE combined question for every part that asked (numbered when there are two or more).
3. Then one plain line for every part that is waiting for deeper thought or failed: what was not done and why. A part is never dropped silently.
4. Tone: one calm style (7D). No filler, no "great question".
**Reading rule from the Router.** Router order is quick answers, asks, deep; the reply shows answered parts in asked order, the Router order only decides what is computed first.
**Dialogue.** The dialogue state (B05 D2) holds ONE pending question. With several asking parts: the first becomes pending, the others are listed as waiting and asked after it is answered (question Q3).
**Switch.** Off until the phone check, like the direct lane; one piece or no switch means the old path, byte for byte.

## 3. Jobs, sizes, proof (sizes are ESTIMATES until measured)
- **MR0 splitting measurement (Director, one turn):** write 40 two-request messages (and 10 three-request), run Meaning, count how many yield the right number of pieces. Proof: the counts. Output: the list of failures with their cause (where a clause after "and"/"then" is lost). Size 3.
- **MR1 splitting fix (Director; owner confirms the closed word sets; FL13 no phrase lists):** fix at the source found by MR0. Proof: MR0 corpus, no regression on the Meaning tests and the golden transcript (79 messages). Size 4 to 6, depends on MR0.
- **MR2 composer (pure code and tests; a ChatGPT or Grok sized job, Director verifies):** contract above, 12 hand-written PieceAnswer sets with exact expected replies, 8 deliberate breakages (drop a part, wrong order, lost question, echo from a stored phrase). Size 3. Can start NOW (no dependency on the cloud build).
- **MR3 wiring behind a switch (Director):** per-piece run through the lane or the old executor, composer, trace line, switch OFF. Proof: single-piece messages byte-identical on 60 messages, 30 two-piece transcripts through the real Mind, 10 breakages. Size 5. Needs MR1, MR2, the Router (built) and B05 D2b (the ask lane).
- **MR4 phone check (owner):** 6 messages from the board lines, then the switch goes on. 
Order: MR0, then MR2 beside MR1, then MR3, then MR4.

## 4. Verdicts (rule 12, honest)
- Two or three independent requests in one message: WORKS (after MR1 to MR3).
- A later part that points back ("and do the same for the second one"): WORKS ONLY IF the reference stage resolves it; otherwise it asks.
- Parts that depend on each other (the result of one feeds the next): WORKS DIFFERENTLY (a plan with steps, Planning stage B06A; not this job).
- Many situations of different kinds at once (a tool request plus an emotion plus a question): WORKS ONLY IF the deep path (Council) exists; until then the deep parts say plainly they wait.
- Wrong split chance: CANNOT BE JUDGED until MR0 gives the number.

## 5. Owner questions (defaults are treated as approved until you answer; listed on the board)
- Q1 Order of answers: the order you asked (default) or quick answers first.
- Q2 When one part needs a question: the other parts answer first, then the question (default), or ask first.
- Q3 Several questions at once: ask all in one numbered question and take answers in one reply, or one at a time (default: one at a time, the rest listed as waiting, because the dialogue holds one pending question).
- Q4 Echo before each part when there are two or more parts: yes (default), or no.

## 6. Left out on purpose
Parts that depend on each other (see verdicts), a reply in several chat bubbles (the wish says one message), long reports per part.
