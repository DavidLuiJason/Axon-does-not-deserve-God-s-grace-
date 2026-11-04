# BATCH 5 - J1 PAGE TO TEXT report

**Placement:** Layer 5 — Reach / AXON Web reader; finish-line H (reach); dependency: none.
**Files:** `src/web/pageToText.ts`, `tests/pageToText.test.ts`, `docs/reports/BATCH5_J1_REPORT.md`.

## LAW CHECK (FL11)
- FL1 — placed as a Layer 5 read-only web capability; no claim that the browser or tool is live.
- FL2 — read only the roadmap, common contract and named J1 card; no other project files were opened.
- FL3 — delivers only the isolated reader; browser integration and end-to-end proof remain later work.
- FL10 — does not register a chat capability or claim a live browser action.
- FL11 — this job-specific law check is repeated here.
- FL13 — uses only structural HTML tag and entity rules stated in the card; no brain phrase or word list.
- FL15 — extracted page text is source material, not an admitted factual claim; no source verification is implied.

## Result
BUILT; ISOLATED TEST RUN: PASS

Printed test line: `PAGE_TO_TEXT OK: 47 checks`

Strict TypeScript command run (shared batch command):

```sh
tsc --noEmit --strict --target ES2020 --module commonjs src/web/pageToText.ts tests/pageToText.test.ts src/web/browserStepGuard.ts tests/browserStepGuard.test.ts src/device/actionVeto.ts tests/actionVeto.test.ts src/web/outsideAiGate.ts tests/outsideAiGate.test.ts src/story/characterSheet.ts tests/characterSheet.test.ts src/testkit/trapRunner.ts tests/trapRunner.test.ts
```

Node compilation command run (shared batch command):

```sh
tsc --strict --target ES2020 --module commonjs --outDir /mnt/data/axonbatch5-build src/web/pageToText.ts tests/pageToText.test.ts src/web/browserStepGuard.ts tests/browserStepGuard.test.ts src/device/actionVeto.ts tests/actionVeto.test.ts src/web/outsideAiGate.ts tests/outsideAiGate.test.ts src/story/characterSheet.ts tests/characterSheet.test.ts src/testkit/trapRunner.ts tests/trapRunner.test.ts
```

Node test command run for this job:

```sh
node /mnt/data/axonbatch5-build/tests/pageToText.test.js
```

The compiled Node test printed the exact line above. The test contains more than 30 independent checks.

`test:kernel` addition (not applied to package.json): `tsx tests/pageToText.test.ts`

## Hand-worked oracle
A. The supplied Shop & Co page yields title `Shop & Co`, exact text `# Welcome\nHello big world !\n- One\n- Two\nRead more`, one decoded HTTPS link, no truncation and zero hidden skips.
B. The three hidden paragraphs/elements remove B, C and D; output is `A\nE` and skippedHidden is 3.
C. Table rows become `Name | Qty` and `Pen | 3`.
D. JavaScript link text remains in page text but is not listed; `/x` is listed.
E. maxChars 14 keeps all text; 9 keeps `aaaa\nbbbb`; 7 keeps `aaaa`; truncation flags are false, true, true.
F. `&amp;lt;` decodes once to `&lt;`; `&#0;` and `&bogus;` stay written while `&#x41;` becomes A.
G. Empty, whitespace-only and blank-paragraph pages return `empty-page`; numeric input returns `bad-input`.
Extra 1. Root-level inline text before and after a paragraph is kept on its own lines: `outside text\npara\nafter`.
Extra 2. Two nested hidden elements count as two; an unclosed hidden element suppresses the remainder of the document.

## Deliberate breakages and test detection
1. HTML size guard raised from 2,000,000 to 2,000,001 — caught by the HTML-too-large check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
2. Empty-page refusal disabled — caught by the empty-string oracle. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
3. `&amp;` decoding changed — caught by the Shop & Co title/text oracle. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
4. Hidden counter increment removed — caught by oracle B hidden count. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
5. Link allowlist widened to accept every scheme — caught by the data-scheme exclusion check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
6. Truncation newline boundary changed — caught by oracle E maxChars 9. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
7. Negative maxLinks accepted — caught by the negative-links option check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.
8. aria-hidden rule removed — caught by oracle B hidden content/count check. — the one-line compiled-engine mutation was applied, the isolated Node test failed, and the engine was restored.

## Questions for the Director
Malformed/mismatched HTML recovery is not fully specified. Chosen reading: use explicit matching close tags and tolerate unclosed tags without attempting browser-grade HTML repair; an unclosed hidden element suppresses to end-of-document.

## What I could not check
No real browser, network, DOM, web-page retrieval, browser integration or source-verification flow was run. `tsx` and `test:kernel` were not run/changed; Node execution used TypeScript compilation. Add to test:kernel: `tsx tests/pageToText.test.ts`.
