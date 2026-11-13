# D321-FIX3 board lines (owner appends; no shared ledger file is touched)

WHAT: red cloud builds #204 and #210 (Gradle :app:compileDebugJavaWithJavac, 3 errors) and the failing test screen-structure-source.test.mjs, from the same snapshot.

CAUSES (MEASURED on the repository zip given on 2026-11-12):
1. scripts/apply-android-overlay.sh never copied the screenstructure Java files, the accessibility resources, or declared AxonAccessibilityService in the manifest, although MainActivity.java imports and registers ScreenStructurePlugin. The cloud build copies only what the script names, so "package com.axon.app.screenstructure does not exist" (2 of the 3 errors). tests/screen-structure-source.test.mjs test 6 (wiring) checks exactly this and failed: reproduced locally, 5 of 6 passed.
2. BrowserActivity.java line 293: the download listener called startDownload with 4 arguments; the method takes (BrowserTab tab, url, userAgent, disposition, mimeType). `tab` is the createWebView parameter, already used inside the same anonymous class, so it is in scope and effectively final.

FIX: apply-android-overlay.sh now copies AxonAccessibilityService.java, ScreenStructurePlugin.java, axon_accessibility_service.xml, axon_accessibility_strings.xml and inserts the service declaration (BIND_ACCESSIBILITY_SERVICE, accessibility intent-filter, @xml/axon_accessibility_service), once, idempotent. BrowserActivity.java line 293 now passes tab first. Nothing else changed.

MEASURED: screen-structure-source 6/6 (was 5/6), screen-structure-reader 12/12, browserRuntime150 155/155, browserSavedBrowsing 25/25, browserIncognitoStealth 12/12, browserOverlayApply.test.py OK, other root .mjs tests all pass. The script run on a mock Android project: manifest well-formed, service declared once, second run byte-identical, copied files identical to the overlay. The two screenstructure Java files compile with javac 21 against stand-in Android and Capacitor classes (they had never been compiled before).
NOT RUN: the real Android compile (no Android SDK in the Director sandbox); BrowserActivity.java compiled as a whole (too many Android classes to stand in; the change is one call); the cloud build is the proof. scripts/test-apply-overlay.sh already failed before this fix (13 of 26 assertions: its mock has no app/build.gradle and it expects 7 permissions, the script adds 8); it is not run by the cloud and was left alone.

LIKELY CAUSE OF THE HIDDEN FAILURE (inference, not proven): scripts/apply-android-overlay.sh is edited by more than one lane (browser, screen structure). If a merge zip carries a whole copy of it from a snapshot without the other lane's lines, the newer lines are silently lost. Suggestion for the Directors board: shared files such as this one are patched, never replaced by a whole copy, and each lane's test checks its own lines.

OPEN: "AXON Code verify and vendor pack (manual) #1" failed in its second group (the real Chromium and Python test tools step; the first operand of the final check was success). Its summary table and log were not provided, so it is undiagnosed; it belongs to the AXON Code lane.

MERGE_TAG line: 2026-11-12 | D321-FIX3 [scripts/apply-android-overlay.sh, android-overlay/.../browser/BrowserActivity.java line 293, docs/D321_FIX3_BOARD_LINES.md] | cloud builds #204/#210 Java errors + screen-structure-source test | MEASURED as above | NOT RUN: real Android compile
