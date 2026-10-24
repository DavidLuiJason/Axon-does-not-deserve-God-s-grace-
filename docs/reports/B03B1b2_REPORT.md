# B03B1b2 — partial delivery

Status: PARTIAL. V22 repaired; speed target NOT MET. Two attempts at the performance defect did not pass; stopped under FL4.

## LAW CHECK (FL11)
- FL1–FL3: Scoped repair in the planned values reader, considering later meaning stages.
- FL4: Stopped after two unsuccessful speed attempts; no third fix.
- FL9: Repaired glued-duration handling using unit metadata, not a phrase exception.
- FL11: This check is repeated here.
- FL12: Changes remain inside the brain reader.
- FL13: No fixed phrase list added.
- FL14: Unit candidates come from `ctx.units`; no unit table copied.

## Evidence
- `node run.mjs tests/valuesRunner.test.ts --jobs a,b,d`: a 30/30, b 22/22, d 6/6; 1 hostile speed failure, 195613/195614 checks.
- `node run.mjs tests/valuesGuard.test.ts`: 20 checks passed.
- `node run.mjs tests/romanNumeral.test.ts`: 27641 checks passed.
- `tsc -p tsconfig.values.json`: clean.
- V22 `set 1h30m`: now one duration, 5400000 ms.
- Hostile timings measured separately in this sandbox (see below).

## Remaining issue
The `1 ` repeated 10000 times hostile case still exceeds 1500 ms. The unit index helps, but repeated scans remain costly. A separate owner-approved follow-up is required; no third fix attempted.
- Standalone hostile measurements: `"1 " × 10000` = 1285.1 ms; `"1/" × 10000` = 398.9 ms; `"1," × 9000` = 356.5 ms. These differ from the runner's failing 1878 ms because timings vary between runs.
