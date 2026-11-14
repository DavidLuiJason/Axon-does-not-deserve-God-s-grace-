# SI3c IMAGE REGIONS (D47, 2026-11-12)
PLAIN: the reader treats pictures as pictures. For every image on screen it records where it is, how big, and the label the app itself gave it (if any). It never decides what a picture shows. planCrops() turns those regions into crop rectangles for a captured frame, so a later stage (SI5) can cut each picture out and hand it to whatever recognises images; the brain keeps its own picture references.
CHANGED: src/screen-intelligence/structure-reader.mjs (adds screen, imageRegions, listImageRegions, planCrops; nothing removed). NEW: tests/screen-image-regions.test.mjs.
STATUS: ISOLATED-TESTED on made-up screens. No pixels are read or stored here. Image recognition, OCR and the picture library are NOT BUILT (SI5, undecided).
INDEPENDENT OF SI3B: touches none of its files; the two zips can merge in either order.
