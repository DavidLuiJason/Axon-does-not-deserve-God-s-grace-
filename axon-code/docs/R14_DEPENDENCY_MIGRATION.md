# Round 14 dependency and engine migration

## Scope
This migration keeps AXON Code independent of the AXON main application and does not change the native Android app.

## Dependency changes
- `typescript` moved from `devDependencies` to exact `dependencies` pin `5.8.3`, as required by C1.
- The vendor pack's exact direct packages were added to `dependencies`: CodeMirror 6 (`@codemirror/state` 6.7.6, `@codemirror/view` 6.43.15, `@codemirror/commands` 6.11.1, `@codemirror/language` 6.13.1, `@codemirror/lang-javascript` 6.2.5), xterm.js (`@xterm/xterm` 6.0.0, `@xterm/addon-fit` 0.11.0), and Pyodide 314.0.7.
- The vendor pack's complete transitive lock entries, registry URLs and integrity hashes were copied without changing package versions.
- TypeScript's lock entry still has no verified integrity hash. No hash was invented. Clean `npm ci` therefore remains BLOCKED until the exact registry artifact/integrity is available.

## UI integration
- `ui/engineBootstrap.js` loads the real CodeMirror 6 and xterm.js adapters.
- `ui/engines.js` mounts `EditorView` and `Terminal`/`FitAddon`; there is no runtime fallback to the textarea or a simulated shell.
- The hidden textarea remains only as a compatibility buffer for legacy workbench storage and event handlers.
- The xterm adapter accepts only a `ws://127.0.0.1:<port>/session` bridge endpoint, adds the single-use token, and forwards PTY data/resize messages using the existing provider protocol.
- The bridge must be started by a trusted host via `window.axonCodeHost.startTerminal`; the browser cannot spawn the desktop Linux service by itself.

## Pyodide asset contract
The required asset name was corrected from `pyodide.asm.js` to `pyodide.asm.mjs` to match the actual supplied Pyodide 314.0.7 package. The real package also supplies `pyodide.js`, `pyodide.asm.wasm`, `python_stdlib.zip`, and `pyodide-lock.json`. This verifies asset availability only; CPython execution in a browser Worker has not been run in Chromium or Android WebView.

## Compatibility and rollback
- Existing project files and historical tests are retained. The Round 14 WP0 tests now assert the mandated production dependency location.
- The previous browser workbench's storage/project workflow remains tested with its existing test-only IndexedDB shim. This does not prove the real CodeMirror/xterm browser mount.
- Rollback: restore the prior `package.json`, `package-lock.json`, `ui/index.html`, `ui/workbench.js`, `ui/workbench.css`, and remove the new `ui/engineBootstrap.js`, `ui/engines.js`, `ui/terminalEndpoint.js`, plus the two new WP3/WP4 tests. No project data format migration was made.
