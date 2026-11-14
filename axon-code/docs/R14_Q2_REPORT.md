# Q2 — Confined Project Tests (WP13)

**State:** TESTED on Node v22.16.0. **Tests:** 10/10. **Negative tests:** 7. **Real compiled-module mutant:** YES — removing `--permission` was caught.

**Implemented:** `runProjectTests(projectRoot, options)` now routes to a real child Node process running `node --test` under `--permission`, `--allow-fs-read=<project>`, and `--allow-fs-write=<scratch>`. `--experimental-test-isolation=none` is used so the Node test runner itself does not need a child-process permission. The child receives a minimal environment, no child-process/worker/addon grants, a 128 MiB V8 old-space cap, wall-clock timeout and output cap.

**Hostile cases:** `/etc/passwd` read denied; child process spawn denied; write outside scratch denied; infinite loop killed by outer timeout; endless output killed at byte cap; environment secret absent because it is not forwarded; no empty test project accepted. A harmless real project test also passed.

**Isolation grade:** process-level Node permission confinement. This is NOT an OS sandbox and does not claim kernel/container isolation. **BLOCKED:** formatter remains blocked because no formatter package is present. Older Node hosts without the permission flags return BLOCKED with the exact probe error.
