# AXON CODE: SCREEN READINESS (Director, updated 2026-11-12 after continuation 3)

For the screen Director (AI Studio). Written from AXON Code's own capability registry (`axon-code/docs/CAPABILITY_REGISTRY.json`, 42 capabilities) and its current `ui/index.html`. The Director that wrote this has NOT clicked any of it in a browser; nobody has. A screen may show a feature as working only when the registry says TESTED, and even then only the logic has been tested in Node.

## 1. What exists today
AXON Code already has a working workbench in plain HTML and JavaScript (`axon-code/ui/`): 25 buttons and 11 panels or dialogs. A new AI Studio screen REPLACES the look, not the logic. The logic tests find these element ids, so every id below must stay on the same kind of element, or tests fail.
BUTTONS: `openProjectButton` (Open / Import), `newProjectButton` (New Project), `settingsButton` (⋯), `newFileButton` (＋), `refreshButton` (↻), `importFilesButton` (Add files), `saveButton` (Save), `saveAllButton` (Save all), `renameButton` (Rename), `moveButton` (Move), `deleteButton` (Delete), `undoDeleteButton` (Undo delete), `clearEditorButton` (Clear), `selectAllButton` (Select all), `copyButton` (Copy), `cutButton` (Cut), `pasteButton` (Paste), `downloadButton` (Download), `shareButton` (Share), `previewButton` (Preview web), `exportButton` (Export), `paletteButton` (Command palette), `createProjectConfirm` (Create project), `createFileConfirm` (Create file), `exportConfirm` (Export).
PANELS AND DIALOGS: `outputPanel`, `problemsPanel`, `previewPanel`, `resourcesPanel`, `terminalPanel`, `capabilitiesPanel`, `projectDialog`, `newFileDialog`, `paletteDialog`, `exportDialog`, `infoDialog`.

## 2. Screens worth building for AXON Code (suggestion; the screen Director decides)
| Screen | Engine readiness | What the screen must do |
|---|---|---|
| Projects start (open, new, import zip, recent) | PARTIAL: durable workspace, journal and a file-backed store TESTED in Node; reload in a browser NOT RUN | real list; clear error state if storage fails |
| Workbench: file tree, tabs, editor | PARTIAL: editor packages wired; UI logic tested in Node with a DOM; browser mount NOT RUN | an "editor failed to load" state |
| File actions (new, rename, move, delete, undo, import, export, copy, cut, paste, share, download) | PARTIAL: planner and controls TESTED in Node; nothing clicked in a real browser | show refusals (name taken, unsafe name) as normal messages |
| Capability status (honesty screen) | READY: reads the real registry | table of TESTED / NOT RUN / BLOCKED with grade |
| Trust and approval sheet | READY: trust, redaction and the Brain gateway contract TESTED | the sheet AXON Brain requests appear on |
| Crash recovery dialog | PARTIAL: persistent jobs and kill-during-save recovery TESTED in Node | "restore unsaved work?" |
| Run and output (Python) | PARTIAL: Pyodide ran real Python in a Node worker (timeouts, output cap, isolation); a browser Worker NOT RUN | show "Python in the browser: not verified" |
| Problems (TypeScript diagnostics) | PARTIAL: diagnostics engine TESTED against 30 golden projects on TypeScript 5.8.3 | list of errors with file and line |
| Debug | PARTIAL: Node inspector adapter TESTED on a desktop host only | NOT AVAILABLE on a phone |
| Git | PARTIAL: real git, local only, hooks off, hostile repository configuration blocked; desktop host only | show BLOCKED with the reason when a repository is not trusted |
| Packages | PARTIAL: npm and pip adapters TESTED against local fixtures on a desktop host; no network | NOT AVAILABLE on a phone |
| Terminal panel | NOT READY on a phone: the hardened local bridge is for a desktop Linux host; Android host NOT RUN | show "No terminal host connected" |
| Preview, Android build, remote, extensions | NOT READY: work packages 8, 9, 11 and the rest of 13 not built | NOT AVAILABLE |

## 3. The rule for every screen
A button that does not work yet is shown disabled with the reason ("Not available yet"), never as if it worked. The status screen must read the registry, not hard-coded words. "TESTED" here means tested in Node on a desktop host; nobody has run any of it in a real browser or on a phone.

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
| git-local-repository-operations | TESTED | T1 |
| hardened-loopback-pty-bridge | TESTED | T1 |
| legacy-workbench-ui-regression | TESTED | T1 |
| linux-pty-provider | TESTED | T1 |
| node-inspector-debug-adapter | TESTED | T1 |
| npm-local-registry-package-manager | TESTED | T1 |
| persistent-jobs-and-crash-recovery | TESTED | T1 |
| pip-local-index-package-manager | TESTED | T2 |
| pyodide-node-worker-runtime | TESTED | T1 |
| pyodide-vendor-assets | TESTED | T1 |
| round12-node-regression | TESTED | T1 |
| storage-recovery-trust-approval-redaction | TESTED | T1 |
| typescript-project-diagnostics | TESTED | T1 |
| workbench-file-operations-and-editor-controls | TESTED | T1 |
| workspace-trust-and-secret-redaction | TESTED | T1 |
| android-capacitor-provider | NOT RUN | T3 |
| android-native-host | NOT RUN | T3 |
| android-webview-storage-recovery | NOT RUN | T3 |
| browser-indexeddb-persistence | NOT RUN | T2 |
| browser-indexeddb-quota-pressure | NOT RUN | T2 |
| codemirror6-android-performance | NOT RUN | T3 |
| codemirror6-xtermjs-browser-mount | NOT RUN | T1 |
| indexeddb-job-recovery | NOT RUN | UNSPECIFIED |
| indexeddb-reload-persistence | NOT RUN | UNSPECIFIED |
| pyodide-browser-worker-runtime | NOT RUN | T1 |
| pyodide-runtime-execution | NOT RUN | T1 |
| typescript-current-version-compatibility | NOT RUN | T1 |
| workbench-browser-live-ui-acceptance | NOT RUN | T1 |
| codemirror6-xtermjs-workbench | BLOCKED | T3 |
| director-verification | BLOCKED | T1 |
| npm-managed-package-execution | BLOCKED | T1 |
| pip-managed-package-execution | BLOCKED | T2 |
| pyodide-cpython-wasm-worker | BLOCKED | MIXED |
| reproducible-clean-install | BLOCKED | T1 |
| typescript-language-server | BLOCKED | T1 |
