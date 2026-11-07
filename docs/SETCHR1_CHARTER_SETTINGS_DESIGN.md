# SETCHR1 CHARTER SETTINGS SCREEN DESIGN (Director, 2026-11-07, design only, no code)

WHO WROTE IT: the Director (Claude). WHY NOW: CHR1 job map lists SET-CHR (Settings screen to read and change the Charter with confirm) as the job after CHR3; CHR3 is merged (`src/mind/charter/charterStore.ts`). Standing permission of 2026-11-05 covers the decisions; each is overrulable. Screens are built by AI Studio from exact text, so this file carries the exact text and states; it contains no code.
LAYER: 5. DEPENDS ON: CHR1 to CHR3. BUILDER: this file; then one small Director piece (SETCHR2) and AI Studio prompts (SETCHR3). PROOF: this file, tests of SETCHR2, then the owner's phone.

## 1. What was measured first (2026-11-07, main zip, files read)
- Reading: `readCharter(storage, sha256)` gives a status (`untrusted` or a loaded Charter, with `built-in` or `signed`); `readCharterHistory` gives up to 20 replaced revisions marked `[replaced DATE]`; `charterToFeedView` gives `{never, ask, status, notice}`; the one notice in code is `CHARTER_UNTRUSTED_NOTICE` = "Your Charter could not be checked, so I ask before every action."
- Changing: `previewCharterChange(storage, patch, sha256)` returns the plain summary lines, a `widens` flag, `changeHash` and `resultHash` WITHOUT writing. `writeCharter` is the one writer: it needs a patch, a `changeApproval` (an `OwnerApproval`: by "owner", actionHash, issuedAt, expiresAt, token) and a `signApproval`; it saves history first, then the Charter, then reads it back and restores the old text if the check fails.
- A patch is `{ lanes?, fences? }`. A rule is `allowed`, `ask` or `never` with a reason (max 500 characters). Fences: `neverTouch` (max 100), `maxSpendPerAction`, `maxSpendPerDay`. Eleven default lanes: email, messages, files, media, code, security, learning, money, web, apps, system. Per CHR1 C2 a single tool is tightened by a rule `tools.<toolId>` in lane `tools`; `allowed` there changes nothing.
- The existing Settings is `src/components/SettingsModal.tsx`. Its layout was NOT read for this design; AI Studio matches it ("DESIGN MATCH", owner rule 6).
- **FINDING F1 (a real gap):** when the stored Charter is `untrusted`, `writeCharter` refuses with `store-untrusted` ("not changed") and `previewCharterChange` does the same. So AXON then asks before every action (correct, fail closed) but the owner has NO way back from Settings. A recovery is needed: job CHR4 below.

## 2. Decisions (V1 to V9; each overrulable)
- **V1 ONE ENTRY.** A row "Charter" in Settings opens a Charter screen. The row's second line shows the status in plain words.
- **V2 FIVE SCREENS, PLAIN WORDS (owner design fix 2).** (a) Charter home; (b) one lane; (c) Tools; (d) Spending and protected places; (e) History. Plus one confirm sheet shared by all changes. No developer words on screen: no "hash", "signature", "lane id".
- **V3 EXACT TEXT (PROPOSED; the owner's yes on the fixed notice line is still WAITING, so the third status line below is not final).**
  - Home title: "Charter". Intro: "Your Charter holds the limits you set for AXON. AXON can ask you to make it stricter. Only you can make it looser."
  - Status line, three states: "Built-in rules, not yet changed by you" / "Your rules, last changed DATE" / "Your Charter could not be checked, so I ask before every action." (the last is the notice already in code, wording owner approval WAITING).
  - Home rows: "What AXON may do" (lanes), "Tools", "Spending and protected places", "History of changes".
  - Lane screen: one row per action, a three-way choice "Allowed", "Ask me first", "Never". A line under it: "Changes are saved only after you confirm."
  - Tools screen: only available tools are listed (from the catalog); each row has "No extra rule", "Ask me first", "Never" (no "Allowed": it would change nothing, CHR1 C2).
  - Spending and protected places: "Most AXON may spend on one action", "Most AXON may spend in one day", and a list "Places AXON never touches" with add and remove. Unit text is "amount", no currency is invented (money has no tool today; CHR1 D6 leaves cost to BUD1).
  - History: a list "Changed on DATE" (newest first, at most 20), read only in v1.
  - Confirm sheet: title "Save this change?"; the summary lines from the preview; if `widens` is true, an extra line in bold "This lets AXON do more than before."; buttons "Save" and "Cancel". No default button is focused.
- **V3a UNTRUSTED STATE.** Home shows the notice and ONE button "Go back to the built-in rules" (CHR4). The other rows are shown dimmed with "Fix this first".
- **V4 ONE ADAPTER IS THE ONLY CALLER.** The screen never imports `writeCharter`. One small file `src/mind/charter/charterSettings.ts` (SETCHR2) is the only importer of the writer; it is added by name to `ALLOWED_WRITER_IMPORTERS` in `tests/charterStore.test.ts` (an empty list today, with a comment that only the SET-CHR action may join it). That scan flags ANY file outside `charterStore.ts` that mentions the writer, the keys or `charterStore`, so the screen reads status and history through the adapter too, never from `charterStore.ts` directly. It does: preview, then on Save mint the two approvals, then write.
- **V5 THE APPROVAL IS A TAP, BOUND TO WHAT THE OWNER SAW.** On Save the adapter makes an `OwnerApproval` whose `actionHash` is the preview's `changeHash` (and `resultHash` for signing), `expiresAt` two minutes after `issuedAt`, a fresh token from an injected generator. A change that differs from the preview fails (`hash-mismatch`, already enforced by `applyChange`). The two-minute expiry is a Director choice. Used tokens are kept only in memory for the session: a token cannot be replayed within two minutes in one session, and expires after that; replay across restarts is blocked by the expiry only (NOT a full guarantee; stated, not hidden).
- **V6 AXON CAN NEVER SAVE.** Any change AXON proposes in chat is shown as a preview in this same confirm sheet and waits for the owner's tap; `proposeChange` with origin `axon` still refuses widening (`axon-cannot-widen`, existing rule).
- **V7 SIZE LIMITS FOLLOW CHARTER_LIMITS.** The screen shows an inline plain error at the cap (50 lanes, 200 actions per lane, 500 characters of reason, 100 protected places) instead of a failed save.
- **V8 RESTORE IS NOT IN v1.** History is view-only. "Restore this version" would be a new change through the same confirm sheet; PROPOSED for later, owner decides.
- **V9 PROOF OF THE PHONE.** Screenshots of the five screens, the confirm sheet with and without the bold line, the untrusted state, and one real save followed by an app restart showing the same status. The owner's phone is the only proof of how it looks (rule 12; ChatGPT cannot judge a screen).

## 3. Job map (PLACEMENT LAW)
| Job | What | Layer | Depends on | Builder | Proof |
|---|---|---|---|---|---|
| SETCHR1 | this design | 5 | CHR1 to CHR3 | Director | this file |
| CHR4 | recovery: pure function plus thin writer step that moves unreadable stored text into the history list and puts the built-in Charter back, only after an owner approval (about 40 lines) | 5 | CHR3 | Director | rows: untrusted text kept in history, built-in restored, approval required, replay refused; mutants |
| SETCHR2 | `src/mind/charter/charterSettings.ts`: preview, mint approvals (V5), write; plus the import-guard list change (about 70 lines) | 5 | CHR3, CHR4 | Director | hand rows, expired and mismatched approval rows, mutants, grep test |
| SETCHR3 | AI Studio prompts, KIND 1, five screens and the sheet, exact text from section 2, DESIGN MATCH to `SettingsModal.tsx` | 5 | SETCHR2, owner's yes on the notice line | AI Studio | phone (V9) |
Order: CHR4 and SETCHR2 are two small Director pieces that can go in ONE turn and one merge package. SETCHR3 waits for the owner's yes on the notice line (and the owner's design check afterwards).

## 4. Risks (probabilities are HYPOTHESES, rule 12)
- WORKS: preview then confirmed write, with a read-back check, because the engine pieces exist and are tested.
- WORKS ONLY IF the confirm sheet cannot be skipped: SETCHR2's test proves the write function cannot be reached without a fresh approval; the screen's look is a phone check.
- WILL NOT HELP TODAY: no tool declares `charterActions` and the lane `tools` rule is the only per-tool control, so most changes the owner can make today affect asking, not what a tool does.
- CANNOT JUDGE: `localStorage` survival on the weakest tier (same as CHR1).

## 5. Findings
- F1 above: untrusted Charter has no way back (CHR4).
- F2 the notice text and the default Charter wording are in code but not yet approved by the owner; they are in the "waiting on owner" list.
- F3 `charterToFeedView` lists never and ask tool ids; the screen can show the same view as a read-only preview of "what AXON will ask about" (PROPOSED, small, adds no new rule).
