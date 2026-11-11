WORKSTREAMS: how parallel accounts avoid breaking each other (2026-11-11)

Several ChatGPT or Claude accounts work on AXON at the same time. They cannot talk to each other. This folder is the only shared board, and it holds the CURRENT state only, never history.

RULES
1. One file per workstream, named after it (AXON_CODE.txt, AXON_WEB.txt, TOOLS_BRAIN.txt, AI_STUDIO.txt). Maximum 20 lines.
2. An account edits ONLY its own workstream file, and it REWRITES the whole file each time (never appends, never keeps old lines). Old facts belong in that workstream's own notes, not here.
3. At the start of every session the owner pastes ALL files of this folder into the chat. An account reads them first and states, in two lines, which workstreams run in parallel and what it must not touch.
4. LANE: every workstream lists the folders and files it OWNS and the ones it must NOT touch. Shared files (package.json, tsconfig.json, tools/files.lock, tools/guard.mjs, tools/snapshot.mjs, .github, NOW.txt, MERGE_TAG.txt, docs/JOB_BOARD.md) are changed only by the Director of the workstream that needs it, and the change is announced in its workstream file in the same package.
5. A merge package never overwrites a shared ledger file (NOW.txt, MERGE_TAG.txt, JOB_BOARD.md) while another workstream is active; it ships its own board lines as a separate file for the owner to append.
6. If two workstreams need the same file, the owner decides who goes first; the other waits.

TEMPLATE (copy this block, fill every line, write nothing you did not verify):
WORKSTREAM:
ACCOUNT / ROLE: (for example "Claude, Director" or "ChatGPT, builder")
UPDATED: (date)
STATE NOW: (two lines: what is finished and verified, what is in progress)
BASE TO START FROM: (the exact zip or folder, and the test count it must show)
OWNS: (folders and files)
MUST NOT TOUCH: (folders and files that belong to others)
NOT BEING DONE HERE: (what other accounts might wrongly assume this workstream does)
NEXT: (the one next job)
WAITING ON THE OWNER: (decisions or uploads)
