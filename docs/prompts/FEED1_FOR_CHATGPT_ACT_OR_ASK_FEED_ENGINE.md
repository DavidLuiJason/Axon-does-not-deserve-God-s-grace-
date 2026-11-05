WHO IT IS FOR: ChatGPT (also runs in Grok). One pure-engine job for the AXON project. No screens.

WHAT THIS DOES: builds FEED1 "Act or Ask Feed": ONE isolated pure engine that turns a Resolution result plus tool-schema facts into the eight typed facts of the finished J6 engine (`decideActOrAsk`). Nothing calls it yet.

WHAT YOU DO: read the roadmap in the mini-base zip, write the LAW CHECK, then create exactly 3 new files (listed under LANE), run the proof commands, and report.

WHAT TO BRING BACK: a zip containing ONLY these 3 files, same paths: `src/decision/actOrAskFeed.ts`, `tests/actOrAskFeed.test.ts`, `docs/reports/FEED1_ACT_OR_ASK_FEED_REPORT.md`. Do not return the mini-base files.

ONE-LINE PASTE (with the mini-base zip attached): Read the attached prompt file `FEED1_FOR_CHATGPT_ACT_OR_ASK_FEED_ENGINE.md` completely and do exactly what it says.

---

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. Open ONLY the files this prompt names and the files you are asked to create or change; do not read any other document, folder or archive. AXON is a foundation-first project and its foundation is being reopened. Answer in at most five lines: (1) what the finished AXON contains (section 6 of the roadmap), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list only the laws this job touches (by number, one line each, at most 12 lines) and say how the job complies; repeat it in your report; if a law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13). (“Part 00” = section 3; “Part 5E” = section 6.)

---

## DIRECTOR PLACEMENT NOTE (roadmap 7K, 7E DECISION DIMENSIONS; owner 2026-11-05 gave the Director the decisions)
- **Item:** the feed between Resolution and J6 (roadmap 7K ACT-OR-ASK by COST). **Layer:** 3 (Understanding) at the edge of 7 Planning. **Dependency:** the finished J6 engine (type import only, see below). **Builder:** ChatGPT. **Proof:** the 32 hand-worked rows in `docs/FEED1_CASES.md`, error-order cases, a sweep through J6, mutants, then the Director reruns everything with a second, independent reference engine.
- The design is `docs/ACT_OR_ASK_FEED_DESIGN.md` (section 3 and section 5). You treat this engine as PLANNED, not UNPLANNED.
- **Stays UNDECIDED (do not build toward):** who calls the feed; the Context lookup that fills `contextFills` and `safeStepFills`; the Charter store; question wording (this engine returns NO text); the Router; screens, storage, wiring, file format, clock.

## JOB FEED1: `makeActOrAskInput(args)` in `src/decision/actOrAskFeed.ts`

**Style:** copy the style of `src/decision/actOrAsk.ts` (J6) and its test: same `EngineResult` shape (local types, not exported), frozen results, one fixed failure message, no `Date`, `Math.random`, `fetch`, `console`, no regex literals, no storage, no global state. Input is never changed. No confidence number anywhere. The ONLY import allowed is `import type { ActOrAskInput } from './actOrAsk';` (it vanishes at compile time). The TEST may import `decideActOrAsk` from `../src/decision/actOrAsk` and the engine.

**Export (exactly):**
```ts
export type FeedEffect = 'shows-result'|'reads-file'|'writes-file'|'stores-note'|'changes-setting'|'uses-camera'|'uses-microphone'|'uses-network'|'sends'|'spends'|'deletes';
export type FeedPrecondition = 'permission'|'owner-approval'|'network-on'|'device-capable';
export type FeedSchema = { readonly tool:string; readonly effects:readonly FeedEffect[]; readonly preconditions:readonly FeedPrecondition[]; readonly undo:'not-needed'|'by-tool'|'by-removal'|'irreversible'; readonly slots:readonly { readonly name:string; readonly required:boolean }[] };
export type FeedResolution =
  | { readonly kind:'match'; readonly tool:string; readonly missingSlots:readonly string[]; readonly evidence?:'concept'|'value'|'both' }
  | { readonly kind:'ask'; readonly choices:readonly string[] }
  | { readonly kind:'none' } | { readonly kind:'not-a-request' } | { readonly kind:'negated' } | { readonly kind:'unavailable' };
export type ActOrAskFeedArgs = { readonly resolution:FeedResolution; readonly schemas:readonly FeedSchema[]; readonly slotDefaults:readonly { readonly tool:string; readonly slot:string }[]; readonly extraReadingTools:readonly string[]; readonly contextFills:readonly string[]; readonly safeStepFills:readonly string[]; readonly charter:{ readonly never:readonly string[]; readonly ask:readonly string[] }; readonly costly:boolean };
export function makeActOrAskInput(args: ActOrAskFeedArgs): EngineResult<ActOrAskInput>;
```
Failure: `{ok:false, error:<code>, message:'Act or ask feed input is invalid.'}` (frozen). Success: `{ok:true, value}` (both frozen); value keys in the order of `ActOrAskInput`. The caller PROJECTS a real Resolution to `FeedResolution`; Resolution's `confidence`, `reason` and `candidates` are deliberately NOT accepted (7E).

**Validation, in THIS order (first failure wins; a missing key counts as the wrong value; all eight keys are required; every "exact keys" check counts string AND symbol own keys; every array is checked element by element):**
1. args not an object, or an array, or null: `bad-input`. 2. an own key named `confidence`: `confidence-not-allowed`. 3. any own key (string or symbol) outside the eight names of `ActOrAskFeedArgs`: `unknown-key`.
4. `resolution` invalid: `bad-resolution`. Valid = an object with exact keys: kind `match`: `kind`, `tool` (non-empty string), `missingSlots` (array of distinct non-empty strings), and optionally `evidence` (if the key is present it must be 'concept', 'value' or 'both'); kind `ask`: `kind`, `choices` (2 to 4 distinct non-empty strings); each of the other four kinds: `kind` only. Any other kind or key: invalid.
5. `schemas` invalid: `bad-schemas`. Valid = an array (empty is fine) of objects with exact keys `tool` (non-empty string, distinct across the array), `effects` (array of distinct FeedEffect values), `preconditions` (array of distinct FeedPrecondition values), `undo` (one of the four), `slots` (array of objects with exact keys `name` (non-empty string, distinct inside that schema) and `required` (boolean)).
6. `slotDefaults` not an array of objects with exact keys `tool` and `slot`, both non-empty strings (duplicates allowed): `bad-slot-defaults`.
7. `extraReadingTools` not an array of at most 4 non-empty strings (duplicates allowed), or non-empty while `resolution.kind` is `none`: `bad-extra-readings`.
8. `contextFills` not an array of non-empty strings: `bad-context-fills`. 9. `safeStepFills`: `bad-safe-fills`. 10. `charter` not an object with exact keys `never` and `ask`, each an array of non-empty strings: `bad-charter`. 11. `costly` not a boolean: `bad-costly`.
12. `resolution.kind` is `not-a-request`, `negated` or `unavailable` (these never reach J6): `not-for-j6`.
13. a tool id used as a reading (`resolution.tool`, then each `resolution.choices` entry, then each `extraReadingTools` entry, in that order) that no schema has: `unknown-tool`.
14. kind `match` and a `missingSlots` entry that is not a slot of the matched schema with `required: true`: `bad-missing-slot`.

**Mapping, in THIS order (all rules are structure, never message text):**
- **Readings.** kind `none`: the result is exactly permission ALLOW, undo READ-ONLY, outward NONE, costly = args.costly, readings NO-READING, missing NONE, readingChangesResult false, inputChangesResult false. Otherwise the READINGS are the distinct tool ids of `[resolution.tool or resolution.choices..., ...extraReadingTools]`. `readings` is TWO-CLOSE when there is more than one distinct tool, or when kind is `match` with `evidence` 'value'; else ONE-CLEAR. `readingChangesResult` equals (readings is TWO-CLOSE).
- **Per reading tool** (its schema): `undo` = NOT-UNDOABLE if schema undo is `irreversible`; else if schema undo is `not-needed`: NOT-UNDOABLE when any effect is outside shows-result, reads-file, uses-camera, uses-microphone, uses-network, else READ-ONLY; else (by-tool, by-removal) UNDOABLE. `outward` = MONEY if effects hold `spends`, else DELETE if `deletes`, else SEND if `sends`, else NONE. `permission` = NEVER if the tool id is in `charter.never`; else ASK if it is in `charter.ask`, or its preconditions hold `owner-approval`, or its effects hold any of sends, spends, deletes; else ALLOW.
- **Over all readings the WORST wins:** undo NOT-UNDOABLE > UNDOABLE > READ-ONLY; outward MONEY > DELETE > SEND > NONE; permission NEVER > ASK > ALLOW. `costly` = args.costly.
- **Missing** (kind `match` only; `ask` gives NONE): per missing slot: CONTEXT-ANSWERS if the slot name is in `contextFills`; else SAFE-STEP-ANSWERS if in `safeStepFills`; else OWNER-ONLY. `missing` = the worst over the slots: OWNER-ONLY > SAFE-STEP-ANSWERS > CONTEXT-ANSWERS > NONE (no missing slot: NONE). `inputChangesResult` = true when some OWNER-ONLY slot has NO entry `{tool: the matched tool, slot}` in `slotDefaults`; else false.
Guarantee to prove: a successful result is ALWAYS accepted by `decideActOrAsk` (never `read-only-with-effect`).

## FIXTURES AND HAND-WORKED CASES
The fixtures (`SCHEMAS`, `BASE`) and the 32 hand-worked rows are in `docs/FEED1_CASES.md` in the mini-base. They are part of this prompt (the Director derived the rows from the rules above, ran them on an independent reference, and checked that J6 accepts each output). Copy the fixtures into your test as written; the row input is BASE with the listed changes (the card explains the columns). Do not return that file.

Error rows the test must also pin (exact code, exact message): resolution kinds `negated`, `not-a-request`, `unavailable` give `not-for-j6`; match on tool `ghost` gives `unknown-tool`; ask choices `['counter','ghost']` gives `unknown-tool`; match counter with `extraReadingTools:['ghost']` gives `unknown-tool`; match noter with `missingSlots:['title']` (optional slot) gives `bad-missing-slot`; match counter with `missingSlots:['nope']` gives `bad-missing-slot`.

Your test MUST contain all 32 rows of `docs/FEED1_CASES.md` as exact-value checks (compare all eight fields with your own independently written expected literals, never by calling a copy of the engine). The test MUST also cover: every error code above with its exact code and message, at least one case per code; the error ORDER (confidence plus an extra key gives `confidence-not-allowed`; an extra key plus a bad resolution gives `unknown-key`; bad resolution plus bad schemas gives `bad-resolution`; bad costly plus a `negated` resolution gives `bad-costly`; `unknown-tool` plus `bad-missing-slot` gives `unknown-tool`); a symbol key at the top and inside `resolution`; an array input; a missing key; duplicate schema tools; `choices` of 1 and of 5; `extraReadingTools` of 5; kind `none` with extra readings; an invalid `evidence`; results frozen; input unchanged (JSON before and after equal); and a SWEEP: for every fixture tool as a `match` with every subset of its required slots missing, with `contextFills` empty and with all required slots, with `evidence` absent, 'value' and 'concept', with `extraReadingTools` empty and with each single fixture tool, and with the three charters `{never:[],ask:[]}`, `{never:[that tool],ask:[]}`, `{never:[],ask:[all tools]}`; plus every ordered pair of different fixture tools as an `ask`: each call returns ok true AND `decideActOrAsk(value)` returns ok true (never throws).

## LANE (the only files you may create; nothing else is touched)
`src/decision/actOrAskFeed.ts`, `tests/actOrAskFeed.test.ts`, `docs/reports/FEED1_ACT_OR_ASK_FEED_REPORT.md`. Do NOT edit `package.json`: write in the report the exact `test:kernel` line to add (`tsx tests/actOrAskFeed.test.ts`). The test file begins like J6's (a local `check` counter) and ends by printing exactly `ACT_OR_ASK_FEED OK: <n> checks`.

## DONE MEANS
1. `tsc --noEmit --strict --target ES2020 --module commonjs --ignoreConfig src/decision/actOrAskFeed.ts src/decision/actOrAsk.ts tests/actOrAskFeed.test.ts` prints no errors (`--ignoreConfig` is needed because a `tsconfig.json` is present; leave it off if your tsc does not know the flag). 2. The compiled test runs under node and prints the OK line. 3. At least 8 deliberate mutants of the engine (for example: ignore `evidence` 'value'; take the best instead of the worst undo; drop MONEY priority; let `safeStepFills` beat `contextFills`; ignore `charter.never`; map non-pure `not-needed` to READ-ONLY; drop the unknown-tool check; swap two validation steps) each make the test FAIL; the report lists each mutant and which check caught it. 4. The report has: the five-line assessment, the LAW CHECK, the exact commands and printed output, the mutant list, and anything unrun marked NOT RUN.

## START RULE
Read the roadmap and the files named here ONLY: `docs/FEED1_CASES.md`, `docs/ACT_OR_ASK_FEED_DESIGN.md`, `src/decision/actOrAsk.ts`, `tests/actOrAsk.test.ts`, `docs/reports/J6_ASK_OR_ACT_REPORT.md` and `tsconfig.json`. If any is missing from the mini-base, STOP and say which.

## HONEST DELIVERY
Anything you did not run is written NOT RUN, never "passed". If one case row disagrees with the rules above, STOP and report that row (do not bend either). Partial but passing files are still success; say what is missing. Fail the same way twice: stop and report.

## RIVAL / GAP (rule 9)
Rival: assistants that decide "ask or just do it" by feel from the message wording. FEED1 reads no words: only declared facts (schema, Resolution kind, bind defaults, Charter view), always takes the strictest reading, and never lets an ask be lifted.
