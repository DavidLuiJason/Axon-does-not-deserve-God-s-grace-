# AXON CODE: SCREEN READINESS (Director, 2026-11-12)

For the screen Director (AI Studio). Written from AXON Code's own capability registry (`axon-code/docs/CAPABILITY_REGISTRY.json`, 27 capabilities) and its current `ui/index.html`. The Director that wrote this has NOT clicked any of it in a browser; nobody has. A screen may show a feature as working only when the registry says TESTED, and even then only the logic has been tested in Node.

## 1. What exists today
AXON Code already has a working workbench in plain HTML and JavaScript (`axon-code/ui/`): 25 buttons and 11 panels or dialogs. A new AI Studio screen REPLACES the look, not the logic. The logic tests find these element ids, so every id below must stay on the same kind of element, or tests fail.
BUTTONS: `openProjectButton` (Open / Import), `newProjectButton` (New Project), `settingsButton` (⋯), `newFileButton` (＋), `refreshButton` (↻), `importFilesButton` (Add files), `saveButton` (Save), `saveAllButton` (Save all), `renameButton` (Rename), `moveButton` (Move), `deleteButton` (Delete), `undoDeleteButton` (Undo delete), `clearEditorButton` (Clear), `selectAllButton` (Select all), `copyButton` (Copy), `cutButton` (Cut), `pasteButton` (Paste), `downloadButton` (Download), `shareButton` (Share), `previewButton` (Preview web), `exportButton` (Export), `paletteButton` (Command palette), `createProjectConfirm` (Create project), `createFileConfirm` (Create file), `exportConfirm` (Export).
PANELS AND DIALOGS: `outputPanel`, `problemsPanel`, `previewPanel`, `resourcesPanel`, `terminalPanel`, `capabilitiesPanel`, `projectDialog`, `newFileDialog`, `paletteDialog`, `exportDialog`, `infoDialog`.

## 2. Screens worth building for AXON Code (suggestion; the screen Director decides)
| Screen | Engine readiness | What the screen must do |
|---|---|---|
| Projects start (open, new, import zip, recent) | PARTIAL: durable workspace and journal TESTED; reload in a browser NOT RUN | real list; show a clear error state if storage fails |
| Workbench: file tree, tabs, editor | PARTIAL: editor packages wired and TESTED as files; browser mount NOT RUN | design an "editor failed to load" state |
| File actions (new, rename, move, delete, undo, import, export, copy, cut, paste, share, download) | PARTIAL: rename/move planner and controls TESTED in Node; nothing clicked in a browser | show refusals (name taken, unsafe name) as normal messages |
| Capability status (honesty screen) | READY: reads the real registry | table of capabilities with TESTED / NOT RUN / BLOCKED and isolation grade |
| Trust and approval sheet (Restricted by default, one approval per request) | READY: trust, redaction and the Brain gateway contract TESTED | the sheet AXON Brain requests appear on |
| Crash recovery dialog | PARTIAL: persistent jobs TESTED; IndexedDB recovery NOT RUN | "restore unsaved work?" |
| Terminal panel | NOT READY on a phone: the hardened local bridge is TESTED for a desktop Linux host only; Android host NOT RUN | show "No terminal host connected" |
| Run and output (Python, JavaScript) | NOT READY: Pyodide files TESTED, Python execution NOT RUN | show "Not available yet" |
| Problems, Debug, Git, Packages, Preview | NOT READY: work packages 6, 10, 11, 13 not built | show NOT AVAILABLE, not an empty working-looking screen |

## 3. The rule for every screen
A button that does not work yet is shown disabled with the reason ("Not available yet"), never as if it worked. The status screen must read the registry, not hard-coded words.

## 4. Registry snapshot (what a screen may rely on)
| Capability | Status | Grade |
|---|---|---|
| android-and-editor-host-contracts | TESTED | T1 |
| axon-code-brain-gateway-contract | TESTED | T1 |
| chromium-browser-verification | TESTED | UNSPECIFIED |
| codemirror6-xtermjs-package-wiring | TESTED | T1 |
| dependency-and-pty-regression | TESTED | T1 |
| durable-workspace-and-transaction-journal | TESTED | T1 |
| full-retained-node-regression | TESTED | T1 |
| hardened-loopback-pty-bridge | TESTED | T1 |
| legacy-workbench-ui-regression | TESTED | T1 |
| linux-pty-provider | TESTED | T1 |
| persistent-jobs-and-crash-recovery | TESTED | T1 |
| pyodide-vendor-assets | TESTED | T1 |
| round12-node-regression | TESTED | T1 |
| workbench-file-operations-and-editor-controls | TESTED | T1 |
| workspace-trust-and-secret-redaction | TESTED | T1 |
| android-capacitor-provider | NOT RUN | T3 |
| android-native-host | NOT RUN | T3 |
| codemirror6-android-performance | NOT RUN | T3 |
| codemirror6-xtermjs-browser-mount | NOT RUN | T1 |
| indexeddb-job-recovery | NOT RUN | UNSPECIFIED |
| indexeddb-reload-persistence | NOT RUN | UNSPECIFIED |
| pyodide-runtime-execution | NOT RUN | T1 |
| typescript-current-version-compatibility | NOT RUN | T1 |
| codemirror6-xtermjs-workbench | BLOCKED | T3 |
| director-verification | BLOCKED | T1 |
| pyodide-cpython-wasm-worker | BLOCKED | MIXED |
| reproducible-clean-install | BLOCKED | T1 |
