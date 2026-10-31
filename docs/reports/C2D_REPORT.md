# C2D — Time runners report

## Delivery scope

Created only the three files in the permitted lane:

- `src/tools/runners/timeRunners.ts` — exports `TIME_RUNNERS: readonly ToolRunner[]` in the required order: timer, stopwatch, date-calculator, tally-counter.
- `tests/runnersTime.test.ts` — direct-engine comparisons, failure matrix, state persistence sequences, reply checks and seven behavioural mutant probes.
- `docs/reports/C2D_REPORT.md` — this report.

No mini-base file, schema, descriptor, catalog, screen, dictionary, `package.json`, guard, lock file, GitHub workflow or roadmap was edited. No runner registration or chat wiring was added.

## LAW CHECK (FL11)

- **FL1:** Place the work in AXON's finished top view: these are Reach-layer tool adapters; later compatibility risks are schema/descriptor drift and persisted-state shape changes.
- **FL2:** Read the complete v20.5 roadmap, reread Part 00, and read the runner contract, relevant schema rows, descriptors, all four time engines and the existing example test.
- **FL3:** Keep the runner as the typed adapter between brain-resolved arguments and the existing engine; the Director still owns registration and end-to-end chat execution.
- **FL4:** Build and test in small steps; record actual failures and stop after two failures of the same problem.
- **FL5:** Preserve the dictionary; no dictionary file was opened, changed, removed or omitted from the base.
- **FL7:** Use measured compiler and test output, not assumed success.
- **FL10:** Do not register tools or add a second chat entry point; the runners only expose engine execution.
- **FL11:** Apply and repeat this law check in the report.
- **FL12:** Accept typed slot values only; no raw chat parsing, UI or direct response path.
- **FL13:** Add no fixed phrase lists or sentence matching; the runner dispatches only on descriptor-defined operation choices.
- **FL14:** Call the existing time engines and do not duplicate their calculations or state transitions.
- **FL15:** Verify known answers, malformed inputs, state persistence, typed refusals and behavioural mutants; label unrun work honestly.

## Implementation and operation-to-engine table

| Tool | Descriptor operation | Existing engine call | State handling |
|---|---|---|---|
| timer | `start` | `startTimer(durationMs, now)` | Creates and returns new state; no previous state required |
| timer | `tick` | `tickTimer(state, now)` | Requires prior state; returns engine result `{state, remainingMs}` unchanged and exposes its `state` separately |
| timer | `pause` | `pauseTimer(state, now)` | Requires prior state; returns new state |
| timer | `resume` | `resumeTimer(state, now)` | Requires prior state; returns new state |
| timer | `reset` | `resetTimer()` | No prior state required; returns reset state |
| stopwatch | `start` | `startStopwatch(now)` | Creates and returns new state; no previous state required |
| stopwatch | `tick` | `tickStopwatch(state, now)` | Requires prior state; returns new state |
| stopwatch | `pause` | `pauseStopwatch(state, now)` | Requires prior state; returns new state |
| stopwatch | `resume` | `resumeStopwatch(state, now)` | Requires prior state; returns new state |
| stopwatch | `lap` | `lapStopwatch(state, now)` | Requires prior state; returns new state with lap information |
| stopwatch | `reset` | `resetStopwatch()` | No prior state required; returns reset state |
| date-calculator | `add` | `addDate(date, amount, unit)` | Stateless |
| date-calculator | `difference` | `differenceDates(date, otherDate)` | Stateless |
| date-calculator | `weekday` | `weekday(date)` | Stateless; converts the engine's ISO weekday number to its weekday name in the reply |
| date-calculator | `day-of-year` | `dayOfYear(date)` | Stateless |
| date-calculator | `iso-week` | `isoWeekNumber(date)` | Stateless |
| date-calculator | `count-weekdays` | `countWeekdays(date, otherDate)` | Stateless; engine defaults are left intact |
| tally-counter | `add` | `createTally()` when state is absent, then `addCounter(state, name, step?, min?, max?)` | Can create the empty prior state; returns new tally state |
| tally-counter | `increment` | `changeTally(state, name, 1)` | Requires prior state |
| tally-counter | `decrement` | `changeTally(state, name, -1)` | Requires prior state |
| tally-counter | `set` | `setTallyValue(state, name, value)` | Requires prior state |
| tally-counter | `reset` | `resetTally(state, name?)` | Requires prior state; omitted name resets all counters per engine behaviour |
| tally-counter | `undo` | `undoTally(state)` | Requires prior state |

Every operation listed by the four descriptors has an engine mapping. **No descriptor operation is unmapped.** The runners use `args.now` when supplied and otherwise use `deps.now`. They use no ambient clock, random source, storage or network. Stateful success outcomes carry the engine's next state in `state`; all returned states in the sequence tests survive JSON serialization and are accepted after restoration.

## SCHEMA FINDINGS (R6)

The schemas and descriptors are read-only and were not edited.

- **timer:** `durationMs` is marked required in the schema but is needed only for `start`. `tick`, `pause` and `resume` require a saved state; `start` and `reset` do not. The schema kinds are `duration` and `time`, while the descriptor labels `durationMs` and `now` as `text`; runner validation follows the schema for slot types and the descriptor for choices.
- **stopwatch:** only `operation` is required. `start` and `reset` do not require saved state; `tick`, `pause`, `resume` and `lap` do. The schema calls `now` a `time`, while the descriptor calls it `text`.
- **date-calculator:** `date` is required for every operation. `otherDate` is needed only by `difference` and `count-weekdays`; `amount` and `unit` are needed only by `add`. The descriptor represents `date`, `otherDate` and `amount` as `text`, while the schema types them as `date` and `number`. The engine validates actual calendar dates; malformed calendar dates are returned as `invalid-input` on `date` or `otherDate` before an engine call.
- **tally-counter:** schema-required `name` is needed for `add`, `increment`, `decrement` and `set`; it is optional for `reset` and unused by `undo`. Schema-required `value` is needed only for `set`. `step`, `min` and `max` are used only by `add`; the engine defaults `step` to 1 when omitted. `add` can create a tally when no state exists; every other operation needs a valid saved state. The descriptor types these numeric inputs as `text`, while the schema types them as `number`.
- **Operation-specific state:** an absent or malformed state for an operation that needs one returns `needs-state`; no state is guessed or reconstructed. Timer/stopwatch reset and timer/stopwatch start are state-creating/resetting engine operations and are allowed without old state. Tally `add` starts from `createTally()` only when `deps.state` is absent.

These are compatibility findings for the Director; this builder did not alter schemas or descriptors.

## Test evidence

### MEASURED — new runner suite

- **50 direct-engine cases:** timer 12, stopwatch 12, date-calculator 14, tally-counter 12. Each case has hand-written runner arguments and a separately written direct engine call; the runner's `result` is deeply compared to the direct engine value.
- **25 independent literal pins:** elapsed-time arithmetic, exact timer timestamps and remaining time, known calendar dates, leap-year arithmetic, weekday/day-of-year/ISO-week values, weekday counts and tally transitions.
- **State sequences:** timer 6 transitions (start, tick/check, pause, resume, finish, reset); stopwatch 7 (start, tick/check, lap, pause, resume, lap, reset); tally 6 (add, increment, decrement, set, reset, undo). Each step compares the runner's `result` and `state` to direct engine output, repeats the same frozen input, serializes the runner-returned state through `JSON.stringify`/`JSON.parse`, then feeds the restored state into the next step.
- **Failure matrix:** required and operation-conditional slots; wrong types for every declared slot (including number-as-text, text/choice/date-as-number, `null`, array and object); `NaN` and `Infinity` for numeric/time slots; unsupported choices; malformed `args` (`null`, `undefined`, array and string); missing/invalid state; and one engine refusal per tool.
- **Replies:** successful replies are checked for required facts and the 2,000-character limit. A 2,400-character counter name proves that the reply is shortened while the complete engine state remains unchanged.
- **Purity:** each of the 50 direct-engine cases runs twice with frozen arguments/dependencies; outcomes match and inputs remain unchanged. Each state-sequence step is also repeated with frozen inputs.
- **Mutants:** seven local faulty runner/call variants were run and caught:

| Mutant | Fault introduced in the copied runner/call | Named check that caught it |
|---|---|---|
| 1 | Ignores supplied `now` and uses `deps.now` | Caller-supplied timestamp produces a different direct engine state |
| 2 | Swaps `date` and `otherDate` | Signed date difference no longer matches the correct runner result |
| 3 | Throws on bad input | The never-throw probe observes the escaped exception |
| 4 | Mutates `args` | Frozen input rejects the mutation; original value remains unchanged |
| 5 | Sends an unlisted operation to an engine path | Invalid-choice mutant unexpectedly succeeds after its engine-call spy increments |
| 6 | Changes the engine result before returning | Mutated result differs from the unmodified runner/direct engine result |
| 7 | Uses `Date.now()` instead of `deps.now` | Ambient-clock result differs from the fixed injected-clock result |

**Printed output:** `runnersTime.test.ts: 551 checks passed (50 direct-engine cases).`

### MEASURED — existing test

`tests/unitCategories.test.ts` compiled and ran unchanged: `unitCategories.test.ts: 59 checks passed.` The mini-base has no installed `@types/node`; the compile used a temporary declaration shim at `/tmp/node-assert.d.ts` for the test's existing `node:assert` import. The shim is outside the delivery lane and is not in the ZIP.

### Exact commands used

New runner suite:

```sh
tsc --target ES2022 --module commonjs --strict --skipLibCheck --outDir /tmp/c2d-out \
  src/brain/mind/schema/schemaTypes.ts \
  src/brain/mind/schema/actionSchemas.ts \
  src/tools/engines/legacyDescriptors.ts \
  src/tools/engines/time/timer.ts \
  src/tools/engines/time/stopwatch.ts \
  src/tools/engines/time/dateCalc.ts \
  src/tools/engines/time/tally.ts \
  src/tools/runners/runnerTypes.ts \
  src/tools/runners/timeRunners.ts \
  tests/runnersTime.test.ts
node /tmp/c2d-out/tests/runnersTime.test.js
```

Existing test:

```sh
tsc --target ES2022 --module commonjs --strict --skipLibCheck --moduleResolution node --outDir /tmp/c2d-existing-out \
  /tmp/node-assert.d.ts \
  src/tools/engines/numbers/unitConvert.ts \
  tests/unitCategories.test.ts
node /tmp/c2d-existing-out/tests/unitCategories.test.js
```

**Exact `test:kernel` line for the Director to add:**

```sh
tsx tests/runnersTime.test.ts
```

No `package.json` change was made.

## NOT RUN

- Native `tsx` execution of the new suite: **NOT RUN** (the mini-base has no installed `node_modules`; the verified route was global `tsc` followed by Node 22).
- Full repository `test:kernel` / `test:all`: **NOT RUN** (this is a mini-base, not the full repository).
- Android/device build and cloud workflow: **NOT RUN** (outside this builder mini-base).
- Director's return verification, mutant re-run against the merged repository, and merge: **NOT RUN** (Director review is the next step; nothing is merged).

## Unfinished work

None within the three-file C2D lane. Registration, chat wiring, schema/descriptor reconciliation, and repository merge remain Director work and were intentionally not performed here.
