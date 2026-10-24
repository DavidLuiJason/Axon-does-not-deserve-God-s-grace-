# B03B1: The Meaning stage, part B1 (VALUES: numbers, units, durations, dates, times, Roman numerals)

[B03B1 = brain job "Meaning stage, part B, piece 1". B03A (part A) already finds clauses and speech acts; B03B1 reads the VALUES inside a message; B03B2 later reads structure; B03B3 later reads teaching, correcting and tone.]

WHO THIS IS FOR: ChatGPT (a NEW chat; it writes code and runs it in its own sandbox). It writes pure engines and tests only; it never designs screens.
WHAT THIS DOES: Builds a pure, tested reader that finds every VALUE in a message and COMPUTES it by tested code: numbers (digits, words, ordinals, halves, decimals, negatives), quantities with units, percents, durations, dates, times of day, and Roman numerals. It keeps unclear readings OPEN (alternatives with a confidence and a reason) and never guesses.
WHAT YOU DO: START NOW (brain jobs run in parallel with the tools, owner 2026-10-23). Attach: this file, AXON_ROADMAP_V17_4.md, B03B_PLAN.md (the plan the roadmap tells you to read; it is also inside BASE.zip at docs/B03B_PLAN.md) and BASE.zip (a fresh repository zip downloaded AFTER the owner uploaded AXON_B03B_PACKAGE.zip, so it contains the merged B03A and docs/B03B_PLAN.md). Paste the one line below.
WHAT TO BRING BACK: ONE zip named B03B1-values.zip (report at docs/reports/B03B1_REPORT.md). Give it to Claude (or the next Director account) to inspect with verify_return.py, run the corpus and try to break it before anything is merged.
PASTE THIS ONE LINE INTO CHATGPT (then attach the files above): Do the job in the attached file B03B1_FOR_CHATGPT_VALUES.md, exactly, using the attached roadmap and the attached BASE zip. Follow the standing rules in it, run and type-check everything yourself, and return one zip.
IF CHATGPT REPLIES WITH ONLY A REVIEW AND A LAW CHECK AND BUILDS NOTHING, paste this in the SAME chat (do not start a new one, do not send it a third time): "Continue now, in this same chat. Do not report again. Write the first file, run its test, then the next. Your next message must contain the zip. If you cannot finish everything, deliver the finished tiers complete and tested and list the rest."

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

---

## JOB B03B1: VALUES

WHY THIS IS SIZED AS FIVE TIERS: the job is big, so it is built in a strict PRIORITY ORDER and each tier is delivered only when complete and tested (Rule 1, QUALITY LAW 5). Tier 1 numbers, Tier 2 quantities with units and percents, Tier 3 durations, Tier 4 dates and times of day, Tier 5 Roman numerals. If you cannot finish everything, deliver the finished tiers and list the rest; never deliver a half-built tier. The Director will send the unfinished tiers as a small follow-up job.

WHY IT EXISTS (owner design, 2026-10-24): a message such as "set an alarm for 8 tomorrow" or "convert five mile too kilometer" carries VALUES that no dictionary can compute. They must be computed by tested code, never guessed, and every value must say where it sits in the message, how sure it is, and why. The reader keeps the choices open: it does NOT decide what a unit or number means for a tool (that is B04B). It never reads the real clock (the clock is given to it) and it never touches the dictionary.

FILES THAT MUST EXIST IN THE BASE (stop and say which is missing): src/brain/mind/types.ts (with Segment), src/brain/mind/meaning/closedSets.ts, src/brain/mind/meaning/index.ts, src/tools/engines/numbers/unitConvert.ts, src/tools/engines/numbers/numberToWords.ts, src/tools/engines/time/dateCalc.ts, tests/meaningNoPhrases.test.ts, tests/meaningA.test.ts, tests/fixtures/meaning-corpus-a.json, docs/reports/B03A_REPORT.md.

SINGLE SOURCE LAW (owner, 2026-10-24: "no tool may ever be out of date"): the brain must NEVER hold its own copy of what a tool knows. Therefore: (a) unit names and symbols come ONLY from `UNITS` and `listUnits` in src/tools/engines/numbers/unitConvert.ts (import them; add no unit list); (b) a date is valid only if `parseDate` in src/tools/engines/time/dateCalc.ts accepts the ISO text you build, and weekdays and day arithmetic come from `weekday` and `addDate` there; (c) Roman numerals live in ONE new shared engine file, src/tools/engines/numbers/romanNumeral.ts, that a future Roman tool will also use; (d) the tests use `numberToWords` as an INDEPENDENT second path. The dependency direction brain to pure engine is new and is allowed here because the engines are pure; import only from src/tools/engines, never from src/components.

DESIGN (follow it; if you find it cannot work, STOP and say why with evidence):

1. ENTRY POINT (`src/brain/mind/meaning/values/index.ts`): `extractValues(text: string, segments: Segment[], clock: Clock): ValuesOutcome`. It scans ONLY the characters inside segments whose kind is 'language'; 'material' segments (quotes, code) are never read. It does not need the dictionary or the Analysis tokens; it scans the text itself with its own small scanner (no regular-expression literal anywhere under src/brain/mind; scan character by character). `Clock = { year: number; month: number; day: number; hour: number; minute: number }` is local wall time supplied by the caller; the code never calls Date.now or new Date. `ValuesOutcome = { ok: true; values: ExtractedValue[] } | { ok: false; error: 'invalid-input' | 'too-long' | 'invalid-clock'; message: string }`. `VALUES_LIMITS = { maxCharacters: 20000 }`. Also export `lookupUnitWord(word: string)` (returns the canonical unit from UNITS or an honest 'not-a-unit'; B03B2 will use it for unit words with no number) .

2. OUTPUT TYPE: `ExtractedValue = { kind: 'number'|'quantity'|'percent'|'duration'|'date'|'time'|'datetime'|'roman'; text: string; start: number; end: number; confidence: number; reason: string; computed: true; value?: number; form?: 'digits'|'words'|'ordinal'|'mixed'; unit?: string; unitSymbol?: string; category?: string; ms?: number; date?: string; dateAlternatives?: string[]; times?: string[]; error?: string; alternatives?: { kind: string; note: string }[]; parts?: ExtractedValue[] }`. `text` equals the original text sliced by start and end. Values are sorted by start and never overlap: a value that is part of a bigger one (the number inside a quantity or duration) is NOT listed on its own; it sits in `parts`. Dates are ISO text `YYYY-MM-DD`; times are `HH:MM` 24-hour. A value that is malformed or impossible is returned with `error` and no value (never thrown, never skipped silently). `confidence` is a number from 0 to 1 and `reason` says which structural facts decided it. Weak means confidence below 0.5.

3. TIER 1, NUMBERS. Digits with optional sign directly attached (a minus counts as a sign only at the start or after a space, so `5-3` is two numbers), decimals with a point, thousands commas (`1,000`), words from the CLOSED NUMBER-WORD SET (below), hyphen or space compounds, hundred, thousand, million, `one hundred and twenty` (the joiner `and` comes from closedSets isCoordinator), `a hundred` (the article `a` comes from isDeterminer), `and a half`, ordinals as words (first to tenth) and as digits with the suffix rule (st, nd, rd, th must agree with the number, so `21st` is right and `1th` is the typed error `bad-ordinal`). The word `one` is also a pronoun ("the last one", "which one"): give it low confidence with an alternative of kind 'pronoun' when a determiner or question word is just before it or an ordinal is just before it, and high confidence when a unit or number follows. `second` is an ordinal by default and a unit after a number or an article (`a second` is a weak duration of 1000 ms with an ordinal alternative of kind number). Digit strings that look like identifiers (a leading zero with more than 3 digits, or 9 or more digits) are weak with an alternative of kind 'identifier'. A value beyond the safe integer range is `error: 'too-large'`. Homophones and typos are never numbers (`tennis`, `won`, `for`, `to`).

4. TIER 2, QUANTITIES AND PERCENTS. A number directly followed by a unit: the unit is matched against UNITS by full name, by symbol, by plural (s, es), by the vowel rule `eet` to `oot` (feet to foot), by the spelling rule that swaps `er` and `re` at the end (meter to metre), and by case-insensitive name; a single-word last part of a multiword name matches only when that word is unique across ALL unit names (derived from the data, never listed). Symbols are case-sensitive, and a symbol of one letter counts only when it touches the number (`5m`, `10s`). Attached forms (`5km`, `30°C`, `1h30m`) are read. When a unit word is also a grammar word (`in` is a preposition and an inch) the primary reading is the plain NUMBER and the quantity is listed in `alternatives` with its note (do not decide). `unit` is the canonical name from UNITS (for example 'mile', 'foot', 'Fahrenheit'). Percent: `%`, `percent` and `per cent` after a number give kind 'percent'.

5. TIER 3, DURATIONS. A quantity whose unit is in the 'time' category becomes a duration with `ms` computed from the UNITS factor (never retyped). Chains (`2 hours 15 minutes`, `5 minutes and 30 seconds`, `1h30m`), `half an hour`, `an hour and a half`, `a week`, decimals (`1.5 hours`). Months and years are not fixed lengths: they are NOT durations (leave them out and say so in the report).

6. TIER 4, DATES AND TIMES. Dates: `1 March 2027`, `March 1, 2027`, `2027-03-01`, `1/3/2027`, `13/3/2027`; today, tomorrow, yesterday and a weekday name (the next such day strictly AFTER today) resolve against the clock using dateCalc. A numeric date where both orders are possible (`1/3/2027`) is NOT decided: no `date`, both ISO texts in `dateAlternatives`, weak. A month name counts only next to a day number or a year (`may I`, `in march` are no dates). An impossible date (`31 February 2027`) is `error: 'invalid-date'`. Times: `7:30am`, `8pm`, `12am` (00:00), `12pm` (12:00), `20:15`, `noon`, `midnight`, `half past eight`, `quarter to nine`, `quarter past 3`; a bare hour after the preposition `at` (from isPreposition) has no stated am or pm, so `times` holds BOTH candidates (`at 8` gives 08:00 and 20:00) and its text includes the word `at`; a time next to a date in the same phrase becomes kind 'datetime' (`tomorrow at 8`). The code never chooses am or pm for the user.

7. TIER 5, ROMAN NUMERALS (a rule, not a list: owner, 2026-10-24: "it should understand how it works"). New shared engine `src/tools/engines/numbers/romanNumeral.ts` exporting `parseRoman(text)` and `toRoman(n)` (1 to 3999, typed errors outside), strictly canonical: a candidate is valid only if `toRoman(parseRoman(x)) === x`, so IIII and IC are invalid. In the reader a Roman numeral is only an UPPERCASE run of two or more of the seven letters that passes this round trip. Confidence 0.8 normally and 0.2 when every letter of the message is uppercase (`MIX THE COLOURS`). Lower-case text is never read as Roman (mix, did, civil are words).

8. CLOSED WORD SET FILE (`src/brain/mind/meaning/valueWords.ts`): the ONLY file in the job allowed to hold word lists, like closedSets.ts; add its path to the ALLOWED_LISTS line of tests/meaningNoPhrases.test.ts (the one allowed edit to that file). Each group carries a comment saying why it is closed grammar and a `status`. APPROVED by the owner on 2026-10-24: zero to nineteen, twenty thirty forty fifty sixty seventy eighty ninety, hundred, thousand, million, first to tenth, half. PROPOSED (built, but the owner approves each group before the Director merges; list them in the report in a table with the reason): sign words (minus, negative); percent words (percent, per, cent); clock words (quarter, past, noon, midnight, am, pm, o'clock); calendar words (today, tomorrow, yesterday; the seven weekday names; the twelve month names and their usual three-letter abbreviations). No other word list anywhere. Do not add "a dozen", "couple", "few" or any other counting word.

9. NOTHING reaches the chat differently in this job. Do NOT wire the reader into the Meaning stage, the pipeline or any screen (B03B2 does that). The golden transcript test and every existing test must give identical results before and after (run them and print the before and after counts).

THE CORPUS (test data, not code; documentation and proof, FL13). Create it EXACTLY as `tests/fixtures/values-corpus-b1.json`. The test clock is Saturday 2026-10-24 10:30 (`{ year: 2026, month: 10, day: 24, hour: 10, minute: 30 }`) unless an item has its own `now`. Every expected number was derived independently by the Director (Python), not remembered. `expect` lists the values in order; an item passes only when the list has exactly those values (same kind and text, in order) and every field named in the expectation matches. Field names: `value`, `unit`, `ms`, `date` (the ISO text), `time` (a string means `times` equals that one candidate; a list means `times` equals that list), `alternatives` on a date means `dateAlternatives`, `alt` means that `alternatives` contains that kind, `error`, `form`; `weak: true` means confidence below 0.5, and when `weak` is absent confidence must be at least 0.5. `kind: "stretch"` items are only reported. Segments for each item come from the real Reading code (copy how tests/meaningA.test.ts or tests/analysis.test.ts obtain them; if a no-dictionary way exists use it, otherwise pass the whole text as one language segment for items without quotes).
````json
[
 {
  "id": "V01",
  "text": "count the words in \"the quick brown fox\"",
  "expect": [],
  "kind": "core"
 },
 {
  "id": "V02",
  "text": "convert 5 miles to kilometres",
  "expect": [
   {
    "kind": "quantity",
    "text": "5 miles",
    "value": 5,
    "unit": "mile"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V03",
  "text": "change 100 fahrenheit to celsius",
  "expect": [
   {
    "kind": "quantity",
    "text": "100 fahrenheit",
    "value": 100,
    "unit": "Fahrenheit"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V04",
  "text": "what is 15 percent of 240",
  "expect": [
   {
    "kind": "percent",
    "text": "15 percent",
    "value": 15
   },
   {
    "kind": "number",
    "text": "240",
    "value": 240
   }
  ],
  "kind": "core"
 },
 {
  "id": "V05",
  "text": "calculate 12 times 8 plus 3",
  "expect": [
   {
    "kind": "number",
    "text": "12",
    "value": 12
   },
   {
    "kind": "number",
    "text": "8",
    "value": 8
   },
   {
    "kind": "number",
    "text": "3",
    "value": 3
   }
  ],
  "kind": "core"
 },
 {
  "id": "V06",
  "text": "turn this number into words 4521",
  "expect": [
   {
    "kind": "number",
    "text": "4521",
    "value": 4521
   }
  ],
  "kind": "core"
 },
 {
  "id": "V07",
  "text": "write 1994 in roman numerals",
  "expect": [
   {
    "kind": "number",
    "text": "1994",
    "value": 1994,
    "alt": "quantity"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V08",
  "text": "how many days between 1 March 2027 and 15 June 2027",
  "expect": [
   {
    "kind": "date",
    "text": "1 March 2027",
    "date": "2027-03-01"
   },
   {
    "kind": "date",
    "text": "15 June 2027",
    "date": "2027-06-15"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V09",
  "text": "what day of the week is 25 December 2027",
  "expect": [
   {
    "kind": "date",
    "text": "25 December 2027",
    "date": "2027-12-25"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V10",
  "text": "what is XIV in normal numbers",
  "expect": [
   {
    "kind": "roman",
    "text": "XIV",
    "value": 14
   }
  ],
  "kind": "core"
 },
 {
  "id": "V11",
  "text": "set a timer for ten minutes",
  "expect": [
   {
    "kind": "duration",
    "text": "ten minutes",
    "ms": 600000,
    "value": 10,
    "unit": "minute"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V12",
  "text": "set timer ten minutes pls",
  "expect": [
   {
    "kind": "duration",
    "text": "ten minutes",
    "ms": 600000
   }
  ],
  "kind": "core"
 },
 {
  "id": "V13",
  "text": "plese set a timmer for 10 minits",
  "expect": [
   {
    "kind": "number",
    "text": "10",
    "value": 10
   }
  ],
  "kind": "core"
 },
 {
  "id": "V14",
  "text": "set a time for tennis minutes",
  "expect": [],
  "kind": "core"
 },
 {
  "id": "V15",
  "text": "convert five mile too kilometer",
  "expect": [
   {
    "kind": "quantity",
    "text": "five mile",
    "value": 5,
    "unit": "mile"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V16",
  "text": "how many mile is 5 kilometres",
  "expect": [
   {
    "kind": "quantity",
    "text": "5 kilometres",
    "value": 5,
    "unit": "kilometre"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V17",
  "text": "convert 10 feet to metres, then 10 yards to metres",
  "expect": [
   {
    "kind": "quantity",
    "text": "10 feet",
    "value": 10,
    "unit": "foot"
   },
   {
    "kind": "quantity",
    "text": "10 yards",
    "value": 10,
    "unit": "yard"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V18",
  "text": "convert 5 miles and 3 feet",
  "expect": [
   {
    "kind": "quantity",
    "text": "5 miles",
    "value": 5,
    "unit": "mile"
   },
   {
    "kind": "quantity",
    "text": "3 feet",
    "value": 3,
    "unit": "foot"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V19",
  "text": "remind me in half an hour",
  "expect": [
   {
    "kind": "duration",
    "text": "half an hour",
    "ms": 1800000
   }
  ],
  "kind": "core"
 },
 {
  "id": "V20",
  "text": "wait an hour and a half",
  "expect": [
   {
    "kind": "duration",
    "text": "an hour and a half",
    "ms": 5400000
   }
  ],
  "kind": "core"
 },
 {
  "id": "V21",
  "text": "run it for 2 hours 15 minutes",
  "expect": [
   {
    "kind": "duration",
    "text": "2 hours 15 minutes",
    "ms": 8100000
   }
  ],
  "kind": "core"
 },
 {
  "id": "V22",
  "text": "set 1h30m",
  "expect": [
   {
    "kind": "duration",
    "text": "1h30m",
    "ms": 5400000
   }
  ],
  "kind": "core"
 },
 {
  "id": "V23",
  "text": "timer for 1.5 hours",
  "expect": [
   {
    "kind": "duration",
    "text": "1.5 hours",
    "ms": 5400000
   }
  ],
  "kind": "core"
 },
 {
  "id": "V24",
  "text": "stopwatch for 90 seconds",
  "expect": [
   {
    "kind": "duration",
    "text": "90 seconds",
    "ms": 90000
   }
  ],
  "kind": "core"
 },
 {
  "id": "V25",
  "text": "remind me in a week",
  "expect": [
   {
    "kind": "duration",
    "text": "a week",
    "ms": 604800000
   }
  ],
  "kind": "core"
 },
 {
  "id": "V26",
  "text": "add twenty five and 3",
  "expect": [
   {
    "kind": "number",
    "text": "twenty five",
    "value": 25
   },
   {
    "kind": "number",
    "text": "3",
    "value": 3
   }
  ],
  "kind": "core"
 },
 {
  "id": "V27",
  "text": "buy twenty-five apples",
  "expect": [
   {
    "kind": "number",
    "text": "twenty-five",
    "value": 25
   }
  ],
  "kind": "core"
 },
 {
  "id": "V28",
  "text": "I need one hundred and twenty copies",
  "expect": [
   {
    "kind": "number",
    "text": "one hundred and twenty",
    "value": 120
   }
  ],
  "kind": "core"
 },
 {
  "id": "V29",
  "text": "add two thousand five hundred",
  "expect": [
   {
    "kind": "number",
    "text": "two thousand five hundred",
    "value": 2500
   }
  ],
  "kind": "core"
 },
 {
  "id": "V30",
  "text": "is three million big",
  "expect": [
   {
    "kind": "number",
    "text": "three million",
    "value": 3000000
   }
  ],
  "kind": "core"
 },
 {
  "id": "V31",
  "text": "send 1,000 words",
  "expect": [
   {
    "kind": "number",
    "text": "1,000",
    "value": 1000
   }
  ],
  "kind": "core"
 },
 {
  "id": "V32",
  "text": "multiply by 3.5",
  "expect": [
   {
    "kind": "number",
    "text": "3.5",
    "value": 3.5
   }
  ],
  "kind": "core"
 },
 {
  "id": "V33",
  "text": "what is -5 plus 2",
  "expect": [
   {
    "kind": "number",
    "text": "-5",
    "value": -5
   },
   {
    "kind": "number",
    "text": "2",
    "value": 2
   }
  ],
  "kind": "core"
 },
 {
  "id": "V34",
  "text": "what is 5-3",
  "expect": [
   {
    "kind": "number",
    "text": "5",
    "value": 5
   },
   {
    "kind": "number",
    "text": "3",
    "value": 3
   }
  ],
  "kind": "core"
 },
 {
  "id": "V35",
  "text": "show the 2nd one",
  "expect": [
   {
    "kind": "number",
    "text": "2nd",
    "value": 2,
    "form": "ordinal"
   },
   {
    "kind": "number",
    "text": "one",
    "value": 1,
    "weak": true
   }
  ],
  "kind": "core"
 },
 {
  "id": "V36",
  "text": "what about the second one",
  "expect": [
   {
    "kind": "number",
    "text": "second",
    "value": 2,
    "form": "ordinal"
   },
   {
    "kind": "number",
    "text": "one",
    "value": 1,
    "weak": true
   }
  ],
  "kind": "core"
 },
 {
  "id": "V37",
  "text": "on the 21st",
  "expect": [
   {
    "kind": "number",
    "text": "21st",
    "value": 21,
    "form": "ordinal"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V38",
  "text": "the 1th item",
  "expect": [
   {
    "kind": "number",
    "text": "1th",
    "error": "bad-ordinal"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V39",
  "text": "wait a second",
  "expect": [
   {
    "kind": "duration",
    "text": "a second",
    "ms": 1000,
    "weak": true,
    "alt": "number"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V40",
  "text": "which one",
  "expect": [
   {
    "kind": "number",
    "text": "one",
    "value": 1,
    "weak": true
   }
  ],
  "kind": "core"
 },
 {
  "id": "V41",
  "text": "the last one was better",
  "expect": [
   {
    "kind": "number",
    "text": "one",
    "value": 1,
    "weak": true
   }
  ],
  "kind": "core"
 },
 {
  "id": "V42",
  "text": "add 15% to 240",
  "expect": [
   {
    "kind": "percent",
    "text": "15%",
    "value": 15
   },
   {
    "kind": "number",
    "text": "240",
    "value": 240
   }
  ],
  "kind": "core"
 },
 {
  "id": "V43",
  "text": "remind me tomorrow",
  "expect": [
   {
    "kind": "date",
    "text": "tomorrow",
    "date": "2026-10-25"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V44",
  "text": "what did I do yesterday",
  "expect": [
   {
    "kind": "date",
    "text": "yesterday",
    "date": "2026-10-23"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V45",
  "text": "is it ready today",
  "expect": [
   {
    "kind": "date",
    "text": "today",
    "date": "2026-10-24"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V46",
  "text": "if it rains tomorrow, cancel the trip",
  "expect": [
   {
    "kind": "date",
    "text": "tomorrow",
    "date": "2026-10-25"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V47",
  "text": "set an alarm for 8 tomorrow",
  "expect": [
   {
    "kind": "number",
    "text": "8",
    "value": 8
   },
   {
    "kind": "date",
    "text": "tomorrow",
    "date": "2026-10-25"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V48",
  "text": "set an alarm tomorrow at 8",
  "expect": [
   {
    "kind": "datetime",
    "text": "tomorrow at 8",
    "date": "2026-10-25",
    "time": [
     "08:00",
     "20:00"
    ]
   }
  ],
  "kind": "core"
 },
 {
  "id": "V49",
  "text": "wake me at 7:30am",
  "expect": [
   {
    "kind": "time",
    "text": "7:30am",
    "time": "07:30"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V50",
  "text": "meet at 20:15",
  "expect": [
   {
    "kind": "time",
    "text": "20:15",
    "time": "20:15"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V51",
  "text": "call at 8pm",
  "expect": [
   {
    "kind": "time",
    "text": "8pm",
    "time": "20:00"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V52",
  "text": "start at 12am",
  "expect": [
   {
    "kind": "time",
    "text": "12am",
    "time": "00:00"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V53",
  "text": "lunch at 12pm",
  "expect": [
   {
    "kind": "time",
    "text": "12pm",
    "time": "12:00"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V54",
  "text": "ring me at noon",
  "expect": [
   {
    "kind": "time",
    "text": "noon",
    "time": "12:00"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V55",
  "text": "alarm for half past eight",
  "expect": [
   {
    "kind": "time",
    "text": "half past eight",
    "time": [
     "08:30",
     "20:30"
    ]
   }
  ],
  "kind": "core"
 },
 {
  "id": "V56",
  "text": "alarm for quarter to nine",
  "expect": [
   {
    "kind": "time",
    "text": "quarter to nine",
    "time": [
     "08:45",
     "20:45"
    ]
   }
  ],
  "kind": "core"
 },
 {
  "id": "V57",
  "text": "alarm for quarter past 3",
  "expect": [
   {
    "kind": "time",
    "text": "quarter past 3",
    "time": [
     "03:15",
     "15:15"
    ]
   }
  ],
  "kind": "core"
 },
 {
  "id": "V58",
  "text": "see you on Friday",
  "expect": [
   {
    "kind": "date",
    "text": "Friday",
    "date": "2026-10-30"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V59",
  "text": "remind me on 1/3/2027",
  "expect": [
   {
    "kind": "date",
    "text": "1/3/2027",
    "alternatives": [
     "2027-03-01",
     "2027-01-03"
    ],
    "weak": true
   }
  ],
  "kind": "core"
 },
 {
  "id": "V60",
  "text": "remind me on 13/3/2027",
  "expect": [
   {
    "kind": "date",
    "text": "13/3/2027",
    "date": "2027-03-13"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V61",
  "text": "the date is 2027-03-01",
  "expect": [
   {
    "kind": "date",
    "text": "2027-03-01",
    "date": "2027-03-01"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V62",
  "text": "what day is March 1, 2027",
  "expect": [
   {
    "kind": "date",
    "text": "March 1, 2027",
    "date": "2027-03-01"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V63",
  "text": "is 31 February 2027 a Sunday",
  "expect": [
   {
    "kind": "date",
    "text": "31 February 2027",
    "error": "invalid-date"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V64",
  "text": "may I convert this",
  "expect": [],
  "kind": "core"
 },
 {
  "id": "V65",
  "text": "open the timer in march",
  "expect": [],
  "kind": "core"
 },
 {
  "id": "V66",
  "text": "remind me in 2 hours",
  "expect": [
   {
    "kind": "duration",
    "text": "2 hours",
    "ms": 7200000
   }
  ],
  "kind": "core"
 },
 {
  "id": "V67",
  "text": "MIX THE COLOURS",
  "expect": [
   {
    "kind": "roman",
    "text": "MIX",
    "value": 1009,
    "weak": true
   }
  ],
  "kind": "core"
 },
 {
  "id": "V68",
  "text": "what is mix",
  "expect": [],
  "kind": "core"
 },
 {
  "id": "V69",
  "text": "write XL as a number",
  "expect": [
   {
    "kind": "roman",
    "text": "XL",
    "value": 40
   }
  ],
  "kind": "core"
 },
 {
  "id": "V70",
  "text": "what is IIII",
  "expect": [],
  "kind": "core"
 },
 {
  "id": "V71",
  "text": "what is IC",
  "expect": [],
  "kind": "core"
 },
 {
  "id": "V72",
  "text": "my number is 08031234567",
  "expect": [
   {
    "kind": "number",
    "text": "08031234567",
    "value": 8031234567,
    "weak": true,
    "alt": "identifier"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V73",
  "text": "99999999999999999999",
  "expect": [
   {
    "kind": "number",
    "text": "99999999999999999999",
    "error": "too-large"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V74",
  "text": "",
  "expect": [],
  "kind": "core"
 },
 {
  "id": "V75",
  "text": "???",
  "expect": [],
  "kind": "core"
 },
 {
  "id": "V76",
  "text": "😀",
  "expect": [],
  "kind": "core"
 },
 {
  "id": "V77",
  "text": "مرحبا",
  "expect": [],
  "kind": "core"
 },
 {
  "id": "V78",
  "text": "x = 5",
  "expect": [
   {
    "kind": "number",
    "text": "5",
    "value": 5
   }
  ],
  "kind": "core"
 },
 {
  "id": "V79",
  "text": "12345",
  "expect": [
   {
    "kind": "number",
    "text": "12345",
    "value": 12345
   }
  ],
  "kind": "core"
 },
 {
  "id": "V80",
  "text": "count the words in \"ten minutes\"",
  "expect": [],
  "kind": "core"
 },
 {
  "id": "V81",
  "text": "the sign says \"open the timer in 5 minutes\" and I want 3 miles in km",
  "expect": [
   {
    "kind": "quantity",
    "text": "3 miles",
    "value": 3,
    "unit": "mile"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V82",
  "text": "I won the game for ten dollars",
  "expect": [
   {
    "kind": "number",
    "text": "ten",
    "value": 10
   }
  ],
  "kind": "stretch"
 },
 {
  "id": "V83",
  "text": "heya, convert 5 miles to kilometres, then set a timer for 10 minutes",
  "expect": [
   {
    "kind": "quantity",
    "text": "5 miles",
    "value": 5,
    "unit": "mile"
   },
   {
    "kind": "duration",
    "text": "10 minutes",
    "ms": 600000
   }
  ],
  "kind": "core"
 },
 {
  "id": "V84",
  "text": "set an alarm for 8 tomorrow if I am not awake",
  "expect": [
   {
    "kind": "number",
    "text": "8",
    "value": 8
   },
   {
    "kind": "date",
    "text": "tomorrow",
    "date": "2026-10-25"
   }
  ],
  "kind": "core"
 },
 {
  "id": "V85",
  "text": "what is the difference between affect and effect",
  "expect": [],
  "kind": "core"
 }
]
````

TESTS YOU MUST WRITE (all run with `npx tsx tests/NAME.test.ts`; NAME-based files): tests/valuesB1.test.ts (corpus runner, confusion table by value kind, the checks below) and tests/romanNumeral.test.ts.
1. CORPUS: 100 percent of core items, printed per item on failure; stretch items reported.
2. INDEPENDENT ROUND TRIP: for every integer from 0 to 99999, write it with the existing `numberToWords`, run `extractValues` on the words, and require the same number (skip forms that use a word outside the closed set, and COUNT the skips and print them). For 2,000 seeded random dates from 1900 to 2100 build `D Month YYYY` text with a month-name array that lives ONLY in the test, and require the ISO date `dateCalc.formatDate` gives. For every integer 1 to 3999, `parseRoman(toRoman(n)) === n`, and compare the whole table against an independent Python-generated list of 3999 numerals saved as a fixture.
3. SINGLE SOURCE: a test that proves no unit name or symbol text from UNITS is copied into any file under src/brain (read the files and search), and that a unit added to a copy of UNITS in the test is found by `extractValues` (inject the unit table for this test through an optional parameter `units` that defaults to UNITS).
4. STATIC GUARDS: tests/meaningNoPhrases.test.ts still passes (no regular-expression literal and no word list under src/brain/mind except closedSets.ts, concepts.ts and valueWords.ts).
5. MUTATION TESTS (at least eight, each must make the corpus fail, print the failing counts): ignore the sign; read `5-3` as minus; let `1th` pass; choose pm for `at 8`; decide `1/3/2027` as day-first; allow lower-case Roman; read months and years as durations; read a number inside quoted material; drop the `eet` rule; let `tennis` be 10.
6. HOSTILE INPUT: empty text, 20,000 and 20,001 characters, 400 digits, only symbols, emoji, right-to-left text, unpaired quotes, huge repeated words, a seeded fuzz of 2,000 random strings (fixed seed): no throw, no unbounded loop, every returned value has `text === original.slice(start, end)`, values sorted and not overlapping.
7. SPEED: print milliseconds per message on this machine (average and worst over the corpus x 20); the average must be under 1 ms; this is the budget for the weakest phone.
8. UNCHANGED: print the count of passing checks of tests/meaningA.test.ts, tests/meaningNoPhrases.test.ts, tests/brainGolden.test.ts before and after (identical).

LANE: NEW src/tools/engines/numbers/romanNumeral.ts; NEW src/brain/mind/meaning/valueWords.ts; NEW src/brain/mind/meaning/values/index.ts and as many small files in that folder as you need (scanner, numbers, quantities, times, types); NEW tests/valuesB1.test.ts, tests/romanNumeral.test.ts, tests/fixtures/values-corpus-b1.json, tests/fixtures/roman-1-3999.json; NEW docs/reports/B03B1_REPORT.md; CHANGE only the ALLOWED_LISTS line of tests/meaningNoPhrases.test.ts. Nothing else.
DONE MEANS: the tiers you deliver pass their share of the corpus 100 percent (a tier you did not deliver is named, and its corpus items are listed as NOT DELIVERED), the independent round trips pass, the eight mutations are killed, the guards pass, existing tests identical, strict type check clean (`npx tsc --noEmit -p tsconfig.json`), speed printed, and the report contains the LAW CHECK, a table of the PROPOSED words with reasons for the owner, the exact `test:kernel` lines to add, and everything NOT RUN.

## STANDING RULES (apply to every step of the job)

START RULE: after the one short paragraph and the LAW CHECK, START BUILDING IN THE SAME REPLY. Do not ask permission, do not stop to restate a plan, do not end your turn with a status report. Your next deliverable after the LAW CHECK is working files and, at the end, the zip. A reply that contains only a review and a Law Check is a FAILED delivery (this has happened before). Work in small verified steps: write ONE file, run its test, fix it, then the next file.

QUALITY LAW (owner, ABSOLUTE): the result must be perfect on its FIRST delivery. Do not hand back anything that merely looks finished.
1. RUN everything yourself in your sandbox before you hand anything over: unpack the repository zip you were given, install what it needs (package.json, tsconfig.json, tsx and the tests under tests/ are there), run every new test with `npx tsx tests/NAME.test.ts`, run the existing tests the job could affect (at least every command in the `test:kernel` script of package.json that does not depend on this job being merged), and run the type check with the project's own options (`npx tsc --noEmit -p tsconfig.json`; this is the project's `lint` script). A returned file that fails the type check is a failed delivery.
2. If your sandbox cannot run something (no internet to install, no tsx, no tsc), say exactly which step was NOT RUN and why, and do the strictest manual check you can. Never write "should work" or "tested" for something you did not run. Evidence labels: MEASURED (you ran it and saw the result), NOT RUN, HYPOTHESIS.
3. NO stubs, NO placeholders, NO "TODO", NO empty functions, NO hard-coded or fake results, NO simplified version that only works for the happy path, NO file that compiles but does nothing. Every error path returns a typed, honest error. Never claim an ability the code does not have.
4. Derive every expected number in a test by an INDEPENDENT calculation (Python with Decimal, hashlib, zlib and so on), never from memory. Break each new behaviour on purpose (empty input, huge input, odd characters, emoji, right-to-left text, zero, negative, wrong types) and keep those cases as tests. Seeded random tests use a fixed seed so they repeat.
5. If you cannot finish everything in one run, work in the PRIORITY ORDER given, deliver the finished items complete and tested, and list the unfinished ones plainly. NEVER deliver a half-built item. A smaller perfect delivery beats a larger broken one. Redoing work is worse than anything.
6. The weakest phone we support is an Infinix Note 10 (low memory). Cap input sizes with an honest typed error, never loop without a bound, never allocate without a bound.

ENGINE CONTRACT (every engine file in this job):
- PURE TypeScript. No React, no JSX, no DOM, no `window`, no `localStorage`, no network. Anything that needs time, randomness or storage is INJECTED as a parameter so tests control it. (The only exception is a job that names a .tsx file in its LANE.)
- Exported limit constants (for example `LOAN_LIMITS`) and exported types. Functions never throw for bad input: they return a typed result such as `{ ok: true, ... } | { ok: false, error: 'code', message: 'plain words' }`.
- Each tool-facing engine file also exports ONE descriptor object named `<TOOL>_DESCRIPTOR` = `{ toolId, displayName, purpose, examples: string[], inputs: { name: string; kind: 'text' | 'choice' | 'file' | 'yes-no'; choices?: string[]; prompt?: string }[] }` with 2 or 3 honest examples (documentation and tests only; the brain never matches on them: FL13). The `toolId` MUST be the exact catalog id from `src/tools/toolCatalog.ts`: loan-calculator, split-bill, pattern-tester, device-profile, json-viewer, file-inspector, qr-maker, zip-tool, code-formatter, file-compare (a new entry added later), and 'converter' for the format hubs and image planning. Do NOT register anything in the capability registry and do NOT edit the tool menu: a later job does both.
- No new dependency (jszip is already installed; only a job that names it may use it). No regular-expression literal inside `src/brain/mind`. Never add words or phrases to the brain.

LANE AND FILES: create or change ONLY the files named in the LANE section. Never edit package.json, tools/files.lock, tools/guard.mjs, .github, public/dictionary, src/App.tsx, src/tools/toolCatalog.ts or anything under src/components (unless the LANE names it). Never delete, rename or shorten an existing file. Do NOT edit package.json: REPORT the exact new lines to add to the `test:kernel` script (each as `tsx tests/NAME.test.ts`).

RETURN: ONE zip of NEW and CHANGED files only, paths relative to the repository root, no top folder needed, no nested zips, containing the report file named in the job. Create it with your code tool and give the download link. The report must contain: your LAW CHECK; every file created or changed; the exact commands you ran with the real pass or fail results and check counts; anything NOT RUN; anything unfinished; the package.json test lines to add.

CHECK THE BASE FIRST: the job names files that must exist in the repository zip you were given. If any is missing, STOP and say which.
