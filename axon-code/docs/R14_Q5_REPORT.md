# Q5 — Integration and Screen Contract

**State:** TESTED. **Tests:** 5/5. **Negative tests:** 2. **Real compiled-module mutant:** YES — removing the approval project/workspace binding was caught.

**Implemented:** `docs/AXON_CODE_APP_INTEGRATION.md` documents all nine gateway operations, request examples, approval flow, statuses, lifecycle, error codes and capability mapping. Every example was executed against the real gateway; the job lifecycle example used a real allowlisted Linux child process for pause/resume/cancel. `docs/AXON_CODE_SCREEN_CONTRACT.json` enumerates all current UI element IDs, commands, capability IDs and state rules; tests compare every ID with the source and built HTML.

**Hostile cases:** approval replay, modified request payload, approval scope mismatch and screen-command element references.

**OPEN:** the exact AXON Tools screen-routing capability ID and AXON-side background dispatcher ID are not in the AXON Code source and are left OPEN for the relevant Directors. Project inspect and workspace export still return BLOCKED when no provider is configured.
