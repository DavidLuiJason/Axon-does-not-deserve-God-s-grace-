WHO IT IS FOR: ChatGPT (also runs in Grok). One pure-engine job for the AXON project. No screens.

WHAT THIS DOES: builds CHR2 "Charter View": ONE isolated pure file that (a) reads a stored Charter text and says whether it can be trusted, (b) writes a Charter back to text, and (c) turns a trusted Charter into the plain list of tools AXON must ask about or never run. Nothing calls it yet.

WHAT YOU DO: read the roadmap in the mini-base zip, write the LAW CHECK, then create exactly 3 new files (listed under LANE), run the proof commands, and report.

WHAT TO BRING BACK: a zip containing ONLY these 3 files, same paths: `src/mind/charter/charterView.ts`, `tests/charterView.test.ts`, `docs/reports/CHR2_CHARTER_VIEW_REPORT.md`. Do not return the mini-base files.

ONE-LINE PASTE (with the mini-base zip attached): Read the attached prompt file `CHR2_FOR_CHATGPT_CHARTER_VIEW_ENGINE.md` completely and do exactly what it says.

---

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. Open ONLY the files this prompt names and the files you are asked to create or change; do not read any other document, folder or archive. AXON is a foundation-first project and its foundation is being reopened. Answer in at most five lines: (1) what the finished AXON contains (section 6 of the roadmap), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list only the laws this job touches (by number, one line each, at most 12 lines) and say how the job complies; repeat it in your report; if a law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13). (“Part 00” = section 3; “Part 5E” = section 6.)

---

## DIRECTOR PLACEMENT NOTE (roadmap 7A Charter, 7E AUTHORITY; owner 2026-11-05 gave the Director the decisions)
- **Item:** the read-only Charter view the Act-or-Ask feed needs (`docs/CHR1_CHARTER_STORE_DESIGN.md`, decisions C2 to C6). **Layer:** 5 (Reach), 7A. **Dependency:** the existing Charter files (`charter.ts`, `change.ts`, `broker.ts`). **Builder:** ChatGPT. **Proof:** the rows in `docs/CHR2_CASES.md` (hand-worked, then run on a separate Director reference), a sweep, mutants; the Director reruns everything on his own reference.
- You treat this engine as PLANNED, not UNPLANNED. **Stays UNDECIDED (do not build toward):** where the Charter text is stored or read (no storage, no `localStorage`), who calls this, the single write path (job CHR3), Settings screens, the wording shown to the owner beyond the one fixed notice below, the Router, the broker (it stays the only authority at execution time: this view can only make AXON ask or refuse EARLIER, never allow).

## JOB CHR2: three exports in `src/mind/charter/charterView.ts`

**Style:** pure functions. NO `Date`, `Math.random`, `fetch`, `console`, storage, global state, regex literals, phrase lists or arrays of 3 or more string literals (FL13). Inputs are never changed. Imports allowed, and only these: `import { validateCharter, defaultCharter, CHARTER_LIMITS } from './charter.ts'`, `import type { Charter, Sha256, CharterError } from './charter.ts'`, `import { verifyCharter } from './change.ts'`. Use these existing functions as they are (do not copy their logic). "exact keys" checks count string AND symbol own keys (`Reflect.ownKeys`). Results are frozen (`Object.freeze`, including the arrays); the Charter object inside a load is handed out as is.

**Exports (exactly these names and shapes):**
```ts
export const CHARTER_UNTRUSTED_NOTICE = 'Your Charter could not be checked, so I ask before every action.';
export type StoredCharterRead = { readonly kind:'absent' } | { readonly kind:'unreadable' } | { readonly kind:'text'; readonly text:string };
export type UntrustedReason = CharterError | 'unreadable' | 'not-json' | 'unsigned' | 'signature-mismatch';
export type CharterLoad =
  | { readonly status:'built-in'; readonly reason:'no-stored-charter'; readonly charter:Charter }
  | { readonly status:'signed'; readonly reason:'trusted'; readonly charter:Charter }
  | { readonly status:'untrusted'; readonly reason:UntrustedReason; readonly charter:null };
export type CharterLink = { readonly tool:string; readonly actions:readonly string[] };
export type CharterViewArgs = { readonly load:CharterLoad; readonly toolIds:readonly string[]; readonly links:readonly CharterLink[] };
export type CharterFeedView = { readonly never:readonly string[]; readonly ask:readonly string[]; readonly status:'built-in'|'signed'|'charter-untrusted'; readonly notice:string };
export function loadCharterText(stored: StoredCharterRead, sha256: Sha256): CharterLoad;
export function serializeCharter(charter: unknown): { ok:true; text:string } | { ok:false; error:CharterError; message:string };
export function charterToFeedView(args: CharterViewArgs): { ok:true; value:CharterFeedView } | { ok:false; error:'bad-input'|'unknown-key'|'bad-load'|'bad-tool-ids'|'bad-links'|'unknown-link-tool'; message:string };
```
The view's failure message is always exactly `'Charter view input is invalid.'` (frozen result). The value's keys are in the order never, ask, status, notice.

**loadCharterText** never throws and always returns a CharterLoad (a bad or unexpected input is `untrusted` with reason `'unreadable'`). In THIS order:
1. `sha256` not a function, or `stored` not a non-array object: untrusted `unreadable`.
2. `kind 'absent'` with exactly the key `kind`: `built-in`, reason `no-stored-charter`, charter = a fresh `defaultCharter()`. (The built-in default is trusted without a signature: it ships as source.)
3. `kind 'text'` with exactly the keys `kind` and `text` (a string): (a) `text.length` over `CHARTER_LIMITS.inputCharacters`: untrusted `input-too-large` (BEFORE parsing); (b) `JSON.parse` throws: untrusted `not-json`; (c) `validateCharter(parsed)` not ok: untrusted with ITS `error` code as the reason; (d) `verifyCharter(valid, sha256)` not ok: untrusted with ITS `reason` (`unsigned` or `signature-mismatch`); (e) else `signed`, reason `trusted`, charter = the validated value.
4. Anything else (including `kind 'unreadable'`): untrusted `unreadable`. Any exception anywhere: untrusted `unreadable`. Untrusted loads have `charter: null`.

**serializeCharter**: `validateCharter(charter)` not ok: `{ok:false, error, message}` with the validator's own error and message. Otherwise `{ok:true, text}` where text is the JSON of the validated Charter with the keys of every object sorted (plain `Array.sort`, at every depth), no spaces, no newline (use `JSON.stringify` with a replacer that rebuilds each non-array object from its sorted keys). The signature and signedAt are written like any other field. Never throws.

**charterToFeedView** validation, in THIS order (first failure wins):
1. `args` not a non-array object: `bad-input`. 2. own keys (string and symbol) not exactly `load`, `toolIds`, `links` (a missing key counts here): `unknown-key`.
3. `load` is not one of the three CharterLoad shapes with exactly their keys (`built-in` needs reason `no-stored-charter`; `signed` needs reason `trusted`; `untrusted` needs a non-empty string reason and `charter` exactly `null`): `bad-load`. The `charter` of a built-in or signed load is NOT checked here (see Mapping).
4. `toolIds` not an array of DISTINCT non-empty strings (empty array is fine): `bad-tool-ids`.
5. `links` not an array of objects with exactly the keys `tool` (non-empty string) and `actions` (array of DISTINCT non-empty strings; may be empty), with the `tool` values distinct: `bad-links`. 6. a link whose `tool` is not in `toolIds`: `unknown-link-tool` (checked also when the load is untrusted).

**Mapping (all structure, never message text). Level order: never > ask > allowed.**
- Load `untrusted`: `never` is `[]`, `ask` is a copy of `toolIds` in the same order, status `charter-untrusted`, notice `CHARTER_UNTRUSTED_NOTICE`. Links are ignored.
- Load `built-in` or `signed`: run `validateCharter(load.charter)` AGAIN; if it is not ok, give exactly the untrusted result above (fail closed, NOT an error). Otherwise, for each tool id in `toolIds` order take the STRICTEST level of: (i) every rule with the exact action id `tools.<toolId>` in ANY lane (the owner tightens one tool this way; an `allowed` rule changes nothing); (ii) for each action id in that tool's link (if any), every rule with that exact action id in ANY lane (two lanes may hold the same id: strictest wins), and if NO lane holds that action id the level is `ask` (unsure goes UP). A tool whose strictest level is `never` goes to `never`; `ask` goes to `ask`; otherwise it is in neither list. A tool is in ONE list at most. Both lists follow `toolIds` order. Status is `built-in` or `signed` as the load says; notice is `''`.
- A rule with level `allowed` can never lower a stricter one. The default Charter changes NO tool today (its lanes hold no `tools.*` rule): that is expected.

## FIXTURES AND HAND-WORKED CASES
The fixtures and the rows are in `docs/CHR2_CASES.md` in the mini-base (V21 view rows, L17 load rows, S08 serialize rows, E26 error rows). Copy the fixtures into your test as written. Do not return that file. If a row disagrees with the rules above, STOP and report the row.

Your test MUST contain every row as an exact-value check against your OWN literals (never by calling a copy of the engine), AND: (1) the default pin `charterHash(defaultCharter(), sha) === '167fb2be'`; (2) a SWEEP: for each of the four loads bi, sg(A), sg(B), sg(O) and each single tool of T as the only link target with each action in [email.send, email.read, money.pay, system.edit-charter, nope.verb, a.b.c, files.write, web.fetch]: the result is ok and equals an ORACLE you write in the test (a few lines: strictest level over every lane that holds the id, else ask); (3) properties over every row above: `never` and `ask` are disjoint, are subsets of `toolIds`, and keep `toolIds` order; an untrusted load always gives `ask` equal to `toolIds`; adding links never makes a tool LESS strict than without links; (4) a symbol key at the top of `args` and inside a link; (5) frozen results and unchanged inputs (JSON before and after).

## LANE (the only files you may create; nothing else is touched)
`src/mind/charter/charterView.ts`, `tests/charterView.test.ts`, `docs/reports/CHR2_CHARTER_VIEW_REPORT.md`. Do NOT edit `package.json`: write in the report the exact `test:kernel` line to append (`tsx tests/charterView.test.ts`). The test imports the engine and the Charter files with `.ts` extensions (like `tests/charter.test.ts`), uses `node:assert/strict` and a local `check` counter, and ends by printing exactly `CHARTER_VIEW OK: <n> checks`.

## DONE MEANS
1. `tsx tests/charterView.test.ts` prints the OK line. 2. `tsc --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler --allowImportingTsExtensions --skipLibCheck src/mind/charter/charterView.ts` prints no errors (if the test file cannot be type-checked because Node types are missing, say NOT RUN for the test file only). 3. At least 10 deliberate mutants of the engine (for example: an `allowed` rule lowers a stricter level; ask beats never; an unknown declared action counts as allowed; skip the `unsigned` check; untrusted gives an empty ask; ignore the second lane; check the size AFTER parsing; do not re-validate a trusted load; links stop being ignored when untrusted; unfrozen results; unsorted keys) each make the test FAIL; the report lists each mutant and which check caught it. 4. The report has: the five-line assessment, the LAW CHECK, the exact commands with printed output, the mutant list, the `test:kernel` line, and anything unrun marked NOT RUN.

## START RULE
Read the roadmap and ONLY these files: `docs/CHR2_CASES.md`, `docs/CHR1_CHARTER_STORE_DESIGN.md`, `src/mind/charter/charter.ts`, `src/mind/charter/change.ts`, `src/mind/charter/broker.ts`, `src/mind/charter/index.ts`, `tests/charter.test.ts` and `tsconfig.json`. If any is missing from the mini-base, STOP and say which.

## HONEST DELIVERY
Anything you did not run is written NOT RUN, never "passed". If a case row disagrees with the rules, STOP and report that row. Partial but passing files are still success; say what is missing. Fail the same way twice: stop and report.

## RIVAL / GAP (rule 9)
Rival: assistants whose permission list is a prompt sentence they can talk themselves past. CHR2 reads a signed, checked file; a bad or tampered file makes AXON ask before everything instead of trusting it, and no tool can loosen the owner's rules.
