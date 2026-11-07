WHO IT IS FOR: ChatGPT (also runs in Grok). One pure-engine job for the AXON project. No screens.

WHAT THIS DOES: builds MR2 "Reply Composer": ONE isolated pure file with ONE function, `composeReply`. When the owner writes one message with several requests, each request gets its own small answer (answered, asking, waiting or failed). This function puts those small answers into ONE reply: answered parts first, then one question, then plain lines for parts that wait or failed. It never invents words: every word comes from the pieces it is given. It also never drops a part silently. Nothing calls it yet.

WHAT YOU DO: read the roadmap in the mini-base zip, write the LAW CHECK, then create exactly 3 new files (listed under LANE), run the proof commands, and report.

WHAT TO BRING BACK: a zip containing ONLY these 3 files, same paths: `src/decision/composeReply.ts`, `tests/composeReply.test.ts`, `docs/reports/MR2_COMPOSE_REPLY_REPORT.md`. Do not return the mini-base files.

ONE-LINE PASTE (with the mini-base zip attached): Read the attached prompt file `MR2_FOR_CHATGPT_REPLY_COMPOSER.md` completely and do exactly what it says.

---

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. Open ONLY the files this prompt names and the files you are asked to create or change; do not read any other document, folder or archive. AXON is a foundation-first project and its foundation is being reopened. Answer in at most five lines: (1) what the finished AXON contains (section 6 of the roadmap), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list only the laws this job touches (by number, one line each, at most 12 lines) and say how the job complies; repeat it in your report; if a law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13). (“Part 00” = section 3; “Part 5E” = section 6.)

---

## DIRECTOR PLACEMENT NOTE (roadmap 5.9 Plan B, 7K W24 multi-reply, 7S; owner 2026-11-05 gave the Director the decisions)
- **Item:** MR2 of `docs/MULTI_REPLY_DESIGN.md` section 3 (the composer). **Layer:** 3 to 5 (reply side of the brain). **Dependency:** none (the engine file has NO imports). **Builder:** ChatGPT. **Proof:** the rows in `docs/MR2_CASES.md` (hand-worked, then confirmed on a separate Director reference), a sweep, mutants; the Director reruns everything on his own reference.
- You treat this engine as PLANNED, not UNPLANNED. **Stays UNDECIDED (do not build toward):** who builds the pieces (MR3 wiring), the wording of questions and lines (a later wording job), the switch, the splitting of a message into pieces (MR0/MR1), any dialogue state. The composer only orders and joins.

## JOB MR2: one export in `src/decision/composeReply.ts`

**Style:** follow `src/decision/contextLookup.ts` and `src/decision/actOrAsk.ts` (in the mini-base): pure function; NO `Date`, `Math.random`, `fetch`, `console`, storage, global state, regex literals or phrase lists; NO imports in the engine file (declare the `EngineResult` type locally like the neighbours). Inputs are never changed. "Exact keys" checks count string AND symbol own keys (`Reflect.ownKeys`). Every result is deep-frozen (arrays and nested objects too), the error result as well. The function takes `unknown`, never throws (any exception: `bad-input`), returns `{ok:true,value}` or a frozen `{ok:false,error,message}` with the ONE message `Reply composer input is invalid.`

```ts
export function composeReply(input: unknown): EngineResult<ComposedReply>;
// input: { pieces: PieceAnswer[] }   (exactly this one key)
// PieceAnswer = {kind:'answered', own, text} | {kind:'asks', own, question, holdLine}
//             | {kind:'waits', own, line}    | {kind:'failed', own, line, reason}
// ComposedReply = { text:string, answered:number[], pending:number|null, held:number[], waiting:number[], failed:number[] }
```
Also export the types `PieceAnswer` and `ComposedReply`.

**Validation, first failing step wins** (exact meaning in `docs/MR2_CASES.md` section C): (1) not a non-array object: `bad-input`; (2) keys not exactly `pieces`: `unknown-key`; (3) `pieces` not an array, empty, or ANY invalid piece (exact keys for its kind, every string non-empty with no space or newline at its start or end, `kind` one of the four): `bad-pieces`; (4) more than 6 pieces: `too-many-pieces`.

**Composing (D1 to D9 in the cases file are binding):** there are NO words of your own in the reply. A BLOCK is `<own>: <string>` when there are two or more pieces, else just `<string>` (one piece: no echo, nothing changes). The reply is these blocks joined by two newline characters, in this order: (1) every `answered` piece in input order (its `text`); (2) the FIRST `asks` piece (its `question`): that piece's position is `pending`; (3) every later `asks` piece in input order (its `holdLine`, not its question): these positions are `held`; (4) every `waits` and `failed` piece in input order (its `line`; a `failed` piece's `reason` is never printed). Positions are 0-based input positions; `answered`, `held`, `waiting`, `failed` list them in input order; `pending` is null when nothing asks. Every piece is in exactly one of the five places: never dropped silently.

## Cases, sweep, mutants
`docs/MR2_CASES.md` holds the hand-worked rows (section A: 14 result rows M1 to M14). Your test must assert EVERY row of A with deep equality including key order, every error of C in the stated order (including: 7 valid pieces is `too-many-pieces`, 7 pieces with one invalid is `bad-pieces`, 6 pieces are fine, a throwing getter on `pieces` is `bad-input`, a symbol key is `unknown-key`, whitespace at the start or end of a string is `bad-pieces`, a `waits` piece with a `reason` key is `bad-pieces`, an `asks` piece without `holdLine` is `bad-pieces`), frozen results (value, all four lists, the error result), inputs unchanged, and the key order of the value. **Sweep:** 2,000 seeded random cases (a tiny seeded generator of your own, 1 to 6 pieces of all four kinds, strings with unique markers) checking: every piece appears in exactly one place; `answered` and `held` and `waiting` and `failed` are the right positions in input order; `pending` is the first asking piece; removing every string that came from the pieces from the text leaves only `:`, spaces and newlines (so the composer added no words); with two or more pieces every piece's `own` is in the text; an answered text comes before the question, and the question before any waiting line. **Mutants:** if you can run code, apply at least 10 deliberate breaks to a COPY of your engine (for example echo always on, echo always off, single newline as separator, question before the answered parts, drop the held lines, show the question of every asking piece, drop failed pieces, add a word of your own to the reply, print the failed reason, raise the cap, allow whitespace at the edges, allow an empty `pieces`) and show your test fails on each; report how many were killed and which survived. If you cannot run them say NOT RUN.
**TYPE RULE (a real mistake, CHR2/CHR3, 2026-11-06):** the cloud runs `tsc --noEmit` over `tests/` too, but `tsx` does not type-check. Reading `.error` or `.value` on an un-narrowed `{ok:true}|{ok:false}` result passes every `tsx` run and fails the cloud lint. In your test narrow the result (`r.ok ? undefined : r.error`) or cast it before reading. Run `tsc --noEmit --strict` on your three files (with `--ignoreConfig` if a tsconfig is in the way) and print the result in the report.

## LANE and DONE MEANS
**LANE (create ONLY these 3 files):** `src/decision/composeReply.ts`, `tests/composeReply.test.ts`, `docs/reports/MR2_COMPOSE_REPLY_REPORT.md`. Do not touch `package.json` (put the exact line to append in the report: `tsx tests/composeReply.test.ts`), `tools/files.lock`, any existing file. The test prints `COMPOSE_REPLY OK: <n> checks` and exits non-zero on the first failure.
**DONE MEANS:** the test passes under `tsx` (report the count; if `tsx` is not available say NOT RUN and give the other command you used); strict type check clean on the three files (print it); the LAW CHECK is in the report; the report lists each cases-file row (A and C) with PASS; the report says what you could NOT run.
**START RULE:** if a file named here is missing from the mini-base, or the cases file, the design file and this prompt disagree, STOP and say so; never guess a value.
**HONEST DELIVERY:** anything you could not run is written NOT RUN; a partly passing file is still delivered with its failures listed. Never write that a test passed unless you ran it and print its last line.
**Rival/gap (rule 9):** assistants answer the first request and quietly forget the rest. Here every part of a message is answered, asked about, or said to be waiting or failed, in one reply, and the composer adds no words that a part did not bring.
