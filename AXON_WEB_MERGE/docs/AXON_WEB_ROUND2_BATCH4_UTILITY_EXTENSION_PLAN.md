# AXON Web — Batch 4 Utility Extension Plan

**Status:** Written before the extension implementation.
**Reason:** The seven-item continuation plan named more than Saved Browsing. This extension covers the safe, Android-host source-level utility subset that can be completed without pretending to have a working APK.

## 1. Objective

Extend the owner-facing browser utility layer beyond bookmarks/history/reading-list with a coherent set of native browser actions. Keep every action behind the existing BrowserController -> typed Capacitor plugin -> Android host path. Do not enable AXON to execute these actions on the owner session.

## 2. Planned utility set

| Area | Operations in scope | Deliberate boundary |
|---|---|---|
| Downloads | List, open completed item, share completed item, cancel/remove tracked item | Android DownloadManager does not provide a general pause/resume API; retry and open-folder are deferred. Only downloads initiated by AXON Web and tracked locally are listed. |
| Current URL | Copy URL; share URL through Android chooser | Share opens owner-controlled system UI. |
| Print/PDF | Open Android print service; offer Save as PDF through the print UI | PDF destination is selected by the owner in Android's print service; AXON does not silently write files. |
| Site information | Read current origin, scheme, TLS/certificate subject and issuer when WebView exposes them | This is informational only, not certificate-chain validation or a replacement for WebView TLS handling. |
| Site permissions | Report current host's fixed browser permission policy | Camera/microphone/geolocation remain denied; this batch does not create a permission-grant UI. |

## 3. Explicit exclusions

- Download pause/resume/retry/open-folder functions.
- Dynamic camera, microphone, geolocation or notification grants.
- Credential/passkey/autofill/payment handling.
- Full certificate-chain verifier or third-party safe-browsing service.
- AXON access to the owner host.
- Any roadmap, NOW, Director board, brain-router, capability-registry or unrelated file changes.

## 4. Implementation order

1. Extend the native Java host with tracked DownloadManager IDs, copy/share, print/PDF handoff and read-only site information.
2. Expose methods through the Capacitor plugin, TypeScript types and AndroidWebViewAdapter.
3. Add BrowserController dispatch for only the catalogue IDs with implementations.
4. Update parity classifications and tests so unsupported download controls remain NOT_IMPLEMENTED.
5. Re-run the focused controller, parity, type, Java syntax, overlay and ZIP checks.

## 5. Acceptance evidence

- Controller tests prove each added function reaches its named native adapter method.
- Static tests confirm corresponding Java/Capacitor methods and UI actions exist.
- AXON actor is denied all owner-host utility commands.
- The parity matrix counts only functions with source implementations.
- Java syntax parsing is recorded separately from actual Android/Capacitor compilation. Actual compilation and device behavior remain blocked until the build environment is available.
