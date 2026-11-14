# D321-FIX5 board lines (owner appends; no shared ledger file and not DIRECTOR_NAP.txt is touched)

WHAT: cloud run #224: Gradle :app:compileDebugJavaWithJavac, 10 errors "cannot find symbol" in BrowserActivity.java (androidx.webkit ProfileStore, WebViewCompat, WebViewFeature), and three failing tests: meaningNoPhrases, mindPipeline, valuesGuard.

CAUSES (MEASURED on the repository zip of 2026-11-14):
1. The WebKit dependency block (androidx.webkit:webkit:1.12.1, the owner-approved Multi-Profile API) was missing from scripts/apply-android-overlay.sh. The script in the repository is a version that has the screen structure reader, ML Kit and AXON Apps lines (written by the Screen/Apps lane) but not the WebKit lines (written by the Web lane): two lanes rewrote the same shared file from different snapshots and each copy dropped the other's lines. Without the dependency, Gradle finds only an old androidx.webkit pulled in by Capacitor, so those classes do not exist. Third time this file lost lines (FIX3: screen structure; FIX4 landed; now WebKit).
2. src/brain/mind/external/external.ts line 73 had one regex literal (/\s+/g) in summarizeAgreement. The no-regex law applies to src/brain/mind.

FIX:
- scripts/apply-android-overlay.sh: the CURRENT script, with ONE block added (the WebKit dependency block, exactly once, the same text the Web lane wrote and tests/browserOverlayApply.test.py expects). Every other line is the repository's own: screen structure, ML Kit, Apps, manifest parts untouched.
- external.ts: the whitespace collapse is plain code now (a small helper sameLookingText); behavior identical.
- NEW tests/overlay-script-guard.test.mjs (4 checks, found by tools/run-tests.mjs like every .test.mjs): fails in one second, naming the lost line, if the overlay script (a) loses the WebKit 1.12.1 dependency, (b) does not name every Java and resource file of android-overlay, (c) misses a class MainActivity imports, (d) loses the ML Kit line while PictureTextReader exists. Proven: it fails on the repository as given (WebKit), on the 2026-11-12 snapshot (screen structure files) and passes with this fix. This is the real cure for the repeating loss: a lane that ships an older whole copy of the script now fails in one second, not after ten minutes of Gradle.

MEASURED: meaningNoPhrases 169 checks (82 files), mindPipeline 188, valuesGuard 163, external 6,756 checks, judgment 179, repair 200, verify 168; browserOverlayApply.test.py OK (WebKit exactly once, two manifest layouts, twice each); screen-structure-source 6/6; overlay-script-guard 4/4. Old and new summarizeAgreement on 40,000 generated answer sets: 0 differences. strict tsc on external.ts clean. The whole suite (276 test files) in my sandbox: every file passes except userDictionaryImport and zipTool, which need the real jszip (I only have a stand-in); markdown and tableFromBoxes failed once under parallel load and passed alone.
NOT RUN: the real Android compile (no Android SDK, no network), so BrowserActivity against androidx.webkit 1.12.1 is unproven here; the real-jszip tests; the cloud suite.

RULE FOR LANES (inference, repeated evidence): never ship scripts/apply-android-overlay.sh, BrowserActivity.java or DIRECTOR_NAP.txt as a whole copy from an older snapshot; start from the file in the newest zip and change only your lines. DIRECTOR_NAP.txt N18 already says so; the guard test now enforces it for the script.

MERGE_TAG line: 2026-11-14 | D321-FIX5 [scripts/apply-android-overlay.sh (WebKit block restored), src/brain/mind/external/external.ts, tests/overlay-script-guard.test.mjs (new), docs/D321_FIX5_BOARD_LINES.md] | cloud #224: 10 Java errors (WebKit dependency lost) + no-regex guard tests | MEASURED as above | NOT RUN: real Android compile, real-jszip tests, cloud suite
