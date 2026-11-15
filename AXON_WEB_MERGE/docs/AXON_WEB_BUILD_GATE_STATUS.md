# AXON Web — Build Gate Status (Round 2 Batch 4)

## Status

- Build inputs and CI lane: **CONFIGURED**.
- Clean dependency install: **BLOCKED in this execution environment**.
- Capacitor Android generation/sync: **NOT RUN**.
- Android/Capacitor Java type compilation: **NOT RUN**.
- Gradle APK assembly: **NOT RUN**.
- APK produced: **NO**.

## Pinned candidate inputs

| Component | Value |
|---|---|
| Node | 22.16.0 |
| npm | 10.x (local evidence 10.9.2) |
| JDK | 21 (local evidence 21.0.12.1) |
| Capacitor core/CLI/Android | 7.6.9 |
| Capacitor App/Filesystem/Share | 7.1.2 / 7.1.9 / 7.0.4 |
| Android Gradle Plugin | 8.7.2 (expected Capacitor template) |
| Gradle wrapper | 8.11.1 (expected Capacitor template) |
| min / compile / target SDK | 23 / 35 / 35 |

## Local evidence

- `node --version`: v22.16.0.
- `npm --version`: 10.9.2.
- `java -version`: OpenJDK 21.0.12.1.
- `ANDROID_HOME`/`ANDROID_SDK_ROOT`: unset.
- `adb`, `sdkmanager`, system `gradle`: not installed.
- `node_modules/.bin/cap`: absent; local Vite package absent.

## Command outcomes

| Stage | Outcome | Interpretation |
|---|---|---|
| `npm ci --no-audit --no-fund --prefer-offline` | Timed out; cache miss had previously returned ENOTCACHED | Dependencies could not be resolved in this offline/DNS-restricted environment |
| `npm run build` | Exit 127 (`vite: not found`) after prebuild snapshot | No web bundle built |
| `npm run lint` | Exit 2 (missing `vite/client` type declaration) | Full project lint/type check unavailable |
| `bash scripts/build-axon-web-android.sh` | Exit 1 before Capacitor generation | Script stops because local Capacitor CLI is missing; no npx fallback allowed |
| JDK parser on 3 Java source files | PASS, syntax only | Does not resolve Android/Capacitor classes |
| Overlay regression | PASS on single-line and multiline application tags; script rerun twice per fixture | Manifest patch is syntactically/idempotently verified on representative fixture, not actual Capacitor-generated manifest |

## Exact stop point

The build script confirms Node/npm/JDK and then requires `node_modules/.bin/cap`. It is absent because dependency install did not complete. Consequently it never ran `cap add android`, overlay against an actual generated app, `cap sync`, native Java compile or Gradle assemble. No Java compilation failure is established; no Java compilation success is established.

## CI status

`.github/workflows/axon-web-android.yml` contains a separate read-only build-only workflow with pinned toolchains, Android SDK install, locked npm install, web build, lint, full tests, overlay regression, Capacitor sync, actual Java compile, APK assemble and artifact upload. Workflow YAML syntax passes. It has not been run remotely.

## Compatibility floor

This Capacitor 7.6.9 candidate lane configures API 23 (Android 6.0) as its minimum. It is a technical floor for this candidate, not universal product support. Android versions below API 23 require a deliberate Capacitor baseline review. Android 11 remains one test point, not the target ceiling.
