# A09: Image editor view fix (centered full-size picture, tap-for-full-picture in every panel, pinch zoom)

WHO THIS IS FOR: Google AI Studio (the screen builder).
WHAT THIS DOES: Fixes three faults the owner saw on the phone in the Image editor: (1) the picture does not fill and centre itself in the space it should occupy, it hangs in the top-left corner; (2) while Adjust or Filters is open, tapping the picture does not show it big; (3) pinch-to-zoom does nothing.
WHAT YOU DO: Start a NEW AI Studio project by importing the GitHub repository (or upload BASE.zip: the repository downloaded with Code, Download ZIP, after the C07 merge). Paste the whole text of this file as your message. When finished, export the project zip and give it together with the BASE zip you started from to Claude (the Director). Never push from AI Studio.
WHAT TO BRING BACK: the exported zip, AI Studio's own list of files created and changed, and the MEASUREMENT TABLE from step 1 (before and after).

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## DIRECTOR'S TOP-VIEW ANALYSIS (read it; it is why this job is shaped as it is)

This is the SECOND round on this area (round 1: the redraw fix R7 and the zoom job C07). The Two-Strike Rule therefore applies: do NOT guess a third fix. First MEASURE, then fix the layer the numbers point to. The pure engines `src/tools/imageEdit/viewTransform.ts` and `gesture.ts` are proven by tests (3,000-round pinch simulation, zero out-of-bounds). The fault is therefore very likely in the React layer that feeds them: `src/components/editors/ZoomStage.tsx` and the way `ImageEditorScreen.tsx` places it. Facts the Director measured by reading the code:
- `ZoomStage` draws the picture as a box of the picture's own pixel size at left 0, top 0, and moves it with `translate3d(tx,ty) scale(fit*scale)`. If the stage's measured size is ever 0 or wrong, `writeTransform` writes nothing (or the wrong thing) and the picture sits UNSCALED at the top-left corner. That is exactly what the owner sees.
- The stage is `w-full h-full` inside a wrapper that is `w-full h-full flex flex-col items-center justify-center`, inside a work area that is `flex-1 min-h-0 ... p-4` (or `fixed inset-0` in full-picture view). A chain of percentage heights inside flex boxes is not a definite size in every browser and WebView. HYPOTHESIS H1: the stage is measured at a wrong size, or at 0 first, and later changes are missed.
- In Adjust and Filters the screen swaps the main canvas for a preview canvas (`isPreviewActive`). HYPOTHESIS H2: the preview canvas does not have the same box as the main canvas, so the picture is wrong or invisible in full view, and `resetKey` (which includes `bitmapVersion`) re-fits on every change.
- Pointer events are handled on the stage with pointer capture and `touch-action: none`. HYPOTHESIS H3: the stage is not the element that actually receives the second finger on the phone (another element on top, or the stage sized smaller than what is drawn), so a pinch never reaches the reducer.
These are hypotheses, not facts (FL7: assume neither side). The numbers decide.

## JOB A09

FILES THAT MUST EXIST (stop and say which is missing): src/components/editors/ZoomStage.tsx, src/components/editors/ImageEditorScreen.tsx, src/components/editors/CropOverlay.tsx, src/components/editors/MediaStrip.tsx, src/tools/imageEdit/viewTransform.ts, src/tools/imageEdit/gesture.ts, src/tools/imageEdit/pictureSet.ts.

STEP 1: MEASURE (no fix yet). Add a TEMPORARY readout, behind one constant `DEBUG_VIEW = true` at the top of ZoomStage.tsx, drawn as a small box in a corner of the stage, showing: stage width and height (as the observer measured them), picture width and height, fit scale, view scale, tx, ty, the number of active pointers, and the last gesture mode. Open a picture in the preview and fill in this table with the real numbers (use the browser's touch emulation and the console if you must):
| Situation | stage w x h | picture w x h | fit | scale | tx, ty | looks centred and full? |
(a) picture just opened, no panel; (b) tap the picture once (full-picture view) and tap again (back); (c) Adjust open: tap the picture; (d) Filters open, choose a filter, tap the picture; (e) after rotating the preview to landscape and back, if the preview can; (f) after Resize or Crop was applied and the picture changed size.
Also measure the real on-screen rectangle of the stage element and of the drawn canvas (getBoundingClientRect) in each situation; they must match what the readout believes. Write down which of H1, H2, H3 the numbers support, or a different cause. If the preview cannot dispatch two-finger touches, dispatch synthetic PointerEvents with two different pointerIds from a script to prove the stage's handlers run, and say plainly that a real two-finger test was NOT RUN.

STEP 2: FIX THE LAYER THE NUMBERS POINT TO. Whatever the cause, the finished behaviour must be:
1. The picture, at its smallest, is the largest size that fits inside the space the editor gives it ("contain": whole picture visible, aspect kept) and is centred in it both ways. Never in a corner, never cut off, never left at its natural pixel size.
2. The stage gets a DEFINITE box that does not depend on percentage heights through flex parents: the recommended shape is a work area that is `relative` with `min-h-0`, and the ZoomStage root as `absolute inset-0` inside it (in full-picture view the work area is the fixed full-screen box and the stage fills it the same way). You may choose another shape if the measurements justify it; say why.
3. Until the stage has a valid measured size, the picture is hidden (visibility hidden), never shown unscaled in the corner. When the size is valid the picture is fitted at once, before first paint of the picture. Every later size change (panel opens or closes, full-picture view on or off, phone rotated, keyboard) keeps the picture contained and centred if it was at fit, and keeps the centre point if it was zoomed.
4. TAP FOR FULL PICTURE works in EVERY panel except Crop: with nothing open, with Adjust open, with Filters open (also right after choosing a different filter or moving a slider). One tap on the picture shows the whole picture as large as the screen allows (fixed full-screen, safe-area padding, the preview canvas and the main canvas both obey it); a second tap, or the Android Back button, returns. In full view the picture shows what the owner is working on (the preview when Adjust or Filters is active), and it must look sharp, not blurry or tiny.
5. PINCH ZOOM with two fingers zooms around the fingers' midpoint up to the engine's maximum and back down to fit; one finger drags the picture only when zoomed in; releasing never makes the picture jump; a tap must not fire after a pinch or a drag. Do not change the gesture rules in `gesture.ts` or `viewTransform.ts`.
6. Choosing a filter or moving an Adjust slider must NOT reset the zoom the owner set; only opening a different picture, or a change of the picture's own size (crop, resize, rotate), re-fits. (Look at `resetKey` and decide with the numbers.)
7. Crop mode is unchanged (zoom off, as today).
8. Remove the DEBUG_VIEW readout and constant when the table shows the fix works, or leave the constant false and say so. Nothing temporary may remain on screen.

LANE (the only files you may touch): CHANGED src/components/editors/ZoomStage.tsx, src/components/editors/ImageEditorScreen.tsx (layout and zoom wiring only; do not change editing behaviour, history, export or the picture set). If CropOverlay.tsx or MediaStrip.tsx must change for the layout, change the minimum and say why. FORBIDDEN: src/tools/imageEdit/** (the proven engines): if you believe an engine is wrong, STOP and report the measured numbers that show it.

TWO-STRIKE RULE FOR THIS JOB: if a symptom is still there after your second attempt, stop, write which layer and which assumption failed with the numbers, and return what you have. Do not try a third fix.

DONE MEANS: the measurement table filled in for before and after; for each of situations (a) to (f) the picture is contained and centred in the stage; tap-for-full works in no-panel, Adjust and Filters (including after changing a filter) and returns; a synthetic or real two-pointer pinch changes the view scale and a lift does not jump; undo, redo, crop, resize, adjust, filters, save and adding or removing pictures still work as before (try each once); no console errors. Your report lists what you did NOT try (real two-finger touch on a phone, if so) and the owner will test on the Infinix Note 10.

## STANDING RULES FOR GOOGLE AI STUDIO (apply to every step)

PROJECT RULES (pasted once per project): never delete, rename, move or shorten a file unless this prompt names it. Never touch `.github`, `tools`, `public/dictionary`, `.gitignore`, `.nvmrc`, `package.json`, `package-lock.json`, or anything under `tests/` unless this prompt names it (the Director updates the tests). List every file you created, changed or deleted at the end. If the project has FEWER files than at the start, stop and say so. NEVER push to GitHub; the owner exports a zip instead.

LANE: change or create ONLY the files named in the LANE section of the job. If you believe another file must change, STOP and say which and why instead of changing it.

WHAT YOU ARE: the screen builder. The engines (pure logic) already exist and are tested; the screens call them directly and NEVER re-implement, copy or "improve" engine logic. First READ each engine's exported API, limit constants and types (the file paths are in the job) and use exactly what is there. If an engine's real API differs from this prompt's description, follow the engine and mention the difference in your report. Never add words or phrases to the brain.

LOOK (the owner's design philosophy, binding on every screen): simple, clear, organised, professional. A person must understand the screen at a glance: what it does, what they can do, where to go next. Show the few main controls first; put everything else behind ONE quiet "Options" row (progressive disclosure). No floods of text, no long lists, no boxed cards, no per-row "Coming soon" badges. A pretty screen that is hard to read is a failed screen. Reuse what exists: `src/components/ScreenHeader.tsx` (the header band; the back row sits UNDER the band), and the look of `src/components/TextCounterScreen.tsx`, `ConverterScreen.tsx` and `DictionaryScreen.tsx`. Same colours (#ECECEC text on the dark calm background), same fonts, lucide icons only; add no colours, fonts or icon sets. Mark anything by symbol or text as well as colour (for example + and - for added and removed). Tap targets at least 44 px. Use sentence case for labels, short verbs on buttons. Do not restyle the Source, Build or Interface Capture screens.

EVERY CONTROL REALLY WORKS: no placeholder buttons, no fake results, no "TODO". Every error is a plain honest line. Empty states say what to do in one short line. Inputs are limited by the engine's own limit constants, with a plain message when a limit is hit. Long work must not freeze the phone (the weakest phone is an Infinix Note 10): chunk it or show progress. Release canvases, object URLs and large buffers when done.

CHAT HONESTY: nothing on a screen says or implies that AXON's chat can run the tool (the chat gets this ability only when the brain's Resolution stage exists).

PROOF BEFORE YOU REPORT: run the app preview, open EVERY screen you built from the Tools menu, try the normal case, an empty case, a bad-input case and a very large input, and fix anything that breaks. Check the browser console for errors and fix them. Your report says, per screen, what you tried and what you saw, and anything that does NOT work. Never write "works" for something you did not try.

RETURN: when finished, list the files created and changed. The owner will export the project zip and give it, together with the base zip, to the Director, who compares them and builds the delta.
