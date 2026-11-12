WORKSTREAMS: how parallel accounts avoid breaking each other (rewritten 2026-11-12)

Several ChatGPT or Claude accounts work on AXON at the same time. They cannot talk to each other. This folder is the only shared board, and it holds the CURRENT state only, never history.

RULES
1. One file per workstream, named after it (AXON_CODE.txt, AXON_WEB.txt, TOOLS_BRAIN.txt, AI_STUDIO.txt). Maximum 20 lines.
2. An account edits ONLY its own workstream file, and it REWRITES the whole file each time (never appends, never keeps old lines). Old facts belong in that workstream's own notes, not here.
3. At the start of every session the owner pastes ALL files of this folder into the chat. An account reads them first and states, in two lines, which workstreams run in parallel and what it must not touch.
4. LANE: every workstream lists the folders and files it OWNS and the ones it must NOT touch. Shared files (package.json, tsconfig.json, tools/files.lock, tools/guard.mjs, tools/snapshot.mjs, .github, NOW.txt, MERGE_TAG.txt, docs/JOB_BOARD.md) are changed only by the Director of the workstream that needs it, and the change is announced in its workstream file in the same package.
5. A merge package never overwrites a shared ledger file (NOW.txt, MERGE_TAG.txt, JOB_BOARD.md) while another workstream is active; it ships its own board lines as a separate file for the owner to append.
6. If two workstreams need the same file, the owner decides who goes first; the other waits.
7. WORKFLOW FILES (.github/workflows/*) can NEVER travel in a merge zip: the repository's auto-unpack refuses the whole zip. The owner adds or edits them by hand on GitHub (Add file, Create new file) and the account supplies the exact text.
8. SCREENS. AI Studio screens are built by a separate Director (the screen Director). That Director reads every file in this folder and every docs/*_SCREEN_READINESS.md, and builds a screen for what a workstream marks READY or PARTIAL; for everything else the screen shows an honest NOT AVAILABLE state. A screen must keep the element ids and command names listed in the workstream's screen readiness note, or that workstream's tests break.
9. ASKS. A workstream may add one line "ASKS OF OTHERS:" (for example "screen Director: keep the ids in docs/AXON_CODE_SCREEN_READINESS.md"). The asked account answers in its own file. This is the only way accounts talk, and the owner carries it by pasting the folder.

TEMPLATE (copy this block, fill every line, write nothing you did not verify):
WORKSTREAM:
ACCOUNT / ROLE: (for example "Claude, Director" or "ChatGPT, builder")
UPDATED: (date)
STATE NOW: (two lines: what is finished and verified, what is in progress)
BASE TO START FROM: (the exact zip or folder, and the test count it must show)
OWNS: (folders and files)
MUST NOT TOUCH: (folders and files that belong to others)
NOT BEING DONE HERE: (what other accounts might wrongly assume this workstream does)
SCREEN-READY NOW: (what a screen can truthfully show or do today)
SCREEN NOT READY: (what a screen must show as NOT AVAILABLE)
ASKS OF OTHERS: (optional)
NEXT: (the one next job)
WAITING ON THE OWNER: (decisions or uploads)
