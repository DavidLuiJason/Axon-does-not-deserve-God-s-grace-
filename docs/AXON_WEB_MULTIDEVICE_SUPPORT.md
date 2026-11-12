# AXON Web — Multi-device and cross-platform compatibility policy

## Product rule

AXON Web is not an Android 11-only product, and one handset is never its design limit. The supplied AXON V21.3 roadmap requires AXON to be built for every Android phone using per-tier weak/mid/strong Device Profile budgets and identifies the Infinix Note 10 as one test device, not the design target. The owner further clarifies that AXON Web must remain adaptable as the product moves to different devices and platforms.

Android 11 is therefore one required compatibility checkpoint, not the product boundary. A single Android APK/native host does not yet make the product cross-platform; the shared browser layer must be portable and each platform needs a real, tested host adapter.

## Architecture boundaries

- `browserCommandGateway.ts`, `browserController.ts`, browser policy, command definitions and session-boundary checks are platform-neutral TypeScript.
- `BrowserEngineAdapter` is the typed engine seam. The only implemented native adapter is Android System WebView.
- Future adapters may use iOS/iPadOS WKWebView, desktop Chromium/WebView, or another engine without duplicating browser command policy. Each adapter must pass the common adapter contract on its target platform.
- `browserDeviceProfile.ts` classifies the available current window from CSS-pixel width and pointer/keyboard hints. It consumes the shared kernel Device Profile RAM hint where the browser exposes one; absent or privacy-reduced readings remain unknown.
- No make/model or Android-version sniffing is used to decide layout. Native runtime capability detection and API-specific feature gating remain required.

## Form-factor classes currently simulated

| Available window width | Window class | Quick-action columns | Example situations (not device locks) |
|---:|---|---:|---|
| < 600 CSS px | COMPACT | 2 | compact phone; narrow split window |
| 600–839 CSS px | MEDIUM | 3 | large phone; small tablet; foldable intermediate posture |
| >= 840 CSS px | EXPANDED | 4 | tablet; wide foldable; Chromebook/desktop-sized window |

The class is based on the current available window, not the physical product category. Foldables and split-screen windows must re-evaluate on resize/orientation/visualViewport changes. Fine pointer/keyboard may enable a wider toolbar/sidebar; coarse pointer retains touch-friendly controls.

## Resource adaptation status

The shared kernel reads a coarse `navigator.deviceMemory` value where exposed. The browser layer labels memory `LOW`, `STANDARD`, `HIGH`, or `UNKNOWN` with provisional thresholds (<2 GB, 2–<4 GB, >=4 GB); these are not measured weak/mid/strong tiers, not guaranteed physical RAM, and not reservation amounts. Unknown remains unknown. The current active WebView renderer budget stays one across profiles until cold/warm navigation, tab-count, process memory and renderer-recovery measurements from multiple devices justify any change. This avoids inventing a device budget.

## Platform and version support status

| Platform/form factor | Current status |
|---|---|
| Android phones | Android host source exists; not APK/device certified |
| Android 11 | Required checkpoint; not tested here |
| Android API 23 minimum candidate | Not tested; current Capacitor 7.6.9 lane minimum |
| Newer Android versions | Not tested |
| Android tablets / foldables / Chromebooks | Responsive viewport/input policy simulated; no native runtime tests |
| iOS / iPadOS | Architecture seam only; no WKWebView adapter or app target |
| Desktop OSes | Architecture seam only; no native desktop shell/adapter |
| Web preview | Browser home preview; not a native browser engine |

## Build-lane compatibility boundary

This batch pins Capacitor 7.6.9 and a native Android host with `minSdk 23`, `compileSdk 35`, `targetSdk 35`. Thus the current *candidate Android lane* excludes Android below API 23 unless the baseline is deliberately changed. This does not narrow the product vision to Android 6+ or Android-only; it identifies a concrete unresolved compatibility decision that must be settled before claiming universal device support. A future iOS target also requires an iOS shell and WKWebView adapter; desktop requires its own shell/engine and platform-specific file, permission and session integration.

## Engine candidate notes — not a final selection

- **Android System WebView:** lower integration/package overhead and uses the device's installed WebView provider; the provider/version can vary by device and OS update path. Official Capacitor Android guidance notes WebView provider requirements and that providers differ by Android release. citeturn561342search5turn561342search8
- **GeckoView:** Mozilla documents it as a self-contained engine suited to browser apps; this can give a more consistent engine version but requires shipping and updating a separate engine dependency. citeturn561342search11turn561342search12
- **Decision:** no engine lock. For a low-resource browser the WebView remains the first measured candidate, while GeckoView remains a valid browser-focused alternative. No size, memory, performance or compatibility winner has been measured in this work.
- **Benchmark required before decision:** APK/download size impact; install footprint; cold/warm page startup; peak/PSS memory with 1/3/5 tabs; renderer crash recovery; JS/API support; media playback; uploads/downloads; WebAuthn/passkeys handoff; accessibility/input; WebView security/Safe Browsing; update cadence; and device/API floor on identical weak/mid/strong devices.

## Acceptance rule

A device/platform is listed as supported only after evidence for install/launch, layout, navigation, saved storage, uploads/downloads, media, lifecycle, low-memory behavior, accessibility/input, security and session isolation. Viewport simulation is not a physical-device test; emulator is not a physical handset; Android host build is not iOS/desktop compatibility evidence.
