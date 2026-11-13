# Game 151 — Find the Loophole

**Status:** Added to scope and designed; not yet implemented or tested as a playable game. The existing 150-game catalogue already contains “Maze Master,” so no duplicate maze entry is needed.

## Core idea
The player is shown a short set of rules, a claim, a plan, or a scenario and must identify a genuine loophole: an exception, ambiguity, missing condition, contradiction, boundary case, or unintended consequence that makes the stated conclusion or system fail.

The game must reward valid reasoning, not merely guessing what the author intended. A loophole must be demonstrable from the supplied facts. If a scenario has no valid loophole, the correct action is to say so and explain why.

## Topic families
1. **Logic and language** — ambiguous wording, quantifiers, hidden assumptions, contradictions.
2. **Mathematics** — invalid generalizations, division-by-zero cases, boundary values, unstated domains.
3. **Science** — flawed experimental controls, confounders, overbroad conclusions, measurement gaps.
4. **Everyday rules** — missing definitions, exceptions, timing and eligibility edge cases.
5. **Games and puzzles** — rule interactions, edge cases, unintended winning states; sandboxed examples only.
6. **Programming and algorithms** — input validation, off-by-one errors, state assumptions, race/order cases; defensive learning, not real-world exploitation.
7. **Business and processes** — policy gaps, incentives, workflow failures, unclear ownership; fictional scenarios, not evasion of law or safeguards.
8. **Probability and statistics** — selection bias, base-rate neglect, misleading averages, sample-size issues.
9. **Ethics and decision-making** — conflicting duties, incomplete criteria, loopholes in stated principles; explain trade-offs rather than asserting one universal answer.
10. **Visual and spatial rules** — diagrams, routes, layouts, pattern constraints, boundary conditions.

## Player loop
1. Choose a topic (or mixed-topic mode), then a tier and level.
2. Read the complete scenario and its explicit rules.
3. Select the loophole type or answer “no valid loophole”.
4. Describe the exact gap and construct a counterexample, if applicable.
5. The game checks the claim against the scenario's formal facts and accepted solution set.
6. Feedback explains the relevant rule, the precise failure, a valid counterexample, an alternative way to detect it, and why tempting false loopholes do not work.

## Difficulty
Use the shared 15-tier framework, but define separate progressions per topic. Higher tiers add interacting constraints, nested exceptions, adversarial wording, longer dependency chains, competing interpretations, and cases where the correct answer is that no loophole exists. Complexity must be substantive, not just longer text or a shorter timer. Each tier has multiple authored/generated levels as appropriate.

## Validation and fairness
- Store a canonical scenario, explicit assumptions, accepted loophole(s), counterexample requirements, and rejected near-misses.
- Accept multiple equivalent valid explanations where possible; do not demand one exact phrase.
- Separate finding the flaw from explaining its consequences.
- Never mark an ambiguous or under-specified scenario as having one certain answer; label it ambiguous or discard it.
- Use fictional systems for policy/business/programming scenarios. Do not teach bypassing real security, payment, access-control, or safety systems.
- Include “no loophole” cases to prevent the player from assuming every scenario is flawed.
- Track topic-wise performance and misconception patterns without making IQ or psychological claims.

## Teaching
Teach loophole categories with worked examples, then require transfer to a new example. Explain: stated rule; hidden assumption; gap; counterexample; impact; and a safer rewrite that closes the gap. Show alternative detection strategies (boundary testing, counterexample search, quantifier check, assumption audit, state-transition tracing).

## Acceptance tests
- Each topic has distinct authored mechanics and content.
- Valid loopholes, no-loophole cases, multiple-valid-answer cases, and ambiguous cases are covered.
- Counterexamples are checked against the exact scenario constraints.
- False positives and false negatives are tested.
- The teaching explanation matches the actual accepted solution.
- Tier 15 has documented topic-specific benchmark criteria and known limitations.
- Visual, touch, persistence, interruption, and narrow-screen tests are completed before claiming release readiness.
