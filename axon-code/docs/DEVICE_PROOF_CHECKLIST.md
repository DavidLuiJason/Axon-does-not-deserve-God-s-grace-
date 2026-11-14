# AXON Code — Android Device Proof Checklist

**Prerequisite:** an owner-supplied signed APK/AAB or installable AXON build containing the AXON Code screen and registered Android host plugin. **This continuation does not produce an APK.** If no installable build is supplied, mark the installation prerequisite NOT AVAILABLE and do not infer a pass from source tests.

Record device model, Android version/API, CPU ABI, RAM, free storage, app/build version, date, network state, and tester. Keep screenshots/logcat/exported job journal with each result.

## Installation and launch

| Step | Action | Expected result | Record |
|---|---|---|---|
| I-01 | Install the owner-supplied signed build. | Package installs without signature, ABI or SDK errors. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| I-02 | Open AXON Tools and select the AXON Code tile. | AXON Code opens; no grey placeholder or crash. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |

## Ten named tasks

| # | Task | Exact action | Expected result | Record |
|---:|---|---|---|---|
| 1 | Create workspace | Create `Round15-Device-Proof`. | Workspace appears with a stable project ID. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| 2 | Create source file | Create `hello.js`. | File appears in the project tree. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| 3 | Edit and save | Enter `console.log('AXON Code device proof');` and save. | Saved state clears; reopening preserves exact text. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| 4 | Import project files | Import a second small text file into the workspace. | File is imported under the selected project; no path escape. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| 5 | Rename and move | Rename the imported file, then move it into a subfolder. | Tree and persisted path update; no duplicate or lost file. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| 6 | Search project text | Search for `device proof`. | Exact matching file and line are shown; binary files are skipped. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| 7 | TypeScript diagnostics/navigation | Open a TypeScript fixture with one known type error and a referenced symbol. | Diagnostic points to the expected range; definition/reference navigation resolves. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| 8 | Run project tests | Run a small project `node --test` fixture through the confined test runner. | Real test output, exit code and confinement limitations are displayed. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| 9 | Preview and console bridge | Preview a local HTML fixture that logs once and throws a known error. | Console message and error appear once; forged foreign-origin messages are ignored. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| 10 | Submit background job | Submit a long-running supported job and inspect its job ID/status/results. | Job appears in the job service with caller, origin, state and bounded output. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |

## Pause, background, process-death and recovery

| Step | Action | Expected result | Record |
|---|---|---|---|
| L-01 | Pause the supported child-process job from the job screen/notification. | State becomes `paused`; process work stops. If host pause is unsupported, UI must say NOT SUPPORTED. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| L-02 | Resume the same job. | State becomes `running`; process continues without duplicate execution. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| L-03 | Submit a second long-running job and leave AXON Code in the background. | Foreground service notification remains visible and state updates honestly. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| L-04 | While that job is running, force-stop/kill the app using Android system controls. | No false claim that the process survived; persisted job is classified accurately. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| L-05 | Reopen AXON Tools and AXON Code. | Workspace and journal recover; interrupted work is marked `interrupted` with a reason; completed results remain available. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |
| L-06 | Cancel a running job from its notification. | Cancellation reaches the job service and no orphan process continues. | [ ] PASS [ ] FAIL [ ] NOT AVAILABLE — Notes: |

## Competitor comparison protocol (do not claim AXON Code wins without raw results)

1. Record the exact Android device, OS/API, free RAM/storage, network state and versions of AXON Code, Termux, Pydroid 3 and Acode.
2. Use the same project files and equivalent task instructions where each product supports the category. Record unsupported categories as N/A, not failures.
3. **Termux:** install/open the same supported command-line tools, run the same script/build/test task, inspect real process/session controls, record setup steps and elapsed time.
4. **Pydroid 3:** run the same supported Python script offline after required runtime/package setup; record interpreter/package versions, output correctness and setup time.
5. **Acode:** edit the same multi-file project, use its project navigation/search and web preview where supported; record console/error workflow and setup time.
6. Repeat each task at least three times after a cold start and three times warm. Record median time, success/correctness, setup steps, error location, offline result, memory/RAM where measurable, battery/thermal observations and recovery behaviour.
7. Preserve raw logs, screenshots, project hashes and a per-product PASS/FAIL/N/A sheet. Do not infer private implementation details.
8. Publish category-by-category wins, ties and losses only after independent review. **Do not claim AXON Code beats Termux, Pydroid 3 or Acode from this checklist alone.**

| Product | Version | Task/category | Result (PASS/FAIL/N/A) | Time | Memory / battery | Evidence reference |
|---|---|---|---|---|---|---|
| AXON Code | | | | | | |
| Termux | | | | | | |
| Pydroid 3 | | | | | | |
| Acode | | | | | | |
