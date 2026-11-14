# AXON BRAIN PART P01 — REPAIR — BUILD REPORT

## 1. DELIVERABLES
- P01 source, test, and fixture ZIP (`COM-BRAIN-RESULTS-P01-repair.zip`): DONE.
- Report included inside the results ZIP as `REPORT.md`: DONE (added at the user's explicit request; see scope note under NOT RUN / NOT DONE / DOUBTS).
- Worked cases copied into the fixture: DONE (W01–W20).
- At least 150 total cases: DONE (194 cases: 20 worked + 174 invented).
- Test-first run showing failure before implementation: DONE.
- Implementation and final test run: DONE.
- Seven deliberate break-and-catch checks: DONE.
- Full multi-part ZIP: NOT APPLICABLE (only one part was built in this chat).

## 2. MY UNDERSTANDING
P01 repairs only three explicitly permitted kinds of message problems before reading: a standalone “wait” or “oops” marker retracts itself and, where applicable, the sentence immediately before it; adjacent sentences with the same case-insensitive, whitespace-normalized form are reduced to the first copy; and “how much” is changed to “how many” only before one of the ten listed count nouns. Quoted payloads are protected, unbalanced quotes cause an unchanged KEEP result, and any applied repair alongside an outside-quote risky whole word changes the verdict to ASK while preserving the original as an alternative. It does not perform general typo correction, synonym substitution, or intent guessing.

## 3. FILES
| Path | Lines | SHA-256 |
|---|---:|---|
| `src/brain/mind/repair/repair.ts` | 180 | `5959c819d6ff90f467a376e7444cde07d965171c1be94e7b51d5b0965366c7d8` |
| `tests/repair.test.ts` | 27 | `f50a2404fcc5cb0cac428db44ff70d99fa985cdb8e4f70fe3bd95f5681a56d5e` |
| `tests/fixtures/repairCases.json` | 196 | `129f6ad1813e9d774d546f26a7259cc9120b42ea73f977dbd677efbfebb04474` |


## 4. TEST OUTPUT
Runner: `node --experimental-strip-types tests/repair.test.ts` (Node v22.16.0; `tsx` was not installed).

Final real stdout:
```text
repair: 194 checks; 0 failed
```
The runtime emitted Node's experimental type-stripping warning on stderr. The test process exited with code 0.

Test-first evidence, before `repair.ts` existed: the same test command exited with code 1 and Node reported `ERR_MODULE_NOT_FOUND` for `src/brain/mind/repair/repair.ts`. This was the expected failure because the implementation had not yet been created.

For expected failures, the fixture schema supplies `{ok:false,error}` without a `message`, while the shared contract requires the function's `EngineFailure` to include a plain-sentence `message`. The test therefore deep-compares `ok` and `error` against the fixture and separately checks that the returned message is a non-empty string. Successful results are deep-compared in full.

## 5. WORKED CASES
| Case ID | Result |
|---|---|
| W01 | PASS |
| W02 | PASS |
| W03 | PASS |
| W04 | PASS |
| W05 | PASS |
| W06 | PASS |
| W07 | PASS |
| W08 | PASS |
| W09 | PASS |
| W10 | PASS |
| W11 | PASS |
| W12 | PASS |
| W13 | PASS |
| W14 | PASS |
| W15 | PASS |
| W16 | PASS |
| W17 | PASS |
| W18 | PASS |
| W19 | PASS |
| W20 | PASS |
| I001_repeat | PASS |
| I002_repeat | PASS |
| I003_repeat | PASS |
| I004_repeat | PASS |
| I005_repeat | PASS |
| I006_repeat | PASS |
| I007_repeat | PASS |
| I008_repeat | PASS |
| I009_repeat | PASS |
| I010_repeat | PASS |
| I011_repeat | PASS |
| I012_repeat | PASS |
| I013_repeat | PASS |
| I014_repeat | PASS |
| I015_repeat | PASS |
| I016_repeat | PASS |
| I017_repeat | PASS |
| I018_repeat | PASS |
| I019_repeat | PASS |
| I020_repeat | PASS |
| I021_repeat | PASS |
| I022_repeat | PASS |
| I023_repeat | PASS |
| I024_repeat | PASS |
| I025_marker | PASS |
| I026_marker | PASS |
| I027_marker | PASS |
| I028_marker | PASS |
| I029_marker | PASS |
| I030_marker | PASS |
| I031_marker | PASS |
| I032_marker | PASS |
| I033_marker | PASS |
| I034_marker | PASS |
| I035_marker | PASS |
| I036_marker | PASS |
| I037_marker | PASS |
| I038_marker | PASS |
| I039_marker | PASS |
| I040_marker | PASS |
| I041_marker | PASS |
| I042_marker | PASS |
| I043_marker | PASS |
| I044_marker | PASS |
| I045_marker | PASS |
| I046_marker | PASS |
| I047_marker | PASS |
| I048_marker | PASS |
| I049_grammar | PASS |
| I050_grammar | PASS |
| I051_grammar | PASS |
| I052_grammar | PASS |
| I053_grammar | PASS |
| I054_grammar | PASS |
| I055_grammar | PASS |
| I056_grammar | PASS |
| I057_grammar | PASS |
| I058_grammar | PASS |
| I059_grammar | PASS |
| I060_grammar | PASS |
| I061_grammar | PASS |
| I062_grammar | PASS |
| I063_grammar | PASS |
| I064_grammar | PASS |
| I065_grammar | PASS |
| I066_grammar | PASS |
| I067_grammar | PASS |
| I068_grammar | PASS |
| I069_grammar | PASS |
| I070_grammar | PASS |
| I071_grammar | PASS |
| I072_grammar | PASS |
| I073_grammar | PASS |
| I074_grammar | PASS |
| I075_grammar | PASS |
| I076_grammar | PASS |
| I077_grammar | PASS |
| I078_grammar | PASS |
| I079_grammar | PASS |
| I080_grammar | PASS |
| I081_grammar | PASS |
| I082_grammar | PASS |
| I083_grammar | PASS |
| I084_grammar | PASS |
| I085_grammar | PASS |
| I086_grammar | PASS |
| I087_grammar | PASS |
| I088_grammar | PASS |
| I089_grammar | PASS |
| I090_grammar | PASS |
| I091_grammar | PASS |
| I092_grammar | PASS |
| I093_grammar | PASS |
| I094_quote | PASS |
| I095_quote | PASS |
| I096_quote | PASS |
| I097_quote | PASS |
| I098_quote | PASS |
| I099_quote | PASS |
| I100_quote | PASS |
| I101_quote | PASS |
| I102_quote | PASS |
| I103_quote | PASS |
| I104_quote | PASS |
| I105_quote | PASS |
| I106_quote | PASS |
| I107_quote | PASS |
| I108_quote | PASS |
| I109_quote | PASS |
| I110_quote | PASS |
| I111_quote | PASS |
| I112_quote | PASS |
| I113_risk | PASS |
| I114_risk | PASS |
| I115_risk | PASS |
| I116_risk | PASS |
| I117_risk | PASS |
| I118_risk | PASS |
| I119_risk | PASS |
| I120_risk | PASS |
| I121_risk | PASS |
| I122_risk | PASS |
| I123_risk | PASS |
| I124_risk | PASS |
| I125_risk | PASS |
| I126_risk | PASS |
| I127_risk | PASS |
| I128_risk | PASS |
| I129_risk | PASS |
| I130_risk | PASS |
| I131_risk | PASS |
| I132_risk | PASS |
| I133_risk | PASS |
| I134_risk | PASS |
| I135_risk | PASS |
| I136_risk | PASS |
| I137_input | PASS |
| I138_input | PASS |
| I139_input | PASS |
| I140_input | PASS |
| I141_input | PASS |
| I142_input | PASS |
| I143_input | PASS |
| I144_mix | PASS |
| I145_mix | PASS |
| I146_mix | PASS |
| I147_mix | PASS |
| I148_mix | PASS |
| I149_mix | PASS |
| I150_mix | PASS |
| I151_mix | PASS |
| I152_mix | PASS |
| I153_mix | PASS |
| I154_mix | PASS |
| I155_mix | PASS |
| I156_mix | PASS |
| I157_mix | PASS |
| I158_mix | PASS |
| I159_mix | PASS |
| I160_mix | PASS |
| I161_mix | PASS |
| I162_mix | PASS |
| I163_mix | PASS |
| I164_mix | PASS |
| I165_mix | PASS |
| I166_mix | PASS |
| I167_mix | PASS |
| I168_mix | PASS |
| I189_missing_text | PASS |
| I190_null_input | PASS |
| I191_number_input | PASS |
| I192_mixed_case | PASS |
| I193_word_boundary | PASS |
| I194_unmatched_curly_close | PASS |

## 6. BREAKS
| Deliberate break | Test(s) that caught it |
|---|---|
| Removed quote protection in grammar processing | W07; I091_grammar; I092_grammar; I093_grammar; I094_quote; I095_quote; I112_quote (7 failures) |
| Treated `wait 5 minutes` as a marker | I037_marker; I048_marker; I164_mix (3 failures) |
| Made repeat comparison case-sensitive | W02; W10; W17; I003_repeat and 9 additional failures (13 total) |
| Added `money` to the closed noun list | W06; I079_grammar (2 failures) |
| Skipped risky-word detection | W08; I113_risk and 9 additional failures (11 total) |
| Removed the empty-result KEEP protection | W11; I027_marker; I028_marker; I038_marker and 5 additional failures (9 total) |
| Discarded mixed capital style when replacing `much` | W13; I059_grammar; I060_grammar; I061_grammar and 20 additional failures (24 total) |

Each deliberate mutation was run against the complete 194-case suite. Every mutation was caught by at least one test. The original implementation was restored after each mutation, and the final clean run is the 194-check result above.

## 7. NOTICED
- The card says “any capitals” and illustrates lower-case, title-case, and upper-case `much`. I interpreted “keeps its capital style” per character, so mixed forms such as `mUcH` become `mAnY`. This is a conservative extension of the stated capitalization rule; the mixed-case behavior is covered by an invented case and mutation check.
- “Three words” is interpreted to require a word boundary before `how`; therefore `somehow much words` is not changed. The card does not spell out that boundary mechanically.
- A lone unmatched curly closing quote `”` is treated as unbalanced and causes KEEP. The card describes paired curly quotes but does not separately spell out the unmatched-closing case.
- Sentence fragments are trimmed for sentence processing; the repaired output is then joined with one space as required. A no-op KEEP preserves the original bytes/text exactly.
- The exact human-readable failure messages are not prescribed by the card. The implementation uses one plain sentence for each named error: `bad-input` and `too-long`.
- The fixture's failure examples omit `message`, despite the shared `EngineFailure` contract requiring it. The test validates the two fixture-specified fields and independently requires a non-empty message.
- Sentence boundaries are implemented exactly as specified: `.`, `!`, or `?` outside a quote, followed by a literal space or end of text. Newline alone is not treated as the required following space.
- No extra repair category, typo correction, synonym matching, or additional noun was added.

## 8. NOT RUN / NOT DONE / DOUBTS
- NOT RUN: integration inside the real AXON project. The builder prompt explicitly says the project files are not supplied and must not be requested or invented.
- NOT RUN: project-wide tests, Android/device tests, and Director-side integration checks. They are outside this isolated part card.
- NOT DONE: full multi-part ZIP, because only P01 was assigned.
- Scope note: the card says the part ZIP contains only its three listed code/test/fixture files. The user additionally required the ZIP to contain its report, so `REPORT.md` is included as a fourth file. This is an explicit deviation from the card's three-file-only ZIP rule; the three required deliverable files remain at their exact required paths.
- No unresolved test failures remain in the isolated suite. The Director should re-run the included test file and independently review the source before integration.
