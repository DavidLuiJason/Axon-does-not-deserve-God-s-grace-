# AXON Web — Round 2 Batch 2 Build Report

**Status:** Builder self-implementation; not submitted to the Director and not a Director ACCEPTED verdict.
**Build lane:** Owner-authorised parallel AXON Web lane. No Grok work was used.
**Base inspected:** `Axon-does-not-deserve-God-s-grace--main (24).zip` (20,100,541 bytes; 2026-11-06 snapshot).
**Roadmap:** `AXON_ROADMAP_V21_3.md` supplied in this conversation. The repo's `NOW.txt` still identifies V21.2 and the Director's CHR1/DLG1/BUD1 lane. No roadmap, NOW tag, job board, Director-owned design or capability registry was changed.

## 1. What was planned before coding

The plan is in `docs/AXON_WEB_ROUND2_NEXT_BATCH_PLAN.md`. It defined the browser host, bridge, controller, engine adapter seam, safety boundaries, 150-check target, site categories, explicit exclusions and build stop conditions before implementation.

## 2. What was built

### Native Android browser host

- `BrowserActivity.java` hosts Android System WebView in a separate native Activity.
- Address/search field; bare domains become HTTPS; search text goes to Google Search.
- Back, forward, reload/stop, new tab, tab chooser/switch, close tab, browser menu.
- Normal tabs, history and bookmarks persist in app-private SharedPreferences.
- Page title, URL, progress, bounded page text extraction, find-in-page, zoom and desktop-site request.
- Download links use Android `DownloadManager` and save beneath `Downloads/Axon`.
- Website file upload uses Android `ACTION_OPEN_DOCUMENT`; the website receives only the user-selected file URI.
- HTTPS/HTTP navigation only; TLS certificate errors are cancelled; mixed content is disabled; WebView Safe Browsing is enabled where supported and unsafe-site hits are sent back to safety.
- Website camera/microphone requests and geolocation are denied in this first batch. They are not silently granted.
- No `addJavascriptInterface` is exposed to websites. The AXON bridge is a typed Capacitor plugin on the app side, not a website JavaScript bridge.
- Resource handling keeps only the active tab's WebView renderer alive; inactive tabs save navigation state and destroy their renderer to reduce memory pressure. Restoration preserves the saved WebView navigation state where supported; it does not promise preservation of every in-page form/JavaScript state.

### AXON app and TypeScript layer

- Web mode now opens the AXON Web launch surface instead of saying the browser is coming soon.
- `AxonBrowser` is the typed Capacitor bridge.
- `BrowserEngineAdapter` is the engine-neutral contract.
- `AndroidWebViewAdapter` is the first adapter. GeckoView is not built or selected.
- `BrowserController` routes owner commands through the Batch 1 permission gateway to the native plugin.
- The controller currently implements 15 commands: navigate, back, forward, reload, stop, find, zoom, desktop-site request, create/close/switch tabs, add/list bookmarks, history search and page read.
- AXON actor requests are deliberately denied: there is no isolated AXON browser session yet. The controller does not allow AXON to borrow the owner's normal WebView session.
- Unimplemented catalogue entries return `NOT_READY`; they are not simulated as working.

### Native overlay

- Added `BrowserPlugin.java` and `BrowserActivity.java`.
- Registered `BrowserPlugin` in `MainActivity.java`.
- Updated `scripts/apply-android-overlay.sh` to copy both files and declare the Activity idempotently.
- Updated the Web mode branch in `src/App.tsx`.
- No npm dependencies or package scripts were added.

## 3. Structure chart

```text
                    AXON WEB
                       |
             +---------+----------+
             |                    |
        OWNER WEB UI          FUTURE AXON CALLER
             |                    |
             +---------+----------+
                       |
             BROWSER COMMAND GATEWAY
                       |
                BROWSER CONTROLLER
                       |
              BROWSER ENGINE ADAPTER
                       |
              ANDROID WEBVIEW ADAPTER
                       |
                CAPACITOR PLUGIN
                       |
              NATIVE BROWSER ACTIVITY
                       |
             ANDROID SYSTEM WEBVIEW
                       |
                    INTERNET

  Future GeckoView adapter: NOT BUILT
  AXON isolated session: NOT BUILT
  Incognito and Stealth: NOT BUILT
```

## 4. What the browser source can do now

If this source is successfully built into the Android app and installed, the owner-facing browser host is intended to support:

- Open a website or search from the address field.
- Visit ordinary JavaScript-enabled websites.
- Open, switch and close normal tabs.
- Go back/forward, reload or stop a page.
- Restore normal tab URLs after closing/reopening the browser.
- Save and revisit bookmarks; search recent history.
- Find text on a page, zoom, request desktop-site layout and read bounded page text through the native plugin.
- Download files through Android's download service.
- Upload user-selected files through Android's system picker.
- Use ordinary HTML forms, cloud sign-in pages, document editors, shopping pages, media pages and other WebView-compatible sites.

This is not yet a browser APK or a tested phone installation. The Android host is source code only until a real Capacitor/Gradle build succeeds.

## 5. Current limitations — do not describe these as working

- The current source ZIP has not been rebuilt into an APK in this environment.
- The browser host has not run on the user's Android 11 phone.
- AXON cannot yet operate the browser. The owner-facing native host exists in source, and the controller/gateway contract exists, but brain/capability registration and an isolated AXON session remain unbuilt.
- The 117-entry catalogue is a future target, not 117 implemented features. Only 15 command IDs currently have controller executors.
- No GeckoView adapter or WebView-vs-GeckoView benchmark; Android System WebView is only the first candidate.
- No tab groups, pinned tabs, recently closed tabs, sync, extensions, built-in password vault, passkeys, autofill, translation, reader mode, read-aloud, print/PDF, PWA installation, full download manager controls, full cookie controls, tracking-protection dashboard or owner-mediated camera/microphone/location permission prompts.
- No site reputation service beyond WebView Safe Browsing support, TLS rejection and URL-scheme controls.
- Normal tabs share the default WebView cookie store. No Incognito/New ID/Saved Incognito Tab.
- No Stealth/VPN/fail-closed kill switch.

## 6. Verification and test results

### Automated checks

| Suite | Checks | Passed | Failed | What it covers |
|---|---:|---:|---:|---|
| Batch 1 gateway tests | 25 | 25 | 0 | Permission gateway, session/tab ownership, grants, approval binding, malformed requests |
| Browser runtime contract | 150 | 150 | 0 | All 117 catalogue entries, 15 controller dispatches, policy/failure cases, native source/overlay contracts |
| Simulated website/controller tests | 50 | 50 | 0 | Search, cloud login, cloud documents, shopping, video, news, wiki, upload portal, redirects, API docs, tabs/history/bookmarks |
| Chromium 144 simulated-site rendering tests | 56 | 56 | 0 | Actual Chromium DOM/rendering interactions using in-memory simulated pages: search forms, cloud login/file picker, document editor, shopping cart, video/audio elements, news, forms/upload, iframe, canvas, accessibility landmarks, responsive layout and history API |
| **Total** | **281** | **281** | **0** |  |

The Chromium suite ran using Playwright with the installed Chromium 144 binary. It uses `page.set_content()` and simulated pages. It is a real Chromium renderer test, but it is not a test of Android System WebView or of the AXON Android Activity.

### Additional checks

- Strict TypeScript check of the gateway, plugin types, typed Capacitor wrapper (with a minimal declaration stub because dependencies are not installed), engine adapter, WebView adapter and controller: **passed**.
- Strict TSX check of `BrowserHomeScreen` (with minimal React/Lucide/Capacitor declaration stubs): **passed**.
- Android overlay script applied twice to a temporary generated Android manifest: **passed**; exactly one BrowserActivity and one BackgroundJobService declaration remained; BrowserPlugin and BrowserActivity files were copied.
- Batch 1 gateway test file: **25 checks passed**.

### Checks blocked / not run

- `npm run build`: **blocked** because `node_modules` is absent and `vite` is not installed (`vite: not found`). The prebuild snapshot command ran and its generated `public/_axon-source` files were removed from the work tree afterwards.
- Android Java/Gradle build: **not run**. This environment has no `ANDROID_HOME`, no Android SDK, no generated `android/` project and no Gradle wrapper in the supplied source snapshot. A direct `javac` attempt fails at missing Android SDK/Capacitor packages; it is not a Java compile pass.
- Physical Android 11 / 4GB device test: **not run**.
- Public website navigation: **blocked by environment network restrictions**. Direct requests to example.com, Google, Wikipedia and Cloudflare failed DNS resolution. Chromium navigation to HTTP/HTTPS URLs was blocked by the environment; Chromium in-memory page tests still ran. Therefore I did not claim that I visited live Claude/Cloud, Google Drive, GitHub or any other external site through this AXON browser.
- DownloadManager, Android document picker, WebView cookie persistence, Safe Browsing callback and WebView renderer restore: source implemented but **not device-tested**.

## 7. Security and identity boundaries

- Owner's normal browser context is the only current native context.
- AXON is denied by the controller until a separate AXON context exists.
- No credentials, passkeys or browser cookies are exposed through the plugin API.
- No website page gets a privileged AXON bridge.
- Site camera/microphone/location are denied in this initial host rather than silently allowed.
- No Incognito or Stealth claims are made.

## 8. Next build sequence (not Director handoff)

1. Obtain a reproducible Android build environment or CI build and fix actual Java/Capacitor/manifest compile errors before adding more functionality.
2. Install and test on Android 11 / 4GB; measure active WebView memory, tab switching/restore, media, uploads/downloads and APK size.
3. Run live external website checks from the installed browser: Google search, Claude/Cloud login page, Drive-like upload, GitHub, documentation, news, shopping, video, redirects, TLS and certificate failures.
4. Complete native browser utilities: download list/open/cancel, bookmark editing, reading list, history clearing, copy/share, print/PDF and site-info/settings UI.
5. Build separate AXON-owned browser session storage and route AXON's commands through the same BrowserController/BrowserEngineAdapter without inheriting owner cookies or credentials.
6. Add the complete parity matrix and implement remaining catalogue groups in small related batches.
7. Compare GeckoView with Android System WebView on measured compatibility, APK growth, security-update path and memory before deciding whether to retain or replace the engine.

No Director review is requested or performed in this return. Remind the owner to request Director verification only when the owner decides the package is mature enough.
