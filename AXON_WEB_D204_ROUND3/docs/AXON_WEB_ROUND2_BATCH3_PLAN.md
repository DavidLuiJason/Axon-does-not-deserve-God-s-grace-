# AXON Web — Round 2, Batch 3 Plan

**Work item:** Complete browser parity matrix and catalogue-group coverage.  
**Status:** Plan-first; implementation is limited to a typed evidence matrix, summary API, and tests.  
**Base:** Round 2 Batch 2 source return plus Batch 1's 117-function gateway catalogue.  
**Boundary:** Owner-authorised parallel lane. No Director handoff or verdict.

## 1. Purpose

Make the full 117-function browser catalogue auditable. For every function, distinguish:

1. Native owner browser host support.
2. BrowserController command-executor support.
3. AXON's current access status.
4. The evidence or reason for the status.

The matrix must include all catalogue groups and must not confuse a browser engine's general web-standard support with an AXON Web feature or command.

## 2. Scope

- Add a typed parity matrix derived from the canonical `BROWSER_FUNCTIONS` catalogue.
- Track `ownerHost`, `ownerCommand`, and `axonAccess` separately.
- Distinguish complete host support from partial host mechanisms.
- Add per-group counts and a summary function.
- Add tests proving all catalogue IDs appear exactly once, all groups reconcile, the 15 current executors are the only executor-complete IDs, and AXON remains blocked for every row.
- Produce a full 117-row Markdown matrix and implementation-priority grouping.

## 3. Explicit exclusions

- Do not claim the matrix implements the missing browser features.
- Do not grant AXON access to the owner browser or owner cookies.
- Do not build an AXON session, brain route, capability registration, Incognito, Stealth, VPN, credential manager, or sync service in this batch.
- Do not modify roadmap, NOW, MERGE_TAG, Director job board, package/dependency files, or unrelated AXON code.
- Do not choose WebView as the final engine; GeckoView comparison remains a separate measured task.

## 4. Acceptance gates

- Matrix covers all 117 catalogue IDs exactly once.
- All eight catalogue groups appear and group totals sum to 117.
- Owner command executor count is exactly 15, matching the Batch 2 controller.
- AXON enabled count remains zero.
- Partial native support is not counted as complete.
- Strict TypeScript check and matrix tests pass.
- Cumulative package includes Round 1 design, Round 2 Batch 1 and Batch 2 returns, Batch 3 matrix, and the complete merged source snapshot.
