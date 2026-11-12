# C3 and C4 — Host provider implementation status

## C3 Android host bridge

Implemented:
- Typed TypeScript Capacitor contract for Android API/ABI and Storage Access Framework operations.
- Kotlin Capacitor plugin source under `android/src/main/java/com/axoncode/host/AxonCodeHostPlugin.kt`.
- Fake-host contract tests for API floor, capability shape, persisted-grant requirement, bounded read/write, exact byte counts and refusal cases.

Not proven:
- Kotlin compilation, Capacitor registration, Android SAF descendant-document enumeration, persisted URI grant survival, actual read/write, process/PTY provider, native Python or Gradle provider.
- No Android SDK/Gradle/physical device evidence is available in this host. These remain NOT RUN. Fake-host tests are not provider evidence.

The plugin advertises process/Python/Gradle providers as false. It does not claim those runtimes exist.

## C4 / WP7 Pyodide CPython WebAssembly Worker

Implemented and Node-proven:
- `PyodideWorkerExecutionAdapter` accepts an injectable `PyodideWorkerFactory`; production browser Workers and the Node `worker_threads` proof runner use the same run/output/completion protocol.
- Vendor Pack V2 supplies the real Pyodide 314.0.7 distribution and WASM/stdlib assets. The Node tests verify asset hashes and execute the actual CPython runtime from those local files.
- Real Node worker_threads execution proves print output, returned expression value, syntax errors, runtime tracebacks, stdin, wall-clock termination of an infinite loop, output caps, source-size refusal, per-run state isolation, and scoped `/project` virtual file read/write.
- The Node runner gives Python an empty JavaScript-global bridge, mounts no host filesystem, denies Python socket connection audit events, and denies writes outside `/project`. It does not fetch runtime assets from the network.
- The execution boundary is **Grade 1 (Worker/process separation)**. It is not an OS-enforced hostile-code sandbox. The Node runner's evidence does not establish Grade 2 or Grade 3 isolation.

Still NOT RUN / not established:
- Real Chromium browser Worker execution, browser offline pack install/reload and browser-native filesystem/network policy parity.
- Android WebView execution, Android memory/performance on the 4 GB target, native Python provider, or Android device recovery.
- Production pack lifecycle integration with the app's persistent optional-pack store. The test runner reads the exact local vendor pack directly; it does not claim the application has installed that pack for end users.

No interpreter imitation, fake Python engine, remote fetch fallback, or OS-sandbox claim is used.
