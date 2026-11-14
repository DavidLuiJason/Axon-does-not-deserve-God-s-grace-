# BRAIN BUILD STATE (Director D84), 2026-11-14

Parts are pure modules with their own tests, merged one group at a time. "Wired" means the live brain actually uses it; nothing below is wired yet.

| Part | What | State |
|---|---|---|
| P01 | Repair (repeats, "wait"/"oops", "how much" to "how many") | MERGED (ChatGPT build, D84 verified, 200 cases) |
| P02 | Verification (stage 9: clause status, evidence labels, REDESIGN on second failure) | MERGED (ChatGPT build, D84 verified, 168 cases) |
| P03 | Council (8 seats) and Judgment (no voting) | MERGED (ChatGPT build, D84 verified, 179 checks) |
| P04 | Goal and Planner (success test, one step at a time, no third blind retry) | THIS PACKAGE (D84 built) |
| P06 | Reflection (candidates only) | THIS PACKAGE (D84 built) |
| P07 | External-AI contract (permissions, secrets, untrusted output) | THIS PACKAGE (D84 built) |
| P05 | Dialogue questions (D2b): ask the open question, use the answer. The shadow dialogue state, answer reading and driver already exist; what is missing is the step that actually asks and applies the answer. | TO DO (needs the B05 plan and the live pipeline read first) |
| P10 | Per-tool verifiers for the live tools (recompute, round trip, known answer) feeding P02 | TO DO |
| P08 | Orchestrator: one entry that runs repair, the existing brain, verification, judgment and reflection in order, off by default, without editing other directors' files | TO DO |
| P09 | End-to-end conversation tests with numbers per stage | TO DO |

Still not decided by the owner: Charter tie rule (NEVER beats ASK beats ALLOW), the other-people check in the Council's CRITIC seat, the go-ahead for the full Judgment design J0 to J5, and which director builds the real AI connections.
