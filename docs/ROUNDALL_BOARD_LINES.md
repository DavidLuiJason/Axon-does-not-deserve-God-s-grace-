# ROUND-ALL board lines (Director 471, 2026-11-19)
- LIVE: Password, Random Picker (coin, pick, shuffle), Calculator (quoted expressions), Percentage Helper (percent-of, adjust) are now live in the real brain: 12 live tools. Each has a real-brain proof (liveBrain<Tool>.test.ts via tests/helpers/liveProof.ts: hand-made answers, must-not identical to OFF, task records, a real mutant).
- NEW: bind/shapers.ts (a shaper builds a tool's arguments from typed values and words by structure); the task record replays the SHOWN result (random and password).
- GAPS: percentage "what percent is 20 of 80", "percent change", "15 is 30% of what" (resolver verbs/nouns) and decimals like 7.5% (sentence splitter); password "make a 32 character password" (resolver); random dice, integer, teams, newline lists; calculator unquoted arithmetic.
- NEXT: Grok job AXON_GROK_CONNECT_ALL_PROMPT.md (date-calculator, converter, text-compare, text-cleaner, STATE3 tools, runner builds).
