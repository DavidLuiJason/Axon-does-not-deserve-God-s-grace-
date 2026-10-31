# LIVE8 DESIGN: the next text runner to go live (Director, 2026-10-31, notes only, NO code)

## 1. What was measured (real brain, real dictionary, lane ON for all five text tools; NOTHING in the repo changed)
- Text Counter is the ONLY tool with a kernel task action (`text.count`, registered in `src/kernel/axonEngine.ts`) and an old chat handler (`src/brain/textCountCommand.ts`). Find & Replace, Case Converter, Text Cleaner, Sort Lines and Text Compare have runners (`textRunners.ts`) but NO old chat handler and NO kernel action.
- MEASURED: with the lane OFF, 10 of 10 Case Converter requests (`convert "hello world" to uppercase`, `make "Hello World" lowercase`, `uppercase "abc def"` and others) get the foundation reply "I do not have a way to do that". So going live is a NEW chat ability, not a copy of an old one; the "62 of 63 identical" proof used for Text Counter cannot apply. The proof is: known-answer replies, a task record, and 0 changes to any other reply.
- MEASURED (lane ON, all five switches on, 8 requests): every one yields. Reasons: "the binder says ask" (4: `convert "hello world" to uppercase`, `make "Hello World" lowercase`, `change "hello world" to title case`, `sort the lines "b\na"`), "no single sure tool was found" (3: `uppercase "abc def"`, `convert ... to camelCase`, `turn ... into kebab-case`), "the binder had to assume something" (1: find and replace).
- CAUSE of the four "ask" yields (read from `argumentBinder.ts` rule 3): a choice slot is filled only when a clause word, lowercased, EQUALS exactly one of the choices the caller supplies (`LIVE_CHOICES`). Case Converter has no `LIVE_CHOICES` entry, and its engine values (`UPPER`, `lower`, `Title`, `camelCase` ...) are not the words people say (`uppercase`, `lowercase`, `title`). This is the same job `TEXT_COUNTER_UNITS` did for Text Counter.
- HYPOTHESIS (NOT measured): the three "no single sure tool" yields come from Resolution reading `uppercase`, `camelCase`, `kebab-case` as unknown or compound words; this needs its own measurement, as RESOLVE-TC did for Text Counter.

## 2. Which runner first: Case Converter (reasons)
Two required slots only (`text`, `mode`); a pure engine with exact output (`caseConvert.ts`, 9 modes); no state; nothing destructive; the correct reply is checkable by hand. Find & Replace is the worst first choice (two quoted texts, order is ambiguous, the binder already assumed something). Sort Lines and Text Compare each need a `mode` choice set too, so they follow the same pattern after this one.

## 3. Parts (one turn each; each part ends with a deliverable)
- LIVE8-1 (needs the owner decision in section 4): kernel task action `text.case` (`src/kernel/textCase.ts`), registered in `axonEngine.ts`; `LIVE_TASKS` entry; test for the action. No switch yet.
- LIVE8-2: the closed mode-word set in ONE named file (FL13), `LIVE_CHOICES` entry, a fold from the user's word to the engine mode in the runner; measure with the real brain how many of 40 requests Resolution now reads as Case Converter (the "no single sure tool" cases), fix at the source if it is reading, never with phrase lists.
- LIVE8-3: tool guard (yield when the text may hold code, same detector as Text Counter), real-brain run of about 60 messages: Case Converter answers carry the right text and a task record; every other reply identical to today (0 differences); switch pin test updated; switch ON; phone check of four messages.
- Then Sort Lines and Text Compare, one at a time, the same way.

## 4. OWNER DECISION NEEDED (FL13: a new word in a closed set needs your approval). Proposed closed set, word on the left, engine mode on the right
upper, uppercase = UPPER | lower, lowercase = lower | title = Title | sentence = Sentence | camel, camelcase = camelCase | pascal, pascalcase = PascalCase | snake, snake_case = snake_case | kebab, kebab-case = kebab-case | constant, constant_case = CONSTANT_CASE.
Open points: (a) "title case" is two words, `title` picks the mode and `case` is ignored; (b) whether the dictionary and the Words stage keep `snake_case` and `kebab-case` as one word is NOT measured (HYPOTHESIS), LIVE8-2 measures it; (c) "capitals" and "all caps" are NOT proposed, they can be added later one group at a time.
Answer: "yes" (set as written), "yes, but change ..." or "no".

## 5. What does not change
No file in `src/`, `tests/`, `tools/` or `.github` is touched by this package. Text Counter stays on. Roadmap v20.7 is unchanged (no law, direction or item changed).
