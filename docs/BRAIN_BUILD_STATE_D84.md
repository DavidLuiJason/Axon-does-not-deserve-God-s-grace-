# BRAIN BUILD STATE (Director D84), 2026-11-16

Pure modules with their own tests. "Wired" means a screen or the app calls it. No screen calls the brain yet, so the new parts are reachable only through the orchestrator.

| Part | What | State |
|---|---|---|
| Reading, meaning, resolution, tools, loop, dialogue state, budget, charter store, learning gate, mistake ledger | existing brain | already in the repository (other directors' work) |
| P01 Repair | repeats, "wait"/"oops", "how much" to "how many" | DONE, tested, merged |
| P02 Verification | clause status, evidence labels, REDESIGN on second failure | DONE, tested, merged |
| P03 Council and Judgment | 8 seats, no voting (first slice of the Judgment design) | DONE for the slice; full J0 to J5 NOT built |
| P04 Goal and Planner | success test, one step at a time, no third blind retry; adapter drives the existing step loop | DONE, tested with the real loop |
| P05 Dialogue questions | a tool found but text missing: ask, take the answer, cancel, park, expire | DONE (in the orchestrator, using the existing dialogue state) |
| P06 Reflection and candidate store | candidates only, saved and restored as text | DONE |
| P07 External-AI contract | permissions, secrets, untrusted output, agreement is never proof | DONE (contract only; real connections belong to the Axon Web director) |
| P08 Orchestrator | wraps any brain: modes off / shadow (default) / on | DONE |
| P09 End-to-end tests | 140 real conversations with measured numbers | DONE |
| P10 Per-tool verifiers | text counter, sort lines, base64 rechecked from the quoted text | DONE for three tools |
| Review | docs/BRAIN_REVIEW_D84.md (self-review, not independent) | DONE |

## Not built (see the review for why)
Full Judgment J0 to J5; independent checks for the other four tools; multi-step plans in the live brain; screens that call the brain; the real AI connections; persistence of learning candidates; a second director's independent review.

## How to use the orchestrator when a screen needs the brain
`const brain = createOrchestrator(createAxonBrain({ lane: true, slot }), { mode: 'shadow' }); const { reply, orchestration } = await brain.ask({ text, place: 'chat' });`
shadow = the reply is exactly what the brain says; `orchestration` records what repair, the question step and the tool re-check would have done. Switch to `'on'` only after the owner has seen the shadow numbers. `brain.candidates()`, `brain.exportCandidates()` and `brain.importCandidates(text)` give the app the learning candidates to keep.

## Not decided by the owner yet
Charter tie rule (NEVER beats ASK beats ALLOW), the other-people check in the council, the go-ahead for the full Judgment design, who builds the real AI connections, when to switch from shadow to on.
