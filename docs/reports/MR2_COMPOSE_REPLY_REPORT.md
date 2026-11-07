# MR2 Reply Composer — implementation report

## Scope and placement

Created exactly the three requested files. The engine is isolated, has no imports, and nothing calls it. MR2 is the reply-side composer in layers 3–5 of the brain, under the Repair & Multi-reply stage (7K). MR3 wiring, splitting, wording, switching and dialogue state remain out of scope.

## LAW CHECK (FL11)

- **FL1 — Top view:** placed MR2 in the six-layer finished AXON and recorded later integration and likely breakage.
- **FL2 — Read exact scope:** read the complete roadmap, Part 3 again, the named design and cases files, and both named neighbouring engines; created only the three LANE files.
- **FL3 — End-to-end plan:** kept the composer as an isolated stage component; did not claim that multi-reply is live before MR3 and later proof.
- **FL4 — Progress/no repeats:** ran the proof once successfully; used a deterministic sweep and isolated mutation copies, with no repeated-failure repair cycle.
- **FL9 — Plan first:** followed the Director's planned MR2 placement and left MR3 and other undecided work untouched.
- **FL11 — Every-Stage:** this visible LAW CHECK is included here and was applied before implementation.
- **FL13 — Structure before vocabulary:** added no fixed phrases or phrase lists; the composer only orders and joins supplied strings.
- **FL15 — Verified foundation / no silent loss:** every valid piece is represented exactly once in the five result positions; pending asks and held asks are handled separately, and failed reasons are not printed.

## Implementation

`src/decision/composeReply.ts` exports `composeReply`, `PieceAnswer` and `ComposedReply`. It uses local result types, exact own-key checks including symbols, validation in the specified first-failure order, catches exceptions as `bad-input`, and freezes the success result, value and all four position arrays as well as failure results. It does not mutate inputs. Reply blocks follow D1–D9 and the cases file, with no composer-authored words.

## Proof results

### Cases file section A — all PASS

- M1 PASS — single answered, no echo.
- M2 PASS — single ask, no echo.
- M3 PASS — single waiting line, no echo.
- M4 PASS — single failed line, no echo.
- M5 PASS — multiple answered parts in input order.
- M6 PASS — answered part before pending question.
- M7 PASS — answered, waiting and failed parts.
- M8 PASS — answered part before an earlier waiting part.
- M9 PASS — first ask pending; later ask held.
- M10 PASS — all four kinds and two asks in the required order.
- M11 PASS — waiting parts retain input order.
- M12 PASS — three answered parts.
- M13 PASS — inner newline in answer preserved.
- M14 PASS — failed reason omitted from reply text.

### Cases file section C — all PASS

- C1 PASS — null, undefined, array and primitive roots return `bad-input`; throwing `pieces` getter returns `bad-input`; throwing piece getter returns `bad-input`.
- C2 PASS — missing or extra root key returns `unknown-key`; symbol root key returns `unknown-key`.
- C3 PASS — non-array and empty `pieces`; unknown kind; null and primitive piece; extra and missing piece keys; non-string and empty strings; leading/trailing spaces, trailing newline and tab-edge whitespace; symbol piece key; `waits` with `reason`; `asks` without `holdLine` all return `bad-pieces`.
- C4 PASS — seven valid pieces return `too-many-pieces`; seven pieces containing an invalid piece return `bad-pieces` first; six valid pieces are accepted.

Additional proof PASS: exact output key order; success value and all four position arrays frozen; error result frozen; input unchanged; 2,000 deterministic seeded cases covering all four kinds, one-to-six pieces, exact-one-place membership, position ordering, pending/held behavior, no added words, echoes for multi-piece replies, and answer/question/waiting order.

### Mutants

Applied 12 deliberate mutations to separate temporary copies of the engine and ran the full test suite against each copy. **12 killed; 0 survived.** Killed: echo always on; echo always off; single-newline separator; reverse answered order; drop held lines; show held questions; drop failed pieces; add a composer-authored word; print failed reason; raise piece cap; allow edge whitespace; allow empty `pieces`.

### Commands and honest limits

- `tsx tests/composeReply.test.ts` — **NOT RUN**: `tsx` was not available in this environment and the `npx` attempt did not complete. Exact line to append to `package.json`: `tsx tests/composeReply.test.ts`.
- Alternative proof: compiled the two TypeScript files with `tsc --strict --target ES2022 --module commonjs --moduleResolution node --outDir /tmp/mr2-build src/decision/composeReply.ts tests/composeReply.test.ts`, then ran `node /tmp/mr2-build/tests/composeReply.test.js`.
- Last test output: `COMPOSE_REPLY OK: 24384 checks`.
- Strict type check: `tsc --noEmit --strict --target ES2022 --module commonjs --moduleResolution node src/decision/composeReply.ts tests/composeReply.test.ts` — PASS, no diagnostics.
- Not run: the Director's independent reference rerun and cloud build/lint. No claim is made that MR3 integration or phone behavior has been tested.
