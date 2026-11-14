# Q6 — Node Performance Budgets

**State:** TESTED on Linux x64 / Node v22.16.0. **Tests:** 6/6. **Negative tests:** 2. **Real compiled-module mutant:** YES — removing the queue global-cap check was caught.

**Measured:** WASM provider start **39.56 ms** (budget < 3,000 ms); WASM guest linear memory **65,536 bytes** (budget ≤ 2,097,152 bytes); UI bundle **14,795,325 bytes** (budget ≤ 16,777,216 bytes); background queue **500 jobs in 41.95 ms**, **11,918.19 jobs/s** (budget > 100 jobs/s). Raw measurements are stored in `docs/Q6_PERFORMANCE_MEASUREMENTS.json`.

**Scope caution:** memory is exported WASM guest linear memory, not worker/process RSS or Android RAM. **Phone performance: NOT RUN.** These desktop Node measurements do not predict mobile performance.
