# AXON Screen Intelligence Engine — Round 2 Build Report

**Source:** `Axon-does-not-deserve-God-s-grace--main (24).zip`  
**Architecture basis:** `AXON_SCREEN_INTELLIGENCE_ROUND1_ARCHITECTURE_PLAN.md`  
**Round:** 2 — First working capture foundation  
**Implementation status:** Built as a prototype; platform build/device verification remains blocked.  
**Roadmap changes:** None.  
**Unrelated cleanup:** None intended.

## 1. Round 2 result

The first capture foundation has been added as a separate capability. The original `Interface Capture` capability and screen remain explicitly marked as a shell; they were not falsely relabelled as a working screen reader.

The new capability is `cap.screen-intelligence-engine`, registered separately as `0.1.0-prototype`.

The build contains:

- A platform-neutral capture observation contract.
- Session coordination requiring explicit user initiation and acceptance of the current disclosure.
- UTC, local date/time, timezone, UTC offset, monotonic time and monotonic-clock identity.
- Source sequence numbers and a separate ingestion sequence.
- An immutable observation envelope with source provenance and completeness.
- Bounded in-memory and IndexedDB preservation stores.
- Pinning and user-directed deletion of unpinned local observations.
- A browser DOM observer for the document AXON owns.
- An Android MediaProjection bridge and visible foreground recording service.
- Video-only MP4 segments, one JPEG keyframe thumbnail per completed segment, and JSONL segment/gap manifests.
- Storage quota checks, storage statistics, session listing and explicit session deletion.
- Recovery scanning for incomplete or unindexed files left by process interruption, plus stale-session reconciliation if Android kills the capture process.
- A composite adapter so Android recording and AXON-owned DOM observation can share one session/timeline.
- A separate registered capability; no modification to the old Interface Capture screen.

## 2. What works in the prototype

### 2.1 Android visual capture path

The Android native adapter uses the Android MediaProjection consent flow. Each capture start creates a new system capture-consent request. Once consent is granted, a foreground service displays a persistent notification with a Stop action and records the visible screen across apps.

The service writes video-only MP4 segments to AXON's private app files directory. It does not request microphone audio and does not call `MediaRecorder.setAudioSource`.

Each completed segment gets:

- A session ID and segment sequence.
- A video file path.
- A JPEG keyframe thumbnail path where extraction succeeds.
- UTC start/end timestamps.
- Local start/end timestamps.
- Timezone ID and UTC offset.
- Android elapsed-realtime start/end values.
- Duration, dimensions, frame rate, bitrate and file size.
- Any known gap before the segment.

A `segments.jsonl` manifest indexes completed segments. `gaps.jsonl` and `recovery-gaps.jsonl` record known capture interruptions, storage pressure, incomplete segments and recovery findings.

The Android adapter exposes capabilities, status, segments, sessions, storage statistics and explicit session deletion.

### 2.2 AXON-owned browser/interface path

The browser DOM adapter observes only the document AXON owns. It does not automatically gain access to a third-party website's internal DOM if that website is isolated in a cross-origin frame or separate browser context. It uses a debounced MutationObserver and emits an initial snapshot and later screen-transition snapshots. It pauses emitting while the document is hidden and emits a fresh snapshot when the document becomes visible again.

It extracts visible semantic elements such as headings, buttons, links, fields, images, navigation, lists and dialogs. It records parent relationships and visible bounds. It does not read entered form values. Password/hidden fields are redacted or excluded. Page URLs are stored without query strings or fragments.

This is structured DOM observation, not a screenshot and not a way to inspect arbitrary third-party apps outside AXON's browser context.

### 2.3 Preservation and processing separation

The capture coordinator commits each observation to preservation before placing its ID in the bounded analysis queue. If the analysis queue is full, the observation remains preserved and an `analysis-deferred` gap/diagnostic is recorded. If storage fails, the coordinator returns an explicit preservation failure instead of claiming success.

The first build does not include OCR or visual understanding. The MP4 segments are preserved so later analysis can decode them progressively.

## 3. Default Android recording profile

These are initial defaults, not a device target or a claim that every device has identical performance:

| Setting | Default | Current bounds/behaviour |
|---|---:|---|
| Segment duration | 30 seconds | 5–120 seconds, then reduced to fit the estimated segment budget |
| Frame rate | 15 fps | 5–30 fps |
| Video bitrate | 1.8 Mbps | 0.5–8 Mbps |
| Maximum recording dimensions | 1920 × 1080 | Aspect ratio preserved; fallback retries reduce dimensions, frame rate and bitrate if encoder setup fails |
| Capture storage quota | 256 MiB | 16 MiB–4 GiB per configured quota; applies to the accumulated capture directory |
| Audio | Off | No microphone or playback audio capture |

The 1080p cap and defaults are initial prototype settings. Device-specific codec selection, dynamic thermal/battery/memory adaptation and adaptive motion-triggered recording are not complete. The architecture is not limited to 4 GB RAM or Android 11.

## 4. Important limitations — do not treat this as the finished screen reader

The Round 2 build is a capture/preservation foundation, not the complete Screen Intelligence Engine.

Not implemented yet:

1. Android accessibility-tree observation.
2. App/window identity and structured screen-transition events outside AXON's own browser.
3. A direct on-demand screenshot API; current Android still extraction is a keyframe thumbnail from each video segment.
4. OCR.
5. Image, icon, object, chart or diagram recognition.
6. Video scene understanding and frame-by-frame analysis.
7. Automatic motion/backlog-based start/stop or adaptive capture activation.
8. The separate Screen Action Engine for AXON-assisted taps, scrolling, typing or navigation.
9. A dedicated user-facing session manager/status/history screen.
10. A prominent disclosure UI wired to a visible Start button. The disclosure text and consent-receipt contract are present, but the caller must display the disclosure and obtain the user's affirmative action before creating the receipt. The OS MediaProjection prompt and Android notification permission are additional gates.
11. App-level encryption of each MP4 segment. Files are stored in AXON's private app sandbox; this is not a substitute for a future explicit encryption-at-rest and key-management review.
12. iOS, desktop and other platform screen-capture adapters.

The user can continue to navigate normally while Android MediaProjection records the visible screen. The engine does not yet provide AI-assisted navigation or take control of other apps.

## 5. Platform and policy boundary

No Android AccessibilityService was added in this round. Current Google Play policy distinguishes genuine disability-support accessibility tools from general-purpose assistants, requires prominent disclosure/affirmative consent for other uses of the Accessibility API, and prohibits using that API to power agents that autonomously initiate, plan and execute actions. That is a significant distribution constraint for the future AXON screen-reading/action design; it must be resolved before adding a general-purpose AccessibilityService.

The first Android adapter therefore uses the user-approved MediaProjection screen-capture flow and a visible media-projection foreground service. It asks for notification permission on Android 13+ so the active recording notification and Stop control can remain visible. A stale persisted `active` marker is reconciled to `interrupted` when the service process is no longer active. Protected/secure content may be blank or unavailable. The engine must not bypass those restrictions.

Official references:

- Android MediaProjection: https://developer.android.com/media/platform/av-capture
- Android 14 MediaProjection consent/session rules: https://developer.android.com/about/versions/14/behavior-changes-14
- Android foreground service types: https://developer.android.com/develop/background-work/services/fgs/service-types
- Google Play AccessibilityService policy: https://support.google.com/googleplay/android-developer/answer/10964491
- Capacitor custom Android plugins: https://capacitorjs.com/docs/v6/android/custom-code

## 6. How the runtime is intended to be called

The caller must first show `runtime.disclosure.body` in a prominent screen and wait for an affirmative user action. Only then may it create the receipt and start the session:

```ts
const runtime = createScreenIntelligenceRuntime();

// First display runtime.disclosure.body and receive the user's explicit acceptance.
const consentReceipt = runtime.createConsentReceipt(true);

const session = await runtime.startFromUserAction(consentReceipt, {
  segmentDurationSeconds: 30,
  frameRate: 15,
  bitrate: 1800000,
  maxStorageBytes: 268435456,
});

// Later, at the user's request:
await runtime.stop('user-stop');
const segments = await runtime.listNativeSegments();
const sessions = await runtime.listNativeSessions();
const storage = await runtime.getNativeStorageStats();
```

The example is an integration contract, not a UI already present in AXON. Do not call `createConsentReceipt(true)` before the user has accepted the displayed disclosure.

## 7. Files added or changed

### Added

- `src/screen-intelligence/contracts.mjs`
- `src/screen-intelligence/memory-store.mjs`
- `src/screen-intelligence/indexeddb-store.mjs`
- `src/screen-intelligence/capture-coordinator.mjs`
- `src/screen-intelligence/browser-dom-adapter.mjs`
- `src/screen-intelligence/android-media-projection-adapter.mjs`
- `src/screen-intelligence/composite-adapter.mjs`
- `src/screen-intelligence/index.mjs`
- `src/screen-intelligence/native-plugin.ts`
- `src/screen-intelligence/runtime.ts`
- `src/capabilities/registerScreenIntelligence.ts`
- `android-overlay/app/src/main/java/com/axon/app/screencapture/ScreenCapturePlugin.java`
- `android-overlay/app/src/main/java/com/axon/app/screencapture/ScreenCaptureService.java`
- `tests/screen-intelligence.test.mjs`
- `docs/AXON_SCREEN_INTELLIGENCE_ROUND1_ARCHITECTURE_PLAN.md`
- `docs/AXON_SCREEN_INTELLIGENCE_ROUND2_BUILD_REPORT.md`
- `docs/SCREEN_CAPTURE_SESSION_DISCLOSURE.md`

### Modified

- `src/main.tsx` — registers the new Screen Intelligence Engine capability separately.
- `android-overlay/app/src/main/java/com/axon/app/MainActivity.java` — registers the new native plugin.
- `android-overlay/manifest-additions.xml` — adds MediaProjection foreground-service permission and declaration fragment.
- `scripts/apply-android-overlay.sh` — copies the native plugin/service and adds their manifest entries idempotently.
- `tools/run-tests.mjs` — includes dependency-free `.test.mjs` tests as well as the existing TypeScript tests.

The existing Interface Capture UI and shell-only capability were not rewritten or falsely marked complete. The roadmap was not changed.

## 8. Test and validation evidence

### Baseline before edits

`node --test tests/*.test.mjs`

- 1 Node test file passed (`snapshot.test.mjs`).
- That test reported 13 internal snapshot checks.

### After Round 2 edits

`node --test tests/*.test.mjs`

- 13 top-level Node tests passed across 2 `.test.mjs` files.
- 12 new Screen Intelligence tests passed.
- Existing snapshot test passed, including its 13 internal checks.

The new tests cover timestamp structure, immutable/versioned observations, explicit consent gates, preservation despite a full analysis queue, bounded storage and pin protection, storage-pressure reporting, permission-revocation handling, DOM redaction/URL sanitisation, Android native source/manifest expectations, final-segment ordering on stop, and composite source operation.

Additional checks:

- `node --check` passed for the new dependency-free JavaScript modules and test runner.
- `bash -n scripts/apply-android-overlay.sh` passed.
- `node tools/run-tests.mjs screen-intelligence` and `node tools/run-tests.mjs snapshot` both passed through the updated test runner.
- Targeted TypeScript type-check passed for the new runtime, native plugin types and capability registration using system TypeScript 5.8.3 and a minimal local `@capacitor/core` declaration shim.
- Java syntax parsing passed for the two new native classes and `MainActivity`; this was syntax parsing only, not Android type resolution or compilation.
- The Android overlay script was applied twice to a synthetic Android manifest. XML parsing passed; the MediaProjection permission and both service declarations appeared exactly once after the second application.

### Blocked validation

- `npm ci --ignore-scripts --no-audit --no-fund` could not complete because package-registry DNS/network requests failed with `EAI_AGAIN`. The local `node_modules` was incomplete.
- Therefore the full TypeScript suite, TypeScript type-check, Vite production build and Capacitor sync were not run.
- The supplied source ZIP contains `android-overlay/` but no generated `android/` Gradle project. Therefore the native Java plugin/service could not be compiled against the actual Capacitor/Android SDK in this environment.
- No physical Android device test was run. MediaProjection consent, foreground notification, MP4 playback, keyframe extraction, rotation behaviour, storage limits and revocation still require device verification.

## 9. Round 2 verdict

**PARTIAL — shared capture foundation and Android native implementation source are built; Android compilation and device validation are not proven.**

The first working engine foundation now exists in source, but it must not be described as a fully verified Android feature or a completed screen reader. Round 3 must begin with restoring dependencies and generating/synchronising the Android project, then compile, install and test on the current Android device. It must correct failures before expanding into OCR, visual intelligence, accessibility-tree access or screen actions.
