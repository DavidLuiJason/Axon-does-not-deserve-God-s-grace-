# CONNECT1-A BOARD LINES (Director, 2026-11-07). Append to docs/JOB_BOARD.md; the board itself is not in this package (it is 176 KB; a stale copy would overwrite newer lines).

2026-11-07 | CONNECT1-A | ChatGPT batch of six cards (Text Cleaner, Find and Replace, Number to Words, Password Generator, Encoder and Decoder, Hash Tool), ACCEPTED by the Director for merge as PREPARED PARTS, not as live tools. 20 new files, no hot file touched, nothing registered, no switch changed. MEASURED: 126 checks pass, six mutants caught, strict tsc clean, 11 Director probes behaved. NOT RUN: full tests, guard, cloud build, the real brain with a switch ON. LOG FOR packBatch: first batch of six under Plan B; builder 1 return, 0 reissues; Director commands about 15, one turn.

FINDINGS (for the Director's next job; none is fixed in this package):
F1 CAPABILITY IDS. Only the kernel capability "text-tools" (registered as cap.text-tools in src/capabilities/registerAxonTools.ts) exists today. The builder used "number-tools" (Number to Words) and "creation-tools" (Password Generator, Encoder and Decoder, Hash Tool), both marked DIRECTOR TO CONFIRM, and neither is registered. The catalog groups are "numbers-converters" and "create-encode". Registration time must either add capabilities for them or reuse an existing one. Text Cleaner and Find and Replace use "text-tools" like Sort Lines.
F2 PASSWORD. The schema has an optional "random" text slot that the runner never reads; the action keeps the slot and uses the engine's cryptographic source. Owner or Director to confirm that is the intended contract.
F3 NUMBER TO WORDS. The runner accepts long digit strings, the action field is declared as a number: it works at run time, the declaration cannot say so.
F4 GUARDS ARE CAUTIOUS. They yield unless the text is inside quote marks and a tool word is present, and they yield on conflicting options (two algorithms, two formats, encode and decode together). This is the safe side (no wrong answer), but it means a plain unquoted request goes to the old path or an ask. The word lists are single-word closed sets (no phrase lists). The wrong cases are HYPOTHESIS until measured through the real brain.
F5 STYLE. The files are written in dense one-line form and each guard redefines the LaneGuard type locally instead of importing it; harmless, tidy later.
F6 TEST WIRING. No test was added to package.json test:kernel (builders never edit it); the six run with `tsx tests/live<Tool>.test.ts`.

OWNER DECISION WAITING: closed choice words (PROPOSED, not registered).
Encoder and Decoder, mode words: encode, encoding, decode, decoding. Format words: base64, base64url, url, html, hex, binary, rot13.
Hash Tool, algorithm words: md5, sha1, sha-1, sha256, sha-256, sha384, sha-384, sha512, sha-512, crc32.
The other four tools have no choice slot, so they need no words.

NEXT: (1) Director registers the six (capability decision F1, chat actions, guards into laneGuards.ts, LIVE_TASKS, task actions in axonEngine.ts), measures wrong cases through the real brain with each switch ON in a sandbox copy, and flips a switch only when tests/liveAdmission.test.ts passes. (2) CONNECT1-B card for ChatGPT: converter, text-compare, calculator, percentage-helper, qr-maker, random-picker. Timer, Stopwatch, Tally Counter wait for STATE3; Date Calculator waits for its own card.
