# Q1 — Cancel, Pause, Background (WP12)

**State:** TESTED on Linux Node host. **Tests:** 16/16. **Negative tests:** 5. **Real compiled-module mutant:** YES — removing the per-owner quota check was caught.

**Implemented:** bounded background queue integrated into the job gateway; concurrency, per-owner quota, global job cap, priority ordering and round-robin owner fairness; user workspace authority can pause/resume/cancel AXON-origin jobs; AXON can manage a user job only with `job.manage.any` and an audit record; real child-process `SIGSTOP`/`SIGCONT`; timeout/output caps and cancellation; queued/paused/running jobs are marked `interrupted` after restart rather than silently resumed.

**Hostile cases:** executable allowlist refusal, no shell invocation, invalid argument types, workspace realpath escape, duplicate process ID, unauthorized AXON action, per-owner quota/global cap, cancel/stop cleanup, and restart while a child was paused. A real busy-loop child was measured through `/proc/<pid>/stat`: CPU ticks stopped while paused and advanced after resume. Both 1,000 queue start/cancel cycles and 1,000 real Linux child-process spawn/cancel cycles completed with no retained child map entries or additional timer/child-process resources.

**BLOCKED / NOT RUN:** SIGSTOP/SIGCONT is Linux child-process support only. Pyodide/WASM pause remains NOT_SUPPORTED. Android foreground-service execution and device process-death behaviour are NOT RUN. The process host is not an OS sandbox; child processes inherit the host app's OS identity and are limited by an executable allowlist and workspace cwd, not a hostile-code security boundary.
