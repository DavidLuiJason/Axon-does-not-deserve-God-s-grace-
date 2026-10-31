# C2AB — Text runners delivery report

## Scope and files

Created exactly these three new files:

- `src/tools/runners/textRunners.ts` — five pure adapters, exported as `TEXT_RUNNERS` in the requested order.
- `tests/runnersText.test.ts` — 50 direct-engine success/refusal cases plus failure, purity, reply and mutant checks.
- `docs/reports/C2AB_REPORT.md` — this report.

No mini-base file was edited. No schema, descriptor, catalog, screen, dictionary, package file or roadmap was changed.

## LAW CHECK (FL11)

- **FL1:** Runners are placed between typed brain arguments and existing engines; only the five named adapters were added.
- **FL2:** Read the complete roadmap and every named contract, schema, descriptor, engine and example test.
- **FL3:** Adapter shapes preserve the later typed tool-bus integration boundary.
- **FL4:** Built incrementally and corrected test expectations after observed failures; no repeated third attempt at one defect.
- **FL5:** Dictionary files and their loading path were untouched.
- **FL10:** Exact existing tool IDs, schema slots and descriptor choices are used.
- **FL11:** This report repeats the job's law check.
- **FL12:** No chat, screen, registry or tool registration wiring was added.
- **FL13:** No phrase lists, phrase matching or raw-message interpretation was added.
- **FL14:** Each runner calls its existing pure engine; no engine behavior was copied into the runner.
- **FL15:** Evidence below is measured from local compiler and Node output; unrun work is labelled.

## Implementation behavior

- All five runners validate the tool's slots from `getSchema()` and choice values from the corresponding legacy descriptor.
- Missing required slots return `missing-input` with the slot name. Wrong types, null values, unknown slots and out-of-list choices return `invalid-input` with the slot name where applicable.
- Engine failures return `engine-refused`; the engine error code is included in the plain-language message.
- `find-replace` supplies an empty replacement only when the caller omits it. Optional engine options are passed only when supplied.
- `sort-lines` passes `deps.random01` only for shuffle; it does not use a separate random source.
- Successful `result` values are returned unchanged. Replies use `shortenReply` and `RUNNER_REPLY_LIMIT`.
- Invalid argument containers (`null`, `undefined`, arrays and strings) are converted to typed failures. The run method catches thrown engine/runtime errors.

## SCHEMA FINDINGS (R6)

The schema marks `sort-lines.mode` and `text-compare.mode` required, while their engines have sensible defaults (`ascending` and `line`). The runners follow the schema and report those slots missing rather than silently applying the engine defaults. The Director should decide whether the schema should later make either slot optional.

`find-replace.replacement` is optional in the schema and the engine defaults it to empty text. The runner preserves that behavior by passing `''` only when the slot is unsupplied. The seven `text-cleaner` options and the four find/replace options are optional and remain unsupplied when absent, allowing engine defaults to apply.

## Verification

### MEASURED — new runner suite

Global `tsx` was not installed. The suite was strict-compiled with global TypeScript 5.8.3, then executed with Node 22.16.0.

Exact commands (from the extracted mini-base root; `/tmp/c2ab-base` was the extraction directory):

```sh
tsc --target ES2022 --module commonjs --strict --skipLibCheck --moduleResolution node --outDir /tmp/c2ab-out \
  /tmp/c2ab-base/src/brain/mind/schema/schemaTypes.ts \
  /tmp/c2ab-base/src/brain/mind/schema/actionSchemas.ts \
  /tmp/c2ab-base/src/tools/engines/legacyDescriptors.ts \
  /tmp/c2ab-base/src/tools/engines/text/findReplace.ts \
  /tmp/c2ab-base/src/tools/engines/text/caseConvert.ts \
  /tmp/c2ab-base/src/tools/engines/text/textCleaner.ts \
  /tmp/c2ab-base/src/tools/engines/text/sortLines.ts \
  /tmp/c2ab-base/src/tools/engines/text/textCompare.ts \
  /tmp/c2ab-base/src/tools/runners/runnerTypes.ts \
  /tmp/c2ab-base/src/tools/runners/textRunners.ts \
  /tmp/c2ab-base/tests/runnersText.test.ts
node /tmp/c2ab-out/tests/runnersText.test.js
```

**Printed final result:** `runnersText.test.ts: 917 checks passed.`

The suite contains 50 individually authored cases (10 per tool). Each case compares the runner's `result` deeply with a direct call to the corresponding engine using hand-written engine arguments. At least 20 independent literal expectations are also checked. The failure matrix checks every declared slot against wrong-type values, every required slot missing, descriptor choices outside the allowed set, five engine refusals, an engine that deliberately throws and four invalid argument-container forms. Inputs and repeated outcomes are checked for purity and repeatability.

### MEASURED — existing test importing a read engine

The only existing test in this mini-base importing a file read for this job was `tests/unitCategories.test.ts` (it imports the separate unit-conversion engine). Global TypeScript lacked the repository's Node type package, so a temporary `/tmp/node-assert.d.ts` declaration for the one `node:assert` use was supplied outside the delivery lane; no repository file was changed.

Exact commands:

```sh
tsc --target ES2022 --module commonjs --strict --skipLibCheck --moduleResolution node --outDir /tmp/c2ab-existing-out \
  /tmp/node-assert.d.ts /tmp/c2ab-base/src/tools/engines/numbers/unitConvert.ts /tmp/c2ab-base/tests/unitCategories.test.ts
node /tmp/c2ab-existing-out/tests/unitCategories.test.js
```

**Printed final result:** `unitCategories.test.ts: 59 checks passed.`

### Mutant table

All seven behavioral mutant probes were executed in the new test suite. They are deliberate faulty copies/call variants; none was left unreported.

| Mutant | Fault introduced | Named check that caught it | Result |
|---|---|---|---|
| 1 | Ignore `caseSensitive` | Compare the correct direct-engine result with the option-omitting variant | CAUGHT |
| 2 | Swap pattern and replacement | Compare the correct find/replace result with swapped engine arguments | CAUGHT |
| 3 | Let a runner copy throw on bad input | Throw-escape probe observes the rejected/escaped call rather than a typed failure | CAUGHT |
| 4 | Change supplied arguments | Frozen-input mutation probe blocks the write; ordinary runner cases also compare before/after inputs | CAUGHT |
| 5 | Let an unknown choice reach the engine | Boundary expects `invalid-input`; direct engine call instead returns its own `invalid-mode` refusal | CAUGHT |
| 6 | Change the engine result before returning it | Mutated result differs from the independently known engine value | CAUGHT |
| 7 | Use a random source other than `deps.random01` | Fixed injected random sequence and deliberately different `Math.random` sequence produce different shuffle results | CAUGHT |

## NOT RUN

- `tsx tests/runnersText.test.ts`: NOT RUN; `tsx` is not installed in this mini-base. The exact command to add to `test:kernel` is given below; the same TypeScript test was strict-compiled and run with Node.
- The complete repository `test:kernel` and `test:all` suites: NOT RUN; this is a mini-base and does not contain the repository's full test set or installed project dependencies.
- Device, Android and cloud-build checks: NOT RUN; this runner-only mini-base has no app build environment.

## Unfinished work

None within the three-file C2AB lane. The runners are intentionally not registered or wired into chat; the Director owns that later integration. `text-counter` remains the C1 pilot. `rephraser` and `grammar-helper` remain open engine gaps, as specified by the job.

## Exact `test:kernel` line to add

```sh
tsx tests/runnersText.test.ts
```
