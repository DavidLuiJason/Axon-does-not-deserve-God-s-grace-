# B03B1d REPORT: shared Roman numeral engine (Meaning part B, piece 1d)

[B03B1d = the Roman-numeral piece of the Values job. It is a pure engine; the reader that spots numerals inside a message comes with the assembler, after B03B1a to c.]

Source: first written by Grok (zip B03B1-values.zip), then inspected and tightened by the Director (Claude) on 2026-10-24.

## LAW CHECK
FL1 place: Ground/Reach-level pure engine under src/tools/engines, used later by the brain and a Roman tool. FL13: no word list, no regex. FL14: ONE Roman engine; the brain imports it, never copies it. FL12: not wired into chat. Rules 1, 4: one small sized job; Rule 12: tests cover every future caller (exhaustive); Rule 13: relative paths, no dependency.

## Changes by the Director to Grok's engine
- `parseRoman` no longer trims: " XIV" and "XIV " are now rejected (a reader passes exact tokens; silent trimming would hide offsets).
- Test rewritten: round trip 1 to 3999; the Python-made table (re-derived by the Director with an independent Python function: identical, 3,999 entries); EVERY string of 1 to 5 Roman letters (19,607 strings) is accepted exactly when it is in the table (735 accepted, count derived from the table); hostile input (non-strings, 100,000 letters, spaces, new line, Unicode Roman capitals, 0, 4000, NaN, Infinity).

## Evidence
- MEASURED: `tsx tests/romanNumeral.test.ts` gives 27,641 checks passed.
- MEASURED: four mutations each make the test fail (canonical check removed; trim restored; limit 3999 to 4999; "CM" row removed).
- MEASURED: single-file strict `tsc --noEmit` on the engine is clean.
- NOT RUN: whole-project type check and the cloud build (Director sandbox has no project toolchain); the cloud build after merge is the real proof.

## Files
NEW src/tools/engines/numbers/romanNumeral.ts; NEW tests/romanNumeral.test.ts; NEW tests/fixtures/roman-1-3999.json; NEW docs/reports/B03B1d_REPORT.md. No existing file changed.

## package.json: add to `test:kernel`
`tsx tests/romanNumeral.test.ts`
