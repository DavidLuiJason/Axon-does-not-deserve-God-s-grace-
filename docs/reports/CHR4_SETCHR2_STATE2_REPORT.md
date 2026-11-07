# CHR4, SETCHR2, STATE2 REPORT (Director, 2026-11-07)

WHAT: three small code pieces that SETCHR1 and STATE1 asked for. None has a caller yet; the screens and the lane wiring come later.
WHY REBUILT: the previous account hit its usage limit after writing them in a scratch folder and before packaging; that folder was not available, so each was written again from the repository files.

## Decisions made while building (each overrulable)
1. CHR4 is its own file, not part of `charterStore.ts`, so the Charter writer file stays untouched. Both new Charter files join `ALLOWED_WRITER_IMPORTERS` in `tests/charterStore.test.ts` (SETCHR1 named only the adapter; recovery needs the keys too).
2. Recovery only resets the Charter when the Charter itself is untrusted. A bad history alone is kept as one history entry and the signed Charter stays.
3. Recovery refuses (`storage-failed`) when the stored text cannot be read, because it could not be kept first.
4. "No extra rule" is written as `allowed`, not removed: `change.ts` treats a removal as narrowing, so removing a `never` rule would loosen without approval.
5. Approval lifetime is two minutes (SETCHR1 V5); used tokens live in memory for the session.
6. Screen text constants in code are PROPOSED; the owner's yes on the fixed notice line is still waiting.
7. Tool state: reset removes the key (STATE1 S8 default). Over 100,000 characters is refused, not cut. Measured in the test: 10 counters with a full 100-step undo history fit; 60 do not.

## Findings
- F4 (CHR5): first "ask" rule for a tool reads as a widening in `change.ts` (unlisted to ask), so the sheet would show the bold line wrongly.
- F5: if a remove fails during recovery, the broken Charter stays and one extra history entry stays; nothing is lost.
- F6: STATE4 F1 (date-calculator wrongly blocked) is still open; not touched here.

## Proof (measured on a copy of the repo)
- tests/toolStateStore.test.ts 43 checks, tests/charterRecovery.test.ts 41, tests/charterSettings.test.ts 43; existing charterStore (43), charterChange (22), charterView (1001), charterViewDirectorChecks (24) pass.
- strict tsc over the new files and the four test files: no output. `node tools/guard.mjs`: OK.
- 14 mutants (stale-preview check, token guards, AXON widening, recovery hash, expiry, replay, key removal, text kept, unreadable-store guard, write cap, read-back, wrong-tool gate, swallowed set failure) all failed a test.
- NOT RUN: `test:all` over the whole repo, the cloud build.
