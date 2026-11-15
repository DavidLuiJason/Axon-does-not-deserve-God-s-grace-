# AXON Web — Round 2 Batch 4 Engineering Report

**Status:** Source batch completed as far as this environment can prove. This is not an APK acceptance report. Plan was written before implementation; a separate utility-extension plan was written before the second utility set was implemented.

## 1. Executive status

| Requested next-work item | Result in this execution | Evidence status |
|---|---|---|
| 1. Reproducible Android build environment | Node/npm/JDK and Capacitor dependencies pinned; build script and dedicated build-only CI workflow added | CONFIGURED, not proven by a successful CI run |
| 2. Actual Java/Capacitor compilation | Found and fixed a multiline-`<application>` manifest-overlay insertion defect; Java parser accepted all 3 project Java files | REAL JAVA TYPE COMPILE BLOCKED; Android/Cap symbols unresolved |
| 3. Android 11 and multi-device tests | Responsive profile and viewport/input classification tests; device matrix prepared | NO emulator or physical device test; Android 11 not run |
| 4. Live public websites | Exact live-site matrix and actions specified | NOT RUN; network policy/DNS plus no installed browser/APK |
| 5. Browser utilities | Saved Browsing plus download/copy/share/print-PDF/site info/security-policy summary wired source-side | Controller/static-source verification only; native runtime not tested |
| 6. Separate AXON-owned session | Fail-closed identity and partition contract; AXON actor blocked | Native isolated WebView profile/process/cookie store NOT BUILT; AXON enabled count remains zero |
| 7. Catalogue coverage and engine readiness | Reconciled all 118 function IDs across 8 groups; documented WebView-vs-GeckoView decision criteria | Matrix complete at source level; no engine benchmark without build/devices |

**No APK was produced. No Android device was installed/tested. No public website was tested through AXON Web. No Director handoff/verdict was requested or made.**

## 2. Plan-first sequence and scope

The seven-gate plan is `AXON_WEB_ROUND2_BATCH4_PLAN.md`. The further native utility work was separately scoped in `AXON_WEB_ROUND2_BATCH4_UTILITY_EXTENSION_PLAN.md` before changes to BrowserActivity, BrowserPlugin, TypeScript types, adapter, controller and tests. Scope remained within the AXON Web owner browser lane. Roadmap, NOW, Director job board, brain router, capability registry and unrelated modules were not changed.

## 3. Build reproducibility (item 1)

Added `.nvmrc`, locked npm dependencies and lockfile, `BUILD.md`, `scripts/build-axon-web-android.sh`, and `.github/workflows/axon-web-android.yml`. The workflow is read-only/build-only: checkout, npm ci, Vite build, lint, full test suite, Android overlay regression, Capacitor project generation/sync, Java compile, Gradle APK assembly and artifact upload. It does not commit or push.

Pinned candidate lane: Node 22.16.0; npm 10.x; JDK 21; Capacitor core/CLI/Android 7.6.9; Capacitor App 7.1.2, Filesystem 7.1.9, Share 7.0.4; expected AGP 8.7.2, Gradle 8.11.1; min API 23, compile/target API 35.

Local machine measurements: Node 22.16.0, npm 10.9.2 and JDK 21.0.12.1. No ANDROID_HOME/ANDROID_SDK_ROOT, adb, sdkmanager, system Gradle, local Capacitor CLI, or Vite package. npm install could not complete because external registry/SDK/Gradle hosts were unreachable. The new GitHub workflow was not run remotely. Therefore build reproducibility is configured, not independently proven yet.

## 4. Compilation and manifest defect (item 2)

The build script correctly fails closed before generation when the local Capacitor CLI is absent; it refuses an unpinned `npx` fallback. Java syntax parsing passed for `MainActivity.java`, `BrowserPlugin.java` and `BrowserActivity.java` using JDK 21. This parser stage does not resolve Android or Capacitor symbols and must not be called a compile pass.

During overlay fixture testing, a manifest with `<application` and its attributes split across multiple lines exposed that the BrowserActivity insertion pattern only matched a single-line start tag. The insertion code is now stateful across the opening tag and checks that insertion actually happened. A regression script tests both single-line and multi-line manifest start tags, runs the overlay twice on each, parses XML and checks singleton service/activity/permission declarations. Both fixture shapes passed.

Still not done: `cap add android`, `cap sync android`, Android/Capacitor type compilation, Gradle build and APK output. There is no established Java source type error yet; the environment stopped before that stage.

## 5. Multi-device adaptation (item 3)

AXON Web is **not Android 11-only**. The AXON V21.3 roadmap says build for every Android phone, with weak/mid/strong budgets drawn from Device Profile and adapted to; the Infinix Note 10 is one test device, not the design target. This batch also treats phones, tablets, foldables/resizable windows, Chromebooks and desktop-sized windows as layout/input targets, with separate native-shell status.

Implemented/verified in source tests:
- compact / medium / expanded window classes from available CSS-pixel width;
- pointer and keyboard/touch-mode hints;
- coarse `navigator.deviceMemory` integration into shared Device Profile when exposed; unknown remains unknown;
- re-evaluation on resize/orientation/visualViewport changes;
- current one-live-renderer budget retained until measured benchmarking supports change.

This is responsive-layout/adaptation infrastructure, not a measured weak/mid/strong performance governor. Memory thresholds are provisional labels only. No native memory-class bridge or physical measurements exist. Android 11, minimum API 23, current Android, multiple RAM tiers, tablets and foldables all remain untested at runtime.

The present Capacitor 7.6.9 candidate lane sets min API 23 (Android 6.0). That is the current technical build floor, not the AXON product's universal design target. Older Android would require revisiting the baseline. iOS/iPadOS and desktop shells/adapters are not implemented yet.

## 6. Live public websites (item 4)

Not run. The environment could not resolve npm/Android build distribution hosts and the earlier external-navigation attempt was blocked by network policy. Without an APK and reachable runtime, a live-site test through AXON Web could not be performed. The simulated site suite and local Chromium renderer simulation are explicitly not live public website tests.

Required future real-browser checks: public search; Claude/cloud sign-in through owner-controlled handoff; GitHub; Drive-like upload and document sites; news/wiki; commerce; video/audio; redirects/popups; TLS error and Safe Browsing; history/tab switching; upload/download; media permissions. Results must be recorded by URL, date, action and exact observed outcome.

## 7. Browser utility additions (item 5)

### Saved Browsing

- Bookmarks: add, edit, remove, list, create folder, move to folder.
- History: search, clear all, clear by host; native history dialog can open entries.
- Reading list: add, remove, open, mark read/unread, list.

Bookmark/history/reading-list records and folder names use app-private SharedPreferences. URLs are validated as HTTP(S) and reject embedded user information. Owner-facing native UI actions are present.

### Utility extension

- Downloads: list tracked AXON Web-created DownloadManager items; open/share completed downloads; cancel/remove non-complete or delete completed items. Item operations use stable DownloadManager IDs, not transient display indexes.
- Current URL: copy to clipboard; share through the Android chooser.
- Print/PDF: open Android print UI; owner selects Save as PDF and destination.
- Site information: current URL, scheme, host, certificate-present flag and available subject/issuer metadata.
- Site permission summary: reports camera, microphone and geolocation as blocked by the current fixed host policy.

Limitations: downloads are tracked only when started by AXON Web; no pause/resume/retry/open-folder controls. Print/PDF not tested on device. Site certificate details are informational only, not a certificate-chain validator. Site permission report reflects fixed denial and does not grant/revoke dynamic site permissions. The 22 new/covered command routes in the focused Saved Browsing test group passed controller dispatch tests; Android native methods have not run on a phone.

## 8. AXON-owned session boundary (item 6)

`browserSessionBoundary.ts` checks distinct session, engine-context, cookie-partition and storage-partition IDs, requires a verified non-shared isolation kind and rejects any shared credential-store identifier. `AXON_BROWSER_SESSION_ENABLED` is false. The controller rejects AXON actor requests before the owner adapter is called. Tests verify that the AXON actor cannot execute these owner-session commands.

This is a contract/guard, not real isolation. No separate Android process, WebView `setDataDirectorySuffix`, AXON WebView instance, independent cookie/local-storage store or AXON-specific native IPC path has been created. No AXON capability/brain/router registration was changed. This must remain disabled until those native boundaries are implemented and device-tested. Owner tabs currently share the default WebView cookie store.

## 9. Parity and engine readiness (item 7)

Current parity matrix is generated from the actual command catalogue and source sets: 118 catalogue functions, 8 groups, 39 owner-host complete, 3 owner-host partial, 37 owner-command executors, zero AXON-enabled functions. Full ID-by-ID evidence and group counts are in `AXON_WEB_BROWSER_PARITY_MATRIX.md`.

The 3 partial rows are `tabs.restoreSession`, `tabs.suspend`, and `history.openEntry`. The native host has related behavior, but does not expose the complete catalogue control. Account/password/passkey/payment functions remain unimplemented and handoff/refusal-classified; no credentials are extracted or supplied to AXON.

### WebView vs GeckoView

WebView remains the first measured candidate because it is already on the Android path and avoids bundling an additional browser engine. GeckoView remains a viable candidate: Mozilla describes it as self-contained and designed for browser apps, offering a more consistent bundled engine version. The trade-offs are documented in `AXON_WEB_MULTIDEVICE_SUPPORT.md`. There is no real comparative package-size, memory, speed, API compatibility, media or crash-recovery benchmark because neither engine could be built/run here. No final engine lock was made.

## 10. Verification evidence

| Suite/check | Result |
|---|---:|
| Browser Node test suites (gateway, runtime, site simulation, saved browsing, parity, device profile, session boundary, step guard) | 248 tests passed, 0 failed |
| Gateway catalogue assertions inside its suite | 25 checks passed |
| Chromium 144 local renderer simulation | 56 checks passed |
| Android overlay insertion regression | 2 manifest layouts, each applied twice; XML valid; no duplicate declarations |
| Strict TypeScript browser/controller/device-profile check with temporary Capacitor declaration | Passed |
| Strict BrowserHomeScreen TSX check with temporary React/Lucide/Capacitor declarations | Passed |
| JDK 21 Java syntax parser | 3 Java sources parsed; syntax only |
| Shell syntax / workflow YAML syntax | Passed |
| ZIP integrity | Checked after packaging |

Simulation boundaries: Chromium tests use local in-memory simulated page fixtures. They do not connect to real sites, use Android WebView, or test actual downloads/uploads/media/print on device.

## 11. Exact blockers and next work dependency

The current execution environment lacks npm package access/cache, Android SDK, adb/emulator, Capacitor CLI and Gradle distribution access. To finish the blocked gates, the project must be opened in a runner with package/Google Maven/Gradle access and Android SDK (the new CI workflow is prepared for that). Run the CI workflow to surface real Java/Capacitor errors, fix only scoped integration issues, produce the debug APK, then test on API23-minimum, Android 11, modern Android, and different weak/mid/strong physical devices. Live-site testing follows only after installation. True AXON isolation and a measured engine decision remain separate gated tasks.

## 12. Law check / protected scope

- Plan before work; measure before making claims; one scoped job and explicit proof.
- Device portability: no Android 11-only design and no one-phone assumption. Device budgets remain unknown until measured.
- One builder/one scope; no unrequested changes to roadmap, NOW, Director board, brain router, capability registry or unrelated app modules.
- AXON never receives owner cookies, passwords, passkeys, payment state or tabs; it remains disabled on the owner session.
- No false claim of build, install, device, live-site or Director acceptance.
