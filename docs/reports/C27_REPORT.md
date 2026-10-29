# C27 Report — Colour Engine

Builder: GPT-6. Job: C27 [Colour Engine: name, hex, RGB, HSL].

## Top view
AXON's finished architecture (roadmap §6) layers ground and a knowledge slot beneath language reading, understanding, voice, and reach (tools, memory, media, device files, optional model and AXON Code). C27 is a pure tool engine under roadmap §§7E, 8 and owner wish W13. Later failures could arise from inconsistent colour conversions, misleading nearest-name claims, or incorrect WCAG contrast calculations.

## LAW CHECK (FL11)
- **FL1:** Located C27 in the complete AXON architecture and preserved existing files.
- **FL2:** Read the supplied roadmap and inspected the named mini-base files.
- **FL3:** Exposes reusable conversion, naming, description, and contrast functions for future integration.
- **FL4:** Ran baseline tests, deliberate mutations, and restoration; no repeated fix cycle was needed.
- **FL5:** Dictionary and licence/credit files were not changed or omitted from AXON.
- **FL6:** Added one compact engine and no dictionary copy.
- **FL7:** Checked CSS names against an independent Python source and exercised all RGB values.
- **FL8:** Return contains only the three lane files with relative paths.
- **FL9:** Pure engine stage only; no screen or registry work.
- **FL10:** No descriptor, registration, or chat action was added.
- **FL11:** This law check is included here and in the delivery response.
- **FL12:** Engine has no UI or independent chat path.
- **FL13:** Uses standards-based CSS names, not brain phrase lists.
- **FL14:** Conversion and naming implementation is centralized in this engine.
- **FL15:** Includes independent source verification, known answers, exhaustive round trips, contrast checks, and mutation checks.

### Building Rules 1–13
1. **Capacity:** input capped at 64 characters; loops are bounded by input length or fixed 148-name/16,777,216-colour test domains.
2. **Foundation:** pure TypeScript engine only; no UI or app wiring.
3. **Foundation-up:** this is an isolated tool-engine job.
4. **One builder/job/proof:** one engine, one test file, one report.
5. **Plan:** scope follows the C27 prompt and roadmap §§6–8.
6. **Measure/design/build/prove:** source count, exhaustive counts, max HSL error and test outcomes are recorded below.
7. **Compression:** no large data or quality-critical media was added.
8. **Weakest phone:** parser caps input and avoids unbounded work; exhaustive loops are test-only.
9. **Return verification:** only named lane files included; Director should still run `verify_return.py` against its base before merging.
10. **Roadmap:** roadmap untouched.
11. **Future compatibility:** exported types and conversion helpers are pure and reusable.
12. **Automatic guards/tests:** new test is provided; package.json was not edited. Director must add the listed test line.
13. **Migration:** repository-relative paths; no new dependency.

## Files created
- `src/tools/engines/colour/colour.ts` — typed parsing, RGB/hex/HSL conversions, CSS name matching and aliases, formatted descriptions, WCAG contrast and foreground selection.
- `tests/colour.test.ts` — known answers, hostile inputs, aliases, contrast and exhaustive RGB round trips.
- `docs/reports/C27_REPORT.md` — this report.

## Evidence and commands

### MEASURED
- Independent table verification, Python 3 + matplotlib 3.10.8 `matplotlib.colors.CSS4_COLORS`: expected 148, engine 148, exact name/value match `True`, missing 0, extra 0.
- `node --experimental-strip-types tests/colour.test.ts`: **PASS**, 8 test groups. The environment had Node v22.16.0; Node emitted its experimental type-stripping warning. This is the executed substitute for the requested runner because `tsx` was unavailable in the mini-base environment.
- Known-answer table: **40 cases passed**. Values were independently checked against Python `colorsys` calculations and the CSS4 table.
- Hex round trip: **16,777,216 / 16,777,216 RGB values passed exactly**.
- HSL round trip: **16,777,216 / 16,777,216 RGB values checked**; largest observed per-channel absolute RGB difference was **5** after integer-rounded HSL conversion. This is the measured loss due to whole-number hue/saturation/lightness; HSL is not a lossless encoding at this precision.
- WCAG checks: black on white = **21:1**; white and black backgrounds select the higher-contrast foreground; grey/white reference within tolerance.
- HSL lightness mutation: **CAUGHT**; the known-answer suite failed after deliberately changing the lightness formula, then source was restored.
- CSS name-table mutation (swapping red and blue values): **CAUGHT**; the suite failed, then source was restored.
- `tsc --strict --noEmit --target ES2022 --module ESNext src/tools/engines/colour/colour.ts`: **PASS**.

### NOT RUN / environment limits
- Required `npx tsx tests/colour.test.ts`: **NOT RUN**; no `tsx` executable or installed `node_modules` was present, and the attempted `npx --no-install tsx --version` timed out. Test logic itself was run using Node's built-in TypeScript stripping.
- `npx tsc --noEmit -p tsconfig.json`: **NOT RUN successfully**; global `tsc --noEmit -p tsconfig.json` failed before checking project files because mini-base dependencies/type declarations are absent: `TS2688: Cannot find type definition file for 'vite/client'`.
- Existing `test:kernel` suite: **NOT RUN**; the supplied mini-base has `package.json` but no `tests/` directory, so the script's existing test files are not present to execute.
- Full app/build/guard suite: **NOT RUN**; this mini-base does not include the complete repository or dependencies.
- Nothing unfinished in the three-file lane. Full project type-check and existing kernel suite remain to be run in the full repository before merge.

## Exact `test:kernel` line to add
Add this entry to the `test:kernel` command chain in `package.json` (do not replace existing entries):

`tsx tests/colour.test.ts`
