# Owner requests and wishes (recorded 2026-10-26, from the owner's dictated message)

Nothing here is built yet unless marked. Order of work stays: one step at a time, brain first. The Director adds new wishes at the bottom and ticks them when built.

## Self-testing code (the Claude-like habit) [wish]
- AXON builds complex code and tests it itself in a sandbox: runs it, attacks it with nasty cases, finds problems, fixes, and RE-RUNS every time. It never gives code it has not run.
- AXON can take code the owner gives it (for example from another AI), find problems, say what each problem was, and either offer the fix or give the fixed code, as the owner asks. It knows how to test and verify.
- Plan: part of AXON Code (AC2 to AC4) and the Mind system loop (M1: plan, act, check; success test written first). The method used by the Director (mutation tests) is the model.

## Frustration (needs the tone glue, built 2026-10-26) [wish]
- When AXON detects frustration it does a full plan and deep check from the foundation: what is failing, why the owner is probably frustrated, what the real fix is. No empty "I know you're frustrated". It may say it understands, say it thought it through, state the problem first, then give a solution, in flexible wording (the personality is not built yet).
- Director note: today a weak tone flag can fire by mistake ("he is sore"), so the deep dive must start only on strong signals or repeated trouble, and its first step is to check AXON's own last answer. Words inside quotes, "you are useless", "fed up", "sick of", "this frustrates me" are not read yet (known limits, to be fixed; the owner suspects more exist).

## Knowing its own limits [wish]
- AXON knows what it can and cannot do (tools, device). For a big job it splits the work into sections.
- It does not guess device limits: it says "I do not know my limits on this device; run tests?" and, if the owner agrees, runs several tests (speed, memory, heavy code), records the result, and either shows it or deletes the test work and keeps the numbers.

## Understanding people [wish]
- Filler words, grammar mistakes, human pauses. A word's type and tone when given a single word. Reverse engineering.

## Video, images, knowledge packs [wish]
- Analyze video frame by frame, extract the audio, compare with built-in compressed knowledge packs (very compressed images, only the needed parts kept).
- Must never lag the phone: packs sit in storage and are loaded only when needed, not kept in RAM. Needs a full plan before any work (size budget, loading, speed).

## Laws [owner rule]
- AXON's laws are the owner's own, not copied from other AI tools. Any law needed goes through the owner, who tests and approves it. The basic laws already in the roadmap stay.

## Thinking tree [wish, at the end]
- A branch-tree view of how AXON thinks and reaches an output, so the owner can see what to work on. Wanted after everything else; related to the "how did you understand" view (R).

## Explainer [done]
- Plain-words file on how AI tools learn: `docs/HOW_AI_LEARNS.md`.

## Process [owner rule]
- Items treated as approved without an answer are listed in `docs/AUTO_APPROVED.md`.
