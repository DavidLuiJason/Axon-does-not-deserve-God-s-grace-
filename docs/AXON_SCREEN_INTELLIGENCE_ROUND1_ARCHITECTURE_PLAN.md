# AXON Screen Intelligence & Interface Capture
## Round 1 — Architecture Review, Corrections, and Complete Engineering Plan

**Document status:** Round 1 design proposal  
**Implementation status:** Not started  
**Next rounds:** Round 2 — Build the first working engine; Round 3 — System testing, correction, and acceptance.

---

## 1. Corrected product direction

AXON is intended to work across devices. Android 11 on a 4 GB phone is one current test environment, not the product's hardware target or architectural limit. The design must adapt to the capabilities, resources, operating-system rules, and permissions of each supported device at runtime.

The system must observe and process the screens the user visits while a capture session is activated—not only AXON screens. The user must be able to benefit from it directly, and AXON's brain and other AXON capabilities must be able to request its information.

AXON Web and AXON Browser are one integration target, not two separate products or duplicated integrations.

The previous proposal had the right broad idea but was not sufficiently precise about capture scope, platform restrictions, data loss, recording policy, queue control, privacy, or which component owns each responsibility. This document corrects those weaknesses.

## 2. Names and boundaries

Use these names provisionally until the Director approves them:

- **Capture Core:** Shared capture-session, source coordination, timestamping, ingestion, and storage foundation.
- **AXON Screen Intelligence Engine (ASIE):** The reusable capability that observes screens, builds structured representations, and progressively understands their content.
- **Screen Preservation Engine:** Retains captured observations, frames, and sequences that cannot be processed immediately or that the user asks to keep.
- **AXON Internal Interface Capture:** The AXON-specific consumer of Capture Core, used to inspect, document, compare, and test AXON's own interfaces.
- **Screen Action Engine:** A separate, permission-controlled capability for carrying out user-authorised navigation or actions. It is not part of the observation or recording pipeline.

The old Interface Capture purpose is not deleted. It becomes one consumer of shared capture infrastructure. It must not own, contain, or be required to open the general Screen Intelligence Engine.

## 3. Problems in the earlier architecture and their corrections

| Earlier weakness | Risk | Correction |
|---|---|---|
| Too many named engines without clear ownership | Duplicate work, circular dependencies, and unclear responsibility | Use a small number of layers and explicit contracts. OCR, visual recognition, frame capture, and recording are modules behind shared interfaces, not independent applications. |
| Screenshot capture, rapid frames, and recording overlapped | Multiple components could capture the same screen, waste resources, or disagree about timestamps | One Capture Coordinator arbitrates capture sources and issues one ordered observation stream. Screenshot and video are different source types feeding the same ingestion contract. |
| “Capture every screen” was not defined | Could mean every app transition, every visual change, or every video frame | Define screen coverage separately from video-frame coverage. During an activated session, attempt to observe every eligible screen/window transition. Continuous capture of every frame is a separate, explicitly authorised mode and cannot be guaranteed on every device. |
| No platform capability model | Android, iOS, desktop, and browsers provide different access | Use platform adapters and runtime capability discovery. Never assume a permission or API exists just because another device has it. |
| The design implied that all screens can always be captured | Secure, DRM, protected, inaccessible, or OS-owned screens may be unavailable | Report supported, unavailable, blocked, and partially observed states. Never bypass secure-content protections. |
| “No data is ever missed” was too strong | Hardware, OS, permission, queue, or storage limits can cause gaps | Guarantee that gaps and dropped data are recorded and reported when detectable—not that every frame can always be captured. |
| Processing and capture were too tightly coupled | Slow OCR or image recognition could block capture and cause data loss | Separate capture/ingestion from analysis. Preserve first; analyse progressively. Use bounded queues and explicit backpressure. |
| No storage policy was defined | A rolling buffer or recording could fill the phone | Use bounded memory buffers, segmented disk storage, quotas, retention rules, and a visible storage-pressure policy. |
| The brain's authority was unclear | The brain could silently expand capture scope or act beyond consent | User consent defines the maximum scope. Automatic rules may adapt capture within that scope. The brain may prioritise, request, pause, or stop within granted permissions; it cannot grant itself new permissions. User stop always wins. |
| Background operation was described too broadly | OS may suspend or kill work; some capture requires a visible foreground session | Distinguish background processing from background screen access. Use only platform-supported lifecycle mechanisms and show active status where required. Recover safely after interruption. |
| Privacy and sensitive screens were under-specified | Passwords, banking data, messages, and personal content could be retained unnecessarily | Local-first processing, per-app exclusions, sensitive-field redaction, encryption, retention controls, explicit external-sharing consent, and respect for secure-window flags. |
| User navigation and AXON automation were mixed together | The engine could unexpectedly interfere with the user's touch or become an uncontrolled agent | The user continues to navigate normally. The observation engine does not take control. Optional actions are a separate subsystem with explicit authorisation and verification. |
| No timing model existed | Events, screenshots, and extracted text could be ordered incorrectly | Timestamp every observation and frame with wall-clock and monotonic time, sequence numbers, source provenance, and processing timestamps. |

## 4. What “everything on every screen” means

When the user activates a Screen Intelligence session and grants the required platform permissions, the engine should follow the active screen across supported apps and windows. It should not be limited to AXON or to a preselected app list unless the user chooses exclusions.

For every eligible screen transition, it should attempt to create an observation containing the available structured interface information and a visual snapshot when permitted. For screens that keep changing, it should detect motion or repeated visual changes and decide whether adaptive frame preservation is necessary.

There are two different completeness requirements:

1. **Screen-transition coverage:** Observe each eligible screen/window transition during the active session, recording any transitions that the platform does not expose or that the engine fails to capture.
2. **Video-frame coverage:** Capture every frame only when a platform capture stream, device capacity, session permission, and configured recording mode support it. Otherwise, capture selected frames/keyframes and record the sampling policy and gaps.

This distinction prevents a false promise that a screenshot-based observer can preserve every frame of every video.

## 5. Corrected architecture

```text
                      USER / AXON BRAIN / AXON TOOLS
                                  |
                         SCREEN INTELLIGENCE API
                                  |
                     SESSION + PERMISSION MANAGER
                                  |
                         CAPTURE COORDINATOR
                                  |
             +--------------------+--------------------+
             |                    |                    |
       SCREEN SOURCES       FRAME/VIDEO SOURCES    INTERNAL SOURCES
       - accessibility      - screenshot stream    - AXON UI tree
         events/tree        - screen recording     - AXON component
       - browser DOM        - rapid keyframes        metadata
       - native adapters    - platform video API   - test fixtures
             |                    |                    |
             +--------------------+--------------------+
                                  |
                       NORMALISED INGESTION PIPELINE
                 timestamps / sequence / provenance / gaps
                                  |
                    +-------------+-------------+
                    |                           |
              PRESERVATION PATH            LIVE ANALYSIS PATH
              - RAM rolling buffer         - tree normalisation
              - compressed segments        - OCR
              - frame/keyframe store        - layout and controls
              - durable index               - image/object analysis
              - retention/quota             - scene/change analysis
                    |                           |
                    +-------------+-------------+
                                  |
                      SCREEN TIMELINE / KNOWLEDGE STORE
                                  |
                  +---------------+----------------+
                  |               |                |
             USER VIEW       AXON INTERNAL     AXON APPS + AXON
             & REVIEW         INTERFACE        WEB/BROWSER
                                  |
                     OPTIONAL SEPARATE ACTION ENGINE
                     (user-authorised actions only)
```

### 5.1 Platform capability and source adapters

The core must not call Android APIs, iOS APIs, or desktop APIs directly from shared business logic. Each platform adapter reports its available capabilities and limitations.

Capability examples include:

- `accessibility_tree_read`
- `accessibility_events`
- `screen_snapshot`
- `continuous_screen_stream`
- `hardware_video_encode`
- `browser_dom_read`
- `axon_native_interface_read`
- `multi_window_or_display`
- `user_authorised_screen_actions`
- `secure_content_exclusion`

Each capability reports its status (`available`, `permission_required`, `unsupported`, `temporarily_unavailable`, or `blocked_by_platform`) and a reason. The engine selects the best permitted source rather than assuming all sources are available.

Initial adapters should be designed so Android can be implemented first and other platforms can be added without redesigning the shared data model. Do not claim cross-platform support until each platform adapter has been implemented and tested.

### 5.2 Capture Coordinator

This is the single owner of an active capture session. It:

- starts and stops sessions;
- checks the user's selected scope and granted permissions;
- selects available source adapters;
- prevents duplicate capture work;
- handles app/window/display changes;
- coordinates screenshots and video streams;
- records interruptions and permission revocations;
- exposes an accurate active/paused/stopped status.

The coordinator does not perform OCR or heavy visual reasoning itself.

### 5.3 Normalised ingestion pipeline

All source adapters emit a common event envelope. At minimum it contains:

- session ID and monotonically increasing sequence number;
- source type and platform adapter ID;
- application/package/bundle identity when available and permitted;
- display/window identity and screen bounds;
- capture time, ingest time, and source timestamp where available;
- wall-clock timestamp in UTC;
- device monotonic timestamp for reliable ordering;
- timezone ID and UTC offset at capture time;
- content reference (tree, screenshot, frame, or segment);
- permission and capture-mode state;
- privacy classification/redaction state;
- quality, confidence, and completeness metadata;
- explicit gap/error information when capture was incomplete.

Raw observations should be immutable once committed. Analysis results are separate, versioned records linked to the observation they describe. This prevents later AI interpretation from overwriting what was actually captured.

### 5.4 Timestamp and timeline rules

Every screen event, screenshot, frame, video segment, text extraction, and analysis result must have detailed timestamps.

Store at least:

- `capturedAtUtc`: ISO 8601 UTC timestamp with millisecond precision where the source permits;
- `capturedAtLocal`: local ISO 8601 timestamp including the actual UTC offset;
- `timeZoneId`: IANA timezone identifier when available;
- `monotonicTimeNs` or the platform's equivalent elapsed monotonic time;
- `sequenceNumber`: increasing within a session;
- `ingestedAtUtc` and `processedAtUtc` for later pipeline stages;
- video presentation timestamp (PTS) when supplied by the capture source.

Wall-clock time can change because of manual changes or time synchronisation. Use monotonic time and sequence numbers for ordering within a session; use UTC/local timestamps for human-readable history. Record detected clock changes rather than silently reordering events.

### 5.5 Preservation Engine

Preservation is a first-class pipeline, not a side effect of OCR.

It has three storage stages:

1. **Short rolling memory buffer:** Holds recent frames/events for a bounded time or byte budget. It must never grow without limit.
2. **Durable segment spool:** Writes selected frames or encoded video segments to local storage in small, recoverable units. A crash should not corrupt the entire session.
3. **Indexed retained history:** Stores preserved assets, observation metadata, extracted data, timestamps, and links between them for later processing and user review.

Use atomic segment finalisation, checksums, an append-only session journal, and recovery of unfinished segments. Use content hashes to avoid storing duplicate static images repeatedly where safe. Do not keep every decoded full-resolution bitmap in RAM.

Storage policy must include:

- user-configurable storage quota and retention period;
- separate budgets for transient buffer and retained captures;
- prioritisation of user-pinned captures, screen transitions, important state changes, and requested evidence;
- automatic deletion only according to an explicit retention policy;
- a warning before storage pressure causes reduced capture or deletion;
- a `GapRecord`/failure record whenever material is dropped, inaccessible, or not preserved;
- a user-accessible review, export, and delete mechanism.

### 5.6 Adaptive capture and recording policy

Do not continuously record at maximum resolution and frame rate by default. Do not rely on a single “screen is moving fast” test either.

The Capture Coordinator combines signals such as:

- accessibility screen/window transition events;
- explicit video playback or animated-content information from an owned browser/app integration;
- change rate between sampled frames;
- scroll/gesture activity where available;
- backlog growth and time-to-process estimates;
- available memory, storage throughput, battery, and thermal state;
- current user task and preservation priority.

Use four operational states:

- **Off:** No general screen session is active.
- **Observe:** Capture eligible screen transitions and available structured information; take snapshots according to the observation policy.
- **Adaptive Preserve:** Temporarily increase capture frequency or preserve short sequences when rapid change, important content, or processing overload makes it useful.
- **Explicit Continuous Record:** A clearly user-started recording session, subject to platform consent and visible status.

Adaptive Preserve may activate automatically only after the user has enabled that behaviour for the current capture session/profile. It must remain within the consent and permission scope already granted. The brain can ask the controller to prioritise, pause, or stop preservation, but it cannot silently broaden the session or defeat a platform stop.

The recording path should prefer a native encoded stream when available rather than repeatedly creating large uncompressed screenshots. If only screenshots are available, use bounded sampling and document that frame coverage is incomplete.

### 5.7 Backpressure and processing scheduler

Capture and analysis must not share one blocking queue.

Use separate bounded queues for:

- session/control events;
- screen-tree observations;
- screenshots/keyframes;
- video segments;
- OCR and visual-analysis jobs.

When processing falls behind:

1. Commit essential event metadata and timestamps first.
2. Preserve important observations/segments within quota.
3. Return a quick partial screen representation.
4. Defer expensive OCR, recognition, or reference lookup.
5. Reduce optional analysis quality or sampling based on the device profile.
6. Record every known dropped frame, skipped job, or unavailable source.

Never create an unbounded backlog. If the device cannot preserve incoming data at the current rate, the controller must reduce the capture rate or stop the session safely and report the exact limitation. It must not claim that everything was saved.

### 5.8 Screen analysis and understanding

The analysis pipeline progressively enriches each observation:

1. Parse the structured accessibility/browser/native tree when present.
2. Build a hierarchy of regions, text, controls, links, images, and relationships.
3. Run OCR on regions where structured text is absent or incomplete.
4. Detect visual elements, icons, objects, diagrams, charts, and layout regions.
5. Recognise image/video content and attach confidence plus evidence.
6. Compare with local knowledge or a permitted reference source when identification is uncertain and the task benefits from it.
7. Use external search or an external AI only when allowed by the user's settings and the data-sharing rules.
8. Update the timeline with processing status and new interpretations without changing the original captured evidence.

A detected image must not automatically trigger a web search. The engine should first determine whether it can identify the image locally, whether identification is actually needed, and whether the user or task permits external lookup. It must distinguish observation (“a brown bird with a curved beak”) from inference (“possibly a hornbill”) and from verified reference information.

### 5.9 Shared screen representation

The API should expose a versioned, platform-neutral representation containing:

- session, observation, and sequence IDs;
- application/window/display identity when available;
- viewport dimensions, density, orientation, and coordinate space;
- UI hierarchy and element IDs;
- element type, text, bounds, visibility, enabled state, relationships, and available actions;
- visual-asset and screenshot references;
- capture source and provenance for each field;
- confidence and uncertainty;
- sensitive/redacted flags;
- capture and processing timestamps;
- completeness, quality, and known gaps;
- links to related frames, clips, and previous/next screen states.

The schema must be versioned and extensible. A browser DOM node, Android accessibility node, and OCR-detected text box must not be treated as equally authoritative; source provenance must remain attached.

### 5.10 User access and optional actions

The user must be able to use the engine without AXON's brain being active. The user continues navigating normally. The engine can provide live descriptions, extracted screen information, saved history, and user-requested assistance.

The Screen Action Engine remains separate. Any action support must be explicit, permission-controlled, and confirmed according to risk. The observation engine must never tap, type, scroll, or navigate merely because it detected an element. It must not intercept or hijack ordinary user interaction.

## 6. Universal-device strategy

The shared engine is device-independent; capture adapters are not.

At session start and whenever conditions change, collect a capability profile:

- operating system and supported API features;
- available accessibility/DOM/native sources;
- screenshot and stream support;
- hardware encoder and supported formats;
- display count, size, density, and refresh characteristics;
- current memory headroom and system memory class;
- CPU/GPU/NPU availability where exposed;
- storage free space and write capability;
- battery and thermal state;
- background execution and permission constraints.

Use this live profile to choose capture quality, concurrency, buffer size, and analysis depth. Do not hardcode a 4 GB RAM target or reserve a fixed amount of RAM. Do not assume a new phone will have the same capabilities as the current test device.

The current Android 11 / 4 GB device is a compatibility and stress-test case. It is not the ceiling. Test on newer Android devices and other supported platforms as they become available.

## 7. Platform and policy constraints that must shape the design

### Android

Android AccessibilityService can expose the active window's structured node tree when the service is configured and permitted to retrieve window content. The root may be null, stale, or incomplete. On API 30 and later, the service API includes screenshot capture, subject to its declared capability and platform restrictions. MediaProjection offers a separate screen-stream path, but it requires explicit user consent and a properly declared foreground-service flow on modern Android. Android 14+ adds stricter one-session consent/token rules; newer releases add further foreground-service constraints.

The engine must respect `FLAG_SECURE` and other protected content. It must not attempt to defeat screen-capture protections.

**Distribution blocker to resolve before relying on AccessibilityService:** Google Play's current Accessibility API policy is restrictive. A general-purpose AI assistant must not assume it qualifies as an accessibility tool. The policy also restricts autonomous agents that use AccessibilityService to initiate, plan, and execute actions. If AXON is distributed through Google Play, the precise permitted use, disclosure, consent, declaration, and action model must be reviewed before implementation is locked. Do not build the architecture around an assumption that unrestricted agent automation through AccessibilityService will be publishable.

### Apple platforms

Apple's screen-capture APIs and system pickers are permission- and platform-controlled. Current Apple documentation describes user-selected screen capture/streaming, recording, and a rolling video buffer on supported versions. This does not justify promising silent, unrestricted, always-on access to every other app. The Apple adapter must report its actual supported scope on each OS/device version and use the system consent experience.

### Browser and AXON-owned interfaces

AXON Web/Browser should provide a direct browser DOM/accessibility adapter where the engine owns the browser context. This is more reliable and efficient than inferring the entire page from pixels. For websites or native apps outside an owned context, use only a supported and authorised platform source.

## 8. Security, privacy, and user control

Required safeguards:

- Capture is off until the user activates a session and grants required permissions.
- A clear, persistent status indicator is shown whenever the platform requires one or a capture session is active.
- A one-step stop control is always available.
- The user can exclude selected apps, windows, or content categories.
- Passwords, authentication codes, payment details, and other sensitive fields are redacted or excluded by default wherever identifiable.
- Secure/protected content is never bypassed. If the platform blocks capture, record only that it was blocked, not a workaround image.
- Local processing and local storage are the default.
- Sending a screenshot, frame, extracted text, or derived personal information to an external AI/search provider requires the applicable user permission and data-sharing policy.
- Stored captures are encrypted at rest where platform support permits, and access is limited to AXON components authorised for the session.
- Retention, export, and deletion are user-controlled and auditable.
- Screen capture does not silently include microphone or call audio. Audio, if ever added, is a separate feature and permission.

## 9. Failure handling requirements

| Failure or difficult screen | Required response |
|---|---|
| Accessibility tree unavailable or empty | Fall back to screenshot/OCR if permitted; mark source and completeness. |
| Custom canvas, game, video surface, or WebGL content | Use permitted visual capture; report that semantic controls may be unavailable. |
| Secure/DRM/protected screen | Respect the block; create a gap/status record; do not bypass. |
| Permission denied or revoked | Stop the affected source, update status immediately, preserve already committed data, and explain what is unavailable. |
| App switch, split screen, picture-in-picture, external display | Re-evaluate active windows/displays and update coordinate spaces and capability state. |
| Rotation, fold/unfold, resolution or density change | Start a new geometry epoch; do not reuse stale coordinates. |
| Screen locked or device sleeps | Follow platform lifecycle; mark interruption and recover only after permitted reactivation. |
| OS kills the process or device restarts | Recover committed segments and journal; mark the unobserved interval. Never invent missing observations. |
| Processing backlog | Apply bounded backpressure, preserve by priority, lower optional analysis, and record gaps. |
| Storage full or write failure | Stop or reduce preservation safely; never overwrite protected/user-pinned data silently; notify the user. |
| Thermal or battery pressure | Reduce optional analysis and capture quality according to policy; make the state visible. |
| Clock/timezone changes | Preserve monotonic ordering and record the wall-clock change. |
| Duplicate or repeated screen states | Link/deduplicate safe static assets while retaining distinct event timestamps and transitions. |
| OCR/vision uncertainty | Return uncertainty and evidence; never fabricate a confident identification. |

## 10. Performance and quality measurement

Do not set a universal RAM target or assume all devices have the same CPU, GPU, NPU, codec, storage, or battery. Measure and adapt.

Record at least:

- screen-event-to-ingestion latency;
- screenshot/frame capture latency;
- ingestion-to-first-useful-result latency;
- deep-analysis completion time;
- screen-transition coverage;
- captured, processed, preserved, sampled, and dropped frame counts;
- queue depth and oldest pending-job age;
- bytes written per minute and total session storage;
- CPU/GPU/NPU utilisation where available;
- memory high-water mark and allocation failures;
- battery and thermal impact;
- permission interruptions and recovery success.

Round 1 must define measurement methods and baseline scenarios. Numerical acceptance thresholds should be set only after measurements on representative devices, not invented in advance. The engine should expose its current quality/capture mode and explain when it degrades.

## 11. Test-first design and correction method

Testing is part of every round, not something postponed until the end.

### Round 1 — Design and feasibility validation (this round)

- Review the architecture against the failure cases in this document.
- Verify current platform API and policy constraints.
- Define the common event, timestamp, session, gap, storage, and capability contracts.
- Create test scenarios and expected outcomes before implementation.
- Identify go/no-go questions, especially AccessibilityService distribution policy and per-platform capture scope.
- Do not modify AXON's existing roadmap or unrelated source files in this round.
- Do not claim that the engine has been built or tested on a device. This round produces the approved design and test plan.

### Round 2 — Build the first working engine

Build a small but complete vertical slice, with tests run after each package:

1. Shared contracts, schema versioning, capability profile, and deterministic test fixtures.
2. Session manager, user activation, permission/status reporting, and stop/revocation handling.
3. First platform adapter (Android first because the current test device is Android), using supported accessibility observations and permitted screenshots.
4. A separately gated MediaProjection/recording adapter where the user grants the required session permission.
5. Unified ingestion with timestamps, sequence numbers, provenance, and explicit gap records.
6. Bounded rolling buffer and crash-recoverable segmented local preservation.
7. Basic screen timeline and API so AXON Internal Interface Capture and other consumers can request observations.
8. Minimal status/diagnostics surface; no large standalone UI is required.

Run unit tests, adapter tests, storage recovery tests, permission lifecycle tests, and device tests continuously. A package does not proceed while its required tests fail. OCR, image identification, advanced scene understanding, and autonomous action are later integrations; they must not be faked as completed capabilities in the first capture foundation.

### Round 3 — Full system testing and correction

- Test static screens, app switching, rapid scrolling, video, animations, long sessions, background/foreground transitions, and multiple windows/displays where supported.
- Test permission denial/revocation, secure screens, unavailable trees, OS interruption, crash recovery, storage exhaustion, thermal pressure, and clock changes.
- Verify timestamp alignment between accessibility events, screenshots, and video frames.
- Verify no unbounded queue growth and no silent data loss.
- Measure latency, resource use, frame/sample counts, and storage consumption on the current Android 11 phone and more capable devices when available.
- Correct failures, rerun affected tests, and then run the full regression suite.
- Produce evidence: build identifier, test counts/results, device/OS details, benchmark logs, known limitations, and a final status of PASS / PARTIAL / BLOCKED.

## 12. Round 2 acceptance gate

The first engine is not considered complete merely because a screenshot appears or a recording file is created. It must demonstrate all of the following:

- A user can explicitly activate and stop a supported capture session.
- The engine reports which sources are available and which are blocked.
- It observes eligible screen transitions across supported apps while the session is active.
- Every committed observation has a usable timestamp, sequence, and provenance.
- Screenshots and permitted recording segments are linked to the correct screen events.
- Preservation is bounded, recoverable, and reports gaps or dropped data.
- Heavy analysis cannot block the capture/ingestion path.
- Revoked permissions and platform stops are handled safely.
- Sensitive and secure content protections are respected.
- The same shared representation can be consumed by AXON Internal Interface Capture and later AXON Apps / AXON Web-Browser integrations.

## 13. Decisions intentionally left open until feasibility evidence exists

These decisions must be resolved by measured prototypes rather than guesses:

- Which platforms will be officially supported in the first public release.
- The precise Android capture-source combination and Google Play-compliant use of AccessibilityService.
- Per-device frame-rate, resolution, and segment-duration profiles.
- The initial storage quota and retention defaults.
- Which on-device OCR and visual-recognition models are suitable for each device class.
- Whether a platform permits the exact background continuation users expect.
- Which screen actions, if any, are permitted in each distribution channel.

## 14. Final design principle

**Observe what the user has authorised. Preserve what cannot be understood immediately. Process it progressively. Keep the original evidence separate from AI interpretation. Report every known limitation or gap. Never let AXON's brain override the user's permission or the operating system's protections.**

This is the foundation for both AXON Internal Interface Capture and the wider AXON Screen Intelligence Engine.

---

## Official platform references reviewed for this design

- Android AccessibilityService API: https://developer.android.com/reference/android/accessibilityservice/AccessibilityService
- Android foreground-service types and MediaProjection requirements: https://developer.android.com/develop/background-work/services/fgs/service-types
- Android MediaProjection callback and stop handling: https://developer.android.com/reference/android/media/projection/MediaProjection.Callback
- Android secure activities and FLAG_SECURE: https://developer.android.com/security/fraud-prevention/activities
- Google Play AccessibilityService policy: https://support.google.com/googleplay/android-developer/answer/10964491
- Google Play sensitive-permission and Accessibility API policy: https://support.google.com/googleplay/android-developer/answer/16558241
- Apple screen capture on iOS: https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-on-ios
