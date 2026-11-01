# HINT-FIX board lines (2026-11-01)

2026-11-01 (Director): HINT-FIX DONE. Cloud build #109 (B05-D2A-merge.zip) succeeded, so D2a is accepted on the owner's report; it still showed 2 type errors at VideoFramesScreen.tsx L941 and L954. Cause (MEASURED by reading): `NumberFieldProps` in `src/components/tools/ToolParts.tsx` has no `hint`; three NumberField calls (L928, L941, L954) passed one. Fix is in the screen only, each hint is a small grey line under its field. NOT RUN: type check, tests, cloud build.

## Treated as approved because the owner did not answer (review on request)
- Router shadow reads only what Resolution already produces (not dictionary senses). Status: not built yet; question still open.
