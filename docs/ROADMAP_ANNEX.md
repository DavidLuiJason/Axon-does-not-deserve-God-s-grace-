# ROADMAP ANNEX (rebuilt 2026-10-24; the earlier version was lost with the first account). The roadmap points here for long texts.

## A1. My Dictionary as a CHECKED source (owner, 2026-10-23)
- Any size of list may be imported (chunked import, a report, and an undo copy).
- It is shown with a My Dictionary icon and a note.
- The brain uses it as a SECOND source; the core dictionary is never rewritten (UD1).
- Every import is checked FIRST by an outside AI tool.
- Nothing is added until the owner says yes.
- NOTE: only these points survive from the roadmap text; if the owner remembers more detail from the original A1, add it here.

## A4. Not possible honestly yet (named in roadmap 8.3)
Web Search, Link Analyzer, Content Extractor, Currency Converter (need a network layer, key storage SK0, permissions); Translator, Rephraser, Grammar Helper (need a model); PDF Tools (needs a measured library); AI Assistant (the brain itself).

## Parked plan item (owner, 2026-10-24; plan and owner approval first)
AXON Build screen: keep the look exactly (dropdown, green dot, mark as confirmed). Make the content accurate: tools, capabilities, interfaces and systems as separate groups (tools have a screen, e.g. Text Counter, File Compare; systems are hidden working parts). An interface opens to its own buttons, each markable as confirmed; the interface gets its green dot when all its buttons are confirmed. Do this after B03B.

## A6. Moved out of the roadmap on 2026-10-25 (v18.0), nothing dropped
The v17.9 roadmap is saved whole as `docs/archive/AXON_ROADMAP_V17_9.md`. Shortened in v18.0: the truth gates, Council, lanes, hands and growth paragraph (full text stays in `docs/AXON_VISION.md`); the B03B part list (full text in `docs/B03B_PLAN.md` and the board); the old repository-status detail (board); the 2026-10-24 owner rules text (kept, reworded). Binding as before.

## A7. Closing cleanup, full text (moved out of roadmap 11 on 2026-10-25, v18.1; binding as before)
Stage Z, after the brain and AXON Code are proven: remove what is dead. Never a bulk delete, never by name pattern (`docs/prompts/` looks like clutter but holds live prompts): (1) the Director lists candidates from EVIDENCE (reachability scan from `src/main.tsx` and the tests; stale copies such as the root `AXON_ROADMAP.md`; unused assets, dependencies, tests, prompts) in `docs/CLEANUP_CANDIDATES.md` with reason and proof; (2) the owner approves; (3) removal runs with `node tools/guard.mjs --forget PATH`; (4) cloud build, all tests and export-equals-repository pass before and after; APK size recorded. Never removed: the dictionary, licence and credit files, the laws, anything the owner names.

## Moved out of roadmap v18.1 into v18.2 (2026-10-25; every line below stays binding as before)

### A8. Open for the owner (full list, with the Director's recommendation in brackets)
**Open for the owner (recommendation in brackets; full list in `docs/OPEN_ITEMS.md`):** outside AI models and tools as permissioned tools (yes); AXON Web before AXON App (yes); Python pack (yes, optional); a MONEY lane (locked until a Charter exists); WhatsApp (after a measurement); Backup and Restore, Source hub S3; second language; slang licences; test gate; Games Lab audit; SK0; FL14; the nine conversation words and value-word groups; roles of Vibe and DeepSeek; the JUDGMENT stage and MEANING MAP (`docs/JUDGMENT_DESIGN.md` section 10); the editors against InShot and Canva; drawing.

### A10. Lessons and failure prevention (full text of the old section 12)
## 12. LESSONS AND FAILURE PREVENTION (full catalogue: `docs/DIRECTOR_HANDBOOK.md`; capacity rows: `docs/AI_CAPACITY.md`)
Real failures: tests that do not block the build let defects pass: run them; acceptance numbers are derived, never remembered; overloaded builders deliver nothing; a builder sent into a zip of documents builds nothing; a rule the builder's sandbox cannot satisfy makes it deliver nothing; a screen needs the owner's phone; the cloud build is the real proof; a builder's own test can be wrong, so run it; **tools built before the brain cannot be judged by tests that assume understanding: ask the T9 questions first; the first AXON was scrapped after two months for lack of structure and foresight.** **Prevention:** size every prompt from the capacity log; name its files (STOP if missing); say what to deliver if it cannot finish; engine jobs only create files; screens never re-implement engines (FL14); never merge without `verify_return.py` and a report; update the board after every step.

### A11. New tools and other screens (full text of the old 8.5)
**8.5 New tools and other screens (owner 2026-10-20; annex A2):** Calculator (A13) and Video Frames (A14) await the phone check; Video to Audio waits for the V1 probe and the native decision; Games Lab not planned until audited; Scripture packs optional; Dictation Cleaner and Reading Comfort come with the Writer; Source hub S3 pending; Voices and cloning LEFT OUT.

### A11b. Works offline (full text of the old 8.3)
**8.3 Works offline (A10 to A12; not a limit on AXON, see owner rule 7):** File Converter, Batch Convert, Summarizer (extractive, provisional), Document Reader (no PDF until a library is measured), My Dictionary (UD1: a SECOND knowledge slot; the core dictionary is never rewritten; chunked import with report and undo copy; annex A1: every import is checked FIRST by an outside AI tool and nothing is added until the owner says yes). **Not yet possible:** the list in annex A4 (needs the network layer and SK0, a model, or a measured library). Backup and Restore: engine C22 written.

### A12, A5b, A10b. Moving the project; outside AI tools; phase status (old text)
**5.4 Moving the project.** The GitHub repository is the source of truth; AI Studio is a workspace. A new repository is one click ("Use this template"; workflows copy, secrets AXON_DEBUG_KEYSTORE_B64 and AXON_GATE do NOT). A .zip uploaded to the repository TOP level runs "Auto-unpack uploaded zip" (tools/auto-unpack.sh): it unpacks onto the project, never deletes, ignores .github/workflows and nested zips, keeps the repository's guard files, then runs the guard in strict mode (refuses missing or shrunk locked files and altered dictionary files). AI Studio standing rules: never delete, rename, move or shorten a file, and never touch .github, tools, public/dictionary, .gitignore, .nvmrc, package.json or tests, unless named; list every file created, changed or deleted; stop if the project has fewer files than at the start; never push.

## 10. PHASE STATUS
**G Ground:** G1 DONE; G2 export fixed; G3 not installed; G4 PAUSED; G5a verdict pending; G5b, G6, G7 OPEN. **C chat control:** C1, C2 done; C3 with B4. **B brain:** done to B03B2b; next the glue, B03B2c, B03B3, B03B4 (`docs/BRAIN_PLAN.md`), in parallel with the tools. **M mind system (7A):** M0A merged; M1 to M9 each after its base. **D, L:** dictionary works in chat, screen done, L1 done. **T tools:** see the board. **R, H:** SK0, how-did-you-understand view, more languages; later the optional model tier, AXON Code AC2 to AC4, the editors. **Z closing cleanup (11).**


**Outside AI tools and plain limits (owner 2026-10-22; annex A5):** AXON may rephrase, split, order and limit what it tells outside tools and may supply true evidence; DIRECTOR POSITION, OPEN until the owner confirms: it never states anything false to a tool and never hides a fact the tool's decision depends on. AXON never edits its own source code; no zero-error promise, only no silent error; no self-copying, no autonomous spending; security testing only on systems the owner declares; imitating a person's writing only with consent; drafts are approved before anything is sent.

### A13 and A14. One look everywhere; Foundation Check and Top-View Check (old text)
**One look everywhere (2026-10-17):** the same header band on every screen (logo fixed left, "AXON" bold with the page name lighter beside it, small-caps line under); the back control is a slim row UNDER the band; lists are plain rows (36 px icon, name, chevron), no boxed cards; no per-row "Coming soon" badges (unbuilt items dimmed, one quiet line says so); the Tools home shows group names only; a header may fold away ONLY on editor screens. Source, Build and Interface Capture screens are locked. 
**Foundation Check (written before every stage prompt):** (1) which layer, and is the one below proven; (2) what it carries vs what the carrier holds (both numbers, how measured); (3) one job, one builder, sized from the capacity log, the single proof; (4) what could go wrong and the cheap test; (5) what "done" looks like by hash, count or run; (6) the smallest next step if it fails; (7) what is added later on top.
**Top-View Check (with it):** T1 place on the map; T2 what is added later and cost at ten times today's size; T3 does it repeat something the owner did by hand; T4 what the last two stages taught (third attempt?); T5 is anything tied to today's files only; T6 which laws apply; T7 can it be done with fewer prompts or owner actions; T8 is the Law Check written, any new fixed phrase (FL13), anything reaching the chat outside the brain (FL12); T9 Think-Through Check (owner rule 6).

### A15. Value words and Summarizer (old text of 7B)
**Approved closed word set:** zero to nineteen, twenty to ninety, hundred, thousand, million, first to tenth, half; other value words are PROPOSED (percent, month and weekday names, am/pm, quarter, past; "a Sunday" is not a date), approved group by group. **Summarizer:** MEASURED unsafe for prompts; S2 reuses the brain's reading; do not summarize prompts until then.

## 7C. THE JUDGMENT STAGE (PROPOSED 2026-10-25; design `docs/JUDGMENT_DESIGN.md`)
Between Resolution (B04B) and Planning (B06A), and in the 7A loop at "plan ONE step": it holds the situation (items, relations, actions with declared EFFECTS, goal), looks several steps ahead, and returns a verdict, the plan, the options left out, a computed chance with its basis and what its model could not see. 32 skills in 8 groups; jobs J0 to J5 wait for the owner's yes and for B04A to carry EFFECTS, PRECONDITIONS, COST and UNDO in every tool schema.

### A16. Owner decisions of 2026-10-25 on B03B3c (Director decided; owner may counsel later)
(1) Vibe is rated 6.4; ChatGPT and Grok stay 7.5. (2) Documents written by another AI are PROPOSALS: the Director filters them. From ChatGPT's Deep Systems prompt only four points are kept as proposals: a failure-chain map (input, meaning, decision, permission, action, result check), the rule infer / ask / proceed / confirm / refuse, hard-fail gates (a short reply that loses a constraint fails; a kind reply that invents facts fails), and its 16 scenarios as a later test set. It is NOT sent to any builder as it stands (too big for one job; rivals BRAIN_DESIGN, JUDGMENT_DESIGN and AXON_VISION; needs AXON's own voice and the outside-tools layer, which do not exist: a staircase to nowhere, T9). Cut-down version only when the Dialogue stage (B05) exists, with our design documents attached; it must never guess a user's skill or needs. (3) Tone dictionary meanings: approved as the Director measured them; they are re-measured when the word-facts glue is built. (4) Loud alone is NOT urgent: capitals and marks give emphasis, the answer becomes brief, nothing is guessed. (5) "Wrong" is not frustration (it usually corrects a fact). (6) Pending ideas recorded: picture the result first; memory across chats.

