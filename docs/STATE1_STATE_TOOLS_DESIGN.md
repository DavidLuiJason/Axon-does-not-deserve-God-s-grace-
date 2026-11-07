# STATE1 STATE TOOLS DESIGN (Director, 2026-11-07, design only, no code)

WHO WROTE IT: the Director (Claude). WHY NOW: `src/tools/runners/liveSwitches.ts` says the lane never runs timers, stopwatch or tally "until a STATE design says who stores it". This is that design. Owner's standing permission of 2026-11-05 ("decide yourself as Director") covers these decisions; each is overrulable.
LAYER: 5 (tools through the brain). DEPENDS ON: the runner contract (`runnerTypes.ts`), the lane (`directLane.ts`), the Charter storage convention (CHR1 C6). BUILDER: none for this file. PROOF: this file, then the STATE2 tests.

## 1. What was measured first (2026-11-07, main zip, files read)
- Three tools keep a state: Timer (`TimerState`: status idle/running/paused/finished, durationMs, remainingMs, startedAt, deadlineAt, pausedAt), Stopwatch (`StopwatchState`: status, elapsedMs, laps, lastLapTotalMs, startedAt, pausedAt), Tally Counter (`TallyState`: counters by name plus an undo history, `HISTORY_LIMIT` 100, each snapshot flat, so the size is bounded).
- The runners (`timeRunners.ts`) are pure. They read the previous state from `deps.state`, check its shape themselves (`timerState`, `stopwatchState`, `tallyState`; a bad or missing one is `needs-state`), take the clock only from `deps.now`, and return the NEW state in the outcome's `state` field. Times are stored as absolute epoch milliseconds (`deadlineAt`, `startedAt`), so a timer is correct after the app was closed and reopened, because the next `tick` recomputes from the clock.
- The lane (`directLane.ts` line 70) yields to the old path with "needs stored state" for every id in `STATE_TOOL_IDS`. That list is built from ALL FOUR `TIME_RUNNERS`.
- **FINDING F1 (a real defect):** `date-calculator` is one of the four time runners but it is STATELESS (`runDateCalculator` starts with `void deps`). It is blocked from the lane only because of how the list is built. `tests/liveSwitches.test.ts` pins that list to `TIME_RUNNERS` (check "state tools are the time family"), so the defect is written into a test. Fix: STATE_TOOL_IDS names the three stateful ids; the pinned check changes with it (a hot-file job, STATE4 below).
- No file in `src/` stores tool state today (searched by name: `needsState` is the only reader, `src/brain/index.ts` line 56). Whether the Timer, Stopwatch and Tally SCREENS keep their own copy of the state is NOT MEASURED (the screens were not read). If they do, chat and screen would disagree: see D7.

## 2. Decisions (S1 to S9; each overrulable)
- **S1 ONE KEEPER, ONE KEY PER TOOL.** A small module `src/tools/state/toolStateStore.ts` (STATE2) reads, writes and clears a tool's state through an injected storage object (the same shape as `CharterStorage`: `getItem`, `setItem`, `removeItem`). Key `axon.toolstate.v1.<toolId>`, value JSON `{ "v": 1, "toolId": "...", "savedAt": "<ISO>", "state": <engine state> }`. The browser binding is the same `localStorage`-behind-try/catch convention as `userDictionaryStorage.ts` and the Charter store. User data only (N3); the source is never touched.
- **S2 TWO GATES ON READ.** The keeper checks only: storage readable, JSON parses, `v` is 1, `toolId` matches, text under 100,000 characters. The runner is the second gate (its own shape check). A failure at either gate means "no usable state", never a guess.
- **S3 NO USABLE STATE IS SAID, NOT HIDDEN (N2).** If the stored text exists but fails a gate, the reply says plainly that the earlier timer (or stopwatch, or tally) could not be read and is treated as gone; it never acts as if it were fine. If storage is absent (first use) the runner's own `needs-state` answer ("Start a timer before using this operation") stands.
- **S4 ORDER: READ, RUN, WRITE, REPLY.** The lane reads the state, runs the runner with `deps.state`, and writes the returned `state` only when the outcome is `ok`. A failed run never writes. If the write fails, the reply says "I could not save this", and AXON does not claim it is kept. One writer, the lane's go-live adapter; a grep test (like CHR3's) fails if any other module imports the keeper's write function.
- **S5 ONE STATE PER TOOL, SO TWO CASES ASK.** The engines hold ONE timer and ONE stopwatch (a tally holds many named counters inside one state). So: starting a timer while one is running or paused, and resetting a timer or stopwatch that is not idle, would lose something. In v1 the lane YIELDS those two cases to the old path (it already does that today for every state tool), so nothing new is lost; the proper "replace it?" question belongs to the act-or-ask wiring (J6, FEED3) and the DLG2 wording. Everything else (start from idle, pause, resume, lap, tick, tally add/change/set/undo) acts, because it loses nothing or is undoable.
- **S6 "HOW MUCH TIME IS LEFT" IS A TICK.** A read-only question maps to operation `tick`, which returns a new state; it is stored like any other result (the engine already moves a finished timer to `finished` on tick).
- **S7 CHAT AND SCREEN SHARE THE SAME RECORD (FL10, FL14).** When the screens are wired, they read and write the same store key. Two copies is a bug by design. STATE5 (AI Studio, later) carries this as a rule; before it, a Director check reads the three screens and records whether they hold their own state (UNMEASURED now).
- **S8 SIZE AND ERASE.** Stored text over 100,000 characters is refused loudly (a Tally with 100 snapshots and many counters is the only case that could approach it; its real size is NOT MEASURED, the STATE2 test measures a worst case). The owner can clear a tool's state by chat ("reset the timer" already runs the reset operation; the keeper then stores the idle state or removes the key: STATE2 decides in its test, default remove). Backup and Restore will include these keys when that tool is designed.
- **S9 NO ALARM WHEN THE APP IS CLOSED.** A finished timer is noticed on the next tick (app open, or on the next question). A sound or notification at the exact moment with the app closed needs a native service (X27, PROBE-NATIVE): UNPLANNED, not promised. The reply wording must never say "I will tell you when it ends" unless the app is open (N2).

## 3. Job map (PLACEMENT LAW)
| Job | What | Layer | Depends on | Builder | Proof |
|---|---|---|---|---|---|
| STATE1 | this design | 5 | runners, lane | Director | this file |
| STATE2 | `src/tools/state/toolStateStore.ts` plus its test: S1 to S4, S8; pure over an injected storage; no clock, random or regex | 5 | STATE1 | Director (about 70 lines; small risky piece, it owns saving) | hand-worked rows, bad-text rows, write-failure row, worst-case size row, mutants |
| STATE3 | lane wiring: read, run, write (hot files `directLane.ts`, `brain/index.ts`) | 3 to 5 | STATE2 | Director | golden transcript pass count kept or raised; shadow identical on the old paths |
| STATE4 | `STATE_TOOL_IDS` = timer, stopwatch, tally-counter (F1); wire cards for the three plus date-calculator; family go-live for the time family | 5 | STATE3, auto-wire | Director | pinned test changed on purpose, golden transcript, `tools/wire.mjs --proof` |
| STATE5 | the three screens use the same store (rule S7) | 5 | STATE2 | AI Studio, later | phone |
Order: STATE2, STATE3, STATE4. STATE2 and the F1 line of STATE4 can ship before STATE3 only if the date-calculator alone goes live first (it needs no state): that is a legitimate small first go-live.

## 4. Risks (probabilities are HYPOTHESES, rule 12)
- WORKS: save and restore across an app restart for all three tools, by the absolute-time design (the engine is pure and checks its own state).
- WORKS DIFFERENTLY: the timer does not ring when the app is closed (S9).
- WORKS ONLY IF the screens share the keeper (S7); otherwise chat and screen disagree.
- CANNOT JUDGE: whether `localStorage` survives Android WebView storage pressure on the weakest phone tier (same open question as CHR1; DEVICE check by tier, rule 8).

## 5. Findings
- F1 above (date-calculator wrongly blocked; pinned by a test).
- F2 the roadmap and the done-and-left file count "state-tools design" as one Director job with no dependency: confirmed, this file needed nothing outside the repository.
- F3 the stored `savedAt` is informational; the runner decides from the engine's own times, so a wrong phone clock can distort a timer but not corrupt it (not tested here).
