# Batch 01 delivery report — first 25 games

## Games delivered

1. **Number Recall** — Memorize and reproduce the complete digit sequence in its original order. Teaches chunking and positional checking.
2. **Missing Number** — Reconstruct the value removed from a remembered sequence. Teaches positional anchoring and gap recovery.
3. **Which Numbers Were Called?** — Select every distinct digit that appeared, regardless of repetition. Teaches set membership versus frequency.
4. **Which Numbers Were Never Called?** — Select digits absent from the complete 0–9 domain. Teaches complements and careful absence checking.
5. **Number Sequence Reconstruction** — Rebuild the remembered sequence from a scrambled presentation. Teaches order reconstruction and anchor use.
6. **Reverse Number Recall** — Reproduce the sequence from last digit to first. Teaches reverse traversal and position control.
7. **Number Gap Filler** — Restore one or more hidden positions in the original sequence. Teaches positional recovery and ordered completion.
8. **Number Position Memory** — Report the digit at a queried one-based position. Teaches indexing discipline.
9. **Number Frequency Recall** — Count every occurrence of a selected target digit. Teaches tallying and distinguishes count from unique values.
10. **Number Appearance Order** — Report distinct digits in order of first appearance. Teaches stable deduplication.
11. **First and Last Number** — Recall the two endpoints in their original order. Teaches endpoint attention.
12. **Number Pair Memory** — Recall an adjacent pair at a specified pair of positions. Teaches positional association.
13. **Number Group Recall** — Recall a group of up to three consecutive digits and calculate its sum. Teaches chunking and group-specific aggregation.
14. **Number Echo Challenge** — Transform each digit by adding its one-based position modulo ten. Teaches rule application and ordered transformation.
15. **Delayed Number Recall** — Recall the full sequence after a longer retention interval. Teaches retention over a longer delay; this build does not yet insert a separate distractor task.
16. **Add-and-Remember** — Recall the values and calculate their combined sum. Teaches maintaining items while aggregating.
17. **Running Total** — Calculate the cumulative total through a requested position. Teaches sequential state updates.
18. **Subtraction Memory** — Subtract the second half's sum from the first half's sum. Teaches order-sensitive aggregation.
19. **Number Transformation** — Apply a fixed multiply-and-offset modulo-ten transformation to every digit. Teaches consistent per-item rule application.
20. **Alternating Arithmetic** — Add and subtract successive digits with alternating signs. Teaches operation tracking by position.
21. **Number Sorting Memory** — Recall and sort the digits ascending while retaining duplicates. Teaches sorting without accidental deduplication.
22. **Odd-One-Out Numbers** — Identify the single odd integer among even values. Teaches property testing and exception detection.
23. **Number Classification Recall** — Count the even digits in the remembered sequence. Teaches applying a classification predicate.
24. **Prime Number Memory** — Identify prime values from the displayed candidates. Teaches primality and the distinction between 1 and prime.
25. **Multiplication Sequence** — Multiply each remembered digit by a fixed factor and preserve order. Teaches consistent multiplication across a sequence.

## Difficulty and lessons
- 15 selectable tiers.
- Each game has its own tier profile.
- Each tier has 2–4 selectable levels as configured for that game/tier.
- Tier and level are recorded in the round presentation; sequence/span demand and retention time scale with progression.
- Each delivered game provides a rule, multi-step explanation, hint path, correct answer after an incorrect attempt, and an improvement/alternative note where relevant.

## Additional catalogue additions
- **Find the Loophole (conceptual Game 151)** — A separate game with Logic & Language, Mathematics, Science, Everyday Rules, Games & Puzzles, Programming, Business & Processes, Probability & Statistics, Ethics & Decisions, and Visual & Spatial Reasoning topic families. It includes challenges where a loophole is present; future content should also include no-loophole cases to prevent players assuming every prompt contains one.
- **Maze Master** — Existing catalogue entry retained; no duplicate maze game was added.

## Automated evidence
Run from the package root:

```sh
npm test
node --check src/app.js
node --check src/engine.js
node --check src/games/number-memory.js
node --check src/progression/game-tiers.js
```

`npm test` includes:
- catalogue/smoke checks;
- all-catalogue round generation checks;
- progression and teaching-contract checks;
- every configured level across all 15 tiers for each of the first 25 games, validating a known correct answer and rejecting a wrong-answer probe.

## Limitations and honest status
- Automated gameplay/answer validation: **PASS**.
- Browser visual inspection: **BLOCKED** by environment policy preventing Chromium from opening local HTTP and file URLs.
- Physical Android testing: **NOT TESTED**.
- Low-memory/battery/storage stress: **NOT TESTED**.
- This is the first 25 game implementation batch, not certification of all 150 catalogue concepts.
