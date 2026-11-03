# V22 PLAN (Director, new account, 2026-11-03). DESIGN ONLY: nothing here is built.
Home of the detail behind roadmap v22 (roadmap pointers say `V22_PLAN.md P1` to `P9`). Evidence labels: MEASURED, HYPOTHESIS, NOT RUN, DEVICE. Probabilities are HYPOTHESES (rule 12). Every item gets: layer, needs, builder, proof, verdict, order (PLACEMENT LAW).

## 0. How I read the owner's 2026-11-03 message (tell me if a reading is wrong)
His message contradicts itself in several places. Rule used: the LATER explicit statement wins; a partial retraction that stays unclear gets ONE question. This table is also the first test set for AXON's contradiction rule (P4).
| # | Earlier in the message | Later in the message | Used |
|---|---|---|---|
| 1 | "you won't write the roadmap" (cue: "I know I probably said earlier… but I've decided") | "you will write it" | The Director writes v22 (ownership law unchanged) |
| 2 | "Don't give me anything yet, just reply" | "Plan everything… then update the roadmap" | Deliver the plan now, the roadmap next turn |
| 3 | "Don't build expansion plan" (cue: "Wait. I think it might actually be necessary") | "Yes, we'll build it" | Rebuild `EXPANSION_PLAN.md` |
| 4 | "I don't think you build the mini base" | "the mini base is necessary" | Mini-base stays (5.9) |
| 5 | "remove the low/medium/high/extra/max ladder" | "but both deep and fast should have it" | UNCLEAR: see Q1 |
| 6 | Roadmap: cap 58,000, "does not plan to raise it again" | "increase the cap to 60,000" | Cap 60,000 |
Also recorded: deadline = 7 November 2026 (scope still unstated); Expansion plan: yes; the 393 files: Director decides KEEP ALL, delete nothing, revisit at Stage Z (nothing measured about what they are).
**Q1 (one question):** my reading is ONE ladder of four named levels (DIRECT, STRUCTURED, ADVANCED, DEEP DIVE) used by both lanes, chosen automatically or by your word, with no new low-to-max words. Does the fast lane also need its own steps below DIRECT? If you say nothing I keep my reading.
**Q2:** target 50,000 and warn 45,000 (the file has been above both for a long time). Keep them as stated, or move them to match the cap? If silent: kept, and the trim step reports the gap each time.

## P1. PLAN A / PLAN B (placed: section 5, layer = workflow; builder = ChatGPT; proof = Director script and mutants)
**Plan A:** one sized job per prompt, mini-base, Director verifies each (today). **Plan B (on TEST):** one master prompt plus short job cards, 3 to 6 jobs (aim 6, ceiling 10), NEW FILES ONLY.
**Why these limits (MEASURED, `AI_CAPACITY.md`):** a 38,000-character prompt with the whole zip failed twice on ChatGPT (2026-10-24); the recipe that worked: prompt under ~16,000 characters, ONE file per job, a fixed contract, a no-install runner, a mini-base. Six jobs at ~8,000 characters is ~48,000, so the master prompt stays under 16,000 and each job's contract and oracle live in a card file in the mini-base.
**What a mini-base is:** a small zip (6 to 11 files): a roadmap copy; `run.mjs`, `register.mjs`, `tsconfig.values.json` (a runner needing no installs; NOT RUN: I have not yet checked they are in the repo); the CONTRACT files (types the job must fit; the contract wins over the prompt); read-only neighbours; the PROOF test (never changed by the builder); fixtures. It carries the packed dictionary (about 16 MB zipped, under the 25 MB limit) only for brain jobs that must measure reading.
**What Plan B can NOT do:** touch hot files; wire a tool into the brain (needs the real dictionary and measurement: Sort Lines cost 27 commands, of which the pure kernel action was 4, MEASURED on the board); decide anything about laws.
**Batch 1 (proposed, six jobs, pure engines, no shared files; replaces the provisional number/create-tool list I gave earlier, because kernel actions save only ~4 commands per tool):**
| Job | Engine (new file) | Proof the Director runs |
|---|---|---|
| J1 | find and replace with MANY pairs and a separator (P7) | hand-written known answers, overlap and order cases, a mutant that reorders pairs |
| J2 | data-use ledger: daily records, month and year roll-ups, retention (P9 engine part) | known sums over 400 synthetic days, month and year boundaries, leap day |
| J3 | grid and collage splitter (P8) | synthetic collages with known panel boxes |
| J4 | focus / subject crop by edge density (P8) | synthetic scenes with a known subject box |
| J5 | shape locator: circles, rectangles, colour blobs; and find-by-example (P8) | drawn shapes with known centres, noise cases, no-match cases |
| J6 | plain-background remover (P8) | known masks on flat and gradient backgrounds, a hard case that must say “cannot” |
All image jobs use one pixel type `{width, height, data: Uint8ClampedArray RGBA}` in a contract file the DIRECTOR writes (small, risky: the one shared piece), read-only for builders. No DOM, no network, no fixed phrase lists. Each job returns its engine, its test, a `*_REPORT.md` and a SHA-256 list.
**Master prompt must carry (so ChatGPT has no 1% room to invent):** the unchanged 5.3a preamble; a Law Check (FL11, at most 12 lines); open ONLY named files, STOP if one is missing; the contract wins; per job: files allowed, DONE MEANS, partial delivery counts; every claim backed by printed output, else NOT RUN; no edit to `package.json` (report the `test:kernel` line), `tools/`, `.github`, the dictionary, the roadmap; same failure twice = stop and report; a closing section “what I could not check”; one fixed report table.
**Director verification:** `python3 docs/director/verify_return.py BASE.zip RETURNED.zip --lane GLOBS --run-tests`, then my own mutants and a rerun. Plan B is judged per batch on: jobs accepted, Director commands, Director turns, jobs per owner-day (7H). Estimate: two Director turns per batch of six (HYPOTHESIS). Shrink when a batch takes more than two turns; grow only after batches pass. The Director decides per batch: merge package, or return as it is, or return with fixes.
Verdict: WORKS ONLY IF the six files really share nothing. HYPOTHESIS: 60% that at least four of six are accepted after one fix round.

## P2. SAFEGUARDS AND MISTAKES (layer 3 to 5; Director designs, ChatGPT builds the pure parts)
**Exists (MEASURED by reading the repo):** `brain.ts` and `legacy.ts` run providers in order and end in the honest fallback (“I could not produce an answer to that.”); every stage failure is caught and written to the trace as `not-built` with its reason; live tool switches default OFF and the old path answers; the Charter and permission broker exist (`src/mind/charter/`, `broker.ts`, tests). **Missing:** stage 9 Verification; any definition of a mistake; a mistake ledger; a caller for `startupSelfCheck`; SAFE MODE; the Watchdog; confidence tabs. So today AXON has a fallback but cannot tell, by itself, that an answer was wrong.
| ID | Piece | Builder | Proof | Order |
|---|---|---|---|---|
| SG1 | MISTAKE and LEDGER: a mistake is a failed check, an owner correction, a test regression, or a claim with no truth label; a ledger line (id, date, kind, claim, check, source, fix, regression test id) in user data; every line needs a regression test | ChatGPT (pure ledger engine) | known-bad corpus, mutants | 2 |
| SG2 | Stage 9 Verification (second-path recompute for exact tools, source and contradiction checks) | Director designs first (7L 2 rows are unsized) | known-answer and known-bad switch | later |
| SG3 | FALLBACK LADDER: second path, then exact engine or old path, then say plainly what could not be confirmed and what was tried, then ask | Director | forced-failure tests per rung | 3 |
| SG4 | per-tool GUARDS (the LIVE9 pattern): wrong-answer trap corpus must pass before any switch-on | Director rule; Plan B may write trap corpora | traps all ask or answer right | now |
| SG5 | startup self-check wired to a caller (7L 14) | Director (small) | probe with a known-bad store | 2 |
| SG6 | SAFE MODE and crash page (7M 3) | after SG1 | crash loop test | later |
| SG7 | Watchdog P4: registry, probes, ONLINE / DEGRADED / OFFLINE / NOT CHECKED, canary that must fail | after SG5 | canary | later |
| SG8 | every owner correction becomes a regression test and a ledger line (7A) | with SG1 | replay | 2 |
Verdict: WORKS for what a check can decide; CANNOT JUDGE an error nobody can test. HYPOTHESIS: 80% that SG1, SG3, SG5 give a usable first net.

## P3. AXON WEB AND APP HANDS (layer 5; needs P2 and the broker; every item UNPLANNED for builders until its contract exists)
| ID | Piece | Builder | Proof | Verdict |
|---|---|---|---|---|
| WEB1 | search, fetch, read pages; SOURCE RECORD (URL, date, publisher, hash); claims labelled REPORTED, never VERIFIED until a second independent source or an exact check (7F); “here is what I found, I cannot confirm it” when that holds | pure source-record and claim-label engines: ChatGPT; fetch shell: Grok/AI Studio | saved-page fixtures, a fake search service, conflict cases | WORKS; 85% for the engines (HYPOTHESIS) |
| WEB2 | browser agent: step budget; read-only ALLOWED; forms, sign-in, sending, money ASK; page-to-text reader | planner: ChatGPT; WebView control: native | a fake site served from fixtures; DEVICE | WORKS ONLY IF the native control compiles |
| WEB3 | web images and videos: results with licence flags, play inside the app; download only when the licence allows or the owner owns it (N2 Webtoon example) | engine ChatGPT | licence-flag fixtures | WORKS DIFFERENTLY (play, not copy) |
| WEB4 | outside AIs, Google and websites as Charter-governed tools; keys in the Android keystore (X20 to X26) | after WEB1 | stub AI that errs on purpose | CANNOT JUDGE until WEB1 |
| APP1 | read what is on screen: accessibility tree to text; OCR only if measured | tree parser: ChatGPT | recorded trees | WORKS ONLY IF the owner enables the service |
| APP2 | act in apps (tap, type, scroll): ASK each time; a hard-veto list (payments, passwords, banking); source stays untouchable (N3) | planner ChatGPT; gestures native | fake app tree | WORKS ONLY IF APP1 works |
| APP3 | screenshots and recording (see below) | native | DEVICE | NOT silent |
**Your question: can screenshots and screen recording run silently, with no notification, in the background?** Not as asked. HYPOTHESIS (DEVICE check needed): screen RECORDING uses the system capture permission; Android 14 and later ask for the owner's consent each session and show a visible indicator, so it cannot be hidden. An accessibility service can take screenshots without that dialog (API 30+), but only after you switch the service on in Settings, and protected windows (for example banking apps) return blank. So: screenshots WORK ONLY IF you enable the service; recording WILL NOT WORK as silent (about 90% sure, HYPOTHESIS). Design rule: AXON logs every capture in its action journal and shows it to you (N2). I will not plan covert capture.
**Native lane risk:** AXON's builders write TypeScript engines. A native Android plugin cannot be compiled or run in my sandbox; only the cloud build and your phone prove it. So the first job is a PROBE-NATIVE (smallest possible plugin through the cloud build). NOT CHECKED: whether the repo already has a custom native plugin.
Order: WEB1 engines, then APP1 parser, then PROBE-NATIVE, then WEB2/APP2, then WEB3/WEB4.

## P4. CONFLICTS, READING AND CONFUSION (layer 3; with the Repair stage and Multi-Reply; contracts after those designs)
**Contradiction rule (7S):** (1) detect, by structure and a CLOSED set of change cues the owner approves (FL13: no phrase lists): same slot with two values, or two opposed stances, in one message or against earlier messages or past choices; (2) priority: explicit change cue, then later over earlier, then a stated decision over a musing, then the specific over the general; (3) no cue: reversible act, use the latest and say “you said X, then Y; I used Y”; irreversible or costly: ask ONE question; (4) the old item is kept `[replaced DATE by what]` (7F 4); (5) a new instruction is checked against past choices for contradiction, inefficiency, outdated or incompatible (X14). Test set: the six rows of section 0. Verdict: WORKS for cue-marked changes (80%, HYPOTHESIS); a contradiction with no cue and no structure is CANNOT JUDGE.
**State the reading:** when one reading leads and the act is undoable: “I read this as X; tell me if not”, then act; irreversible: ask first. CONFLICT TO DECIDE (owner): section 12 says weak guesses never execute (RUN_AT 0.8, ASK_AT 0.5). This rule would execute inside that band only when UNDO exists, so it changes a measured rule. It needs the held-out set (7L 7) and your yes before any build.
**Anti-confusion:** signals (repeated question, a self-contradiction, several unresolved slots, a long list) trigger a restatement in at most three lines plus a short checklist. TEST-NEED: certified exact engines need no per-run test; new code, new claims and new tools do. Both live in Judgment (7C); `JUDGMENT_DESIGN.md` is unread by me (7L 8), so the first job is to read it.

## P5. DEPTH LADDER AND SWITCHING (placed: Router, 7E; after Router go-live)
One ladder: DIRECT (fast lane), STRUCTURED, ADVANCED, DEEP DIVE (deep lane levels, not new brains). Chosen automatically from the signals already in 7E (complexity, uncertainty, risk, dependencies, reversibility, knowledge need, free resources) or by the owner's word (a CLOSED set of level names, owner approves, “do this on deep dive”). Thresholds live in ONE per-tier table (rule 8) that the Router reads, so when AXON's intellect improves every tool moves up together and no tool owns a private threshold. AXON's own questions to the owner run at the highest level the budget allows (PROPOSED reading of “its question should always be on the highest”). Builder: a pure `depthTable` chooser, ChatGPT, after the Director defines each signal from existing Meaning and Resolution outputs (a signal with no source is UNPLANNED). Proof: a message corpus with expected levels and an override test. Verdict: WORKS ONLY IF each signal is measurable today (HYPOTHESIS 65%).

## P6. PLACEMENT OF THE OWNER'S NOTES (every item; builder, proof, verdict)
| Item | Layer | Needs | Builder | Proof | Verdict |
|---|---|---|---|---|---|
| P7 find and replace many pairs with a separator | 5 | none | ChatGPT (Batch 1 J1) | known answers | WORKS |
| P8 splitter, collage splitter, focus, plain-background remover, shape locator, find-by-example | 5 | pixel contract | ChatGPT (Batch 1 J3 to J6) | synthetic images | shapes WORK (85%); remover WORKS on plain backgrounds (70%), DIFFERENTLY on complex ones; collage splitter WORKS for grids not free-form; focus is edge density, not understanding |
| P8 identify an animal or creature in a photo | 5 | optional model tier | later | model benchmark | WORKS ONLY IF the model tier exists (about 5% without it) |
| “learn images from images” | 5 | exemplar store in user data | after J5 | match tests | WORKS DIFFERENTLY: it stores your examples and matches them; it does not train a model |
| P9 data-use by month and year, connection check | 5 | Usage access permission you grant; internet toggle (rule 11) | J2 engine ChatGPT; native reader after PROBE-NATIVE | known sums; DEVICE | WORKS ONLY IF you grant access; the system's history depth is UNMEASURED (7N 13), so AXON keeps its own daily ledger from the first run and cannot invent earlier months |
| P6 knowledge from videos, verified | 4 to 5 | Speech to Text (owner tests first), WEB1 | after those | claim-check fixtures | WORKS ONLY IF a transcript exists; claims enter REPORTED, then verified (FL15) |
| P12 PROMPT LAB: write prompts, ask an AI for one, test it, grade positives and negatives, improve | 5 | outside-AI broker (WEB4), X23 countermeasures | templates and grader: ChatGPT | a stub AI that errs on purpose | WORKS ONLY IF graded against a known expected result |
| P13 TRUTH TABS: VERIFIED-TRUE, VERIFIED-FALSE, OWN-THOUGHT, weights; a percentage only with a measured basis | 3 | SG1, P3 FORECAST (Brier) | ChatGPT | calibration test | WORKS ONLY IF a track record exists; otherwise AXON says “no measured basis” |
| P14 CHARACTER CONTINUITY (enrolled people and characters kept as sheets, generations checked against them) | 3 to 5 | W3 limits, optional model for photos | later | consistency tests | WORKS for text and simple-feature sheets; photos need the model tier |
| Experiments, “run tests” (P2 in 7P) | 5 | SG1 | later | success-rate tests | WORKS |
**On the “73% accurate” example:** a percentage AXON cannot back with a measured record would be a number it did not measure, and roadmap section 4 (honesty) plus N2 forbid that. So AXON states a figure only with its basis (“about 3 in 4, from N checked cases”), and otherwise says it has no measured basis.

## P7. ORDER OF WORK AND TURN PLAN (Director's placement; HYPOTHESIS until you agree)
1. THIS TURN: plan and blocks. 2. NEXT TURN: write roadmap v22 (its own turn, WRITE-ONCE). 3. EXPANSION_PLAN rebuild from 7N: only group-level for X01 to X40, because the per-item text was lost with the file; you confirm the groups. 4. PLAN-B BATCH 1: pixel contract, mini-base, master prompt, six job cards (own turn). 5. Verify the batch (one or two turns). In parallel and owner-gated: LIVE9-3 (needs your yes to the ten Sort Lines words and A to Z by default). Then: SG1, SG5, SG3; then the Repair stage and Multi-Reply (REP0, MR1); Router go-live and depth ladder; WEB1 and APP1 engines; PROBE-NATIVE. FIRST SCREEN 1 (finish the open job first) still holds: tools going live is the open job (the roadmap says 18 of 19 runners are not live).
**State at hand-over:** `NOW.txt` was one job behind `MERGE_TAG.txt` (it named MEANING-N07-FIX while the newest tag is LIVE9-2b); this package fixes it. Per the STALE-ROADMAP RULE the tags win for progress. The paste's unfinished LIVE9-3 was never delivered and the repo does not contain it.

## P8. ROADMAP V22 WRITE PLAN (the next turn; arithmetic first)
Measured today: 57,088 characters (cap 60,000, so room 2,912). The ten blocks in `V22_ROADMAP_BLOCKS.md` measure 4,990. Projected 62,078, which is 2,078 over the cap and 2,878 over a 59,200 target (800 left as slack). Class C measured so far: 888 (7N files-by-area line 299, 7L RESOLVED line 87, change-log tail 360, 7H pace sentence 142). Still to MEASURE next turn: 7L items (3) (10) (15) built-state and counts, 7N order-of-work progress line, section 1 progress lines, section 5.8 counts, Class B rewording of ONE section projected over the rest. Needed: at least 2,078 more out of Class C and B beyond the 888, or 2,878 for the slack. HYPOTHESIS: 60% that C plus B reach it. If the arithmetic shows it will not, I deliver the draft over the cap (`AXON_ROADMAP_V22_0_DRAFT_OVER_BY_<n>.md`), say so, and ask you for a higher cap; I never cut a law, number, example or owner quote to fit. Steps: (1) script splits the file by section and measures each; (2) cut Class C; (3) reword one Class B section and project; (4) insert blocks A to J by marker; (5) `tests/roadmapSize.test.ts` constants and the “hard cap 58,000” string become 60,000; (6) phrase check of every NO-LOSS item before and after, printed; (7) write `docs/ROADMAP.md` ONCE; (8) merge package with NOW.txt, MERGE_TAG.txt, INTAKE_LOG, board.

## P9. ADVICE (things I think you may regret) AND OPEN QUESTIONS
1. Twenty-plus new wishes while 18 of 19 runners are still not live repeats the roadmap's own EXAMPLE (stacked wishes, +29% in two days). They are placed and ordered here; no builder sees one without a contract.
2. A bigger roadmap costs every new Director account more to read. Keeping detail in this file and only laws in the roadmap is deliberate; keep it that way.
3. Plan B at six jobs is a test. Start at six, not ten; the shared pixel contract is the one place two jobs could clash.
4. “Silent” capture will not work as asked (P3). Do not plan features that assume it.
5. State-the-reading changes a measured rule (P4): measure before you say yes.
6. Giving ChatGPT the whole zip is a measured failure risk (P1); the mini-base is the safer route and Plan B needs it.
7. Percentages: see P6.
**Owner decisions still open:** Q1, Q2; yes to the ten Sort Lines words and A to Z by default (`LIVE9_DESIGN.md` 2 and 6); the Router's six default choices (my advice: approve all, they change no reply yet); what the 7 November deadline covers; FL14 and the Director/builder split; what “AXON's way of replying” meant; the cloud build result (still not seen).
