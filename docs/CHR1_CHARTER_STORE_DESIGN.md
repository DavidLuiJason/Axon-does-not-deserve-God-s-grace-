# CHR1 CHARTER STORE DESIGN (Director, 2026-11-06, design only, no code)

WHO WROTE IT: the Director (Claude). WHY NOW: D5 of `ACT_OR_ASK_FEED_DESIGN.md` says the Act-or-Ask feed reads a read-only Charter view `{never, ask}` and that the store design is job CHR1. The owner's standing permission of 2026-11-05 ("decide yourself as Director") covers these decisions; each is overrulable by the owner.
LAYER: 5 (Reach). DEPENDS ON: 7A (Charter = owner-signed rules AXON cannot edit or widen). BUILDER: none yet (next: card CHR2, section 7). PROOF: this file, then the CHR2 tests.

## 1. What was measured first (2026-11-06, main zip)
- A Charter ALREADY EXISTS: `src/mind/charter/` (`charter.ts` type, validation, default, canonical hash; `broker.ts` `decide` allow/ask/deny, `resolveAsk`; `change.ts` `proposeChange`, `applyChange`, `signCharter`, `verifyCharter`), tests `charter`, `broker`, `charterChange`. Nothing outside tests imports it (the feed takes only a plain `{never, ask}` object).
- Its ids are `lane.verb` (11 default lanes: email, messages, files, media, code, security, learning, money, web, apps, system). Real tools have NO lane: `ACTION_SCHEMAS` has 63 tools, effects `shows-result` 40, `writes-file` 17, `reads-file` 9, `changes-setting` 3, `uses-network` 3, `stores-note` 2, `uses-microphone` 1, `deletes` 1; NO tool has `sends` or `spends`; 4 tools carry `owner-approval` (voice-cloner, my-dictionary, backup-restore, taught-meanings).
- So today the Charter view adds NO new ask beyond what the feed already derives from effects and preconditions. CHR1's value is the owner's path to TIGHTEN, and the fail-closed rule below.

## 2. Decisions (C1 to C7)
- **C1 ONE CHARTER, NO NEW STORE (FL14).** The existing `Charter` type is the store's content. CHR1 adds only: where it is kept, how it is loaded, and one derivation to the feed's `{never, ask}`.
- **C2 TOOLS ENTER THE CHARTER AS A LANE `tools`.** The owner tightens a single tool with an ordinary rule `tools.<toolId>` (level `ask` or `never`) in lane id `tools`: no schema change (ids like `tools.sort-lines` pass the existing validation). `allowed` there changes nothing (a Charter can tighten, never loosen: D5). A tool may also declare `charterActions` (a list of `lane.verb` ids it performs, written in its wiring card later; EMPTY for all 63 tools today). Strictest level among the tool's own `tools.<id>` rule and its declared actions wins. No effect-class guessing: an undeclared tool is NOT made `never` by a lane it does not own (that would block every writer when the owner forbids one lane).
- **C3 THE VIEW IS A PURE FUNCTION.** `charterToFeedView(charter, integrity, toolIds, links)` returns `{never, ask, status, notice}`. It reads only the Charter it is given. It never decides execution: the BROKER `decide` stays the one authority at execution time (7E AUTHORITY: Planning picks, the broker allows, asks or blocks). The view only feeds J6's question; a view `ask` can make AXON ask earlier, never act.
- **C4 FAIL CLOSED, LOUD (FL15).** Stored Charter present but invalid or failing `verifyCharter` (tampered, unsigned, signature mismatch): the view sets `ask` to EVERY tool id, `status` `charter-untrusted`, and a plain notice the owner can see ("Your Charter could not be checked, so I ask before every action"). Unsure goes UP. No stored Charter: use the built-in default (C5), `status` `built-in`.
- **C5 BUILT-IN DEFAULT IS TRUSTED WITHOUT A SIGNATURE.** `defaultCharter()` is unsigned by construction (`signature: null`), and `decide` denies everything when integrity fails, so first run needs a rule: the app ships the default as SOURCE, pinned by a test that compares `charterHash(defaultCharter())` with a literal. Source is untouchable (N3), so the shipped default needs no signature. It is replaced only by an owner-signed stored Charter. Note the existing default has `money.*` NEVER while D5 said "no never": no tool lives in lane money, so the view is unchanged today; recorded so nobody is surprised.
- **C6 STORAGE.** User data, key `axon.charter.v1` (the signed Charter JSON), plus `axon.charter.history` (the replaced revisions, newest last, at most 20, each marked `[replaced DATE]`, 7F 4; never lost silently). The app's existing convention is `localStorage` behind try/catch (`userDictionaryStorage.ts`); same here: a read error is treated as "invalid" (C4), never as "absent". Size: the input cap is 1,000,000 characters (`CHARTER_LIMITS`); the default is a few KB. HONEST LIMIT: clearing app data erases the Charter and its history; backup is the Backup & Restore tool's job, not CHR1's. Loads before the first screen (7M 6).
- **C7 THE ONLY WRITE PATH.** One function, called only by an owner-confirmed Settings action, runs `proposeChange` then `applyChange` with an owner approval then `signCharter`, then writes. Anything from AXON, a tool, a worker or an outside AI may only produce a NARROWING proposal (the existing `axon-cannot-widen` rule) that still waits for the owner's confirm. A test proves no other module imports the writer (a grep guard in the style of `brainBoundary.test.ts`). The Settings screen is a later AI Studio job (SET-CHR), after the systems (owner order, roadmap section 1).

## 3. Not decided here (and why)
- Fences `maxSpendPerAction`, `maxSpendPerDay`, `neverTouch`: they act on cost and targets at execution time in the broker, not in the feed (D6: J6's `costly` is cost to the owner and waits for BUD1).
- Settings screen layout, wording of the notice (DLG1 words questions; the notice is a fixed safety line the owner approves, FL13).
- Backup of the Charter (Backup & Restore design).

## 4. Risks (probabilities are HYPOTHESES, rule 12)
- WORKS: tightening one tool through `tools.<id>` and fail-closed on a bad store, both pure and testable.
- WORKS ONLY IF the writer is never imported elsewhere: the grep test must run in `test:kernel`.
- WILL NOT HELP TODAY: no real tool declares `charterActions`, so the linked-action path is exercised only by test fixtures until the first new tool card declares one.
- CANNOT JUDGE: whether `localStorage` survives Android WebView storage pressure on weak phones (UNMEASURED; DEVICE check by tier, rule 8).

## 5. Findings
- F1 the shipped default (money NEVER) and D5's "no never" differ in words only; recorded in C5.
- F2 the existing `decide` has no notion of a TOOL id, only `lane.action`; CHR1 does not change it. A later wiring job (FEED3) must call `decide` with the tool's declared `lane.verb`, which only exists for tools that declare `charterActions` (C2).

## 6. Job map (placement, PLACEMENT LAW)
| Job | What | Layer | Depends on | Builder | Proof |
|---|---|---|---|---|---|
| CHR1 | this design | 5 | 7A | Director | this file |
| CHR2 | pure `src/mind/charter/charterView.ts`: `charterToFeedView` (C2 to C4) and pure `loadCharterText` / `serializeCharter` (C5, C6), no IO | 5 | CHR1 | ChatGPT after a card | hand-worked rows, fail-closed rows, sweep, mutants, Director second reference |
| CHR3 | thin storage adapter and the single writer (C6, C7) plus the import-guard test | 5 | CHR2 | Director (small risky piece, about 60 lines) | grep test, byte-identical source test |
| SET-CHR | Settings screen to read and change the Charter with confirm | 5 | CHR3 | AI Studio, later | phone |
| FEED3 | Router shadow call (already planned) takes the view | 3 to 5 | CHR2, CTX1, DLG1 | Director plus a card | golden transcript |

## 7. Card CHR2 (to write after the owner merges this file)
Scope for the builder, so the next prompt is short: ONE new file `src/mind/charter/charterView.ts`, ONE test, ONE report; imports only `./charter.ts` and `./change.ts` types and functions; no Date, no random, no IO, no regex literals, no phrase lists (FL13); error order and exact output keys fixed by the Director in the prompt; 24 or more hand-worked rows from C2 to C6.
