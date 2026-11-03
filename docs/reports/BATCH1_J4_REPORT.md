# Batch 1 — J4 report: focus/subject crop by edge density

**Result:** BUILT; targeted test passed. Independent Director verdict remains pending.

**Files**
- Shared pixel contract: `src/tools/engines/images/pixelImage.ts`
- Engine: `src/tools/engines/images/focusCrop.ts`
- Test: `tests/batch1J4FocusCrop.test.ts`

**What it does**
- Computes a deterministic luminance edge map from central horizontal/vertical differences.
- Finds connected edge regions and selects the region with the greatest accumulated edge energy.
- Returns the tight rectangle around that region, with optional pixel margin, edge count, energy, threshold and a relative confidence measure.
- Returns `no-subject` instead of inventing a crop when the image contains no sufficiently strong connected edge region.

**Measured checks**
- `node run.mjs tests/batch1J4FocusCrop.test.ts` — PASS.
- Synthetic scene subject rectangle: detected box `{ x: 8, y: 5, width: 11, height: 10 }`, 64 edge pixels, confidence approximately `0.9623`.
- Isolated weak noise did not displace the connected subject; a blank scene returned `no-subject`.

**Important limits / interpretation**
- This is an edge-density heuristic, not semantic object recognition. It may select a high-detail background, text or another strong edge cluster instead of the intended subject.
- If multiple subjects exist, it selects the strongest connected edge component; it does not understand which subject the user means.
- Pixel contract cap is 4,000,000 pixels. This is a conservative memory safeguard, not a measured device-tier limit.

**Law check (FL11; laws touched)**
- FL1/FL3/FL9: pure image analysis is isolated from screen and brain layers.
- FL4: memory is bounded by the shared pixel contract; synthetic subject and no-subject cases are tested.
- FL7: output reports measured edge signals and does not claim semantic understanding.
- FL10/FL12: no catalogue, UI, registry or chat action changed.
- FL13: no phrase/pattern lists added.
- FL5/FL6/FL8/FL15/N3: dictionary, archives, export and original source untouched.

**NOT RUN:** real-photo subject benchmark, phone speed/memory, screen integration, full suite, app/cloud build, independent Director mutants.
