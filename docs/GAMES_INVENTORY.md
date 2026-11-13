# AXON Games Lab — honest inventory (DT3)

Measured on the code in this package. "Distinct" counts different questions seen across 5 low tiers + 5 high tiers x 3 levels x 6 seeds (a lower bound). "flat" = the low and high tiers draw the same questions, so difficulty does not grow with the tier. "recomputed" = every round's answer was recalculated independently by tests/oracle-audit.test.mjs; "reviewed" = checked by reading the question pools, not by calculation.

Totals: 171 games; 120 recomputed, 51 reviewed; 52 tier-flat.

| # | id | category | round kind | distinct | tiers | answers | note |
|---|---|---|---|---|---|---|---|
| 1 | number-recall | Memory | memory | 180+ | scales | recomputed |  |
| 2 | missing-number | Memory | memory | 180+ | scales | recomputed |  |
| 3 | which-numbers-were-called | Memory | memory | 180+ | scales | recomputed |  |
| 4 | never-called | Memory | memory | 174+ | scales | recomputed |  |
| 5 | number-sequence-reconstruction | Memory | memory | 180+ | scales | recomputed |  |
| 6 | reverse-recall | Memory | memory | 180+ | scales | recomputed |  |
| 7 | number-gap-filler | Memory | memory | 180+ | scales | recomputed |  |
| 8 | position-memory | Memory | memory | 160+ | scales | recomputed |  |
| 9 | number-frequency-recall | Memory | memory | 126+ | scales | recomputed |  |
| 10 | number-appearance-order | Memory | memory | 180+ | scales | recomputed |  |
| 11 | first-and-last-number | Memory | memory | 165+ | scales | recomputed |  |
| 12 | number-pair-memory | Memory | memory | 178+ | scales | recomputed |  |
| 13 | number-group-recall | Memory | memory | 153+ | scales | recomputed |  |
| 14 | number-echo-challenge | Memory | memory | 180+ | scales | recomputed |  |
| 15 | delayed-number-recall | Memory | memory | 180+ | scales | recomputed |  |
| 16 | add-and-remember | Memory | memory | 145+ | scales | recomputed |  |
| 17 | running-total | Memory | memory | 166+ | scales | recomputed |  |
| 18 | subtraction-memory | Memory | memory | 128+ | scales | recomputed |  |
| 19 | number-transformation | Memory | memory | 180+ | scales | recomputed |  |
| 20 | alternating-arithmetic | Memory | memory | 127+ | scales | recomputed |  |
| 21 | number-sorting-memory | Memory | memory | 180+ | scales | recomputed |  |
| 22 | odd-one-out-numbers | Memory | memory | 9+ | flat | recomputed |  |
| 23 | number-classification-recall | Memory | memory | 55+ | scales | recomputed |  |
| 24 | prime-number-memory | Memory | memory | 167+ | scales | recomputed |  |
| 25 | multiplication-sequence | Memory | memory | 180+ | scales | recomputed |  |
| 26 | missing-arithmetic-result | Memory | memory | 121+ | scales | recomputed |  |
| 27 | number-pattern-memory | Memory | memory | 117+ | scales | recomputed |  |
| 28 | hidden-number-operations | Memory | memory | 177+ | scales | recomputed |  |
| 29 | number-relationship-recall | Memory | memory | 115+ | scales | recomputed |  |
| 30 | mental-number-matrix | Memory | memory | 180+ | scales | recomputed |  |
| 31 | remember-and-rearrange | Memory | memory | 180+ | scales | recomputed |  |
| 32 | dual-task-challenge | Memory | memory | 180+ | scales | recomputed |  |
| 33 | memory-updating | Memory | memory | 180+ | scales | recomputed |  |
| 34 | last-three-items | Memory | memory | 178+ | scales | recomputed |  |
| 35 | moving-memory-window | Memory | memory | 179+ | scales | recomputed |  |
| 36 | instruction-memory | Memory | memory | 177+ | scales | recomputed |  |
| 37 | rule-switching | Memory | memory | 180+ | scales | recomputed |  |
| 38 | memory-under-distraction | Memory | memory | 180+ | scales | recomputed |  |
| 39 | delayed-instruction | Memory | memory | 58+ | scales | recomputed |  |
| 40 | mental-workspace | Memory | memory | 180+ | scales | recomputed |  |
| 41 | chess | Strategy | choice | 13+ | flat | reviewed | Rules and concept questions only. There is no playable board or engine. |
| 42 | chess-tactics | Strategy | choice | 13+ | scales | reviewed | Rules and concept questions only. There is no playable board or engine. |
| 43 | checkmate-in-one | Strategy | choice | 6+ | flat | reviewed | Rules and concept questions only. There is no playable board or engine. |
| 44 | checkmate-in-two | Strategy | choice | 6+ | flat | reviewed | Rules and concept questions only. There is no playable board or engine. |
| 45 | chess-position-memory | Strategy | choice | 6+ | flat | reviewed | Rules and concept questions only. There is no playable board or engine. |
| 46 | blindfold-chess | Strategy | choice | 6+ | flat | reviewed | Rules and concept questions only. There is no playable board or engine. |
| 47 | chess-endgame-challenge | Strategy | choice | 6+ | flat | reviewed | Rules and concept questions only. There is no playable board or engine. |
| 48 | draughts | Strategy | choice | 7+ | flat | reviewed | Rules and concept questions only. There is no playable board or engine. |
| 49 | go | Strategy | choice | 7+ | flat | reviewed | Rules and concept questions only. There is no playable board or engine. |
| 50 | reversi | Strategy | choice | 8+ | flat | reviewed | Rules and concept questions only. There is no playable board or engine. |
| 51 | connect-four | Strategy | choice | 6+ | flat | recomputed | A position puzzle (landing row / completing square), not a playable game. |
| 52 | tic-tac-toe-master | Strategy | choice | 8+ | flat | recomputed | A position puzzle (landing row / completing square), not a playable game. |
| 53 | nim | Strategy | strategy | 174+ | scales | recomputed | Real nim-sum puzzle; every winning heap is accepted. |
| 54 | hex | Strategy | choice | 9+ | scales | reviewed | Rules and concept questions only. There is no playable board or engine. |
| 55 | strategic-territory | Strategy | input | 36+ | scales | recomputed |  |
| 56 | mastermind | Logic | choice | 167+ | scales | reviewed | mastermind = rules question; mastermind-mini = real playable code-breaking. |
| 57 | the-hidden-number | Logic | input | 180+ | scales | recomputed |  |
| 58 | twenty-questions | Logic | choice | 180+ | scales | recomputed |  |
| 59 | logic-grid | Logic | choice | 12+ | flat | recomputed |  |
| 60 | who-is-lying | Logic | choice | 149+ | scales | recomputed |  |
| 61 | truth-and-lies | Logic | choice | 126+ | scales | recomputed |  |
| 62 | the-impossible-lock | Logic | input | 12+ | flat | recomputed |  |
| 63 | the-missing-clue | Logic | choice | 6+ | flat | reviewed |  |
| 64 | who-owns-what | Logic | choice | 36+ | scales | recomputed |  |
| 65 | the-suspect-puzzle | Logic | choice | 120+ | scales | recomputed |  |
| 66 | logical-consequences | Logic | choice | 91+ | scales | recomputed |  |
| 67 | conditional-reasoning | Logic | choice | 28+ | scales | recomputed |  |
| 68 | bridge-crossing | Logic | input | 8+ | flat | recomputed |  |
| 69 | river-crossing | Logic | choice | 6+ | flat | reviewed |  |
| 70 | prisoners-puzzle | Logic | choice | 6+ | flat | reviewed |  |
| 71 | flash-grid | Visual Memory | visual | 177+ | scales | reviewed | All five share one mechanic: memorise highlighted grid cells. The name overstates what is built (no shapes, no image comparison). |
| 72 | pattern-reproduction | Visual Memory | visual | 179+ | scales | reviewed | All five share one mechanic: memorise highlighted grid cells. The name overstates what is built (no shapes, no image comparison). |
| 73 | shape-sequence | Visual Memory | visual | 177+ | scales | reviewed | All five share one mechanic: memorise highlighted grid cells. The name overstates what is built (no shapes, no image comparison). |
| 74 | spot-the-difference | Visual Memory | visual | 177+ | scales | reviewed | All five share one mechanic: memorise highlighted grid cells. The name overstates what is built (no shapes, no image comparison). |
| 75 | image-recall | Visual Memory | visual | 179+ | scales | reviewed | All five share one mechanic: memorise highlighted grid cells. The name overstates what is built (no shapes, no image comparison). |
| 76 | object-displacement | Visual Memory | input | 175+ | scales | recomputed |  |
| 77 | visual-rotation | Visual Memory | choice | 12+ | flat | reviewed | Fixed word or fact pools; checked by review and by structural rules. |
| 78 | mirror-image | Visual Memory | choice | 8+ | flat | recomputed |  |
| 79 | shape-assembly | Visual Memory | input | 10+ | scales | recomputed |  |
| 80 | tangram-challenge | Visual Memory | choice | 7+ | flat | reviewed | Fixed word or fact pools; checked by review and by structural rules. |
| 81 | hidden-object-memory | Visual Memory | choice | 180+ | scales | reviewed | Fixed word or fact pools; checked by review and by structural rules. |
| 82 | color-sequence | Visual Memory | choice | 177+ | scales | reviewed | Fixed word or fact pools; checked by review and by structural rules. |
| 83 | visual-intruder | Visual Memory | choice | 47+ | scales | recomputed |  |
| 84 | map-memory | Visual Memory | input | 176+ | scales | recomputed |  |
| 85 | visual-change-detection | Visual Memory | choice | 6+ | flat | reviewed | Fixed word or fact pools; checked by review and by structural rules. |
| 86 | word-recall | Language | choice | 180+ | scales | reviewed | Fixed word or fact pools; checked by review and by structural rules. |
| 87 | reverse-spelling | Language | input | 20+ | flat | recomputed |  |
| 88 | anagram-solver | Language | input | 176+ | scales | recomputed |  |
| 89 | word-chain | Language | choice | 8+ | flat | recomputed | Fixed word or fact pools; checked by review and by structural rules. |
| 90 | synonym-challenge | Language | choice | 8+ | flat | reviewed | Fixed word or fact pools; checked by review and by structural rules. |
| 91 | antonym-challenge | Language | choice | 8+ | flat | reviewed | Fixed word or fact pools; checked by review and by structural rules. |
| 92 | word-relationships | Language | choice | 9+ | flat | reviewed | Fixed word or fact pools; checked by review and by structural rules. |
| 93 | hidden-word | Language | choice | 6+ | flat | recomputed |  |
| 94 | letter-sequence-memory | Language | choice | 180+ | scales | reviewed | Fixed word or fact pools; checked by review and by structural rules. |
| 95 | vocabulary-ladder | Language | choice | 12+ | flat | reviewed | Fixed word or fact pools; checked by review and by structural rules. |
| 96 | sentence-reconstruction | Language | input | 24+ | scales | reviewed |  |
| 97 | word-classification | Language | choice | 67+ | scales | recomputed |  |
| 98 | the-odd-word | Language | choice | 178+ | scales | recomputed |  |
| 99 | letter-count-memory | Language | input | 30+ | scales | recomputed |  |
| 100 | verbal-logic | Language | choice | 114+ | scales | recomputed |  |
| 101 | mental-math | Mathematics | input | 178+ | scales | recomputed |  |
| 102 | rapid-calculation | Mathematics | input | 176+ | scales | recomputed |  |
| 103 | missing-equation | Mathematics | input | 144+ | scales | recomputed |  |
| 104 | number-pyramid | Mathematics | input | 180+ | scales | recomputed |  |
| 105 | mathematical-sequence | Mathematics | choice | 147+ | scales | recomputed |  |
| 106 | prime-factor-challenge | Mathematics | input | 20+ | scales | recomputed |  |
| 107 | greatest-common-divisor | Mathematics | input | 161+ | scales | recomputed |  |
| 108 | least-common-multiple | Mathematics | input | 146+ | scales | recomputed |  |
| 109 | fraction-duel | Mathematics | choice | 127+ | scales | recomputed |  |
| 110 | percentage-master | Mathematics | input | 174+ | scales | recomputed |  |
| 111 | algebra-detective | Mathematics | input | 177+ | scales | recomputed |  |
| 112 | equation-balancer | Mathematics | choice | 176+ | scales | recomputed |  |
| 113 | target-number-mathematics | Mathematics | input | 169+ | scales | recomputed |  |
| 114 | mathematical-proof-puzzle | Mathematics | choice | 8+ | flat | reviewed |  |
| 115 | probability-challenge | Mathematics | input | 104+ | scales | recomputed |  |
| 116 | target-switch | Attention | choice | 12+ | flat | recomputed |  |
| 117 | count-the-occurrences | Attention | input | 180+ | scales | recomputed |  |
| 118 | distractor-filter | Attention | input | 180+ | scales | recomputed |  |
| 119 | color-word-conflict | Attention | choice | 16+ | flat | recomputed |  |
| 120 | go-or-no-go | Attention | choice | 18+ | flat | recomputed |  |
| 121 | sequence-violation | Attention | input | 158+ | scales | recomputed |  |
| 122 | rapid-symbol-search | Attention | input | 180+ | scales | recomputed |  |
| 123 | sustained-attention | Attention | input | 180+ | scales | recomputed |  |
| 124 | interruption-recovery | Attention | input | 180+ | scales | recomputed |  |
| 125 | cube-counting | Spatial | input | 75+ | scales | recomputed |  |
| 126 | cube-net | Spatial | choice | 6+ | flat | recomputed | Fixed word or fact pools; checked by review and by structural rules. |
| 127 | three-dimensional-rotation | Spatial | input | 145+ | scales | recomputed |  |
| 128 | block-assembly | Spatial | input | 155+ | scales | recomputed |  |
| 129 | spatial-navigation | Spatial | input | 180+ | scales | recomputed |  |
| 130 | maze-master | Spatial | input | 3+ | scales | recomputed | Serpentine routes on three sizes; not a real maze search. |
| 131 | shortest-path | Spatial | input | 56+ | scales | recomputed |  |
| 132 | spatial-sequence | Spatial | choice | 69+ | scales | recomputed |  |
| 133 | paper-folding | Spatial | input | 50+ | scales | recomputed |  |
| 134 | hidden-geometry | Spatial | input | 71+ | scales | recomputed |  |
| 135 | matrix-reasoning | Abstract Reasoning | input | 158+ | scales | recomputed |  |
| 136 | abstract-sequence | Abstract Reasoning | input | 74+ | scales | recomputed |  |
| 137 | rule-discovery | Abstract Reasoning | input | 142+ | scales | recomputed |  |
| 138 | pattern-completion | Abstract Reasoning | choice | 21+ | scales | recomputed |  |
| 139 | symbol-transformation | Abstract Reasoning | input | 41+ | scales | recomputed |  |
| 140 | relationship-mapping | Abstract Reasoning | input | 60+ | scales | recomputed |  |
| 141 | analogy-matrix | Abstract Reasoning | input | 48+ | scales | recomputed |  |
| 142 | sequence-prediction | Abstract Reasoning | input | 166+ | scales | recomputed |  |
| 143 | abstract-odd-one-out | Abstract Reasoning | choice | 8+ | flat | reviewed | Fixed word or fact pools; checked by review and by structural rules. |
| 144 | multi-rule-patterns | Abstract Reasoning | input | 16+ | flat | recomputed |  |
| 145 | alternative-uses | Complex Thinking | choice | 10+ | flat | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
| 146 | planning-puzzle | Complex Thinking | choice | 123+ | scales | recomputed |  |
| 147 | resource-allocation | Complex Thinking | choice | 142+ | scales | recomputed |  |
| 148 | mystery-laboratory | Complex Thinking | choice | 177+ | scales | recomputed |  |
| 149 | ultimate-brain-challenge | Complex Thinking | input | 116+ | scales | recomputed |  |
| 150 | mastermind-mini | Logic | mastermind | 1+ | flat | reviewed | mastermind = rules question; mastermind-mini = real playable code-breaking. |
| 151 | target-number-attention | Attention | input | 87+ | scales | recomputed |  |
| 152 | called-missing | Memory | set-memory | 173+ | scales | recomputed |  |
| 153 | find-the-loophole | Critical Thinking | choice | 10+ | flat | reviewed |  |
| 154 | imagine | Creative Thinking | imagine | 5+ | scales | reviewed | Open-ended, never scored. |
| 155 | scrambled-words | Language | text | 175+ | scales | recomputed |  |
| 156 | what-would-you-do | Decision Making | choice | 7+ | flat | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
| 157 | find-a-way-to-escape | Planning | choice | 7+ | flat | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
| 158 | escape-room | Puzzles | input | 12+ | flat | recomputed |  |
| 159 | the-detective | Critical Thinking | choice | 6+ | flat | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
| 160 | the-interrogator | Critical Thinking | choice | 6+ | flat | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
| 161 | the-negotiator | Strategy | choice | 6+ | flat | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
| 162 | the-strategist | Strategy | choice | 6+ | flat | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
| 163 | the-impostor | Deduction | choice | 142+ | scales | recomputed |  |
| 164 | the-paradox | Logic | choice | 6+ | flat | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
| 165 | the-architect | Spatial Reasoning | choice | 10+ | scales | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
| 166 | the-survival-planner | Planning | choice | 6+ | flat | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
| 167 | the-investigator | Critical Thinking | choice | 6+ | flat | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
| 168 | the-codebreaker | Language & Logic | text | 93+ | scales | recomputed |  |
| 169 | the-experimenter | Science | choice | 6+ | flat | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
| 170 | the-deceiver | Critical Thinking | choice | 6+ | flat | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
| 171 | the-systems-breaker | Systems Thinking | choice | 6+ | flat | reviewed | Judgement question with one curated best answer. Correct by review, not by calculation. |
