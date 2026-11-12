# Round 14 Continuation 3 — P5 / WP13 Real Git Provider

## Package verdict

**State: DONE for the requested local Git operations on this Node/Linux host.** The adapter invokes the real `git` executable; it does not emulate Git. The host does not provide OS-level isolation, and no such claim is made.

## Real Git operations proved

Using `git version 2.47.3` and temporary real repositories, the tests exercise:
- Status, diff, log, current branch and branch listing.
- Commit, branch creation and checkout.
- A real merge conflict fixture; the adapter reports `CONFLICT` and leaves the conflict unresolved for the user.
- `.gitignore` detection through `git check-ignore`.
- A 2 MiB file committed to the real Git object database.
- Refusal of a file above the configured per-file budget.
- Refusal of a repository outside the approved workspace.
- Hooks disabled by default; a real pre-commit hook marker was not created.
- Credential environment isolation: `GIT_ASKPASS`, `SSH_AUTH_SOCK` and `GIT_CREDENTIAL` sentinels are not forwarded. Global/system Git config and credential helpers are disabled; no remote operation is provided.
- Dirty checkout, unsafe branch names, traversal paths and invalid log limits are refused.

## Test evidence

| Measure | Result |
|---|---:|
| P5 targeted tests | 12 |
| Passed / failed / skipped | 12 / 0 / 0 |
| Negative tests | 7 (58.3%) |
| Real compiled-module mutant caught | YES — removing the actual compiled workspace-boundary guard lets the mutated provider inspect an outside repository with real Git |
| Git version | 2.47.3 |

## FAKE_BOUNDARY items

None for Git operations. Temporary repositories and merge-conflict fixtures are real Git repositories; the `git` executable performs every operation. The Node host adapter is the process/filesystem boundary and does not imitate Git.

## Security boundary

The provider uses an argument array (no shell), disables hooks for every command, disables Git system/global config and credential helpers, sets `GIT_TERMINAL_PROMPT=0`, omits askpass/SSH-agent/credential environment values, and exposes local repository operations only. Git runs as the current host OS user; this is not an OS-enforced isolation boundary. No remote push, pull, fetch or credential-based operation is exposed.

## Commands and counts

- `git --version` — exit 0; `git version 2.47.3`.
- `npm run build` — exit 0.
- `node --test tests/r14-wp13-git.test.mjs` — exit 0; 12/12 passed; 0 failed; 0 skipped; 7 negative tests; real mutant caught.
- Before P5: **1,199/1,199** retained Node tests passed.
- After P5: all 40 files matching `tests/*.test.mjs` were run serially with `node --test <file>` in separate processes — **1,211/1,211 passed; 0 failed; 0 skipped**.
- Clean-copy delta verification: all 10 replacement base hashes matched; `npm run typecheck` and `npm run build` passed; P5 targeted tests passed 12/12; the full 40-file suite again passed **1,211/1,211**, with 0 failures and 0 skips.

The full-regression machine evidence is in `results/r14-full-regression-per-file.json` and `results/r14-full-regression-summary.json`; the P5 capability evidence is in `results/r14-wp13-git.json`.

## Closing — what this prompt missed

The prompt did not specify whether a large file should be committed or rejected. This provider commits files up to a configurable byte limit (the test proves a 2 MiB file) and refuses files above that explicit limit; no Git LFS provider is claimed.
