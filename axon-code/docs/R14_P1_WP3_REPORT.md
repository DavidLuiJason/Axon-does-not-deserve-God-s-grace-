# Round 14 Continuation 3 — P1 / WP3 Real UI Tests

## Package verdict

**State: DONE for Node-provable P1 controls. Overall WP3 remains PARTIAL because live Chromium browser acceptance is NOT RUN.**

The test loads the real `ui/workbench.js` into jsdom, mounts the real CodeMirror 6 `EditorView` imported from Vendor Pack V2, and uses `fake-indexeddb` as the actual IndexedDB implementation behind the UI's project store. It drives the actual DOM controls and verifies stored project/file records.

### Acceptance actions exercised

New project; open project; import files; edit; save; save all; reopen a project/file; export; rename; move; delete; undo delete; clear; select all; copy; cut; paste; share; download.

### Failure cases exercised

- Stale save conflict: a newer external revision is preserved; the stale editor save is refused.
- Delete of a missing file: the command reports failure and does not recreate the record.
- Rename onto an existing destination: the operation is refused and neither source nor destination is overwritten.
- Additional negative coverage: unsafe/binary/oversize imports, clipboard denial, cancelled clear, denied dirty-project switch, oversize save.

## Test evidence

| Measure | Result |
|---|---:|
| Targeted P1 tests | 29 |
| Passed | 29 |
| Failed | 0 |
| Skipped | 0 |
| Negative tests | 21 |
| Real compiled-module mutants caught | 2 |

Both mutant tests create temporary modified copies of the real compiled `dist/workbench/fileOperations.js`: one removes the case-collision check; the other removes the unsupported-operation guard. The unmodified production module refuses the corresponding bad input.

## FAKE_BOUNDARY items

- jsdom dialog `showModal` / `close` presentation.
- File picker / `FileList` injection.
- Clipboard read/write permission API.
- Native share sheet.
- Anchor click/download navigation. The project serializer and resulting Blob are real and inspected; only navigation is intercepted.
- xterm drawing and `ResizeObserver`. Terminal painting is outside P1 and was not represented as tested.

These are narrow test boundaries. The workbench command handlers, CodeMirror document, serializers, and IndexedDB records are real.

## BLOCKED / NOT RUN

**Live Chromium browser acceptance: NOT RUN.** jsdom does not prove Chromium rendering, actual browser-native picker/clipboard/share/download behaviour, or xterm painting. The real browser capability remains `NOT RUN` in the derived registry. No phone/device result is claimed.

## Commands and counts

1. `npm run build` — exit 0.
2. `node --test tests/r14-wp03-control-wiring.test.mjs tests/r14-wp03-file-operations.test.mjs tests/r14-wp03-file-operations-director.test.mjs` — exit 0; 29/29 passed; 0 failed; 0 skipped; 21 negative; two real mutants caught.
3. `npm run build` — exit 0.
4. `node --test tests/*.test.mjs` — exit 0; 1,147/1,147 passed; 0 failed; 0 skipped.

The required pre-change baseline was also reproduced on the clean Director base with Vendor Pack V2: `npm run build` exit 0, then `node --test tests/*.test.mjs`: 1,147/1,147 passed, 0 failed, 0 skipped. After P1, the full count remains 1,147/1,147.

## Replaced files and base hashes

See `BASE_HASHES.txt` at the delta root. It records SHA-256 values from the exact `AXON_CODE_R14_DIRECTOR_BASE.zip` for every replaced file. Added files have no base hash.

## Capability registry

Regenerated only from `results/*.json` using `node tools/derive-capability-status.mjs`. The registry contains 28 capability rows derived from 175 result records. The Node workbench UI capability is `TESTED`; live browser acceptance is `NOT RUN`.

## Deviations

No import-map changes. No package or dependency changes. No AXON main-app or other workstream files changed. The UI's save path gained an atomic revision check so a stale buffer cannot overwrite a newer stored file. Missing-file delete now reports an explicit failure.

## Closing — what this prompt missed

The prompt did not define whether jsdom-only UI acceptance could close WP3. This package therefore marks the Node-provable P1 control work complete while retaining overall WP3 as `PARTIAL` until real Chromium/browser acceptance is independently run.
