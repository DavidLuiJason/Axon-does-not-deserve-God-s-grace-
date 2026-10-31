# REPAIR STAGE: DESIGN (roadmap 7K, UNDERSTANDING REPAIR AND ACT-OR-ASK). DESIGN ONLY, nothing built. Director, 2026-10-31, owner wish W23 (proposed number).

**Owner wish:** AXON must understand wrong or unusual wording (a slip such as "how much" for "how many", a short form such as "chars", a typo, a dictated repeat) and still give the result the owner expected. It must not insist on the exact words it looks for.
**Rival/gap (rule 9):** chat assistants built on a large model shrug off typos because the model guesses; a rule-based AXON must do it with bounded, traced steps or it fails on the first slip. Gap today: part 5 handles ONE closed slip ("how much"); typos, truncations and repeats are not handled at all (MEASURED: "count chars" asks).

## 1. Where it sits (FL1)
Between 3 ANALYSIS and 4 MEANING (7E). Input: the Analysis tokens (each knows whether the dictionary found it). Output: the same message plus `repairs[]`; the original text is NEVER changed. Resolution (stage 5) receives each repair as a SECOND READING, exactly the mechanism proven in RESOLVE-TC parts 4 and 5 (adapter rules 17 and 18): the first reading stands unless the repaired reading is a match backed by the verb or noun it supplied and leaves fewer required slots empty. Later additions: more repair kinds plug in as more alternatives; the router (7E) and the act-or-ask rule need no change.

## 2. What a repair is (bounded, cheap, traced)
Every repair is `{ at: word index, kind, from: surface, to: candidate, evidence, truth: INFERRED }` (7F rule 7: a repair is INFERRED, never VERIFIED) and appears in the trace ("how did you understand" view). Kinds, in the order they would be built:
- **R1 Repeated or restarted words** (dictated speech: the same sentence twice, "wait, let me think"): an exact repeat of an earlier clause is collapsed to one reading; a restart marker is dropped only from the closed grammar sets (owner approves each set, FL13). Cheapest, no dictionary search.
- **R2 Wrong grammar word** (closed pairs such as how much / how many): already the part 5 pattern. Each further pair is one owner-approved line in `closedSets.ts`.
- **R3 Unknown word, one edit away** (typo): only words the dictionary does NOT know; candidates are headwords at edit distance 1 (2 for words of 8 or more letters), same first letter, length within 1. At most 3 candidates per word.
- **R4 Truncation** ("chars", "docs", "msg"): an unknown word that is the START of a headword (at least 3 letters). Many headwords share a start, so the candidates are NOT chosen by the repair stage: all (at most 4) go to Resolution as readings and the one that completes a tool wins (rule 15 style). A truncation that completes no tool is dropped.
- **R5 Wrong word altogether** (the owner means "translate" and says "change language"): CANNOT JUDGE in general; stays with the existing synonym path (B04B3). Not part of this stage.
Limits per message: at most 3 repairs in total and at most 4 readings per piece; beyond that AXON says it could not repair the message and asks one plain question (FL15 loud, never silent).

## 3. Act or ask (7K, by COST)
The tool schema already declares EFFECTS, PRECONDITIONS, COST and UNDO (B04A). Rule: a repaired reading that picks a tool with no effect beyond showing a result and with undo not-needed (counters, converters, calculators) is RUN and AXON says plainly "I read this as: count the characters" (the bind-default sentence, owner decision 2026-10-28). A repaired reading that would send, delete, spend money, or has any cost or no undo is NEVER run on a guess: AXON asks one question that names both readings. A close tie between two repaired readings asks, naming both. Never ask what the context already answers.

## 4. Proof plan (FL4: measure before and after, Two-Strike)
- **Corpus (proposal, sizes are a plan, not a measurement):** about 60 messages per repair kind that DO need repair (each with the reading the owner expects) and about 60 well-formed messages that must stay EXACTLY as they are (no repair, same result). A held-out half is written by someone other than the builder (7L 7).
- **Numbers to report, never target in advance (derive them):** repaired and correct; repaired and wrong but confident (must be 0 before go-live; any is a defect); asked instead; unchanged well-formed messages that changed (must be 0). Compare with the baseline taken BEFORE the build.
- **Mutants:** edit-distance limit off, truncation start off, tie rule off, repair applied to a known word, repair applied to an irreversible tool: each must make a named check fail.
- **Guards:** no phrase list (FL13): the stage knows only closed grammar sets from `closedSets.ts` and the dictionary through the knowledge slot; `meaningNoPhrases` must still pass.

## 5. Sizing and cost (honest)
Phone cost is NOT MEASURED. The risky part is R3/R4: searching headwords means reading dictionary shards (the loader keeps up to 24, about 7 MB, opened on demand). A probe job (like BM1) must measure a lookup on the weakest phone BEFORE R3/R4 are built; R1 and R2 need no such probe. Proposed jobs (sizes UNMEASURED, so each stays in the 7L gap ledger until a builder capacity is known): REP0 corpus and baseline; REP1 R1 and R2 as pure engine; REP2 probe for R3/R4; REP3 R3/R4 engine; REP4 adapter hook and act-or-ask; REP5 live. Never give a builder an unsized job.

## 6. Verdicts (rule 12; probabilities are HYPOTHESES, not measurements)
- R1 repeats and restarts: WORKS ONLY IF the closed sets are approved; exact repeats are safe. HYPOTHESIS about 85%.
- R2 wrong grammar word: WORKS, proven on "how much" (part 5, MEASURED on the test corpus).
- R3 typos: WORKS ONLY IF the typo is one edit from a headword that is not also a different real word ("form" for "from" is a real word and is NOT repaired). HYPOTHESIS about 70%.
- R4 truncations: WORKS ONLY IF Resolution can pick the completing tool; ambiguous starts will ask. HYPOTHESIS about 60%.
- R5 wrong word altogether: CANNOT JUDGE in general.
- "Understands anything strange the way the owner meant it": WILL NOT WORK as an unlimited promise; it works inside these bounds and says so when it cannot (FL15).

## 7. Laws touched (FL11)
FL1 map above; FL4 corpus before and after, Two-Strike; FL12 repairs reach Resolution only as stage output; FL13 closed grammar sets only, owner approves each, no phrase accumulation; FL14 same engines, no copies; FL15 INFERRED label, loud failure, trace; 7K act-or-ask by cost.
**Owner decisions needed before REP1:** approve R1 restart/repeat marker set; approve the repair limits (3 per message, 4 readings per piece); confirm that R5 stays out of this stage.
