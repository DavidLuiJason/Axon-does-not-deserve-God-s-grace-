# D321-FIX6 board lines (owner appends; no shared ledger file is touched)

WHAT: the pasted log is cloud run #221 (job 132496558523): Java compile errors from git conflict markers (<<<<<<<, =======, >>>>>>> bd3435b "AXON: unpack and update (automatic)") inside AxonAccessibilityService.java lines 67-69.

FINDINGS (MEASURED / read from the numbers):
1. That log is a RE-RUN of an OLD run. Run ids rise with time: #221 = 43573059559, #222 = 43583478618, #224 = 43604617325, so #221 is the oldest of the three. Job ids also rise with time, and #221's job id (132496558523) is HIGHER than #224's (132476466810): the job was created after #224's, so it is a re-run of the old run. GitHub re-runs a run on the SAME commit it started with: it can never contain a later fix, so an old failed run fails the same way however many fixes are merged afterwards.
2. The conflict markers are not in the repository: the newest source zip the Director has (taken after run #224) has no marker line in any text file, and AxonAccessibilityService.java there is clean (the `current()` method is public static, resolved).
3. Likely origin of the markers (inference): a rebase conflict between two uploads that landed together (workflow step 4 runs `git pull --rebase` when its push is rejected); a Director's own copy of the repository can carry such a file into a zip.

FIX: NEW tests/noConflictMarkers.test.mjs (2 checks, found by tools/run-tests.mjs): scans every text file of the repository for lines that start with "<<<<<<< " or ">>>>>>> " and fails in a second naming file and line, instead of the Java compiler failing after ten minutes. MEASURED: passes on the repository as given (0 markers), fails on a copy with a planted marker file and names it, and its scanner ignores look-alikes (a setext "=======" line, shift operators, indented text).
NOT RUN: the cloud suite; the real Android compile.

HOW TO TEST THE FIXES: never use "Re-run" on an old run. Merge the newest zip, then start a NEW run: the upload itself starts one, or Actions > "AXON: unpack, check, build" > Run workflow (leave the box empty). Check the commit id at the top of the run page: it must be the one made after the merge.

MERGE_TAG line: 2026-11-14 | D321-FIX6 [tests/noConflictMarkers.test.mjs (new), docs/D321_FIX6_BOARD_LINES.md] | pasted log was a re-run of old run #221 (git conflict markers in AxonAccessibilityService.java, not present in the current source); guard test added | MEASURED as above | NOT RUN: cloud suite, real Android compile
