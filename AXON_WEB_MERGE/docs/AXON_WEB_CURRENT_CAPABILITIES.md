# AXON Web — Current Capability Snapshot (Round 2 Batch 4)

**Evidence level:** cumulative source implementation, automated BrowserController and source-contract tests, local simulated-site/Chromium tests, TypeScript checks with explicit temporary stubs, Java syntax parse and overlay-script fixture tests. There is no APK, native Java type-compile, Android device runtime test, or live public-site result.

## Owner-facing Android browser source

- Android System WebView Activity: normal-tab navigation/back/forward/reload/stop, create/switch/close tabs, saved normal-tab URLs, title/progress, bounded page text extraction, find-in-page, zoom and desktop-site request.
- **Saved Browsing:** bookmark add/edit/remove, create folders, move/list; recent history search/clear-all/clear-by-site; reading-list add/remove/open/mark-read/list. Persisted in app-private SharedPreferences.
- **Download and page utilities:** list tracked AXON Web downloads; open/share completed downloads; cancel/remove tracked active or failed downloads; delete completed downloads; copy/share current URL; open Android print dialog or Save-as-PDF print workflow; show current URL/scheme/host and WebView certificate subject/issuer when available; report fixed camera/mic/geolocation-deny policy.
- Download tracking is limited to DownloadManager IDs initiated by AXON Web and recorded locally. Pause, resume, retry and open-download-folder controls are not implemented.
- Print/PDF handoff opens Android's print UI. The owner must choose the Save as PDF destination; the host does not silently save a document.
- Site certificate details are informational, not a complete certificate-chain or trust verifier.
- HTTP/HTTPS-only navigation, TLS-error cancellation, mixed-content blocking, Safe Browsing where supported, and denial of website camera/mic/geolocation grants.
- Website JavaScript receives no injected native JavaScript interface. Uploads use the Android document picker.

## Build and platform state

- Reproducible Android build lane is **configured, not successfully executed**: Node 22.16.0, npm 10.x, JDK 21, Capacitor packages pinned, expected AGP 8.7.2 / Gradle 8.11.1, min API 23 / compile and target API 35; separate CI workflow added.
- Local build could not install npm dependencies because external package/SDK download hosts were unreachable; no Capacitor project sync, real Java type compile, Gradle APK assembly or APK.
- AXON Web is **not Android 11-only**. Android 11 is one compatibility test point. Responsive logic adapts to available window width, pointer/keyboard hints and a coarse shared Device Profile memory hint; compact/medium/expanded viewport classes are covered by unit simulations. The renderer budget remains conservatively one live WebView until actual multi-device benchmarking exists.
- Current native shell is Android only. iOS/iPadOS and desktop native shells/adapters are not implemented. Tablet/foldable/Chromebook/desktop-width are layout simulations only.
- Current Capacitor 7.6.9 candidate lane has min API 23 (Android 6.0). It is a technical floor for this lane, not proof of support across every API-23+ device. Older Android requires revisiting the Capacitor baseline. See `AXON_WEB_MULTIDEVICE_SUPPORT.md`.

## Browser catalogue and controller

- 118 catalogue function IDs across 8 groups.
- Owner host: 39 complete, 3 partial.
- BrowserController: 37 owner command executors.
- AXON-enabled functions: 0. AXON actor remains denied until a real native isolated WebView context and separate cookie/storage partitions are implemented and proven.
- Complete row-by-row statuses are in `AXON_WEB_BROWSER_PARITY_MATRIX.md`.

## Identity and privacy

- Normal owner tabs share the default WebView cookie store.
- AXON cannot read owner tabs, cookies, password store, autofill, passkeys or payment state.
- `browserSessionBoundary.ts` is a typed guard/contract only. No second native process, WebView data-directory suffix, profile, cookie store or AXON-specific native IPC context is implemented.
- `AXON_BROWSER_SESSION_ENABLED` remains `false`.
- Incognito/isolated named identities and Stealth/network fail-closed protection are separate, not implemented systems.

## Still outstanding

- Complete dependency install and CI execution; generated Capacitor Android project; actual Java/Capacitor compile; Gradle APK assembly.
- Android 11 plus low/mid/high physical-device and API-level tests; actual tablet/foldable/Chromebook/runtime coverage.
- Live public websites through the installed browser (search, Claude/cloud sign-in handoff, GitHub, Drive-like uploads, documentation, news, commerce, video, redirects and TLS).
- True AXON native profile/data-store isolation and a verified controlled AXON command route; no brain/capability-registry wiring in this lane.
- Engine benchmark: Android System WebView versus GeckoView on matched devices; GeckoView is researched as a candidate but not integrated or measured.
- Remaining catalogue groups: restore closed/duplicate/group/pin tabs; downloads pause/resume/retry/open folder; richer site controls; account/credential/password/autofill/passkey/payment handoff; reader/site settings and other page utilities.
- Incognito, New ID, Save Incognito Tab, Stealth/VPN fail-closed kill switch.
