# LIVE8-2b part 0: where each missed Case Converter shape stops (Director, twenty-fourth account, 2026-11-01)
Docs only. No code changed. MEASURED on the repository zip as it is now: real brain, real dictionary, the shipped switches, `askWithTrace` notes (they carry counts and the lane's yield reason, not the candidates).

| Request | Meaning | Resolution | Lane |
|---|---|---|---|
| `convert "hello world" to uppercase` (control) | command | 1 match | ANSWERS, task record |
| `uppercase "abc def"` | clause kind unknown | no match, ask, unavailable or none | yields: no single sure tool was found |
| `lowercase "ABC DEF"` | clause kind unknown | same | same |
| `turn "hello there" into kebab-case` | command | none | same |
| `convert "x y" to KEBAB-CASE` | command | 1 question (ask) | same |
| `change "hello world" to Title` | command | 1 question (ask) | same |
| `convert hello world to uppercase` (no quotes) | command | 1 match | yields: the binder says ask |

READING OF THE TABLE (MEASURED = where it stops; HYPOTHESIS = why):
1. Bare `uppercase` / `lowercase` stop in MEANING: no verb, so the clause is not read as a command. HYPOTHESIS: the mode word is the only verb-like word.
2. `kebab-case` stops in RESOLUTION, and the verb changes the outcome (`turn` gives none, `convert` gives a question), so it is not only the mode word. HYPOTHESIS: the hyphenated word splits into `kebab` + `case` and `kebab` has no concept.
3. `Title` alone stops in RESOLUTION as a question. HYPOTHESIS: `title` also names something else, so two readings tie.
4. Unquoted text stops in the BINDER (the text slot is not filled), not in Resolution.
NOT MEASURED: the candidate list and scores Resolution returns, what each question offers, why Meaning says unknown. One scratch print of `resolutions` answers all three (the plan the previous account paused on).

ORDER FINDING (Director): FL15 rule 6 says unconfirmed machine, cloud or phone checks cannot be built on for more than two jobs. The merge lines since RESOLVE-TC part 1 are about 19 jobs, all checked by the Director only; the LIVE board lines I opened record no cloud build or phone result for any LIVE job. So before more CODE on top: the owner gate in NOW.txt. Measurement-only work like this part is allowed. B05 stays after that: 7L item 2 says it has no contract, corpus or count, and builders never get UNPLANNED items.
NEXT after the gate: LIVE8-2b part 1, one shape group at a time (bare uppercase/lowercase; kebab-case and Title; unquoted text). Any new word or rule needs the owner's yes (FL13).
