UPDATE (part 1b, same day): the owner chose Q1 = A and Q2 = not now; part 1b MEASURED that A cannot ship as specified and recommends B instead: see `docs/LIVE8_2B_PART1B_MEASURE.md`.

# LIVE8-2b part 1a: WHY the five shapes stop (Director, twenty-fourth account, 2026-11-01). Docs only, no code.
MEASURED on the repository zip as it is now (real brain, real dictionary, shipped switches). A temporary print inside the Resolution stage was used in a scratch copy only; the repository files are unchanged.

## What Resolution looks at
The Case Converter schema (`src/brain/mind/schema/actionSchemas.ts` line 35) lists the concept words it can match: verbs `convert change`; object words `case letter upper lower lowercase uppercase`; technical names `camelcase pascalcase`. The approved mode set (`caseModeWords.ts`, 16 words) is a separate list used only by the binder AFTER a tool is chosen. So `kebab`, `snake`, `title`, `camel`, `sentence` carry NO concept into Resolution; only the word `case` (or `uppercase`, `lowercase`, `camelcase`, `pascalcase`) does.

## Results (MEASURED)
| Request | What Resolution returns | Source |
|---|---|---|
| `convert "hello world" to uppercase` (control) | match case-converter, score 1.17: convert, change AND uppercase matched | answers |
| `convert "x y" to kebab case` / `snake_case` / `Title case` / `kebab_case` | match (the separate word `case` matches) | answer |
| `convert "x y" to kebab-case` / `snake-case` | ask: four converters tie at 0.18 (only convert and change matched) | old handler |
| `turn "hello there" into kebab-case` | none: no schema shares a concept | old handler |
| `convert "x y" to Title` / `kebab` / `snake` | no match (no object concept) | old handler |
| `uppercase "abc def"` | not-a-request: MEANING read the clause as act `unknown` (no verb, no imperative) | old handler |
| `convert hello world to uppercase` (no quotes) | match; the BINDER then asks (text slot) | old handler |

## Causes, in plain words
1. **Hyphen (`kebab-case`, `snake-case`): MEASURED** that the word `case` is not seen when joined by a hyphen but is seen after a space or underscore. Cause inside Reading (why a hyphen joins) NOT measured.
2. **A mode word alone (`Title`, `kebab`, `snake`): MEASURED** no object concept, so the four converters tie. The tie then asks, and the old handler answers instead.
3. **Mode word with no verb (`uppercase "abc def"`): MEASURED** stops in Meaning (act unknown).
4. **Unquoted text: MEASURED** stops in the binder; why it asks NOT measured.
HONEST NOTE: when the lane yields, the OLD handler says it has no way to convert case, which is now untrue for Case Converter. That is a wrong-words reply, not a wrong answer; it stays until the shapes are read or the old reply is changed.

## Options for the owner (each needs a yes; FL13: no phrase lists)
**Q1, kebab-case, Title, kebab, snake (causes 1 and 2):**
- A (small, my pick): feed the schema's object concepts from the ONE approved closed set (`caseModeWords.ts`), so `kebab`, `snake`, `title`, `camel`, `pascal`, `sentence`, `constant` count as concepts. One source (FL14). Risk (HYPOTHESIS): `title` or `sentence` may pull in other tools or ordinary talk; Part 1b measures the must-not list (greetings, "what is a title", translate, count) before anything ships.
- B (wider): Reading also tries a second reading that splits a hyphenated word (`kebab-case` into `kebab`, `case`). Fixes hyphens everywhere (and `snake-case`), but touches every message with a hyphen; needs the golden transcript and the Resolution scoreboard to stay equal.
- C: do neither; AXON keeps asking for a space (`kebab case`).
**Q2, `uppercase "abc def"` with no verb (cause 3):** my pick is NOT NOW. It needs a Meaning rule (a lone mode word plus quoted text is a command) on a hot file; the better fix is ACT-OR-ASK (7K, no design yet): AXON asks "convert the case?". Yes = I design the Meaning rule in its own part; no = it waits for 7K.
Cause 4 (unquoted text) gets one more measurement first; no question yet.

## Gate
Code for 1b waits for the owner gate in NOW.txt (cloud build result and phone messages), FL15 rule 6. Measuring does not.
