# AI CAPACITY (rebuilt 2026-10-24 by the Director from the roadmap and the B03B1 job; the earlier version was lost with the first account)

Roadmap section 5.8 gives the roster. This file holds the ratings and the LOG of what overloaded each tool. Add a line after every overload. Check order for a failed job: PROMPT (size, conflicting rules, demands the builder's sandbox cannot meet), ENVIRONMENT, TOOL, JOB SIZE; only then the idea.

## Ratings (owner, 2026-10-24)
- ChatGPT 7.5, Grok 7.5, Vibe 7.7 (gives what is wanted from a small prompt with little stress; strong at code and SVG).
- Zip in and out: Claude, ChatGPT, Grok. Text only (no zip): Vibe, DeepSeek. Vibe jobs are small code or SVG that the owner copies and pastes, only when the Director names it.
- Every prompt written for ChatGPT may also be run by Grok ("ChatGPT or Grok").

## Measured sizes that worked
- A prompt of about 16,000 characters plus a mini-base of about ten files (B03B1a, b, c): worked on ChatGPT.
- The builder fills ONE file; the Director owns the shared contract and the test runner; the runner needs no install (`node run.mjs`).

## Log of overloads
- 2026-10-24 ChatGPT: the one-piece B03B1 prompt (about 38,000 characters, whole base zip) failed twice. Fix: split into a, b, c, d, small prompts, mini-base.
- 2026-10-24 ChatGPT: reading the whole project zip stopped it. Fix: mini-base only, never the whole zip.
- 2026-10-24 Grok: got the 38,000-character prompt; its sandbox could not install tsx, so it ran nothing; its zip failed 16 of 84 core items and the no-regex guard. Fix: the no-install runner.
- 2026-10-24 ChatGPT, B03B1b: delivered partial (one core item and the speed limit failing); B03B1b2 fixed one; the Director fixed the rest under the SMALL FIXES rule (roadmap 5.2).
- Earlier (roadmap v17.4): the Summarizer was measured unsafe for prompts.
| 2026-10-25 | ChatGPT | B03B3c TONE: ONE file (about 8,000 characters) against a fixed contract and a 50-check runner, mini-base of 6 files | delivered on the first reply, all proofs pass (builder-reported); Director accepted | two Claude accounts that tried to measure, build, test and package it themselves hit their usage limit: the Director never builds a builder's job |

| 2026-10-25 | ChatGPT | B03B3d MEMORY NOTES: ONE file (about 17,900 characters, 13 functions) against a fixed contract and a 2,166-check runner, prompt 14,044 characters, mini-base of 7 files | delivered on the first reply, all proofs pass (builder-reported); Director's independent differential check: 0 differences in 159,476 checks; worst-case message search 6 times slower than the reference | the same recipe as B03B3c worked: prompt under 16,000 characters, one file, fixed contract, no-install runner |

## Director capacity record (small; size 1 to 10, 1 = one small file, 10 = whole-project work; ESTIMATES)
- 2026-10-27, four Claude accounts: B04B4 as ONE job, size about 7, delivered nothing, limit hit YES (cause: job too large for one turn; the roadmap and the paste were not the cause).
- 2026-10-27, twelfth account: read roadmap and board, B04B4P1 (3 files, ~12 commands) plus roadmap v19.4, size about 5, delivered, limit hit NO so far.
- 2026-10-27, thirteenth account: B04B4P2 (8 files, about 24 commands), size about 5, delivered; limit hit YES at the next message in the same chat (OWNER-REPORTED).
- 2026-10-27, OWNER-REPORTED: two more accounts hit the limit when P3 and the roadmap were asked in one turn, no output. The owner now asks P3 and the roadmap in separate turns.
- 2026-10-27, fourteenth account: read roadmap and paste, five doc tails, B04B4P3a (4 docs files, about 6 commands), size about 2, delivered, limit hit NO so far.
- 2026-10-27, fifteenth account: read roadmap v19.4 and v19.5, board tail, size test; B04B4P3b roadmap v19.6 (5 docs/test files, about 17 commands), size about 4, delivered; limit hit NO so far. OWNER-REPORTED: a new account given the whole roadmap rewrite plus the old chat hit its limit with no output; an account that wrote an over-cap draft and then rewrote it also did. Method that worked: repair the draft by exact replacements, count before writing.
