# Batch 01 — first 25 game-specific design contracts

This document is the implementation contract for the original first 25 catalogue entries. The engine must dispatch by exact `game.id`, not by fuzzy title matching. Each game generates reproducible round data when supplied a seeded random source, exposes a canonical answer/state, and returns feedback derived from that round.

## Difficulty framework — 15 tiers

| Tier | Name | Minimum meaningful progression requirement |
|---:|---|---|
| 1 | Orientation | One rule, short and fully demonstrated |
| 2 | Foundation | Same rule with a new instance; no hidden complication |
| 3 | Stable practice | Slightly richer input or a second step |
| 4 | Variation | New arrangement or distractor type |
| 5 | Combined skills | Two operations/rules must be coordinated |
| 6 | Applied reasoning | Transfer the skill to a changed presentation |
| 7 | Intermediate mastery | More than one relevant feature; irrelevant features present |
| 8 | Strategy | Player selects an efficient method, not just recalls |
| 9 | Multi-step | Three or more dependent operations |
| 10 | Advanced application | Interacting constraints or delayed information |
| 11 | Expert practice | Less scaffolding; robust checking needed |
| 12 | Complex transfer | Novel combinations of established skills |
| 13 | High complexity | Dense information with competing plausible paths |
| 14 | Near ceiling | Strongest practical challenge supported by this game's mechanics |
| 15 | Maximum supported | Benchmark-defined ceiling; no claim beyond measured capability |

A tier profile is game-specific. Each tier contains multiple levels (default plan: 5, adjustable by game), and the engine records both tier and level. Higher tiers must add a documented cognitive/mechanical demand. Timer pressure is optional and cannot be the sole source of difficulty. No tier is called world-class or state-of-the-art without an explicit benchmark.

## Game contracts

| # | ID / Game | Unique playable task | Core learning / feedback |
|---:|---|---|---|
| 1 | `number-recall` — Number Recall | Reproduce a displayed sequence in exact order. | Chunking, rehearsal, order-vs-value distinction; identify first incorrect position. |
| 2 | `missing-number` — Missing Number | Reconstruct hidden slots in a sequence; positions are shown, values hidden. | Use neighboring anchors and verify every slot; explain each placement. |
| 3 | `which-numbers-were-called` — Which Numbers Were Called? | Select the distinct values that appeared at least once, regardless of order/frequency. | Set membership; distinguish repeated calls from unique values. |
| 4 | `never-called` — Which Numbers Were Never Called? | Select values from the defined domain that did not appear. | Complement of observed set; explicitly state domain and avoid confusing omission from answer with never-present. |
| 5 | `number-sequence-reconstruction` — Number Sequence Reconstruction | Rebuild a shuffled sequence using remembered order clues / indexed slots. | Recover relative order; explain anchor placement and unresolved ambiguity. |
| 6 | `reverse-recall` — Reverse Number Recall | Reproduce the sequence from last item to first. | Reverse traversal and positional checking. |
| 7 | `number-gap-filler` — Number Gap Filler | Fill one or more missing values in a numeric progression whose rule is specified or inferable. | Determine step/rule before filling; explain uniqueness and ambiguity. |
| 8 | `position-memory` — Number Position Memory | Answer which value occupied a queried one-based position. | Indexing discipline; explicitly teach one-based positions. |
| 9 | `number-frequency-recall` — Number Frequency Recall | Report the count of a target value, with distractor values present. | Tally marks / grouped counting; count occurrences, not distinct values. |
| 10 | `number-appearance-order` — Number Appearance Order | Report distinct values in order of first appearance, ignoring later repeats. | Stable deduplication; explain why repeats do not move a value. |
| 11 | `first-and-last-number` — First and Last Number | Report the first and final values in a sequence. | Endpoint attention; preserve sequence direction. |
| 12 | `number-pair-memory` — Number Pair Memory | Recall paired values and answer a queried partner / pair mapping. | Association encoding; validate both direction and pair identity. |
| 13 | `number-group-recall` — Number Group Recall | Recall values grouped into labeled or spatial groups; answer a group-specific query. | Grouping/chunking; never mix group membership. |
| 14 | `number-echo-challenge` — Number Echo Challenge | Repeat a sequence with a defined echo transformation (e.g. repeat each value twice); transformation shown in lesson and fixed per round. | Apply transformation consistently; explain mapping from source to output. |
| 15 | `delayed-number-recall` — Delayed Number Recall | Recall a sequence after an intervening, specified distractor task. | Retention across interference; report delay task separately from memory target. |
| 16 | `add-and-remember` — Add-and-Remember | Memorize a sequence, then calculate its sum. | Maintain items while aggregating; show arithmetic audit trail. |
| 17 | `running-total` — Running Total | Process values in order and report requested intermediate/final cumulative total. | State transitions after each item; explain each running sum. |
| 18 | `subtraction-memory` — Subtraction Memory | Apply an ordered subtraction chain to a starting value remembered from the sequence. | Order-sensitive arithmetic; show each subtraction and prevent negative/ambiguous rules unless intended. |
| 19 | `number-transformation` — Number Transformation | Apply a named operation to every recalled value, then return transformed sequence or queried result. | Explain operation and per-item mapping; check order. |
| 20 | `alternating-arithmetic` — Alternating Arithmetic | Apply alternating operations to a sequence (e.g. +, −, +, −) in order. | Track operation position; show a step table and running result. |
| 21 | `number-sorting-memory` — Number Sorting Memory | Recall the presented values and return them sorted ascending; duplicates retained. | Distinguish sorting from deduplication; explain stable multiplicity. |
| 22 | `odd-one-out-numbers` — Odd-One-Out Numbers | Identify the one value violating a stated or discoverable shared property. | Test candidate rule against every item; explain why alternatives fit. |
| 23 | `number-classification-recall` — Number Classification Recall | Classify remembered values by a defined property (parity, range, divisibility, etc.). | Apply a clear predicate; return exact members/count as specified. |
| 24 | `prime-number-memory` — Prime Number Memory | Select prime values from remembered candidates; composites may include nontrivial factors. | Divisibility reasoning; explain primality and distinguish 1 from prime. |
| 25 | `multiplication-sequence` — Multiplication Sequence | Reconstruct or extend a sequence generated by a multiplication rule, including controlled variations at higher tiers. | Identify multiplier/exception pattern; explain each transition and reject underdetermined cases. |

## Cross-game requirements

- Each game owns its prompt schema, validation, hint, explanation, and tier profile.
- Canonical answer formats are explicit; whitespace/order normalization is allowed only where the rules say so.
- Generated challenges must be solvable and have one intended answer, or explicitly accept all mathematically valid answers.
- Every round includes a worked-example-capable explanation and a teaching objective.
- Each game needs tests for canonical correct answer, representative wrong answer, malformed input, boundary cases, and tier progression.
- Do not claim a full adaptive tutor: feedback can only refer to observed answer patterns and the actual generated solution.
