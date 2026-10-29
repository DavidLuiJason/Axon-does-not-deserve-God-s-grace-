# C28 — DC Circuit Solver report

## Top-view placement

AXON's finished architecture has Ground, Knowledge, Reading, Understanding, Voice and Reach layers. C28 belongs in Reach as a pure exact engine for ideal DC networks; later it can be called through the tool bus and independently checked by Verification. Its main future risks are numerical conditioning, ambiguous real-world component models, and integration that accidentally bypasses the shared engine or reports unsupported circuit behavior as fact. This engine explicitly models ideal sources, zero-resistance wires, and steady DC only.

## LAW CHECK (FL11)

- **FL1 — Top view:** placed C28 in Layer 5, Reach; later tool-bus and verification integration noted above.
- **FL2 — Exact scope:** used the supplied v20.0 roadmap and named mini-base files only; no unrelated repository files were edited.
- **FL3 — End-to-end plan:** pure solver API and typed result/error contract are ready for later integration.
- **FL4 — Progress / Two-Strike:** implemented and corrected issues through incremental checks; both deliberate mutants were detected and restored.
- **FL5 — Dictionary core:** dictionary data and interfaces are untouched.
- **FL6 — Bounded resources:** limits are 60 nodes and 200 elements; Gaussian elimination is bounded by those limits; no dependencies added.
- **FL7 — Measure:** reference cases include exact Python Fraction-generated values; residuals and executed commands are reported below.
- **FL9 — Plan first:** only the DC solver, tests and report were created.
- **FL10 — Truthful capability:** supported ideal model, assumptions, and failure cases are explicit; no descriptor/registration was added.
- **FL11 — Every-Stage:** this law check is included here and before implementation in the builder response.
- **FL12 — One designed brain:** no screens, brain stages or alternate answer paths are implemented.
- **FL13 — Structure before vocabulary:** no brain phrase lists or vocabulary were added.
- **FL14 — One source, no copies:** implementation is one pure engine; equivalent resistance calls the same solver. Later integrations should import this engine rather than copy its equations.
- **FL15 — Verified foundation:** known-answer, hostile-input, Kirchhoff, power, seeded reference, and mutation checks are included; full-project checks remain blocked by the incomplete mini-base.

### Building Rules 1–13

1. **Capacity:** small, single-engine job; 60-node/200-element limits bound matrix size.
2. **Foundation first:** pure engine only; no UI or registration.
3. **Foundation-up:** solve and error contracts are self-contained.
4. **One builder, sized job, proof:** only three named files are returned, with targeted proof.
5. **Plan before work:** follows C28 priority and lane.
6. **Measure → design → build → prove:** independent references, KCL/power checks, strict targeted type-check and mutants.
7. **Compression:** no bundled data or new dependencies.
8. **Weakest phone:** bounded to 60 nodes and 200 elements; dense solve is at most 260 unknowns in the stated limits (actual MNA size depends on source count).
9. **Guard and return discipline:** base guard was attempted; it fails because this mini-base omits many locked repository files, not because of these new files.
10. **Roadmap size:** roadmap was not edited.
11. **Future compatibility:** exported types, limits, solver and equivalent-resistance API; no descriptor added early.
12. **Ratchets:** existing guard/lock were not changed.
13. **Migration:** relative paths, no new dependencies, all return files in one flat-root zip.

## Files created

- `src/tools/engines/science/circuit.ts` — typed pure DC MNA solver and resistor-only equivalent resistance.
- `tests/circuit.test.ts` — textbook, hostile-input, Kirchhoff/power, seeded independent cases and mutation-sensitive assertions.
- `docs/reports/C28_REPORT.md` — this report.

No existing files were edited. `package.json`, `tools/files.lock`, and `tools/guard.mjs` were not changed.

## Evidence and commands

### MEASURED — targeted strict TypeScript check

Command:

```sh
tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck src/tools/engines/science/circuit.ts tests/circuit.test.ts
```

Result: **PASS, exit 0**.

### MEASURED — executable tests via available global TypeScript compiler

The mini-base has no `node_modules`, `tsx` executable or cached `tsx` package. The same TypeScript engine and test were therefore compiled to temporary CommonJS JavaScript and run with Node:

```sh
tsc --target ES2022 --module commonjs --moduleResolution node --strict --skipLibCheck --outDir /mnt/data/c28_build src/tools/engines/science/circuit.ts tests/circuit.test.ts
printf '{"type":"commonjs"}\n' > /mnt/data/c28_build/package.json
node /mnt/data/c28_build/tests/circuit.test.js
```

Result: **PASS** — 229 assertions; 208 solved networks; 17 typed-error cases; 200 seeded independent cases. Largest observed KCL/power residual: `1.066e-14`, within relative tolerance `1e-9`.

The solved network checks independently sum currents at every node and independently sum element powers. Cases include a voltage divider, series and parallel equivalent resistance, balanced and unbalanced Wheatstone bridges, two voltage sources with superposition, a current source feeding a resistor, and a 10-stage ladder.

### MEASURED — mutation checks

1. Changed the voltage-source RHS stamp from `rhs[row]=e.volts` to `rhs[row]=-e.volts`: the test failed as expected (`divider midpoint: expected 4, got -4`). Restored the original source.
2. Changed the power-balance sum to return only the first element's power: the test failed as expected (`reported power balance: expected 0, got -0.048`). Restored the original source.
3. Recompiled and reran after restoring: **PASS**, same 229 assertions and residual.

### NOT RUN / BLOCKED — exact project commands

- `npx tsx tests/circuit.test.ts`: **NOT RUN successfully**. `npx --offline` failed with `ENOTCACHED`; there is no installed `tsx`, no `node_modules`, and this environment cannot fetch the missing package. Equivalent compiled test execution passed as described above.
- `npx tsc --noEmit -p tsconfig.json`: **NOT RUN successfully**. It exits 2 before checking project code because `vite/client` type definitions are absent from the mini-base (`TS2688`). The targeted strict type check above passed.
- `npm run test:kernel`: **BLOCKED**, exit 127 (`tsx: not found`). The mini-base contains no existing `tests/` files, although `package.json` lists the full repository's test chain.
- `node tools/guard.mjs`: **BLOCKED by mini-base incompleteness**, exit 1; it reports 349 missing locked repository files. The required guard file itself is present. No guard or lock files were changed.

## Independent seeded reference generator

The 200 fixed-seed test cases are voltage dividers. The expected midpoint voltage was generated independently using Python's exact rational arithmetic, then stored as numeric literals in `tests/circuit.test.ts`; the TypeScript solver does not generate its own expected values.

```python
import random
from fractions import Fraction

rng = random.Random(280028)
cases = []
for _ in range(200):
    rtop = rng.randint(1, 10000)
    rbottom = rng.randint(1, 10000)
    volts = rng.randint(1, 240)
    expected = Fraction(volts * rbottom, rtop + rbottom)
    cases.append((rtop, rbottom, volts, float(expected)))
```

## Known interface limitation

The network format has no separate node registry: node names are defined by element terminals. Therefore, an arbitrary non-empty terminal name cannot be identified as “unknown” in isolation; a terminal on a disconnected part is instead reported as `FLOATING_PART`, naming the affected nodes. Empty or invalid terminal names return `INVALID_NETWORK`.

## `test:kernel` line to add

Do not edit `package.json`. Add this command to the `test:kernel` chain:

```sh
tsx tests/circuit.test.ts
```

## Completion

All three lane files are complete. The new test passes through the available compile-and-run route and targeted strict type-check passes. The exact `tsx` command, full-project type check, existing kernel chain and guard could not pass in this 13-entry mini-base for the environment/repository-completeness reasons listed above; they are not represented as passed.
