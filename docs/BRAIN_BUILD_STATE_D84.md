# BRAIN BUILD STATE (Director D84), 2026-11-14

Parts are pure modules with their own tests, merged one group at a time. "Wired" means a screen or the app actually calls it; no screen calls the brain yet (the screens come later), so the new parts are reachable only through the orchestrator below.

| Part | What | State |
|---|---|---|
| P01 | Repair (repeats, "wait"/"oops", "how much" to "how many") | MERGED (ChatGPT build, D84 verified) |
| P02 | Verification (clause status, evidence labels, REDESIGN on second failure) | MERGED (ChatGPT build, D84 verified) |
| P03 | Council (8 seats) and Judgment (no voting) | MERGED (ChatGPT build, D84 verified) |
| P04 | Goal and Planner | MERGED (D84 built) |
| P06 | Reflection (candidates only) | MERGED (D84 built) |
| P07 | External-AI contract | MERGED (D84 built) |
| P10 | Per-tool verifiers: text counter, sort lines, base64 encode/decode, rechecked from the quoted text by a second path | THIS PACKAGE (D84 built) |
| P08 | Orchestrator: wraps any brain with `askWithTrace`; modes off / shadow (default) / on; edits no existing file | THIS PACKAGE (D84 built) |
| P05 | Dialogue questions (D2b): the step that actually asks the open question and uses the answer. The shadow dialogue state, answer reading and driver already exist. | TO DO (needs the B05 plan and a change inside the Mind pipeline) |
| P09 | End-to-end conversation tests with numbers per stage | TO DO |
| P11 | Hook the orchestrator's verification and planning into the Mind pipeline's own "verification" and "planning" stages (today they say "not built") | TO DO (edits `src/brain/mind/stages.ts`; to be done as an exact find-and-replace patch so no other director's changes are overwritten) |

## How to use the orchestrator when a screen needs the brain
`const brain = createOrchestrator(createAxonBrain({ lane: true, slot }), { mode: 'shadow' }); const { reply, orchestration } = await brain.ask({ text, place: 'chat' });`
shadow = the reply is exactly what the brain says; `orchestration` records what repair and the tool re-check would have done. Switch to `'on'` only after the owner has seen the shadow numbers. In `on` mode a repaired message is said out loud ("I read your message as: ..."), a risky repair asks first, and a tool answer that fails its own recheck is held back.

## Not decided by the owner yet
Charter tie rule (NEVER beats ASK beats ALLOW), the other-people check in the Council's CRITIC seat, the go-ahead for the full Judgment design J0 to J5, and which director builds the real AI connections.
