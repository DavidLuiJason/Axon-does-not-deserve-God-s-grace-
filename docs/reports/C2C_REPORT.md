# C2C REPORT — Number and converter runners

**Delivery:** `C2C-number-runners.zip`  
**Status:** BUILD COMPLETE — new runner and test files type-check and pass in the mini-base sandbox. No repository files were merged or changed.

## LAW CHECK

- **FL1:** The runners occupy the existing tool-runner layer; later compatibility risks are listed below.
- **FL2:** The complete v20.5 roadmap and Part 00 were read, along with the named runner contract, schemas, descriptors, engines, and example test.
- **FL3:** Each runner preserves the typed path from the brain to the existing engine.
- **FL4:** Work was built and checked in small steps; the two-failure stop rule was observed.
- **FL5:** The dictionary was not changed, removed, or omitted from the base.
- **FL10:** No registry, catalog, screen, or chat wiring was added.
- **FL11:** This visible law check is repeated here.
- **FL12:** Runners accept typed arguments only; chat routing remains outside this job.
- **FL13:** No phrase lists, sentence matching, or raw-message interpretation were added.
- **FL14:** Existing shared engines are called; no computation was copied into the runners.
- **FL15:** Known answers, failure paths, repeatability, and the existing unit-category test were run; unrun checks are labelled below.

## Files created

Only these three new files are in the delivery ZIP:

1. `src/tools/runners/numberRunners.ts` — exports `NUMBER_RUNNERS` in the required order: calculator, number-to-words, percentage-helper, converter.
2. `tests/runnersNumbers.test.ts` — direct-engine comparisons, literal checks, failure matrix, purity/reply checks, and seven behavioural mutant probes.
3. `docs/reports/C2C_REPORT.md` — this report.

No file in the mini-base was edited. No package, guard, catalog, descriptor, schema, screen, dictionary, or roadmap file was changed.

## Implementation

- All four objects implement the unchanged `ToolRunner` contract and return a `Promise<RunnerOutcome>`.
- `args` must be a plain named-value object. Unknown keys, wrong types, invalid choices, missing required inputs, and malformed containers return typed failures. Unexpected property-access exceptions are caught at the runner boundary.
- The calculator uses the descriptor's `deg` / `rad` choices. `angle` is treated as optional because the engine defaults to radians.
- Number-to-words accepts a safe whole-number JavaScript number or a string containing digits only. Fractions, unsafe numbers, non-finite numbers, and other strings are rejected on `number`; the engine's own range refusals retain their error code.
- Percentage values accept JSON text or a plain object. Values are numeric finite numbers or decimal strings. Extra keys are refused.
- The converter finds the one `CONVERTER_KINDS` entry containing both exact `from` and `to` unit/format IDs. It refuses zero or multiple matches; multiple matches are named in the failure. It passes only supported engine options and preserves the engine result unchanged.
- `deps` is not read by these four engines; no clock or random source is used.
- Replies are built from engine results and supplied arguments, then passed through `shortenReply`.

## SCHEMA FINDINGS (R6)

1. **Calculator — `angle`:** the schema marks this choice required, but `evaluate()` defaults to radians when options are absent. The runner therefore permits it to be absent; if supplied, only descriptor choices `deg` and `rad` are accepted.
2. **Converter — `text`:** the schema marks this slot required, but the converter request consumes `input`, not `text`. It is treated as optional; if supplied, it is refused as unsupported rather than silently substituted or ignored.
3. **Converter — `toFormat`:** the schema marks this choice required, but it belongs to image/file conversion and is not a field consumed by `convert(request)`. It is treated as optional for text/number/block conversions; supplying it returns `needs-file`.
4. **Converter — `image` / `maxSide`:** these are image/file-path inputs. The runner returns `needs-file`; it does not invent image metadata or call the planning API without a file.
5. **Converter — `delimiter`, `header`, `html`:** these schema slots are not consumed by the current `convert()` request/options type. If supplied, the runner returns `invalid-input` on that slot rather than pretending the option was applied.
6. **Converter — `indent`:** the schema carries a choice string, while the block engine accepts numeric `2 | 4`. The runner accepts only strings `"2"` and `"4"` and maps them to the engine's numeric option.
7. **Converter descriptor gap:** `legacyDescriptors.ts` contains no `converter` descriptor. The runner therefore derives `from` / `to` choices from `CONVERTER_KINDS` units/formats, as this job explicitly requires, rather than inventing a descriptor or fixed list.
8. **Number-to-words:** the schema kind is `number`, while this job explicitly permits digit strings for values beyond JavaScript's safe integer range. The runner accepts only safe integer numbers or digit-only strings and passes the engine a `bigint` or original digit string.
9. **Percentage `values`:** the schema labels it `text`, while this job permits either JSON text or an already-parsed object. The runner accepts both forms and validates the exact key set for the selected mode.

## Percentage-helper key table

| Mode | Required keys inside `values` |
|---|---|
| `percent-of` | `x`, `y` |
| `what-percent` | `x`, `y` |
| `change` | `a`, `b` |
| `adjust` | `x`, `y` |
| `percent-of-what` | `x`, `y` |

A missing mode-specific key returns `missing-input`, `slot: "values"`, and names the missing key in the message. Non-numeric values and extra keys return `invalid-input`, `slot: "values"`.

## Converter support table

| Kind | Entry | Runner handling |
|---|---|---|
| `length` | number | Supported through the existing unit converter |
| `mass` | number | Supported through the existing unit converter |
| `temperature` | number | Supported through the existing unit converter |
| `volume` | number | Supported through the existing unit converter |
| `area` | number | Supported through the existing unit converter |
| `speed` | number | Supported through the existing unit converter |
| `time` | number | Supported through the existing unit converter |
| `data` | number | Supported through the existing unit converter |
| `number-base` | text | Supported through the existing base converter |
| `data-formats` | block | Supported through the existing data block converter |
| `text-formats` | block | Supported through the existing text format converter |
| `image` | file | Refused with `needs-file` |

Selection is based on exactly one kind containing both supplied endpoint IDs. No match or more than one match is `invalid-input`; more than one match names the conflicting kinds. File/image requests return `needs-file`.

## Tests and measured evidence

### New runner suite

**MEASURED:** 50 independent cases: 13 calculator, 12 number-to-words, 12 percentage-helper, 13 converter. Each case has hand-written runner arguments and a direct call to the engine with separately written engine arguments; the runner result is compared with that direct result. Twenty literal expected-value checks are also pinned independently.

**MEASURED:** `runnersNumbers.test.ts: 509 checks passed.` The suite covers:
- every required slot, subject to the R6 exceptions above;
- wrong types for every non-file slot, invalid choices, missing percentage keys, and malformed top-level arguments (`null`, `undefined`, array, string);
- all four engines' own refusal paths and preserved error codes;
- every direct case run twice with frozen arguments and frozen dependencies;
- unchanged arguments, complete engine results, reply facts, and reply length;
- long reply shortening without shortening the returned `result`;
- zero-kind and multiple-kind converter selection, plus file/image refusal.

### Mutant probes

The seven behavioural mutant call variants were exercised in the test harness; all seven were caught:

| Mutant | Fault introduced in the isolated probe | Named check that catches it | Result |
|---|---|---|---|
| 1 | Ignore the supplied calculator angle | Compare degree-mode result with default-radian result | CAUGHT |
| 2 | Swap the two percentage-change engine arguments | Compare direct percentage results for forward and reversed inputs | CAUGHT |
| 3 | Let an unexpected throw escape | Throw-boundary probe detects the escaping exception; the real runner boundary separately converts hostile property access into a typed failure | CAUGHT |
| 4 | Mutate caller arguments | Assignment against frozen arguments throws; original value remains unchanged | CAUGHT |
| 5 | Let an out-of-list angle reach the calculator | Compare the engine's interpretation of `degrees` with valid `deg` | CAUGHT |
| 6 | Change an engine result before returning it | Deep comparison detects the changed result | CAUGHT |
| 7 | Use ambient randomness instead of injected dependencies | Two ambient random reads differ while injected dependency reads are stable | CAUGHT |

**Mutant scope note:** these are seven isolated behavioural mutant call variants/probes in the test harness, not seven separate mutated source-tree builds. The report does not claim otherwise.

### Existing tests

**MEASURED:** `unitCategories.test.ts: 59 checks passed.` This is the only existing test file in the mini-base that imports a file read for this job (`unitConvert.ts`). Its existing source was not modified.

### Exact commands used

Environment:
- Node: `v22.16.0`
- TypeScript: `5.8.3`
- `tsx`: NOT INSTALLED in the mini-base.

Strict compile of the new runner suite (exit 0, no diagnostics):

```sh
tsc --target ES2022 --module commonjs --strict --skipLibCheck --moduleResolution node --outDir /tmp/c2c-out   /tmp/c2c-base/src/brain/mind/schema/schemaTypes.ts   /tmp/c2c-base/src/brain/mind/schema/actionSchemas.ts   /tmp/c2c-base/src/tools/engines/legacyDescriptors.ts   /tmp/c2c-base/src/tools/engines/numbers/calculator.ts   /tmp/c2c-base/src/tools/engines/numbers/numberToWords.ts   /tmp/c2c-base/src/tools/engines/numbers/percentage.ts   /tmp/c2c-base/src/tools/engines/numbers/unitConvert.ts   /tmp/c2c-base/src/tools/engines/numbers/baseConvert.ts   /tmp/c2c-base/src/tools/engines/data/jsonTokens.ts   /tmp/c2c-base/src/tools/engines/data/csv.ts   /tmp/c2c-base/src/tools/engines/data/yaml.ts   /tmp/c2c-base/src/tools/engines/data/xml.ts   /tmp/c2c-base/src/tools/engines/text/textFormats.ts   /tmp/c2c-base/src/tools/engines/text/markdown.ts   /tmp/c2c-base/src/tools/engines/text/htmlText.ts   /tmp/c2c-base/src/tools/engines/images/convertPlan.ts   /tmp/c2c-base/src/tools/converter/blocks.ts   /tmp/c2c-base/src/tools/converter/kinds.ts   /tmp/c2c-base/src/tools/converter/convert.ts   /tmp/c2c-base/src/tools/runners/runnerTypes.ts   /tmp/c2c-base/src/tools/runners/numberRunners.ts   /tmp/c2c-base/tests/runnersNumbers.test.ts
```

New suite:

```sh
node /tmp/c2c-out/tests/runnersNumbers.test.js
```

Printed output:

```text
runnersNumbers.test.ts: 509 checks passed.
```

Existing test type-check and run (a temporary declaration shim was created outside the delivery lane only because the mini-base has no installed `@types/node`):

```sh
tsc --target ES2022 --module commonjs --strict --skipLibCheck --moduleResolution node --outDir /tmp/c2c-existing-out   /tmp/c2c-base/src/tools/engines/numbers/unitConvert.ts   /tmp/c2c-node-assert.d.ts   /tmp/c2c-base/tests/unitCategories.test.ts
node /tmp/c2c-existing-out/tests/unitCategories.test.js
```

Printed output:

```text
unitCategories.test.ts: 59 checks passed.
```

## NOT RUN

- `tsx tests/runnersNumbers.test.ts`: NOT RUN because `tsx` is not installed. The same test source was strict-compiled with global `tsc` and executed with Node.
- Full repository `test:kernel`, `test:all`, Android build, device test, and cloud workflow: NOT RUN; this is a mini-base, without the full repository toolchain.
- No package script was edited. No registration or chat wiring was attempted; Claude/Director owns that later step.

## Exact `test:kernel` line to add

```sh
tsx tests/runnersNumbers.test.ts
```

## Unfinished work / handoff

- No runner work remains unfinished within the stated lane.
- Claude/Director should inspect the converter schema findings, especially the absent legacy converter descriptor and schema-only options that the current engine cannot consume, before registration/merge.
- This ZIP is a new-files-only builder return. It is not merged into the repository.
