# AXON Games: honest inventory (DT3, updated 2026-11-13, GAMES5)

Measured on src/games. "Distinct" counts different questions seen across tiers 1 to 5 and 11 to 15, every level, 8 seeds each (a lower bound). "scales" = the low and high tiers draw different questions or parameters; "flat" = they draw the same. "recomputed" = tests recalculate the answers independently from the question text (audited lab oracle for games unchanged since the audit, tests/gamesOracle.test.ts for the tier-scaled games); "reviewed" = checked by reading the question pools, with no calculation behind it (see docs/GAMES_SECOND_READER_PACK.md).

Totals: 171 games; 120 recomputed, 51 reviewed; 1 tier-flat.

| # | id | category | round kind | distinct | tiers | answers | note |
|---|---|---|---|---|---|---|---|
| 1 | number-recall | Memory | memory | 224+ | scales | recomputed |  |
| 2 | missing-number | Memory | memory | 184+ | scales | recomputed |  |
| 3 | which-numbers-were-called | Memory | memory | 184+ | scales | recomputed |  |
| 4 | never-called | Memory | memory | 214+ | scales | recomputed |  |
| 5 | number-sequence-reconstruction | Memory | memory | 184+ | scales | recomputed |  |
| 6 | reverse-recall | Memory | memory | 184+ | scales | recomputed |  |
| 7 | number-gap-filler | Memory | memory | 224+ | scales | recomputed |  |
| 8 | position-memory | Memory | memory | 157+ | scales | recomputed |  |
| 9 | number-frequency-recall | Memory | memory | 129+ | scales | recomputed |  |
| 10 | number-appearance-order | Memory | memory | 224+ | scales | recomputed |  |
| 11 | first-and-last-number | Memory | memory | 165+ | scales | recomputed |  |
| 12 | number-pair-memory | Memory | memory | 182+ | scales | recomputed |  |
| 13 | number-group-recall | Memory | memory | 188+ | scales | recomputed |  |
| 14 | number-echo-challenge | Memory | memory | 184+ | scales | recomputed |  |
| 15 | delayed-number-recall | Memory | memory | 184+ | scales | recomputed |  |
| 16 | add-and-remember | Memory | memory | 169+ | scales | recomputed |  |
| 17 | running-total | Memory | memory | 169+ | scales | recomputed |  |
| 18 | subtraction-memory | Memory | memory | 137+ | scales | recomputed |  |
| 19 | number-transformation | Memory | memory | 224+ | scales | recomputed |  |
| 20 | alternating-arithmetic | Memory | memory | 135+ | scales | recomputed |  |
| 21 | number-sorting-memory | Memory | memory | 184+ | scales | recomputed |  |
| 22 | odd-one-out-numbers | Memory | memory | 40+ | scales | recomputed |  |
| 23 | number-classification-recall | Memory | memory | 55+ | scales | recomputed |  |
| 24 | prime-number-memory | Memory | memory | 162+ | scales | recomputed |  |
| 25 | multiplication-sequence | Memory | memory | 224+ | scales | recomputed |  |
| 26 | missing-arithmetic-result | Memory | memory | 135+ | scales | recomputed |  |
| 27 | number-pattern-memory | Memory | memory | 126+ | scales | recomputed |  |
| 28 | hidden-number-operations | Memory | memory | 211+ | scales | recomputed |  |
| 29 | number-relationship-recall | Memory | memory | 132+ | scales | recomputed |  |
| 30 | mental-number-matrix | Memory | memory | 216+ | scales | recomputed |  |
| 31 | remember-and-rearrange | Memory | memory | 216+ | scales | recomputed |  |
| 32 | dual-task-challenge | Memory | memory | 216+ | scales | recomputed |  |
| 33 | memory-updating | Memory | memory | 216+ | scales | recomputed |  |
| 34 | last-three-items | Memory | memory | 215+ | scales | recomputed |  |
| 35 | moving-memory-window | Memory | memory | 216+ | scales | recomputed |  |
| 36 | instruction-memory | Memory | memory | 215+ | scales | recomputed |  |
| 37 | rule-switching | Memory | memory | 216+ | scales | recomputed |  |
| 38 | memory-under-distraction | Memory | memory | 216+ | scales | recomputed |  |
| 39 | delayed-instruction | Memory | memory | 62+ | scales | recomputed |  |
| 40 | mental-workspace | Memory | memory | 216+ | scales | recomputed |  |
| 41 | chess | Strategy | choice | 13+ | scales | reviewed | Rules and concept questions only. There is no playable board. |
| 42 | chess-tactics | Strategy | choice | 13+ | scales | reviewed | Rules and concept questions only. There is no playable board. |
| 43 | checkmate-in-one | Strategy | choice | 6+ | scales | reviewed | Rules and concept questions only. There is no playable board. |
| 44 | checkmate-in-two | Strategy | choice | 6+ | scales | reviewed | Rules and concept questions only. There is no playable board. |
| 45 | chess-position-memory | Strategy | choice | 6+ | scales | reviewed | Rules and concept questions only. There is no playable board. |
| 46 | blindfold-chess | Strategy | choice | 6+ | scales | reviewed | Rules and concept questions only. There is no playable board. |
| 47 | chess-endgame-challenge | Strategy | choice | 6+ | scales | reviewed | Rules and concept questions only. There is no playable board. |
| 48 | draughts | Strategy | choice | 7+ | scales | reviewed | Rules and concept questions only. There is no playable board. |
| 49 | go | Strategy | choice | 7+ | scales | reviewed | Rules and concept questions only. There is no playable board. |
| 50 | reversi | Strategy | choice | 8+ | scales | reviewed | Rules and concept questions only. There is no playable board. |
| 51 | connect-four | Strategy | choice | 14+ | scales | recomputed | A landing-row puzzle on taller boards at higher tiers, not a playable game. |
| 52 | tic-tac-toe-master | Strategy | choice | 16+ | scales | recomputed | A position puzzle (win, block, win-or-block), not a playable game. |
| 53 | nim | Strategy | strategy | 183+ | scales | recomputed | Real nim-sum puzzle; every winning heap is accepted. |
| 54 | hex | Strategy | choice | 9+ | scales | reviewed | Rules and concept questions only. There is no playable board. |
| 55 | strategic-territory | Strategy | input | 35+ | scales | recomputed |  |
| 56 | mastermind | Logic | choice | 181+ | scales | reviewed | mastermind = rules question; mastermind-mini = real playable code-breaking (digits differ at tiers 1 to 5, may repeat from tier 6). |
| 57 | the-hidden-number | Logic | input | 184+ | scales | recomputed |  |
| 58 | twenty-questions | Logic | choice | 184+ | scales | recomputed |  |
| 59 | logic-grid | Logic | choice | 108+ | scales | recomputed |  |
| 60 | who-is-lying | Logic | choice | 151+ | scales | recomputed |  |
| 61 | truth-and-lies | Logic | choice | 134+ | scales | recomputed |  |
| 62 | the-impossible-lock | Logic | input | 108+ | scales | recomputed |  |
| 63 | the-missing-clue | Logic | choice | 6+ | scales | reviewed |  |
| 64 | who-owns-what | Logic | choice | 126+ | scales | recomputed |  |
| 65 | the-suspect-puzzle | Logic | choice | 123+ | scales | recomputed |  |
| 66 | logical-consequences | Logic | choice | 91+ | scales | recomputed |  |
| 67 | conditional-reasoning | Logic | choice | 28+ | scales | recomputed |  |
| 68 | bridge-crossing | Logic | input | 126+ | scales | recomputed |  |
| 69 | river-crossing | Logic | choice | 6+ | scales | reviewed |  |
| 70 | prisoners-puzzle | Logic | choice | 6+ | scales | reviewed |  |
| 71 | flash-grid | Visual Memory | visual | 190+ | scales | reviewed | All five share one mechanic: memorise lit grid cells. The name overstates what is built. |
| 72 | pattern-reproduction | Visual Memory | visual | 182+ | scales | reviewed | All five share one mechanic: memorise lit grid cells. The name overstates what is built. |
| 73 | shape-sequence | Visual Memory | visual | 182+ | scales | reviewed | All five share one mechanic: memorise lit grid cells. The name overstates what is built. |
| 74 | spot-the-difference | Visual Memory | visual | 190+ | scales | reviewed | All five share one mechanic: memorise lit grid cells. The name overstates what is built. |
| 75 | image-recall | Visual Memory | visual | 182+ | scales | reviewed | All five share one mechanic: memorise lit grid cells. The name overstates what is built. |
| 76 | object-displacement | Visual Memory | input | 176+ | scales | recomputed |  |
| 77 | visual-rotation | Visual Memory | choice | 93+ | scales | recomputed |  |
| 78 | mirror-image | Visual Memory | choice | 64+ | scales | recomputed |  |
| 79 | shape-assembly | Visual Memory | input | 10+ | scales | recomputed |  |
| 80 | tangram-challenge | Visual Memory | choice | 7+ | scales | reviewed |  |
| 81 | hidden-object-memory | Visual Memory | choice | 192+ | scales | reviewed |  |
| 82 | color-sequence | Visual Memory | choice | 181+ | scales | reviewed |  |
| 83 | visual-intruder | Visual Memory | choice | 47+ | scales | recomputed |  |
| 84 | map-memory | Visual Memory | input | 184+ | scales | recomputed |  |
| 85 | visual-change-detection | Visual Memory | choice | 184+ | scales | recomputed |  |
| 86 | word-recall | Language | choice | 184+ | scales | reviewed |  |
| 87 | reverse-spelling | Language | input | 24+ | scales | recomputed |  |
| 88 | anagram-solver | Language | input | 179+ | scales | recomputed |  |
| 89 | word-chain | Language | choice | 99+ | scales | recomputed |  |
| 90 | synonym-challenge | Language | choice | 8+ | scales | reviewed |  |
| 91 | antonym-challenge | Language | choice | 8+ | scales | reviewed |  |
| 92 | word-relationships | Language | choice | 9+ | scales | reviewed |  |
| 93 | hidden-word | Language | choice | 12+ | scales | recomputed |  |
| 94 | letter-sequence-memory | Language | choice | 184+ | scales | reviewed |  |
| 95 | vocabulary-ladder | Language | choice | 18+ | scales | reviewed |  |
| 96 | sentence-reconstruction | Language | input | 24+ | scales | reviewed |  |
| 97 | word-classification | Language | choice | 67+ | scales | recomputed |  |
| 98 | the-odd-word | Language | choice | 183+ | scales | recomputed |  |
| 99 | letter-count-memory | Language | input | 30+ | scales | recomputed |  |
| 100 | verbal-logic | Language | choice | 117+ | scales | recomputed |  |
| 101 | mental-math | Mathematics | input | 182+ | scales | recomputed |  |
| 102 | rapid-calculation | Mathematics | input | 182+ | scales | recomputed |  |
| 103 | missing-equation | Mathematics | input | 153+ | scales | recomputed |  |
| 104 | number-pyramid | Mathematics | input | 184+ | scales | recomputed |  |
| 105 | mathematical-sequence | Mathematics | choice | 150+ | scales | reviewed |  |
| 106 | prime-factor-challenge | Mathematics | input | 24+ | scales | recomputed |  |
| 107 | greatest-common-divisor | Mathematics | input | 167+ | scales | recomputed |  |
| 108 | least-common-multiple | Mathematics | input | 153+ | scales | recomputed |  |
| 109 | fraction-duel | Mathematics | choice | 133+ | scales | recomputed |  |
| 110 | percentage-master | Mathematics | input | 180+ | scales | recomputed |  |
| 111 | algebra-detective | Mathematics | input | 181+ | scales | recomputed |  |
| 112 | equation-balancer | Mathematics | choice | 187+ | scales | reviewed |  |
| 113 | target-number-mathematics | Mathematics | input | 170+ | scales | recomputed |  |
| 114 | mathematical-proof-puzzle | Mathematics | choice | 8+ | scales | reviewed |  |
| 115 | probability-challenge | Mathematics | input | 109+ | scales | recomputed |  |
| 116 | target-switch | Attention | choice | 45+ | scales | recomputed |  |
| 117 | count-the-occurrences | Attention | input | 184+ | scales | recomputed |  |
| 118 | distractor-filter | Attention | input | 192+ | scales | recomputed |  |
| 119 | color-word-conflict | Attention | input | 144+ | scales | recomputed |  |
| 120 | go-or-no-go | Attention | input | 142+ | scales | recomputed |  |
| 121 | sequence-violation | Attention | input | 168+ | scales | recomputed |  |
| 122 | rapid-symbol-search | Attention | input | 184+ | scales | recomputed |  |
| 123 | sustained-attention | Attention | input | 184+ | scales | recomputed |  |
| 124 | interruption-recovery | Attention | input | 192+ | scales | recomputed |  |
| 125 | cube-counting | Spatial | input | 73+ | scales | recomputed |  |
| 126 | cube-net | Spatial | choice | 71+ | scales | recomputed |  |
| 127 | three-dimensional-rotation | Spatial | input | 149+ | scales | recomputed |  |
| 128 | block-assembly | Spatial | input | 164+ | scales | recomputed |  |
| 129 | spatial-navigation | Spatial | input | 184+ | scales | recomputed |  |
| 130 | maze-master | Spatial | input | 3+ | scales | recomputed | Serpentine routes on three sizes; not a real maze search. |
| 131 | shortest-path | Spatial | input | 57+ | scales | recomputed |  |
| 132 | spatial-sequence | Spatial | choice | 73+ | scales | recomputed |  |
| 133 | paper-folding | Spatial | input | 48+ | scales | recomputed |  |
| 134 | hidden-geometry | Spatial | input | 73+ | scales | recomputed |  |
| 135 | matrix-reasoning | Abstract Reasoning | input | 171+ | scales | recomputed |  |
| 136 | abstract-sequence | Abstract Reasoning | input | 77+ | scales | recomputed |  |
| 137 | rule-discovery | Abstract Reasoning | input | 156+ | scales | recomputed |  |
| 138 | pattern-completion | Abstract Reasoning | choice | 21+ | scales | recomputed |  |
| 139 | symbol-transformation | Abstract Reasoning | input | 40+ | scales | recomputed |  |
| 140 | relationship-mapping | Abstract Reasoning | input | 61+ | scales | recomputed |  |
| 141 | analogy-matrix | Abstract Reasoning | input | 48+ | scales | recomputed |  |
| 142 | sequence-prediction | Abstract Reasoning | input | 173+ | scales | recomputed |  |
| 143 | abstract-odd-one-out | Abstract Reasoning | choice | 190+ | scales | recomputed |  |
| 144 | multi-rule-patterns | Abstract Reasoning | input | 82+ | scales | recomputed |  |
| 145 | alternative-uses | Complex Thinking | choice | 10+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
| 146 | planning-puzzle | Complex Thinking | choice | 131+ | scales | recomputed |  |
| 147 | resource-allocation | Complex Thinking | choice | 147+ | scales | reviewed |  |
| 148 | mystery-laboratory | Complex Thinking | choice | 181+ | scales | recomputed |  |
| 149 | ultimate-brain-challenge | Complex Thinking | input | 123+ | scales | recomputed |  |
| 150 | mastermind-mini | Logic | mastermind | 2+ | scales | reviewed | mastermind = rules question; mastermind-mini = real playable code-breaking (digits differ at tiers 1 to 5, may repeat from tier 6). |
| 151 | target-number-attention | Attention | input | 99+ | scales | recomputed |  |
| 152 | called-missing | Memory | set-memory | 230+ | scales | recomputed |  |
| 153 | find-the-loophole | Critical Thinking | choice | 10+ | flat | reviewed | The player picks a topic; difficulty is not tiered. |
| 154 | imagine | Creative Thinking | imagine | 5+ | scales | reviewed | Open-ended, never scored. |
| 155 | scrambled-words | Language | text | 234+ | scales | recomputed |  |
| 156 | what-would-you-do | Decision Making | choice | 7+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
| 157 | find-a-way-to-escape | Planning | choice | 7+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
| 158 | escape-room | Puzzles | input | 24+ | scales | recomputed |  |
| 159 | the-detective | Critical Thinking | choice | 6+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
| 160 | the-interrogator | Critical Thinking | choice | 6+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
| 161 | the-negotiator | Strategy | choice | 6+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
| 162 | the-strategist | Strategy | choice | 6+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
| 163 | the-impostor | Deduction | choice | 183+ | scales | recomputed |  |
| 164 | the-paradox | Logic | choice | 6+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
| 165 | the-architect | Spatial Reasoning | choice | 10+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
| 166 | the-survival-planner | Planning | choice | 6+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
| 167 | the-investigator | Critical Thinking | choice | 6+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
| 168 | the-codebreaker | Language & Logic | text | 108+ | scales | recomputed |  |
| 169 | the-experimenter | Science | choice | 6+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
| 170 | the-deceiver | Critical Thinking | choice | 6+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
| 171 | the-systems-breaker | Systems Thinking | choice | 6+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not calculation. |
