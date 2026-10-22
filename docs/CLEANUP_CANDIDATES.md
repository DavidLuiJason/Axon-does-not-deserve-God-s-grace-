# CLEANUP CANDIDATES (running list; ADD only, never delete a line; used by the closing cleanup, roadmap section 11)

Nothing here is removed now. Every line is a CANDIDATE with evidence; before removal the Director proves it with a reachability scan from src/main.tsx and the tests, the owner approves the list, and removal runs in a shell with `node tools/guard.mjs --forget PATH`. Never removed: the dictionary, licence and credit files, the laws.

| Candidate | Evidence (MEASURED in the 2026-10-20 export) | Status |
|---|---|---|
| AXON_ROADMAP.md at the repository root | 153,619 bytes; the roadmap itself calls it a stale v14.4 copy; the live copy is docs/ROADMAP.md | candidate |
| STAGE6_*_REPORT.md at the root (8 files, about 60 KB) | old stage reports; their results live on the board and in the handbook | candidate, check nothing reads them |
| axon-guard-v2.zip at the root | 5,386 bytes; a delivery package, not source | candidate |
| README.md | 14 bytes, no content | candidate (replace or remove) |
| docs/archive/AXON_ROADMAP_V16_2.md and V16_3.md | 39,817 and 36,034 bytes; history only | candidate (keep V15_1: tests/roadmapSize.test.ts requires it) |
| src/components/editors/AudioEditorScreen.tsx and VideoEditorScreen.tsx | 996-byte placeholders; audio and video are LEFT OUT | keep until the owner decides |
| src/capabilities/registerPlanned.ts and registerPlannedMedia.ts | register planned-only entries | check after the tools finish |
| docs/prompts/* for finished jobs | prompt files of jobs already merged | candidate at the end |
| duplicated or superseded tests | none identified yet | scan at the end |
| tools/video-probe.html | one-time measurement tool for the video jobs | candidate once V1 results are recorded on the board |
