# AXON Web — Device and Live Website Test Status (Round 2 Batch 4)

## Device and platform compatibility

AXON Web is not Android 11-only. Android 11 is one compatibility checkpoint. The product must adapt to a wide range of Android phones and prepare for additional platforms/form factors; one owner handset is not the design target.

| Target | Status | Evidence / blocker |
|---|---|---|
| Android API 23 (candidate min) | NOT RUN | no generated project/SDK/emulator |
| Android 11 | NOT RUN | no APK, adb, emulator or attached handset |
| Newer Android API levels | NOT RUN | no emulator/device |
| Weak / mid / strong physical Android devices | NOT MEASURED | no device benchmark data; tiers must not be invented |
| Compact / standard / expanded phone windows | VIEWPORT UNIT TESTS | CSS-pixel classes and pointer/input changes tested in browser simulation |
| Tablets | VIEWPORT SIMULATION ONLY | expanded-width policy; no tablet runtime |
| Foldables / split-window | VIEWPORT SIMULATION ONLY | resize-window classes; no native fold posture or device test |
| Chromebook / desktop-sized viewport | VIEWPORT SIMULATION ONLY | wide viewport + fine pointer/keyboard hints; no ChromeOS/Desktop shell |
| iOS / iPadOS | NOT IMPLEMENTED | WKWebView adapter and native app target absent |
| Desktop native platforms | NOT IMPLEMENTED | native desktop shell and engine adapter absent |

The browser policy adapts layout to the current available width and pointer/keyboard characteristics. `navigator.deviceMemory` supplies only a coarse RAM hint where the browser exposes it. LOW/STANDARD/HIGH are provisional labels—not a real measured weak/mid/strong tier system. Unknown stays unknown. The one-live-WebView renderer budget remains conservative until multi-device measurements exist.

Current Capacitor 7.6.9 candidate build uses min API 23. Devices below API 23 are excluded from this specific lane unless the baseline changes. This technical build floor is not a new product lock to Android 6+; the cross-device requirement remains broader.

## Live public website status

**NOT RUN.** This task had no APK or installed browser, and external DNS/network policy blocked the package/download and earlier external-navigation routes. The local simulated site/controller and Chromium renderer suites are not public-site testing.

## Required eventual installed-browser test matrix

| Site/category | Required actions | Current status |
|---|---|---|
| Public search | Search, suggestions, navigation, back/forward, query encoding | NOT RUN |
| Cloud AI sign-in (e.g., Claude) | Owner-initiated login/handoff, cookie/session remain owner-only, return to page | NOT RUN |
| Git hosting | Sign in, repo browsing, file navigation, download, redirects | NOT RUN |
| Cloud documents/storage | Select/upload file via Android picker; no silent file access | NOT RUN |
| Documentation/wiki/news | Long pages, links, find-in-page, history/readability | NOT RUN |
| Commerce | Product images, carts/forms, navigation; no AXON payment automation | NOT RUN |
| Video/audio | Playback, controls, fullscreen, codec/media behavior | NOT RUN |
| Redirects/popups/iframes | User-gesture popup, safe navigation, blocked schemes | NOT RUN |
| TLS/security | Invalid certificate blocks, safe-browsing event and site-info display | NOT RUN |
| Downloads/printing | Real file download, open/share/cancel, print/Save PDF chooser | NOT RUN |

A future live result must include date, exact URL, action, observed result and device/API identity. Simulated fixtures must never be reported as live sites.
