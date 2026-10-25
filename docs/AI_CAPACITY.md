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
