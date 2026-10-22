# C03 Report — YAML subset and XML readers/writers

Date: 2026-10-18

## Result and evidence

**PARTIAL / REVIEW REQUIRED.** Both engine files and tests are present and pass their focused tests under Node's built-in TypeScript stripping; a strict in-lane TypeScript check passes. The repository's standard `tsx` runner and whole-project type check could not run because this base ZIP has no `node_modules`, and the sandbox could not obtain `tsx`. The whole `test:kernel` result is therefore **NOT RUN**, not a pass. In addition, the XML convention itself cannot preserve every JavaScript scalar type: text-only elements must parse as strings, and null must write as an empty element which parses as `""`. This conflicts with an unrestricted exact round-trip promise for numbers, booleans and null. The XML random corpus therefore covers values representable by the stated convention (strings, attributes, nested mappings and repeated siblings); a focused test records the null/empty ambiguity. Director/owner should resolve whether XML typed scalars are intentionally lossy or a future typed extension is allowed.

## Files created

- `src/tools/engines/data/yaml.ts`
- `src/tools/engines/data/xml.ts`
- `tests/yaml.test.ts`
- `tests/xml.test.ts`
- `docs/reports/C03_REPORT.md`

No existing files were changed. No dependencies were added. Both descriptors use the catalog ID `converter`; no registry or menu was edited.

## YAML contract

`parseYaml(text)` and `stringifyYaml(value, { indent: 2 | 4 })` return typed result unions and do not intentionally throw for invalid user input. Plain values are null, booleans, finite numbers, strings, arrays and plain objects. The writer emits flow-style YAML (quoted strings and keys) for stable round-tripping; `indent` is validated as part of the API but does not change the flow-style output.

Supported subset: block mappings; block sequences, including sequences of mappings; plain and single-/double-quoted strings; JSON-compatible double-quoted escapes and YAML doubled single quotes; integers and finite decimal/exponent floats; lowercase `true` and `false`; `null` and `~`; comments; flow sequences `[a, b]`; flow mappings `{a: b}` with simple string keys; literal `|` and folded `>` block scalars with `-` and `+` chomping; a single document with an optional leading `---`. Unsupported YAML features are refused with a typed error and line where available: anchors, aliases, tags, additional documents, complex/non-string mapping keys, indentation tabs, merge keys, implicit boolean/null variants and non-finite numbers. Duplicate keys are refused. Limits: 1,000,000 input characters, depth 100, and 100,000 values.

## XML convention and limits

`parseXml(text)` returns the content of the single document root; `writeXml(value, { indent, rootName? })` wraps the value in `rootName` (default `root`). Attributes become `@name` keys, text becomes `#text` when an element also has attributes/children, repeated siblings become arrays, text-only elements become strings, and empty elements become `""`. `null` writes as an empty element. Comments and processing instructions/XML declarations are dropped and disclosed in `notes`. Namespaces remain plain prefixed names, including namespace declaration attributes. The parser supports elements, single/double-quoted attributes, text, CDATA, comments, processing instructions, the five predefined entities, decimal/hex numeric entities, self-closing tags, and an XML declaration. DOCTYPE/entity declarations, malformed or mismatched tags, duplicate attributes, invalid XML characters and multiple roots are refused with line and column. Parsing uses an explicit stack. Limits: 1,000,000 input characters, depth 100 and 100,000 element nodes.

XML serialization is compact (no pretty-print whitespace) so that it does not inject whitespace into the parsed text. The `indent` option is accepted and validated but currently does not affect layout. This is a known limitation to review before screen integration. Also, XML's required text-only-to-string and null-to-empty conventions mean that arbitrary numbers/booleans/null cannot all round-trip as their original JavaScript types without changing the convention. No hidden type metadata is added.

## LAW CHECK (FL11)

- **FL1 Top view:** aligned the data engines with AXON's converter layer and future integration.
- **FL2 Read everything, then act:** used the complete supplied v16.3 roadmap, revisited section 3, and inspected the job board, handbook and engine conventions.
- **FL3 Plan reaches the end:** documented stable plain-value contracts and format limitations for later converter work.
- **FL4 Progress first / Two-Strike:** built YAML then XML and fixed issues revealed by focused tests; no third attempt was made at any single unresolved failure.
- **FL5 Dictionary is core:** dictionary files and behavior are untouched.
- **FL6 Searchable compression:** no bundled data or dependencies; input and traversal limits are enforced.
- **FL7 Measure why:** command outcomes and unavailable tooling are recorded below.
- **FL8 Source export:** no export behavior or existing source files were changed.
- **FL9 Plan first:** separate parser implementations have explicit error handling and bounded work.
- **FL10 Chat control surface:** descriptors truthfully identify the `converter` catalog ID; no registry or menu integration is claimed.
- **FL11 Every-Stage Law:** this check is included in the report.
- **FL12 One designed brain:** engines are pure TypeScript and import no brain, UI, network or storage code.
- **FL13 Structure before vocabulary:** no brain phrases or patterns were added; descriptor examples are documentation only.
- **Rule 1 Size the job:** only the five files in the C03 lane were created.
- **Rule 2 Respect the foundation:** used the repository's TypeScript conventions and contracts.
- **Rule 3 Foundation up:** delivered reusable data primitives ahead of converter UI work.
- **Rule 4 One builder, one small job, one proof:** tested each engine separately and attempted the broader project checks.
- **Rule 5 Plan before work:** followed YAML-first, XML-second priority.
- **Rule 6 Measure, design, build, prove:** used deterministic tests and independent Python parser oracles.
- **Rule 7 Compress without degrading:** added no assets or dependencies and did not trade correctness for size.
- **Rule 8 Weakest phone:** bounded input, nesting and node/value counts; XML parsing uses an explicit stack.
- **Rule 9 Test the connection:** verified the exact output ZIP contents and relative paths before delivery.
- **Rule 10 Roadmap size:** did not edit the roadmap.
- **Rule 11 Future cost:** documented conventions and limitations for converter integration.
- **Rule 12 Locks grow:** did not change guards, lock files or existing tests.
- **Rule 13 Move safely:** all delivered paths are repository-relative and no dependency was added.

## Commands and measured results

### Focused engine tests

- `node --experimental-strip-types tests/yaml.test.ts` — **PASS**: 350 fixed-seed round trips; 9 hand-authored YAML documents; 12 hostile/boundary checks.
- `node --experimental-strip-types tests/xml.test.ts` — **PASS**: 350 fixed-seed round trips for values representable by the XML convention; 6 hand-authored XML documents; 13 hostile/boundary checks including DOCTYPE/entity attack refusal and null/empty ambiguity.
- `tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions --strict src/tools/engines/data/yaml.ts src/tools/engines/data/xml.ts tests/yaml.test.ts tests/xml.test.ts` — **PASS**.
- Python PyYAML 6.0.3 independent oracle — **PASS** for 9 hand-authored YAML documents, including block scalar and CRLF cases.
- Python `xml.etree.ElementTree` independent oracle — **PASS** for 4 hand-authored XML documents. The namespace-prefix case is checked by the engine test because ElementTree expands prefixes into Clark notation rather than preserving the original prefix.

### Required project checks — not green / not run

- `tsc --noEmit -p tsconfig.json` — **FAIL / environment blocked**: `TS2688: Cannot find type definition file for 'vite/client'`; the ZIP has no `node_modules`.
- `npm run test:kernel` — **FAIL / environment blocked at first command**: `sh: 1: tsx: not found`; no kernel test was executed by the project's standard runner.
- `npx --yes tsx tests/yaml.test.ts` — **NOT RUN to completion**: timed out while attempting to obtain/run `tsx` in this sandbox.
- Alternate attempt: ran all 30 `test:kernel` TypeScript entries individually with `node --experimental-strip-types`. **2 PASS** (`tests/brainBoundary.test.ts`, `tests/roadmapSize.test.ts`); **28 could not run** because Node's direct TypeScript loader does not resolve the repository's extensionless directory imports (for example `src/capabilities`). These are environment/runner failures, not counted as product-test passes or proven code failures.

## Package script lines to add

Do not edit `package.json` in this lane. Add these entries to the `test:kernel` chain:

```text
tsx tests/yaml.test.ts
tsx tests/xml.test.ts
```

## Unfinished / review items

1. Install the project's declared dependencies in a network-enabled build environment, then run `npx tsx tests/yaml.test.ts`, `npx tsx tests/xml.test.ts`, `npx tsc --noEmit -p tsconfig.json`, and the complete `npm run test:kernel`.
2. Resolve the XML contract conflict for arbitrary scalar round-tripping: under the required convention, a text-only number/boolean parses as a string and null parses back as empty string. Current tests deliberately generate XML values from the representable convention rather than falsely claiming otherwise.
3. Decide whether compact XML output is acceptable or whether a future convention change may permit pretty-printing without changing text semantics; `indent` is currently validated but not applied.

## Director inspection 2026-10-18 (INSPECTED-OK for merge as new files; YAML needs fix job C03F)
- MEASURED: verify_return.py clean (5 new files, no out-of-lane, no placeholders); yaml and xml tests pass under tsx; strict tsc passes on the lane files.
- MEASURED by hand: scalar round trips (41 tricky strings), tricky keys, odd numbers, DOCTYPE and entity-bomb refusal, depth and size limits, cycles and NaN refused: all good. 12 YAML and XML documents matched or were honestly refused.
- DEFECTS (YAML reader, compared with PyYAML 6.0.3): blank lines and `#` text inside `|` and `>` block scalars are lost (silent wrong output). Fix job: C03F.
- LIMITS to know, not defects: `- - 7` refused (message misleading, fixed in C03F); writer accepts up to about 30,000 records but the reader refuses over 100,000 counted values (keys count), so a very large write may not read back; XML mixed content joins text pieces ("t<b/>u" gives "tu"); XML typed scalars come back as strings; XML indent is accepted but ignored.
