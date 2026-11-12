# AXON Web — Current-Project Integration Contract (Round 2 foundation)

## 1. Base and placement

Inspected base: `Axon-does-not-deserve-God-s-grace--main (24).zip`.

Observed placement:

- `src/App.tsx` currently renders a placeholder when the user selects Web mode: “Web is coming soon. AXON's own browser will live here.”
- `src/web/` contains pure helpers: `browserStepGuard.ts`, `pageToText.ts`, `sourceRecord.ts`, `linkAnalyzer.ts`, `outsideAiGate.ts`, plus related small utilities. It does not contain a complete browser engine, browser tab UI, session manager or browser storage implementation.
- `android-overlay/app/src/main/java/com/axon/app/MainActivity.java` is a Capacitor `BridgeActivity` and registers native plugins. Existing native plugin examples live under `android-overlay/app/src/main/java/com/axon/app/`.
- `android-overlay/manifest-additions.xml` is the manifest-overlay seam. The build workflow applies the Android overlay after Capacitor setup.
- `src/capabilities/` is the existing capability area. The exact registry API and brain routing contract must be checked by the Director at integration time; this return does not import or change it.

The repository `NOW.txt` still names roadmap v21.2 while the supplied current roadmap is v21.3. The main source ZIP is therefore a last-merge snapshot, not proof that all later Director work is present. This parallel return is deliberately delta-only.

## 2. Proposed module boundaries

```text
src/web/
  browserCommandGateway.ts       PURE: catalogue + permission decision
  browserController.ts           FUTURE: command execution coordinator
  browserSessionStore.ts         FUTURE: session/tab metadata and persistence contract
  browserEngineAdapter.ts        FUTURE: engine-neutral interface
  adapters/
    androidWebViewAdapter.ts      FUTURE: WebView candidate adapter
    geckoViewAdapter.ts           FUTURE: optional comparison adapter
  page/
    pageReader.ts                 FUTURE: live DOM/page extraction via safe engine APIs
    sourceCapture.ts              FUTURE: source records and capture provenance

android-overlay/
  .../browser/BrowserPlugin.java  FUTURE: narrow Capacitor plugin API
  .../browser/BrowserActivity.java FUTURE: isolated browser host Activity
  .../browser/BrowserTab*.java   FUTURE: native tab/engine lifecycle

src/components/browser/          FUTURE: owner-facing browser controls
src/capabilities/                FUTURE: AXON capability registration after executor proof
```

Only `browserCommandGateway.ts` exists in this return. All other entries are placement targets, not files claimed to exist.

## 3. Export/import contract for this return

`browserCommandGateway.ts` exports:

- `BrowserFunctionId` — typed ID for each declared browser function.
- `BROWSER_FUNCTIONS` — immutable function catalogue.
- `getBrowserFunction(id)` and `listBrowserFunctions(group?)` — catalogue lookup.
- `BrowserCommandRequest` — actor, measured engine support, browser session, optional tab, and narrowly scoped grants/approval.
- `decideBrowserCommand(request)` — pure decision result; it never executes a command.

The owner UI and AXON capability caller must both call the same `decideBrowserCommand` and then route an allowed action to the same future `BrowserController`. Neither caller may implement a parallel permission policy.

The future controller owns execution and revalidation. It must not trust a stale decision: it re-checks the current tab/session, engine support, owner grants and a short-lived single-use approval immediately before execution.

## 4. Session and tab ownership

- Every request carries a `session` context. `session.owner` is `OWNER` or `AXON`.
- AXON starts in its own session context. It cannot inspect the owner's history, bookmarks, cookies, tabs or account state merely because the same browser engine is used.
- Owner-session access requires an exact session ID plus function grant.
- Owner-tab access additionally requires that the owner selected that exact tab and granted the exact tab ID plus function.
- A tab's owner must match the AXON request's session owner. A mismatch is rejected as invalid context.
- The persistent storage schema must key records by session/profile context from the beginning, even though the first runtime may expose only the default owner context and AXON task context.

## 5. Native bridge boundary

- The web page rendered by the browser engine is untrusted content.
- No AXON privileged bridge, private storage API, capability registry, file system API or credential API is injected into arbitrary website JavaScript.
- The native plugin exposes only explicit typed browser operations to the trusted AXON app shell.
- Page content, DOM text, titles, link labels and downloaded files are data, never owner instructions or capability grants.
- File uploads use Android's scoped system picker. Websites never receive broad access to AXON's private storage.
- TLS/certificate failures are not bypassed. Popups, redirects, external intents and downloads are handled by the browser controller.

## 6. Existing helper reuse candidates

- `linkAnalyzer.ts`: URL normalization, credential/tracking parameter redaction and descriptive URL flags; it is not a malicious-site verdict.
- `pageToText.ts`: bounded HTML-to-text conversion; it is not a live DOM engine or a substitute for accessibility APIs.
- `sourceRecord.ts`: source provenance record creation; it labels records `REPORTED`, not `VERIFIED`.
- `browserStepGuard.ts`: existing step-level policy helper; its action vocabulary and policy must be reconciled with the new function catalogue before any wiring.
- `outsideAiGate.ts`: outside-AI request gate; future page content passed to external AIs must pass its redaction/permission process.

These helpers were identified as reuse candidates only. This batch does not change or call them.

## 7. Engine decision gate

No engine is locked by this return. The first native candidate should be Android System WebView through an engine adapter because it fits the existing Capacitor Android host. GeckoView remains a comparison candidate. Before selecting a production engine, measure on supported Android tiers:

1. compatibility with the required websites and web APIs;
2. active/background tab memory and renderer lifecycle;
3. APK growth and native dependency size;
4. security-update availability on older Android devices;
5. cookie/session isolation and file-picker/permission support;
6. media, PDF, PWA, WebAuthn and download/upload behaviour.

A browser UI or WebView wrapper is not a complete browser by itself. The host must implement the browser functions and prove them individually.

## 8. Integration stop conditions

Do not wire the gateway into `App.tsx`, `src/capabilities/`, `package.json`, the brain router, the Android manifest or `MainActivity.java` until the Director reviews this contract and supplies the exact current merge base. The next native-shell job belongs to a builder authorised for Android shell work (Grok), with a small named file lane, manifest diff and build proof. This ChatGPT return remains pure engine plus tests only.
