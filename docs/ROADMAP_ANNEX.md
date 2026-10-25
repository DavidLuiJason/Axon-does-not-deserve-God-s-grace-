# ROADMAP ANNEX (rebuilt 2026-10-24; the earlier version was lost with the first account). The roadmap points here for long texts.

## A1. My Dictionary as a CHECKED source (owner, 2026-10-23)
- Any size of list may be imported (chunked import, a report, and an undo copy).
- It is shown with a My Dictionary icon and a note.
- The brain uses it as a SECOND source; the core dictionary is never rewritten (UD1).
- Every import is checked FIRST by an outside AI tool.
- Nothing is added until the owner says yes.
- NOTE: only these points survive from the roadmap text; if the owner remembers more detail from the original A1, add it here.

## A4. Not possible honestly yet (named in roadmap 8.3)
Web Search, Link Analyzer, Content Extractor, Currency Converter (need a network layer, key storage SK0, permissions); Translator, Rephraser, Grammar Helper (need a model); PDF Tools (needs a measured library); AI Assistant (the brain itself).

## Parked plan item (owner, 2026-10-24; plan and owner approval first)
AXON Build screen: keep the look exactly (dropdown, green dot, mark as confirmed). Make the content accurate: tools, capabilities, interfaces and systems as separate groups (tools have a screen, e.g. Text Counter, File Compare; systems are hidden working parts). An interface opens to its own buttons, each markable as confirmed; the interface gets its green dot when all its buttons are confirmed. Do this after B03B.

## A6. Moved out of the roadmap on 2026-10-25 (v18.0), nothing dropped
The v17.9 roadmap is saved whole as `docs/archive/AXON_ROADMAP_V17_9.md`. Shortened in v18.0: the truth gates, Council, lanes, hands and growth paragraph (full text stays in `docs/AXON_VISION.md`); the B03B part list (full text in `docs/B03B_PLAN.md` and the board); the old repository-status detail (board); the 2026-10-24 owner rules text (kept, reworded). Binding as before.

## A7. Closing cleanup, full text (moved out of roadmap 11 on 2026-10-25, v18.1; binding as before)
Stage Z, after the brain and AXON Code are proven: remove what is dead. Never a bulk delete, never by name pattern (`docs/prompts/` looks like clutter but holds live prompts): (1) the Director lists candidates from EVIDENCE (reachability scan from `src/main.tsx` and the tests; stale copies such as the root `AXON_ROADMAP.md`; unused assets, dependencies, tests, prompts) in `docs/CLEANUP_CANDIDATES.md` with reason and proof; (2) the owner approves; (3) removal runs with `node tools/guard.mjs --forget PATH`; (4) cloud build, all tests and export-equals-repository pass before and after; APK size recorded. Never removed: the dictionary, licence and credit files, the laws, anything the owner names.
