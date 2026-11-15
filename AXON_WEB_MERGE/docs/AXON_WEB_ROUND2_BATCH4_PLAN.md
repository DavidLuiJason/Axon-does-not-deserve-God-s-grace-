# AXON Web — Next Work Plan (Build Reproducibility, Device Adaptability, and Runtime Verification)

**Status:** PLAN WRITTEN BEFORE IMPLEMENTATION  
**Baseline:** Cumulative AXON Web project assembled from Round 1 and Round 2 Batches 1–3, using the supplied source snapshot and the previously delivered browser deltas.  
**Owner instruction:** Do not treat Android 11 or one handset as the product boundary. Android 11 is one compatibility test point only.

## 1. Objective

Move AXON Web from source-level browser work toward a reproducible, installable, testable browser implementation, while ensuring the architecture is not designed around one Android version, one screen size, one hardware tier, or one device family.

The work is split into seven gates. Each gate must state what was actually executed and what evidence it produced.

## 2. Non-negotiable device and platform rule

AXON Web must adapt to the device and host environment rather than assume a fixed handset. Android 11 is a supported test target, not the only target and not the design target. The first native host is Android because the present AXON app shell is Capacitor/Android; this does not make the browser engine, controller, command catalogue, state model, or layout policy Android-only.

The shared browser layer must stay platform-neutral. Native engines are adapters behind a typed interface. Device behavior is selected using measured/runtime capabilities (viewport, density, input modes, memory class, OS/API capabilities, window size, fold posture where available), not hard-coded to the owner's current phone.

Form-factor targets to account for in layout and tests:
- compact phones and low-memory phones;
- large phones;
- tablets;
- foldables and resizable/multi-window windows;
- Chromebooks and desktop-sized windows;
- external keyboard/mouse and touch input combinations.

Platform coverage is reported separately from form-factor coverage. Android native host work does not imply iOS, desktop, or other native shells are already implemented.

## 3. Scope and gates

### Gate 1 — Reproducible build environment
- Reconstruct the cumulative working source tree without altering the user's separate repository.
- Pin/document Node, npm, JDK, Capacitor, Android Gradle Plugin, Gradle wrapper, compile SDK, target SDK, and minimum Android API.
- Generate a real Capacitor Android project and wrapper; retain exact generated configuration and wrapper in the return if permitted by project structure.
- Add a dedicated CI build workflow that does not unpack arbitrary ZIPs, commit, or push source changes.
- Verify clean install, web build, Capacitor sync, and APK artifact path.

### Gate 2 — Java and Capacitor compilation
- Apply the Android overlay to the generated project.
- Compile the full Java source against the actual Android SDK and Capacitor dependencies; do not substitute stub-only type checks.
- Fix errors only within AXON Web integration scope; record any inherited/base issue separately.
- Verify manifest, plugin registration, Android resources, and package namespace.

### Gate 3 — Multi-device / multi-version runtime test plan
- Add adaptive viewport/device-profile logic in the shared browser layer.
- Test layout policy at compact phone, large phone, tablet, foldable split-window, Chromebook, and desktop-width viewports.
- Preserve API-level feature detection: do not branch on Android 11 except where a specific API requires it.
- State clearly that simulator/browser tests are not physical-device certification.

### Gate 4 — Installed browser and live-site validation
- Only run Android device tests if an emulator/device is actually available. Record `adb devices` evidence.
- Only claim live-site testing for actual reachable public sites and record URL, test action, result, and date.
- Exercise navigation, login handoff (without sharing owner session with AXON), uploads, downloads, media, redirects, history, and tab switching.
- If no device or unrestricted network is available, produce a precise blocked-test matrix rather than claim success.

### Gate 5 — Browser utilities implementation
- Plan and implement the owner-facing browser utility group: bookmark edit/remove/folders; history clear-all/by-site; reading-list CRUD; tracked downloads list/open/share/cancel/delete; current URL copy/share; print/Save-as-PDF handoff; read-only site information and fixed permission-policy summary.
- Use app-private persistence for browser-owned lists and safe URL validation; do not expose owner credentials or make AXON able to access the owner session.
- Test controller routes and native-source contracts. Native execution, real DownloadManager behavior, print service behavior, and persisted data on-device remain gated on APK/device testing.
- Explicit exclusions: downloads pause/resume/retry/open-folder; dynamic site grants; certificate-chain validation; credential/passkey/autofill/payment implementation.

### Gate 6 — AXON-owned browser identity/session boundary
- Define a distinct AXON-owned context identity and partition contract.
- Keep AXON unable to query, copy, or reuse owner browser tabs, cookies, passwords, autofill, passkeys or payment state.
- Build/test the native isolated engine process/profile before enabling AXON. This batch only delivers the fail-closed TypeScript guard; the native isolation context is not built.
- Keep AXON actor disabled until native storage/cookie separation and bridge authority are independently proven.
- Do not wire the brain/router/capability registry or edit Director-owned files in this lane.

### Gate 7 — Browser coverage and engine readiness
- Reconcile the 118-command catalogue and parity matrix with actual native host methods and controller executors.
- Mark implemented / partial / not implemented / not testable distinctly.
- Keep WebView as a measured candidate, not a permanent engine lock; record what evidence would be needed to compare GeckoView and future platform adapters.

## 4. Explicit exclusions
- No changes to AXON roadmap, NOW, Director-owned job board, brain router, capability registry, or unrelated AXON code.
- No Director handoff or request for verdict.
- No owner-session sharing, credential extraction, stealth/anonymity claims, or website-policy bypass.
- No assertion that Android-only implementation equals universal platform support.
- No APK or device-test claim until the build/device evidence exists.

## 5. Implementation order
1. Toolchain and source-baseline inventory.
2. Build reproducibility and actual Java/Capacitor compilation.
3. Shared device/viewport adaptation and regression tests.
4. Android emulator/device and live-site validation where available; otherwise exact blocker evidence.
5. Saved Browsing utility implementation and tests.
6. AXON isolated-session boundary definition and guard tests, with execution still disabled.
7. Reconcile the 118-function catalogue and parity matrix; record WebView/GeckoView trade-offs without declaring a benchmark winner.
8. Cumulative packaging and hashes.

## 6. Acceptance evidence
- A clean-source build log with tool versions and exit codes.
- A real APK file only if Gradle assembles it successfully.
- A report distinguishing browser code, native compilation, emulator, physical-device, and live-site results.
- Automated tests covering all named form-factor width classes and the AXON/owner session separation guard.
- Complete cumulative project ZIP plus separately identified latest-batch ZIP and readable report/plan files.

## 7. Known environmental unknowns at plan time
- Whether this execution environment can reach npm and Android SDK distribution hosts.
- Whether Android SDK, emulator, or an attached device is available.
- Whether the existing base project's Android overlay compiles unchanged against its pinned Capacitor version.
- Whether outbound access to public websites is available.

These are to be measured, not assumed.
