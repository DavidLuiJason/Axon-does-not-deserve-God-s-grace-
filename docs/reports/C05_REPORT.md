# C05 — QR Code Engine report

## Result

**MEASURED:** Implemented a pure TypeScript QR Code Model 2 byte-mode encoder for versions 1–10 and L/M/Q/H error correction, with smallest-fitting-version selection, all eight masks, standard mask penalties, function patterns, BCH format/version data, GF(256) Reed–Solomon block encoding and interleaving, SVG output, and payload helpers. The independent test decoder round-tripped **1,279 strings** and checked zero Reed–Solomon syndromes for every recovered block. An external OpenCV decoder also decoded the generated SVG after SVG-to-PNG rendering.

## LAW CHECK (FL11)

- **FL1:** Used the full v16.4 roadmap and its top-view architecture before implementation.
- **FL2:** Read the supplied roadmap in full, revisited section 3, and inspected the BASE, job board, handbook and C05 prompt.
- **FL3:** Kept the engine contract compatible with later registry, chat-action and screen integration.
- **FL4:** Built and checked in small steps; corrected the function-pattern placement defect before final verification.
- **FL5:** Did not alter or omit the dictionary.
- **FL6:** Bounded QR versions to 1–10 and input to the maximum version-10 byte capacity; SVG dimensions and module size are capped.
- **FL7:** Used repeatable tests, independent arithmetic derivations and an external decoder rather than assumptions.
- **FL8:** Return archive contains only the three permitted new files with repository-relative paths.
- **FL9:** Followed the engine-first workflow; no screen or integration changes were made.
- **FL10:** Exported `QR_DESCRIPTOR` with tool id `qr-maker`; did not register capabilities or claim chat integration.
- **FL11:** This law check is included in the report.
- **FL12:** The implementation is a pure engine and does not call or bypass the brain.
- **FL13:** Descriptor examples are documentation only; no brain phrase lists were added.
- **Rule 1:** Kept the job within the requested three-file lane and versions 1–10.
- **Rule 2:** Built on the existing repository structure and verified both required BASE files.
- **Rule 3:** Implemented the engine and tests only, before any screen work.
- **Rule 4:** Separated implementation, test execution and external-decoder verification.
- **Rule 5:** Kept the work within the Create and Encode tool stage.
- **Rule 6:** Derived polynomial, BCH and alignment expected values independently in Python and ran tests.
- **Rule 7:** Added no dependency or bundled data; the trade-off is a bounded in-memory matrix and Reed–Solomon work per encode.
- **Rule 8:** Capped versions, input bytes, SVG module size and output dimensions for low-memory devices.
- **Rule 9:** Packaged only the named lane files; the BASE itself was not changed.
- **Rule 10:** Did not modify the roadmap.
- **Rule 11:** Kept exported results and payload helpers independent of UI and ready for later integration.
- **Rule 12:** Added tests without weakening existing guards or tests.
- **Rule 13:** Used repository-relative paths and introduced no dependency.

## Files created

1. `src/tools/engines/create/qrCode.ts`
2. `tests/qrCode.test.ts`
3. `docs/reports/C05_REPORT.md`

No existing files were changed. `src/tools/engines/create/index.ts` is intentionally untouched.

## Verification evidence

### MEASURED — successful

- `tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --skipLibCheck src/tools/engines/create/qrCode.ts` — **PASS**.
- `tsc --target ES2022 --module commonjs --moduleResolution node --strict --skipLibCheck --esModuleInterop --outDir /tmp/qrtest /tmp/node-shim.d.ts src/tools/engines/create/qrCode.ts tests/qrCode.test.ts` — **PASS**. The temporary declaration shim was needed because this sandbox has no installed Node type definitions.
- `node /tmp/qrtest/tests/qrCode.test.js` — **PASS**, 1,279 independent decoder round trips. Each decode reads either format-information copy, recovers the mask, unmasks the data path, de-interleaves blocks, verifies all Reed–Solomon syndromes are zero, and reads UTF-8 byte-mode payload data.
- Seeded coverage: all byte lengths from 1 through the version-10 capacity at each of L/M/Q/H (754 level/length cases), plus version-boundary and seeded mixed-character cases. Total successful round trips: **1,279**.
- Edge checks: empty input (`empty-input`), exact and one-byte-over version-10 capacity for all four levels, four-byte UTF-8 emoji, right-to-left Arabic, malformed lone surrogate, invalid level, oversized input, Wi-Fi escaping, email, phone, links and SVG validation — **PASS**.
- Independent Python arithmetic — **PASS**. GF(256) degree-7 generator coefficients: `[1,127,122,154,164,11,68,117]`. Python-derived format words (masks 0–7): L `77C4 72F3 7DAA 789D 662F 6318 6C41 6976`; M `5412 5125 5E7C 5B4B 45F9 40CE 4F97 4AA0`; Q `355F 3068 3F31 3A06 24B4 2183 2EDA 2BED`; H `1689 13BE 1CE7 19D0 0762 0255 0D0C 083B`. Python-derived version words: v7 `07C94`, v8 `085BC`, v9 `09A99`, v10 `0A4D3`. Python-derived alignment positions for v1–10: `[]`, `[6,18]`, `[6,22]`, `[6,26]`, `[6,30]`, `[6,34]`, `[6,22,38]`, `[6,24,42]`, `[6,26,46]`, `[6,28,50]`. These values are asserted in the test.
- External bitmap check — **PASS**. Rendered the actual `qrToSvg()` output to PNG using CairoSVG 2.8.2; OpenCV 4.13.0 independently decoded `AXON independent bitmap proof: café 🙂 https://example.com` exactly.

### NOT RUN — sandbox limitations

- `npx tsx tests/qrCode.test.ts` — **NOT RUN**: the invocation timed out while resolving `tsx`; `tsx` is not installed in the sandbox.
- `npm run test:kernel` — **NOT RUN**: stopped immediately with exit code 127, `sh: 1: tsx: not found`. The existing kernel suite could not be executed without the missing runner.
- `npx tsc --noEmit -p tsconfig.json` — **NOT RUN successfully / BLOCKED**: the project-configured type check exits with TS2688 because the BASE has no installed `vite/client` type definitions. The engine itself passed the standalone strict TypeScript check above, and engine plus test passed strict compilation using the temporary Node-assert declaration shim.

No claim is made that the full `test:kernel` suite or project-configured type check passed. No implementation items remain unfinished; the unavailable repository-toolchain checks remain unverified.

## Integration lines to add later

Add this export line to `src/tools/engines/create/index.ts` during the integration step (not in this job):

```ts
export { makeQr, qrToSvg, qrCapacity, wifiPayload, emailPayload, phonePayload, linkPayload, QR_LIMITS, QR_DESCRIPTOR } from './qrCode';
```

Add this line to the `test:kernel` script in `package.json` (not changed here):

```text
tsx tests/qrCode.test.ts
```

## Director inspection 2026-10-18 (INSPECTED-FIX, fixed by the Director; MERGE)
- MEASURED: verify_return.py clean on the returned zip (3 new files, in lane, strict tsc passes, the test passes under tsx).
- MEASURED by the Director with an independent decoder (OpenCV QRCodeDetector, no shared code): 192 codes written by the engine (versions 1 to 10, all four levels, strings at and below each capacity, accented letters, emoji, all eight masks seen); all 192 decode to the exact text (8 needed a different pixel scale, which is the detector, not the encoder: every one decodes at another scale). Limits and errors are right: 271 bytes at L and 213, 151, 119 at M, Q, H; lone surrogates refused.
- Found by hand and fixed here (the new tests fail on the returned engine): the four payload helpers accepted input that makes a code that does not work or is unsafe.
  1. wifiPayload: empty network name, name over 32 bytes, WPA password not 8 to 63 characters (or 64 hex digits), empty WEP password are now refused.
  2. emailPayload: "not an email" and "a@b@c" gave `mailto:` garbage; the address is now checked (conservative pattern, no commas, spaces, `?`, `;`).
  3. phonePayload: "abc" and a number with a line break were accepted; now 3 to 20 digits with optional leading `+`, spaces, dots, dashes and brackets removed (`tel:+15551234567`).
  4. linkPayload: `javascript:`, `data:`, `vbscript:` and `file:` links were accepted, spaces were kept, `//x.com` became `https:////x.com`, `localhost:3000` got no scheme. Now refused or repaired.
- The existing wifi test used a 6-character WPA password; changed to a 10-character one with the same special characters (expected text re-derived from the escaping rule).
- LIMITS to know, not fixed: `qrToSvg` returns an empty string (not an error) for invalid options or a malformed matrix; the engine is byte mode only (no numeric or alphanumeric compaction), so codes are slightly larger than the smallest possible; versions 1 to 10 only.
