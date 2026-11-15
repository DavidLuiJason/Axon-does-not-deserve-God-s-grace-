# AXON Web — Round 2 Next-Batch Plan (Owner-authorised parallel build)

**Status:** Plan written before implementation. This is a parallel design/build return, not a roadmap edit and not a Director verdict.
**Base:** AXON source snapshot `Axon-does-not-deserve-God-s-grace--main (24).zip` (2026-11-06) plus isolated Batch 1 gateway return.
**Roadmap:** V21.3 is the current supplied law; repository `NOW.txt` still names V21.2 and a separate Director lane. Do not modify roadmap, `NOW.txt`, board, capability registry, or brain routing.

## 1. Purpose of this batch

Deliver the first actual owner-usable browser runtime rather than another catalogue-only design. Build a native Android WebView host inside the existing Capacitor overlay, expose a narrow typed Capacitor plugin, add an AXON Web launch surface, and provide the first operational browser controller contract. WebView is a measured candidate, not a permanent engine lock.

## 2. Law and scope check

- Preserve the Director's parallel CHR1/DLG1/BUD1 lane and all existing project files outside the named additions/one explicitly necessary registration seam.
- No roadmap edits, no source-wide cleanup, no dependency additions, no changes to package scripts or existing capability/brain registry.
- No fake claim that unsupported functions work. The first native runtime is deliberately a limited browser, not Chrome parity.
- No arbitrary JavaScript bridge exposed to websites; no privileged AXON APIs in page JS.
- Accept only HTTP/HTTPS navigation; cancel TLS certificate errors; block file/content/javascript/data and unapproved external schemes.
- Deny camera, microphone and geolocation requests until a complete owner permission flow is designed.
- File upload must use Android's document picker; downloads must use Android DownloadManager.
- Persist ordinary browser tab URLs, history and bookmarks. Normal tabs share the default WebView cookie store. This is NOT Incognito.
- AXON's catalogue/gateway remains a policy layer. This batch does not grant AXON access to owner tabs or credentials; owner UI uses the native runtime. AXON's full parity must be wired only after session separation and the shared executor are complete.
- Incognito and Stealth are excluded. Incognito = isolated identities/sessions + Save Incognito Tab; Stealth = separate network protection with fail-closed kill switch and verified recovery.

## 3. Proposed module structure

```text
src/web/
  browserCommandGateway.ts       existing pure permission/catalogue contract
  axonBrowserPlugin.ts           typed Capacitor native-plugin surface
  browserController.ts            shared command dispatch and capability gating
src/components/browser/
  BrowserHomeScreen.tsx           AXON Web launch/status surface
android-overlay/app/src/main/java/com/axon/app/
  MainActivity.java               existing registration seam, add BrowserPlugin
  browser/BrowserPlugin.java      narrow Capacitor bridge; no page-facing bridge
  browser/BrowserActivity.java    native Android WebView host, toolbar, tabs, storage
android-overlay/manifest-additions.xml
scripts/apply-android-overlay.sh  copy plugin/activity and declare Activity

tests/
  browserController.test.ts       deterministic command/session tests
  browserNativeContract.test.mjs  static overlay/manifest/bridge contract tests
```

## 4. Runtime features built in this batch

1. Open browser from AXON Web mode; default to a search page.
2. Address bar supports URL navigation and search query conversion.
3. Back, forward, reload, stop, open new tab, switch tabs, close tab, tab count.
4. Restore last normal tab URLs after Activity/app recreation; persist history and bookmarks.
5. Add/list bookmarks; list/search history.
6. Page title, URL, loading/progress status, and bounded visible page text for AXON's later read path.
7. Find-in-page and zoom controls.
8. Download link handling via DownloadManager.
9. File uploads through ACTION_OPEN_DOCUMENT.
10. Safe defaults: HTTPS preferred for bare domains, strict HTTP/HTTPS scheme allowlist, SSL errors cancelled, WebView Safe Browsing enabled where platform supports it, mixed content disabled, site media/location permissions denied.

## 5. Explicitly not complete after this batch

- GeckoView adapter/benchmark and final engine selection.
- Isolated AXON session and complete owner/AXON parity.
- Complete browser UI/Chrome parity: groups, pinned tabs, recently closed, sync, extensions, reader, translation, built-in password manager/passkeys/autofill, advanced accessibility, printing/PDF, PWA install, full site-permission manager, cookie controls, tracking protection UI, Safe Browsing reputation service.
- Full download manager controls, resumable downloads, upload lifecycle tracking.
- Incognito/New ID/Saved Incognito tabs.
- Stealth/VPN/fail-closed kill switch.
- Browser default-app registration and sync.

## 6. Build order

**B2-A — Native browser host and bridge:** Android Activity + WebView + toolbar + tabs + safe navigation + downloads/uploads + native persistence. No dependency additions.

**B2-B — AXON app entry and controller:** launch surface, typed plugin wrapper, shared controller dispatch through the Batch 1 gateway. Only commands genuinely implemented by the host are reported SUPPORTED; others remain UNKNOWN/NOT_READY.

**B2-C — Verification:** at least 150 automated checks across controller rules, URL handling, tab lifecycle, persistence, bridge boundaries, overlay idempotence and local website simulations. Run actual Chromium against a local suite of simulated site categories (search, docs, cloud login, commerce, media, forms, redirects, downloads/uploads). Attempt public sites only if the environment has network access; this container's outbound DNS currently fails, so public-site tests must be labelled blocked rather than claimed passed.

## 7. Acceptance gates

- TypeScript controller passes strict type-check.
- Native Java source and manifest/overlay contracts pass static tests.
- 150+ deterministic tests pass with zero failures.
- Chromium successfully loads and interacts with local simulated sites if installed.
- Build output includes exact files, hashes, changed-file manifest, and honest limitations.
- No claim of Android APK/physical Android 11 success unless Gradle/SDK/device tests actually run.

## 8. Stop conditions

Stop before integration if native Android build shows missing SDK/Gradle, Capacitor API mismatch, manifest patch conflict, security boundary failure, or if current base is stale. Do not patch around an unverified failure by editing unrelated project files.
