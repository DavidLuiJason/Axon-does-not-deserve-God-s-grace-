# AXON Web — Round 2, Batch 1 Return

**Job:** Shared Browser Command Gateway contract and permission-decision engine  
**Base inspected:** `Axon-does-not-deserve-God-s-grace--main (24).zip` (20,100,541 bytes; uploaded 2026-11-06)  
**Roadmap read:** `AXON_ROADMAP_V21_3.md` (74,852 bytes in Library metadata; uploaded 2026-11-06)  
**Repo state found:** `NOW.txt` still names roadmap v21.2 and `PLAN-B-ROUTER-R3` as the last merged job; it directs the Director to read `DIRECTOR_NAP.txt` and continue CHR1/DLG1/BUD1. This browser work is a separate owner-authorised parallel lane.  
**Return type:** new files only; no merge, no changes to the user's repository.

## 1. What this batch contains

- `src/web/browserCommandGateway.ts` — a pure, deterministic contract and permission decision engine.
- `tests/browserCommandGateway.test.ts` — focused test suite for the catalogue, context separation, approvals, handoffs and unsupported engine features.

The catalogue contains **117 browser function identifiers** across navigation, tabs, saved browsing, files, page tools, site security, accounts, settings and diagnostics.

## 2. Structure chart

```text
                    AXON WEB
                       |
          +------------+-------------+
          |                          |
      OWNER BROWSER                AXON BRAIN
          |                          |
          +------------+-------------+
                       |
            BROWSER COMMAND GATEWAY
                       |
             decideBrowserCommand()
                       |
          +------------+-------------+
          |            |             |
      CATALOGUE     CONTEXT       DECISION
      {function}    {session,      {ALLOW,
                     tab, grants}   ASK_OWNER,
                                    HANDOFF,
                                    NOT_READY,
                                    REFUSE}
                       |
                FUTURE EXECUTOR
                       |
              Browser Controller
                       |
               Browser Engine
             (not built in this batch)
```

Both the owner UI and AXON are intended to call the same function identifiers and the same gateway. This batch establishes the contract only; it does not yet connect either caller or execute browser operations.

## 3. Security and permission rules implemented

1. Every AXON request must identify a browser session. Owner sessions and AXON sessions are distinct.
2. AXON cannot read or change the owner's browser session unless an exact session-and-function grant is supplied.
3. Access to an owner tab additionally requires that the owner selected that tab and granted the exact tab-and-function pair.
4. Sensitive actions require an approval matching the exact function and tab. The native caller must issue and validate a short-lived, single-use approval; this pure engine only checks the binding fields.
5. Password entry, passkeys, sign-in, address autofill and payment autofill hand off to owner-controlled or Android system UI. AXON does not receive the credential secret.
6. Unsupported functions are refused. Unknown engine support returns `NOT_READY`; the gateway does not pretend the feature works.
7. This module does not decide whether a URL is safe. The future controller must use the existing URL hygiene checks and separate security reputation/certificate handling.

## 4. Current-project findings used for placement

- `src/App.tsx` currently says the Web mode is coming soon and that AXON's own browser will live there.
- The repository already has `src/web/browserStepGuard.ts`, `pageToText.ts`, `sourceRecord.ts`, `linkAnalyzer.ts` and `outsideAiGate.ts`. These are useful helpers, not a complete browser.
- `MainActivity.java` registers the existing Capacitor native plugins. The Android overlay is the likely native integration seam.
- `package.json`, the capability registry, the main screen and Android files were not changed. This follows the builder boundary in Roadmap V21.3 section 5.1–5.2: ChatGPT returns pure engines and tests only; the owner/Director handles integration and shared files.

## 5. LAW CHECK (FL11)

- **FL1 — Top view:** placed under `src/web`; later callers are the owner browser UI, AXON capability layer and native browser controller. No caller was wired.
- **FL2 — Exact scope:** inspected the current source ZIP only for intake tags, browser helpers, capability boundaries, Android plugin pattern and build configuration; no whole-source extraction or unrelated edits.
- **FL3 — End-to-end plan:** the gateway contract includes both owner and AXON actors and preserves the future native executor boundary.
- **FL4 — Progress/no repeats:** one pure engine and one focused test file; no shared hot files or package-script edits.
- **FL8 — Export:** no export files, repository source, or workflow files changed.
- **FL10 — Chat/capability truth:** catalogue identities are explicit; the engine reports unsupported and not-ready functions honestly. The catalogue is not yet registered with the AXON brain.
- **FL11 — Every-Stage:** this list is repeated in this report.
- **FL12 — One designed brain:** AXON is only a caller through the future capability gateway; no direct UI/native bypass was added.
- **FL13 — Structure before vocabulary:** no phrase matching or fixed phrase lists were added.

## 6. Test evidence

- **MEASURED:** `node --experimental-strip-types tests/browserCommandGateway.test.ts` — 25 checks passed.
- **MEASURED:** strict TypeScript check of the pure engine with global `tsc` (`--noEmit --strict --target ES2022 --module ES2022 --moduleResolution bundler --skipLibCheck`) — passed.
- **NOT RUN:** repository `test:kernel` / `test:all` (this was an isolated return, not an unpacked repository).
- **NOT RUN:** Vite build, Android Gradle build, GitHub Actions APK, Android 11 phone test, WebView/GeckoView benchmark.
- **NOT RUN:** real browser navigation, tabs, downloads, uploads, permissions, media, login, passkeys or page extraction. No browser runtime exists in this batch.

Two early test runs exposed distinct issues: the first revealed that an invalid approval function ID was not rejected; the second was a duplicated session fixture in the test data. Both were diagnosed and corrected. The final 25-check run and strict engine type check passed. These are not independent Director acceptance tests; Director review is still required.

## 7. Explicit non-deliverables

- No native Android browser Activity, WebView, GeckoView or engine adapter.
- No browser UI or tab manager.
- No database, history, bookmarks, download manager or file picker.
- No capability-registry wiring or brain routing.
- No `package.json`, workflow, manifest, shared registry or existing file changes.
- No Incognito, New ID, Save Incognito Tab, Stealth Mode, VPN or kill switch.

**Incognito and Stealth remain separate future systems:** Incognito concerns isolated browser sessions and saved tabs; Stealth concerns network protection and must fail closed if a required protection fails. Neither is implemented here.

## 8. Required next work

1. Director reviews this return and its permission model.
2. Build the native engine adapter and browser host as a separate Grok shell job, with WebView as a measured candidate—not a permanently locked engine—then compare compatibility, memory, APK growth and security update path against GeckoView on the target device tier.
3. Build tab/session lifecycle and persistence.
4. Build the owner-facing browser controls.
5. Register every browser function with AXON only after its real executor exists and tests pass.
6. Run the owner/AXON parity matrix: every supported owner-facing function must have the same underlying service available to AXON, with the same permission broker and only the approved differences in authority.

**Builder status:** implementation candidate returned for Director review. No Director verdict (ACCEPTED / NOT ACCEPTED) has been issued.
