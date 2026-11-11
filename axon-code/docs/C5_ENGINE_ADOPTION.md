# C5 — Fixed editor and terminal engine decision

## Locked architectural choices

- Source editor: **CodeMirror 6** (not Monaco).
- Terminal emulator: **xterm.js** with the fit addon.
- No plain-textarea fallback is accepted as the final editor engine.
- No page-based terminal imitation is accepted as a terminal engine.

## Implemented in this checkpoint

- `src/workbench/editorEngineContracts.ts` defines the strict host adapter contracts for CodeMirror 6 and xterm.js.
- The contract rejects a missing CodeMirror mount function and rejects an xterm integration without terminal creation and fit support.
- `tests/r14-wp03-editor-engine-contract.test.mjs` exercises both successful adapter shape and refusal paths.

## Why C5 is not marked complete

The CodeMirror and xterm packages are not installed in `node_modules` or the npm cache. The environment cannot resolve `registry.npmjs.org` (`curl` returned `Could not resolve host: registry.npmjs.org`). Without retrieving the actual package tarballs, checking their metadata, and generating lock entries with verified integrity hashes, adding guessed version/hash values would create false reproducibility. The current UI still contains the Round 12 textarea and has not been migrated to CodeMirror; the visible terminal is still honestly marked host-required. The real xterm terminal UI is not connected.

**Status: BLOCKED for dependency acquisition and UI integration; adapter contracts BUILT and TESTED.** No Monaco dependency has been introduced.

## Required next action when registry access returns

1. Resolve and pin exact CodeMirror 6 packages and `@xterm/xterm` plus `@xterm/addon-fit`.
2. Generate and commit the complete package lock with package integrity values.
3. Install from a clean extraction using `npm ci`.
4. Integrate CodeMirror with document buffers, dirty state, save/reopen and keyboard/touch actions.
5. Connect the hardened PTY WebSocket bridge to xterm, including resize, streaming, signal/exit and reconnect.
6. Run the desktop Chromium interaction suite. Physical Android performance remains NOT RUN until a target device is available.
