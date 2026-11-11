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

## C4 Pyodide CPython WebAssembly Worker

Implemented:
- A distinct `PyodideWorkerExecutionAdapter` using the real `loadPyodide` and `runPythonAsync` entry points in a Worker.
- Offline pack contract, per-file SHA-256 and byte-size verification, required runtime asset checks, optional pack install/removal interfaces, source/output/time limits, cancellation and Worker termination.
- Grade 1 isolation label only; Worker isolation is not an OS sandbox.
- Fake-worker/pack contract tests prove rejection and pack-management logic, not Python interpreter correctness.

Blocked/not run:
- No actual Pyodide runtime assets are present in the project or local npm cache. The network cannot resolve the npm registry. Therefore no real offline pack is installed and the adapter correctly reports unavailable/BLOCKED.
- Real CPython execution, package imports, offline restart, browser compatibility, and Android WebView memory/performance are NOT RUN.
- No interpreter imitation or remote fetch fallback is provided.
