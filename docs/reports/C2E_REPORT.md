# C2E Report — Create-tool runners

## LAW CHECK (FL11)

- **FL1:** These runners sit in section 6, layer 5 Reach; they reuse existing create engines and leave registration for the Director.
- **FL2:** Read AXON_ROADMAP_V20_5.md in full, reread section 3 (Part 00), and read every named contract, schema, descriptor, engine, and example test.
- **FL3:** Preserve the typed path from meaning/resolution through the existing engine; do not add a separate chat path.
- **FL4:** Built and tested against the supplied mini-base; the first strict build passed after one compile correction, then tests were rerun.
- **FL5:** The dictionary and its files were not touched or omitted.
- **FL10:** These are runner adapters only; no registry, chat action, or screen registration is added.
- **FL11:** This LAW CHECK is included in the delivery report.
- **FL12:** Runners accept typed arguments and do not answer chat independently.
- **FL13:** No phrase lists, sentence matching, or new brain vocabulary were added.
- **FL14:** Each runner calls the existing engine; no algorithm is copied into the runner.
- **FL15:** Direct-engine comparisons, independent literal values, failure tests, repeatability checks, and mutation probes were run.

## Scope and files

Created exactly these three new files:

1. `src/tools/runners/createRunners.ts` — exports `CREATE_RUNNERS: readonly ToolRunner[]` in the required order.
2. `tests/runnersCreate.test.ts` — direct-engine cases, literal checks, failure matrix, repeatability/reply checks, and seven mutation probes.
3. `docs/reports/C2E_REPORT.md` — this report.

No mini-base file was edited. No package, registry, catalog, screen, dictionary, schema, descriptor, or engine file was changed.

## Implementation

The exported array order is:

1. `qr-maker`
2. `password-generator`
3. `random-picker`
4. `encoder-decoder`
5. `hash-tool`

Every runner:
- checks its typed input before calling the engine;
- checks choices against the matching descriptor choices (QR uses `QR_DESCRIPTOR` in `qrCode.ts`, because no QR descriptor is present in `legacyDescriptors.ts`);
- catches synchronous exceptions and, for the hash runner, asynchronous rejection;
- maps engine refusals to `engine-refused`, retaining the engine error code in the message;
- returns the engine's successful result object unchanged;
- creates a plain-word reply using `shortenReply` and `RUNNER_REPLY_LIMIT`;
- does not mutate its arguments or dependencies.

Randomness is taken only from `deps.randomBelow`. The text `random` slots on password-generator and random-picker are deliberately ignored; a string slot cannot carry a callable random source.

### Password option keys

The runner accepts exactly these optional boolean keys in the `options` JSON string or parsed object:

| Key | Meaning passed through |
|---|---|
| `lower` | Lowercase characters |
| `upper` | Uppercase characters |
| `digits` | Digits |
| `symbols` | Symbols |
| `excludeLookAlikes` | Exclude visually similar characters |

`length` is supplied separately through the `length` slot and is not accepted inside `options`. Unknown option keys or non-boolean option values are rejected as `invalid-input`.

### Random-picker operation mapping

| Operation | `items` interpretation | Engine call |
|---|---|---|
| `pick` | JSON array, parsed string array, or one-item-per-line text | `pickRandom(items, count ?? 1, false, deps.randomBelow)` |
| `shuffle` | JSON array, parsed string array, or one-item-per-line text | `shuffle(items, deps.randomBelow)` |
| `coin-flip` | Not needed | `coinFlip(deps.randomBelow)` |
| `roll-dice` | Dice notation such as `2d6` | `rollDice(notation, deps.randomBelow)` |
| `random-integer` | Two safe integer bounds as `min,max` | `randomInteger(min, max, deps.randomBelow)` |
| `split-teams` | JSON array, parsed string array, or one-item-per-line text | `splitTeams(items, count, deps.randomBelow)` |

The six descriptor operations are all mapped; none is missing an engine function. `count` is used as the pick count (defaulting to the engine's default of 1) or team count. It is not needed for shuffle, coin flip, dice, or random-integer. `items` is not needed for coin flip. Empty list lines are dropped; list operations require at least one remaining item. For random-integer, the runner parses exactly two comma-separated safe integers; it does not guess a range.

## SCHEMA FINDINGS (R6)

These mismatches are recorded for the Director. No schema or descriptor was changed.

- **QR maker:** `text` and `level` are required in the schema. The engine requires a valid level and has no default. Choices are `L`, `M`, `Q`, `H`. The QR descriptor is exported from `qrCode.ts`, not `legacyDescriptors.ts`.
- **Password generator:** schema `length` is a number, but the documentation descriptor calls it text. The runner follows the schema and requires a finite integer number. Schema `options` is required text, while the runner accepts either JSON text or a parsed object. Schema/descriptor `random` is optional text, but it is ignored; the actual random function comes only from `deps.randomBelow`. Password option keys are listed above.
- **Random picker:** schema marks `items` and `count` required for every operation. The engine only needs `items` for pick, shuffle, roll-dice, random-integer and split-teams; coin-flip needs neither. The engine needs `count` for split-teams, uses its default count of 1 for pick, and does not consume count for shuffle, coin-flip, roll-dice, or random-integer. The runner follows those per-operation engine needs. The descriptor calls `count` text while the schema calls it number; the runner follows the schema and requires a numeric integer when count is used. Descriptor `random` is ignored; injected randomness is `deps.randomBelow`.
- **Encoder-decoder:** `mode`, `format`, and `input` are required and consumed by the engine. Choices come from the descriptor: modes `encode`/`decode`; formats `base64`, `base64url`, `url`, `html`, `hex`, `binary`, `rot13`.
- **Hash tool:** `input` and `algorithm` are required. The engine can also hash `Uint8Array`, but the schema exposes text and no file/byte input; the runner accepts text only. Algorithms are `MD5`, `SHA-1`, `SHA-256`, `SHA-384`, `SHA-512`, and `CRC32`. The runner uses the engine's default digest provider (`globalThis.crypto`); `RunnerDeps` has no digest-provider slot.

## Verification

Evidence labels: **MEASURED** = command was run and output observed; **NOT RUN** = unavailable in this mini-base; **HYPOTHESIS** = none used for a pass claim.

### MEASURED — strict compile

Environment:
- Node: `v22.16.0`
- TypeScript: `Version 5.8.3`
- `tsx`: not installed
- `globalThis.crypto.subtle.digest`: available in Node 22

Command (global `tsc`, CommonJS output, strict mode; a temporary ambient declaration outside the delivery lane supplies the missing `node:assert` type for the existing test):

```sh
tsc --target ES2022 --module commonjs --strict --skipLibCheck --outDir /tmp/c2e-out-exact \
  /tmp/c2e-base/src/brain/mind/schema/schemaTypes.ts \
  /tmp/c2e-base/src/brain/mind/schema/actionSchemas.ts \
  /tmp/c2e-base/src/tools/engines/legacyDescriptors.ts \
  /tmp/c2e-base/src/tools/engines/create/qrCode.ts \
  /tmp/c2e-base/src/tools/engines/create/passwordGenerator.ts \
  /tmp/c2e-base/src/tools/engines/create/randomPicker.ts \
  /tmp/c2e-base/src/tools/engines/create/encodeDecode.ts \
  /tmp/c2e-base/src/tools/engines/create/hashChecksum.ts \
  /tmp/c2e-base/src/tools/runners/runnerTypes.ts \
  /tmp/c2e-base/src/tools/runners/createRunners.ts \
  /tmp/c2e-base/src/tools/engines/numbers/unitConvert.ts \
  /tmp/c2e-base/tests/runnersCreate.test.ts \
  /tmp/c2e-base/tests/unitCategories.test.ts \
  /tmp/c2e-node-assert.d.ts
```

Output: exit code `0`; no TypeScript errors.

### MEASURED — new test suite

Command:

```sh
node /tmp/c2e-out-exact/tests/runnersCreate.test.js
```

Output:

```text
runnersCreate.test.ts: 707 checks passed (53 direct-engine cases).
```

The 52 hand-written direct-engine cases are distributed as follows:

| Tool | Cases |
|---|---:|
| QR maker | 10 |
| Password generator | 10 |
| Random picker | 13 |
| Encoder-decoder | 10 |
| Hash tool | 10 |
| **Total** | **53** |

40 of the 53 direct cases also pin literal expected values independent of the runner mapping. Every password-generation and random-picker case uses a fixed injected random source and a literal expected output; the other literal pins cover standard encoding/decoding values, published MD5/SHA/CRC vectors, and the QR matrix size.

Each direct case compares the runner's complete result to a direct engine call, runs twice with identical frozen arguments and injected dependencies, and checks that arguments remain unchanged. Success replies are checked for their key result facts and the 2,000-character limit. A 3,000-item pick verifies that the reply is shortened while the full result remains intact.

The failure matrix covers missing required inputs, wrong slot types (including null, array, object, NaN, Infinity and text/number swaps), invalid choices, malformed structured input, engine refusals, and null/undefined/array/string argument containers for every runner. The hash engine-refusal path is measured with a temporary test-only digest provider that rejects; the original global provider is restored in `finally`.

### MEASURED — existing test importing a read engine

Command:

```sh
node /tmp/c2e-out-exact/tests/unitCategories.test.js
```

Output:

```text
unitCategories.test.ts: 59 checks passed.
```

The existing test was compiled in the same strict TypeScript invocation. Its only missing mini-base dependency was the Node assertion type declaration, supplied temporarily outside the delivery ZIP.

### Mutation probes

Seven faulty behavioural copies/call variants were run in the test harness. These are mutation probes of the relevant call paths, not seven separate source-tree builds.

| Mutant | Named check that caught it | Result |
|---|---|---|
| Password call drops requested options | `mutant caught: ignored option` | Caught |
| Encoder mode/format arguments swapped | `mutant caught: swapped engine arguments` | Caught |
| Runner copy lets a thrown error escape | `mutant caught: throw escapes on bad input` | Caught |
| Runner copy mutates its input object | `mutant caught: args changed` | Caught |
| Choice guard bypass forwards an unsupported QR level | `mutant caught: choice outside list reaches engine` | Caught |
| Runner copy changes the engine's returned value | `mutant caught: result changed before return` | Caught |
| Runner copy substitutes a different random source | `mutant caught: random source other than deps` | Caught |

All seven probes were caught; none survived.

## NOT RUN

- Native `tsx tests/runnersCreate.test.ts`: `tsx` is not installed in the mini-base. The test was compiled with global TypeScript and run with Node 22 instead.
- Full repository `test:kernel` / `test:all`: the mini-base is not the full repository and has no installed project dependencies.
- Android/device build, weakest-phone performance test, and GitHub/cloud workflow: not available from this mini-base.

## Unfinished work

None within the three-file C2E lane. Registration and chat wiring are intentionally left to the Director, as required by FL10/FL12.

## `test:kernel` line to add

```text
tsx tests/runnersCreate.test.ts
```
