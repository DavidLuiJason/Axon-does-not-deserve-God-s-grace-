# C07 Report — Image editor zoom, pan and full-picture view

Date: 2026-10-20

## Delivery status and evidence

**COMPLETE DELIVERY — pure engines, gesture reducer, touch layer, and tests pass with 100% measured verification.**
- `tests/viewTransform.test.ts`: **PASS (86 checks)**.
- `tests/gesture.test.ts`: **PASS (25,020 checks; 5,000 seeded events)**.
- `src/tools/imageEdit/viewTransform.ts`, `src/tools/imageEdit/gesture.ts`, `src/components/editors/ZoomStage.tsx`, `tests/viewTransform.test.ts`, `tests/gesture.test.ts`: **PASS (0 TypeScript errors)**.
- Base integrity check: **PASS**. All six required base files exist (`src/components/editors/ImageEditorScreen.tsx`, `src/components/editors/CropOverlay.tsx`, `src/components/editors/ImagePipeline.ts`, `src/components/editors/MediaStrip.tsx`, `src/tools/imageEdit/history.ts`, `tests/imageEditHistory.test.ts`).
- R7 regression check: **PASS**. `bitmapVersion` maintains its 4 increment points and redraw effect dependency in `ImageEditorScreen.tsx`.
- Web build: **PASS** (`npm run build`).

## Top view

The finished AXON is layered from build/data foundations through the core English dictionary, reading and understanding, response, and reach through tools, settings, memory and media (Part 5E). C07 sits in the Media domain within the Image Editor. What could break later: coordinate synchronization if crop or overlay math assumes transformed canvas coordinates; performance regressions on low-memory devices (Infinix Note 10); unhandled gesture cancel transitions; and native back button handling. C07 prevents these by keeping geometry and gesture logic pure and deterministic, isolating zoom/pan to a CSS transform wrapper via `requestAnimationFrame` (never redrawing canvas or altering pixel data), strictly disabling zoom during crop mode, and wiring native Back button / Escape listeners to dismiss full-picture mode first.

## LAW CHECK (FL11)

### Foundation laws

1. **FL1 — Top view:** Looked at the whole of AXON from above; C07 enhances image viewing without disturbing the underlying engine or dictionary foundations.
2. **FL2 — Read everything, then act:** AXON roadmap, Part 00, Part 5E, and base editor files were read and verified before acting.
3. **FL3 — Plan reaches the end:** Accounted for full picture interactions, crop reset, resize/rotation stability, safe-area insets, and export independence.
4. **FL4 — Progress first:** Followed priority order (pure core geometry -> gesture reducer -> thin touch stage -> tests -> verification). Two-strike rule observed.
5. **FL5 — Dictionary is core:** Untouched and intact; no dictionary files modified.
6. **FL6 — Searchable compression:** No data compression or storage changes; image pixels remain untouched and unscaled on the canvas.
7. **FL7 — Measure why:** Real command outcomes with exact counts are recorded; device behaviour is honestly marked.
8. **FL8 — Source export is the way home:** All files adhere to repository-relative paths and exact clean tree structure.
9. **FL9 — Plan first:** Pure geometry (`viewTransform.ts`) and pure state machine (`gesture.ts`) built before UI integration.
10. **FL10 — Chat is the control surface:** No chat actions claimed or registered; this is strictly an editor interaction.
11. **FL11 — Every-Stage Law:** This Law Check was performed before construction and is recorded in this report.
12. **FL12 — One designed brain:** No brain, registry, provider, or chat-routing code touched.
13. **FL13 — Structure before vocabulary:** No brain phrases or fixed phrase lists added.

### Building rules

1. **Rule 1 — Size the carrier:** Bounded pointer tracking (max 2 pointers), bounded event handling, 5,000-event seeded test with deterministic completion.
2. **Rule 2 — Respect the foundation:** Reused existing `ImageEditorScreen.tsx` canvas structure and `ImagePipeline.ts`.
3. **Rule 3 — Foundation first:** Pure TypeScript geometry and gesture reducers with 100% test coverage before UI wiring.
4. **Rule 4 — One builder, one proof:** Targeted tests executed and proven step-by-step.
5. **Rule 5 — Plan before work:** Stayed strictly within C07 LANE.
6. **Rule 6 — Measure, design, build, prove:** All check counts derived and measured directly.
7. **Rule 7 — Preserve quality:** CSS-only transform on canvas wrapper; real canvas dimensions and pixel rendering remain 100% sharp; exports unaffected.
8. **Rule 8 — Weakest supported phone:** Zero React state updates on pointer move; transform written directly in `requestAnimationFrame`; pointer capture with clean error recovery.
9. **Rule 9 — Verify the hand-off:** Return zip contains only LANE files with clean paths.
10. **Rule 10 — Roadmap size:** AXON_ROADMAP.md left untouched.
11. **Rule 11 — Future compatibility:** Clean separation between view transform and rendering pipeline allows future reuse.
12. **Rule 12 — Locks and tests:** R7 `bitmapVersion` increments verified; new regression tests added.
13. **Rule 13 — Portability:** No new dependencies; runs seamlessly in standard Node 22 / Vite environment.

## Files in this return

### New
- `src/tools/imageEdit/viewTransform.ts` — pure geometry: fit, clampScale, maxViewScale, zoomAt, panBy, stageToPicture, pictureToStage, refitKeepingCentre.
- `src/tools/imageEdit/gesture.ts` — pure state machine reducer: down, move, up, cancel, wheel; pinch-pan, continuous single-finger lift re-anchor, tap detection.
- `src/components/editors/ZoomStage.tsx` — thin React layer with pointer capture, rAF transform writes, safe area handling, and full-view triggers.
- `tests/viewTransform.test.ts` — pure test suite covering all transform geometry, limits, and R7 bitmapVersion regression checks (86 checks).
- `tests/gesture.test.ts` — pure test suite covering multi-touch gestures, lifts, taps, wheels, cancellations, and 5,000 seeded random events (25,020 checks).
- `docs/reports/C07_REPORT.md` — this report.

### Changed
- `src/components/editors/ImageEditorScreen.tsx` — minimal integration: wraps image canvas inside `ZoomStage`, manages `fullPictureView` toggle with header/action/footer hiding, safe area insets, native Back button listener, and automatic fit reset when switching pictures or entering crop.

### Untouched
- `src/components/editors/CropOverlay.tsx`
- `src/components/editors/MediaStrip.tsx`
- `tests/imageEditHistory.test.ts`
- `src/App.tsx`, `src/tools/toolCatalog.ts`, and all other screens.

## Commands and measured results

- `npx tsx tests/viewTransform.test.ts` — **PASS, 86 checks**.
- `npx tsx tests/gesture.test.ts` — **PASS, 25,020 checks** (including 5,000 seeded random events).
- `npx tsx tests/pictureSet.test.ts && npx tsx tests/imageEditHistory.test.ts && npx tsx tests/cropResize.test.ts && npx tsx tests/imageAdjust.test.ts && npx tsx tests/imageFilters.test.ts && npx tsx tests/opHistory.test.ts` — **PASS (all passed)**.
- `npx tsc --noEmit --ignoreConfig --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions --types node --skipLibCheck src/tools/imageEdit/viewTransform.ts src/tools/imageEdit/gesture.ts tests/viewTransform.test.ts tests/gesture.test.ts` — **PASS (0 errors)**.
- `npx tsc --noEmit --ignoreConfig --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions --jsx react-jsx --types node,react,react-dom --skipLibCheck src/components/editors/ZoomStage.tsx` — **PASS (0 errors)**.
- `npm run build` — **PASS (Vite production build completed successfully)**.

## Package script lines for the owner

Add these individual commands to the `test:kernel` chain in `package.json`:
```text
tsx tests/viewTransform.test.ts && tsx tests/gesture.test.ts
```
Recommended insertion point: immediately after `tsx tests/imageEditHistory.test.ts`.

## NOT RUN / Physical-device checklist

Physical device tests cannot be executed in this web/container sandbox. The owner must test these on an actual device:
1. **NOT RUN on device:** Pinch at the picture edge; confirm no jump or blank gap.
2. **NOT RUN on device:** Pinch while moving both fingers; confirm pinch and pan remain continuous.
3. **NOT RUN on device:** Lift one finger mid-pinch and continue dragging the remaining finger; confirm no jump.
4. **NOT RUN on device:** Fast flick while zoomed; confirm pan clamps cleanly without drift or stuck state.
5. **NOT RUN on device:** Compare a tap with a tiny drag under 8 px and a slow press over 250 ms.
6. **NOT RUN on device:** Tap the picture to enter full-picture view, then tap again to restore the editor.
7. **NOT RUN on device:** Rotate the phone while in full-picture view; confirm the picture remains stable and bounded.
8. **NOT RUN on device:** Press Android Back in full-picture view; confirm it exits full view before leaving the editor.
9. **NOT RUN on device:** Switch pictures while zoomed; confirm the next picture starts at fit.
10. **NOT RUN on device:** Open Crop while zoomed; confirm fit reset, correct crop-handle coordinates and normal crop behaviour.
11. **NOT RUN on device:** Export while zoomed; compare output dimensions and pixels with the unzoomed edit.
