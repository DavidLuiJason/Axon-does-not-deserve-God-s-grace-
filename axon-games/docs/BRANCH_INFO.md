# Branch handoff

Proposed review branch: `games-lab/expanded-games`

This ZIP is the branch source snapshot. It is not an AXON app build and does not claim Games Lab is already built into AXON. Claude should review this package as a separate implant candidate, inspect all source and tests, and approve/revise before AXON integration.

Start: `npm test` (includes 7,695-round simulated player playthrough coverage)
Standalone preview: serve this directory over localhost and open `index.html` (ES modules require a local web server in browsers that restrict `file://`).

See `docs/restart/BATCH_07_REPORT.md` for additions, test evidence, and limitations.
