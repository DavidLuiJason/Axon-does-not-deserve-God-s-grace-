# How AI tools learn and get good (plain words, for the owner)

Written 2026-10-26 by the Director (Claude). Simplified on purpose. Where I am describing the general public picture and not something I can check, I say so.

## 1. The big idea
A modern AI model is not given rules. It is shown an enormous amount of examples and adjusts itself, millions of tiny dials at a time, until its guesses get good. Nobody types "a bank can be a river bank". The model sees the word used in billions of sentences and its dials settle into patterns that act like that knowledge.

## 2. The four stages most top tools go through

**Stage 1: Reading everything (pre-training).** The model reads a huge amount of text (books, websites, code, papers). The only game: guess the next word. Wrong guess, adjust the dials a little. Repeat trillions of times. This is where it learns language, facts, how code looks, how arguments flow. Cost: months, thousands of special chips, millions of dollars. This is what a single phone app cannot do.

**Stage 2: Learning to be an assistant (fine-tuning).** Humans write good example answers to questions, and the model is trained on them. Now it answers instead of just continuing text.

**Stage 3: Learning what people prefer (feedback).** People compare two answers and pick the better one. The model is nudged toward the kind of answer people pick (helpful, clear, honest, polite). Newer methods also use written principles or another AI as the judge.

**Stage 4: Learning by trying and being checked (this is the code one).** For tasks where the answer can be CHECKED by a machine (does the code run, does the test pass, is the maths right), the model tries many times, the checker says pass or fail, and it is rewarded for passing. This is the biggest reason the best coding models became good: a test cannot be flattered. (This is the public description of the method; the exact recipes of each company are secret.)

## 3. What you saw: "attack its own code to find problems"
That is stage 4 turned into a working habit. Good tools do not only write code; they RUN it, read the error, break it on purpose with nasty inputs, fix it, and run it again. The reason weak tools give "false or incomplete work" is that they stop after writing. In this project that habit is called mutation testing: the Director changes the code on purpose (a "mutant") and checks that the tests notice. Example from today: I broke the tone engine in 10 different ways and the tests caught all 10; I broke the sense engine in 9 ways and the tests caught 7, which tells me 2 parts are not proven yet. I cannot tell from here whether the thing you remember came from me or from ChatGPT in an older chat; this style of work is what the Director does on every stage.

## 4. How they "know" things: stored or researched?
Both, and they are different:
- **Stored in the dials:** everything learned in training. It is not a database of pages; it is a compressed pattern of them. That is why a model can be confidently wrong: it recalls a pattern, not a checked record. It stops at a cut-off date.
- **Looked up when needed (tools):** web search, reading a file, running code, a calculator. The answer is fetched fresh, then the model reads it. This is how a model stays current and checks itself.
The best tools mix them: pattern knowledge to understand you, tools to check facts and run things.

## 5. How they make pictures
- Most image tools use **diffusion**: start from pure noise (TV static) and remove noise step by step, steered by your words, until a picture appears. During training, the model saw millions of (picture, caption) pairs and learned to undo noise while matching the caption.
- A second part turns words into numbers that steer the picture (so "red cat" and a red cat meet in the same number-space).
- Nothing is copied from a stored picture; it is generated from learned patterns (with arguments about training data and rights).
- Vision (understanding a picture or video) is the reverse use: the same kind of training lets the model describe what it sees. Video is handled as many pictures (frames) plus sound.

## 6. What makes the very best tools better than the rest
1. More and cleaner training data, and a lot of money for chips.
2. Better feedback (careful humans, strong checkers).
3. Tools plus a loop: plan, act, check, fix (what you want for AXON).
4. Many rounds of testing against hard cases before release.

## 7. What this means for AXON (the Director's view)
AXON is not trying to out-read the world; that needs a data centre. AXON's edge is the part you control: a brain whose every step is written down and testable (readings with reasons, not a black box), your own laws, your own checks, and the loop (plan, act, check, fix). So the plan is: keep every stage provable with the real dictionary and your tests, build the self-attack habit (stage 4's idea) into AXON Code, and use outside models only as helpers the way the roadmap already says.
