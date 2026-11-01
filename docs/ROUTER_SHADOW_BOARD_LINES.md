# ROUTER-SHADOW board lines (2026-11-01)

2026-11-01 (Director, twenty-sixth account): ROUTER-SHADOW DONE (built and checked by the Director only). The Router is the stage between Meaning and Resolution in the design (7E); as a shadow it runs right after Resolution, reads what Resolution produced plus the argument binder's decision per piece, and appends ONE line to the Resolution trace entry: `ROUTER shadow: N fast, N ask, N deep [piece 0 fast (R6); ...]`. It changes no reply (replies identical on 40 messages, old code against new) and the files outside the router never read `routes`.
FINDING (MEASURED): Resolution's `missingSlots` cannot see quoted text, so `count words in "hello world"` first came out as ASK. Rule R4 therefore asks the binder (same input the direct lane builds, never runs a tool); without a binder answer it falls back to Resolution's list.
The rules: R1 conditional or linked -> deep; R2 no schema -> deep; R3 irreversible or sends/spends/deletes -> deep; R4 binder ask -> ask, confirm-first -> deep; R5 found only by a carried value -> deep; R6 one capability, slots filled -> fast; R7 Resolution asked -> ask; R8 none/unavailable/negated -> deep; R9 greeting or thanks -> fast; R10 other not-a-request -> deep. Order: quick answer first, then asks, then deep (first stone for the W24 many-things-in-one-reply wish).
Real-stage reading, 24 messages: plain count with quoted text fast; greeting/thanks/define fast; 'if it rains ...' deep; 'tell me a joke', 'who are you', 'what time is it', 'send an email to Tom' deep (no capability fits); 'trim the video', 'zip these files' ask; a two-piece message routes piece by piece.
NOT USED, said loudly: close dictionary senses and the Meaning tone (they need the owner's decision on the Router's inputs).
NOT RUN: full type check, full suite, liveFacts, engineTruth, cloud build, phone check. FOUND failing before this job (also in the old code): `resolveOptionsRunner` status counts 3 / 37 / 18 / 5 expected, 4 / 36 / 18 / 5 got.
NEXT (Director picks): B05 D2b, or the Router go-live design (the Router choosing the lane).

## Treated as approved because the owner did not answer (review on request)
- Router inputs: Resolution output plus the binder only (not dictionary senses). Question still open.
- R5: a match found only by the value the message carries goes DEEP (the future Council confirms); the old rule said the running stage decides.
- R8: an unavailable (planned or waiting) tool goes DEEP, not ask.
- R9: greetings and thanks are FAST; every other non-request (chat, a stated need) is DEEP.
- A compound's second reading (the 'word count' rule) stays FAST because it is decided by a guarded rule, not a doubt.
- The Router is on in the shadow with no switch: it is read-only and failure-safe. A switch comes with go-live.

## MULTI-REPLY design defaults treated as approved because the owner did not answer
- Q1 answers in the order asked; Q2 other parts answer before the question; Q3 one question at a time; Q4 echo before each part when there are two or more parts. Details: docs/MULTI_REPLY_DESIGN.md section 5.
