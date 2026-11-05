# J4 Capability Window Report

## Five-line project assessment
1. **Finished AXON:** A layered Android AI assistant with knowledge, language understanding, reasoning, voice, tools, memory, media, device access and optional outside AI services.
2. **J4 placement:** An isolated pure engine in layer 5 (Reach), after Understanding, implementing capability time windows and approval waiting periods.
3. **Dependencies:** The engine has no caller; screens, storage, wiring and clock access are not added.
4. **Possible later breakage:** Incorrect time boundaries, freezing precedence, USER/SYSTEM handling or approval timing could affect future capability permissions.
5. **Design boundary:** The v21.3 DESIGN-FIRST EXIT explicitly permits this isolated engine before the full 7M design.

## LAW CHECK (FL11)
- **FL1:** J4 is placed in layer 5, Reach, after Understanding; later additions and boundary risks are covered.
- **FL2:** Only the roadmap and the three named style examples were read; only the three permitted files were created.
- **FL3:** The engine remains isolated; screens, storage, wiring and callers are deferred to the 7M design.
- **FL4:** One bounded job, hand-worked cases, strict compilation, runtime tests and six deliberate mutations.
- **FL9:** Implements only 7M items 2–5 under the DESIGN-FIRST EXIT.
- **FL10:** No registry entry or chat action is added; integration remains future work.
- **FL11:** This visible check is repeated in the report.
- **FL12:** No brain or chat path calls the engine.
- **FL13:** No phrase lists or brain vocabulary are added; only the contract's closed state/reason values are used.
- **FL14:** One pure engine; no imports or duplicated implementation.
- **FL15:** No external facts are introduced; behavior is tested against the supplied contract.

## Result
**BUILT; STRICT COMPILE: PASS; ISOLATED TEST RUN: PASS.**

Printed test line:

```text
CAPABILITY_WINDOW OK: 348 checks
```

## Exact proof commands and output
Commands run from `/tmp/axon-j4-work`:

```sh
tsc --noEmit --strict --target ES2020 --module commonjs src/capabilities/capabilityWindow.ts tests/capabilityWindow.test.ts
```

Output: no diagnostics; exit status 0.

**One initial attempt** at this same strict compile found a TypeScript narrowing error in the test helper (`TS2339`, access to `value` on generic `T`). I corrected the test helper once; the exact strict command above then passed. No repeated failure occurred.

```sh
rm -rf /tmp/axon-j4-test && tsc --strict --target ES2020 --module commonjs --outDir /tmp/axon-j4-test src/capabilities/capabilityWindow.ts tests/capabilityWindow.test.ts
```

Output: no diagnostics; exit status 0.

```sh
node /tmp/axon-j4-test/tests/capabilityWindow.test.js
```

Output:

```text
CAPABILITY_WINDOW OK: 348 checks
```

## Deliberate breakages
The mutation runner was invoked with:

```sh
python /tmp/axon-j4-work/run_mutants.py
```

All six mutations were caught by their named literal test cases; the original source was restored after each mutation and again in the runner's `finally` block.

1. Change end comparison from `>=` to `>` (end incorrectly remains inside): **CAUGHT** — `C5 exactly at end exact value`.
2. Change start comparison from `<` to `<=` (start incorrectly remains outside): **CAUGHT** — `C3 exactly at start exact value`.
3. Remove the USER restriction from safe mode (SYSTEM incorrectly freezes): **CAUGHT** — `C9 safe mode leaves SYSTEM exact value`.
4. Let a future start defeat `frozen` (frozen incorrectly loses to sleeping): **CAUGHT** — `C7 frozen beats sleeping exact value`.
5. Change the default wait from 2 days to 3: **CAUGHT** — `T1 default two days exact value`.
6. Change the maximum wait from 30 days to 31: **CAUGHT** — `E1 31 days fails`.

The strict compile and 348-check runtime test were rerun successfully after restoration.

## `test:kernel` line to add

```text
tsx tests/capabilityWindow.test.ts
```

`package.json` was not edited.

## NOT RUN
- `tsx tests/capabilityWindow.test.ts` and integration into `test:kernel`.
- Main repository-wide tests, build, cloud build, APK and Android-device behavior.
- Screens, storage, wiring, registry/chat caller and the later full 7M design; intentionally outside this isolated-engine job.
