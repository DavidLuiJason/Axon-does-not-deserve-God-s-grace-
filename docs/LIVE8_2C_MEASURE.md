# LIVE8-2c: why the binder asks on unquoted text (Director, twenty-fourth account, 2026-11-01). Measure only; NO code shipped.
Method (MEASURED, real brain, real dictionary, shipped switches): the repository copy was temporarily logged inside `directLane.ts` (the log was removed again; the file is byte-identical to the repository). 19 requests, then 11 with the binder's own output.

## Findings
1. **The binder takes the text ONLY from quote marks (by design: no source for a required text slot means missing, asking beats guessing).** For `convert hello to uppercase`, `make HELLO lowercase`, `convert hello world to uppercase`, `make hello world lowercase`, `convert hello_world to camelCase`, `turn my var name into snake case`, `make it uppercase`: decision = ask, missing slot `text` ("This was not said"), mode found correctly each time (uppercase, lowercase, camelcase, snake). With quotes (`convert "hello world" to uppercase`) the same request runs.
2. **The question is never shown.** When the binder asks, the lane yields and the OLD handler answers "I do not have a way to do that, and I will not guess", which is now untrue (Case Converter exists). The person never learns that quote marks would fix it. (7 of 7 unquoted requests above.)
3. **A hidden binder defect, found by measurement (the reason the part 1c quote guard matters):** for `change hello world to title case` the binder RUNS with `{mode: title, text: "case"}`; for `convert helloWorld to snake case` it runs with `{mode: snake, text: "case"}`. The mode word `title` or `snake` is taken as the mode and the leftover word `case` is bound as the text. Without the quote guard these would answer "Case". Only the guard (answer only when the text sits inside quote marks) stops it. HYPOTHESIS (not yet read in the code): the leftover-word rule does not treat the second word of a two-word mode name as part of the mode.
4. Other yields measured and CORRECT: `hello`, `what is uppercase`, `convert a snake to a string` (no single sure tool); `convert the camel image to png` (reads as another tool, switched off); `uppercase this: hello world` (more than one piece: the colon).
5. `convert hello world to camel case` yields on the guard (binder said run; the text bound was again a leftover word).

## What this means
- Unquoted text is NOT a bug in the binder: it matches the owner's rule that quoted text is the thing to work on. The defect is the SILENCE: the person gets "no way" instead of the question.
- Finding 3 is a real latent defect behind a guard; it must be fixed at the source before the guard is ever relaxed (FL4, FL9).

## Q4 for the owner (yes or no; Director's default if you say nothing: yes, built after the gate)
**When the binder asks because the text was not said, AXON shows that question in chat** (for example: "Which text? Put it in quote marks, like convert "hello" to uppercase.") instead of the old "no way" reply. Applies to Case Converter; Text Counter measured separately first. Changes some replies, so the golden transcript is regenerated on purpose.
Order after the gate: LIVE8-2d (show the question) then LIVE8-2e (fix finding 3 at the source). Reason for waiting: FL15 rule 6, two jobs already stand on unconfirmed checks.
