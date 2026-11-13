# D84 W0-B board lines (owner appends; this package does not touch NOW.txt, MERGE_TAG.txt, JOB_BOARD.md or DIRECTOR_NAP.txt)

WHAT IT IS: ChatGPT's Wave 0 card W0-B (repair baseline: corpus + measurement, no repair code), accepted by Director D84 after three fixes. Three new files only; nothing existing changed.

FILES: tests/fixtures/repairCorpus.json (180 hand-written cases: 60 R1 repeats/restarts, 60 R2 "how much" for "how many", 60 well-formed controls), tests/repairBaseline.test.ts, docs/REPAIR_BASELINE.md, docs/D84_W0B_BOARD_LINES.md.

D84 FIXES TO CHATGPT'S RETURN (measured):
1. The harness started its workers through ../axon-toolchain/..., a folder that is not in the repository, so it would fail in the cloud. It now re-uses the running Node and tsx (2 lines). Reproduced on the current zip (__35_) with plain tsx.
2. The report lumped "refused" and "ran a tool and gave a wrong answer" together as "wrong". Split added (about 8 lines).
3. Re-measured: identical totals to ChatGPT's. R1: 4 right, 45 refused, 11 ran WRONG (for example "count words in X. count words in X." answers 9 words: it counted the whole message). R2: 60 refused. CONTROL: 60 right.

FOR D471 (not touched): "how much words are in ..." passes at stage level (tests/howMuchSecondReading.test.ts) but the full brain still answers "I do not have a way to do that". The count reading exists only as a second reading and the lane does not run it. Repair R2 will have to hand the lane one clear reading.

LIMITS: cases are builder-written, not a held-out set (D84 writes the held-out half). R1/R2 cases use the text counter only; the controls cover seven tools. Runs about 30 to 45 seconds and rewrites docs/REPAIR_BASELINE.md each time. NOT RUN: Android/Java build, full cloud suite.

NOW.txt line: 2026-11-12 | roadmap v21.3 | W0-B repair baseline measured (D84) | next: Wave R (R1, R2) after owner accepts Wave 0 | owner decisions: D1-D6 in BRAIN_BUILD_PLAN_D84.md
MERGE_TAG.txt line (newest first): 2026-11-12 | W0-B REPAIR BASELINE [D84; files above] | corpus + measurement only, no repair code | MEASURED: R1 4 right / 45 refused / 11 ran wrong; R2 0 right / 60 refused; controls 60/60 | NOT RUN: Android build, full cloud suite
DIRECTOR_NAP.txt line: D84 (2026-11-12): THE BRAIN above the tools (repair, safeguards, decision, judgment, planning, response, memory). Now: Wave 0 repair baseline, then repair R1/R2. Builds go through ChatGPT; D84 verifies. Leaves the tool lane, AXON Web, AXON Code and AXON Apps alone.
