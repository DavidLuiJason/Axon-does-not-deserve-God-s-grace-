# ACT-OR-ASK FEED: DESIGN (roadmap 7K and 7E DECISION DIMENSIONS; layer 3 to 5 edge). DESIGN ONLY, nothing built. Director, 2026-11-05 (owner: "decide yourself as Director"). Owner may overrule.

**What this settles:** J6 `decideActOrAsk` is built and has no caller. It needs eight typed facts. This file decides WHERE each fact comes from (from Resolution and the tool schema), how J6's answer is recorded in J2, and what is built next. Roadmap pointer is needed at the next roadmap edit (ROADMAP UPDATE LAW: no roadmap edit for this alone).
**Rival/gap (rule 9):** assistants ask by feel. Here every question traces to a declared fact: a schema field, a Resolution result, a bind default, or the Charter.

## 1. Where it sits (FL1)
Resolution (stage 5, `resolve.ts`) returns a `Resolution`; the schema (`actionSchemas.ts`, B04A) declares effects, undo, cost; bind defaults (`bindDefaults.ts`, `SLOT_DEFAULTS[tool][slot]`) say which slots have an approved default. A NEW pure engine, the FEED (`src/decision/actOrAskFeed.ts`), turns those into `ActOrAskInput`. J6 decides. Then Dialogue (stage 6) words the question; THEN J2 records the decision. The feed and J6 never see the message text (FL13). Nothing calls the feed yet.

## 2. Which results reach J6
Only `match`, `ask` and `none`. `not-a-request` stays conversation. `negated` is a refusal ("do not"): never acted on. `unavailable` goes DEEP, not ASK (ROUTER DEFAULT R8). Resolution's `confidence` is NOT read (7E: no confidence figure before calibration).

## 3. The eight facts (decided)
| J6 input | Comes from | Rule |
|---|---|---|
| readings | Resolution kind, plus repair readings (7K) | `match` with no second reading: ONE-CLEAR. `ask` (2 to 4 tools), or a `match` plus a repaired reading naming a DIFFERENT tool: TWO-CLOSE. `none`: NO-READING. A match found ONLY by value evidence (`evidence: 'value'`): TWO-CLOSE (the other reading is "not a request"; HYPOTHESIS, test on the golden transcript, pass count must not drop). |
| readingChangesResult | the readings' tool ids | true when the readings name more than one distinct tool id; false when repairs all complete the SAME tool. |
| undo | `schema.undo` | `not-needed` -> READ-ONLY; `by-tool` or `by-removal` -> UNDOABLE; `irreversible` -> NOT-UNDOABLE. With two readings: the WORST of them (NOT-UNDOABLE > UNDOABLE > READ-ONLY). Unsure goes UP: `not-needed` on a tool with any non-PURE effect is mapped to NOT-UNDOABLE, never passed on (J6 would reject READ-ONLY with an effect). |
| outward | `schema.effects` | `sends` -> SEND, `deletes` -> DELETE, `spends` -> MONEY, none -> NONE. J6 holds ONE value: if several, the worst, MONEY > DELETE > SEND (MEASURED: no schema today has two). With two readings: the worst of them. |
| costly | `schema.cost` | FALSE in v1. MEASURED: 24 of 63 schemas are `slow`, 13 `high` memory, all `basis: estimate`; asking approval on those would ask before most runs. It flips only when costs are MEASURED on the device tiers (rule 8) and the owner agrees. Money is already `outward: MONEY`. |
| permission | Charter (7A), else the schema | `NEVER` if the Charter says NEVER; `ASK` if the Charter says ASK or the schema has precondition `owner-approval` (4 schemas) or an approval effect; else ALLOW. The strictest of these wins; nothing here ever lifts an ask. The Charter store is not built: until it is, the feed takes an optional `charter` value and the rest comes from the schema. |
| missing | `match.missingSlots`, bind defaults, context | per missing required slot: CONTEXT-ANSWERS if the conversation supplies it, SAFE-STEP-ANSWERS if a read-only step can fetch it, else OWNER-ONLY. Several slots: the worst, OWNER-ONLY > SAFE-STEP-ANSWERS > CONTEXT-ANSWERS > NONE. `ask` and `none` results have no slots: NONE. Context and safe steps do not exist yet: the feed takes `contextFills` and `safeStepFills` (slot names) as typed arguments. |
| inputChangesResult | `SLOT_DEFAULTS[tool][slot]` | false when EVERY OWNER-ONLY slot has an approved default (AXON acts and says the default aloud: bind-default rule); true when any has none (no default means AXON cannot proceed, so it asks). |

## 4. Recording in J2 (MEASURED, no J2 change needed)
J2 refuses `permission ASK` unless the question is APPROVAL, and refuses an APPROVAL question unless `permission` is ASK. I ran all 2,592 valid J6 inputs through J2 two ways. **Mapping the INPUT permission straight across: J2 rejects 808** (350 ALLOW with an approval ask, 400 ASK with a clarification, 58 ASK with a missing-input ask). **Mapping the EFFECTIVE permission (BLOCK -> NEVER, ASK APPROVAL -> ASK, everything else -> ALLOW): J2 rejects 0.** DECIDED: J2's `permission` means "what the broker does with this decision now". When J6 asks a clarification while the Charter says ASK, the record says ALLOW with the clarification; after the owner answers, the whole decision runs again and the approval question comes THEN. One question at a time. Question text comes from Dialogue after J6; J2 needs 1 to 200 characters and one `?` at most, so the record is made after the wording, never by J6. `stepsLeft` and `route` come from the Router and budget (7E, not built).

## 5. Still UNDECIDED (do not build toward)
Who calls the feed and when; where `contextFills` and `safeStepFills` come from (Context store, not built); how repair readings (REP stage) are handed over; question wording; the Charter store; measured costs; the value-evidence rule above (HYPOTHESIS).

## 6. Jobs (sizes are estimates; each stays UNPLANNED for builders until its card exists)
- **FEED1** (ChatGPT, one pure engine, new files only, DESIGN-FIRST EXIT NOT needed: this design is the design): `src/decision/actOrAskFeed.ts`, `makeActOrAskInput(args)` implementing section 3 with hand-worked cases from the Director; size ~ J6. Proof: cases, error order, mutants, then a Director check that every real schema (63) and every Resolution result kind maps to an input J6 accepts (no `read-only-with-effect` ever).
- **FEED2** (Director, small): `tests/` guard that the schema cross-table (undo x effects: not-needed x pure 41, by-removal x persistent 17, by-tool x approval 1, by-tool x persistent 4) never gains a row the feed cannot map.
- **FEED3** (later, with the REP stage and Router): wiring in shadow only, plus the J2 record after Dialogue.

## 7. Verdicts (rule 12; probabilities are HYPOTHESES)
Mapping from schema and Resolution: WORKS (typed facts only; 63 of 63 schemas map). Value-only winner as TWO-CLOSE: WORKS ONLY IF the golden transcript pass count holds; about 60%. costly false: WORKS DIFFERENTLY (no approval for slowness; slow work shows a progress note, 7D). Context and safe-step fills: CANNOT JUDGE until a Context store exists.

## 8. Laws touched (FL11)
FL1 placement above; FL3 whole path to J2 drawn; FL9 stage first; FL11 this list; FL12 the feed is stage output, no screen or tool answers alone; FL13 no phrase lists, no message text read; FL14 one engine per job, no copies; FL15 INFERRED readings, unsure goes UP, traced by reason codes; 7E no confidence figure; 7K act-or-ask by cost; N2 AXON never acts while hiding an approval it needs.
