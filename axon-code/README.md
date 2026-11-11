# AXON Code — Round 14 full-source checkpoint

AXON Code is a standalone technical development environment. AXON Brain is an authorised caller through a narrow JSON gateway; AXON Code is not an autonomous AI and does not independently author source code. The AXON main app was not modified.

## Current status

This is a **full-source Round 14 checkpoint**, not a final approved release. The supplied Round 12 build is the baseline. All currently runnable Node tests pass: **1,108 passed, 0 failed, 0 skipped** (serial execution). The retained test ratchet remains at 1,015.

- C10 security/redaction: DONE; central redaction boundary and adversarial tests cover logs, diagnostics, exports and crash reports; approval/trust controls remain tested.
- C3 Android: PARTIAL; typed Capacitor contract, Kotlin SAF plugin source and fake-host tests are present. Android compilation/device evidence is NOT RUN.
- C4 Python: PARTIAL; real Pyodide CPython Worker adapter and offline-pack verification/install/removal contracts are present. No actual Pyodide pack is installed; real execution is BLOCKED.
- C5 editor/terminal: BLOCKED; CodeMirror 6 and xterm.js are fixed choices with strict integration contracts, but packages are not installed and UI migration is not complete.
- C1 reproducible packaging: BLOCKED; registry DNS resolution fails and TypeScript 5.8.3 is absent from npm cache. The build currently uses host-global TypeScript 5.8.3 linked locally; this is not clean `npm ci` proof.
- WP5 provider isolation-grade and CPU/memory/process/disk/network quota enforcement remain incomplete.
- Real Chromium IndexedDB reload and Android force-stop/restart proof remain NOT RUN.

## Commands

```bash
npm run build
npm run test:r14:phase-a
npm run test:full-r14
npm run verify:director
npm run verify:browser
python3 tools/test-round12-pty.py
```

See `docs/ROUND14_IMPLEMENTATION_REPORT.md`, `AXON_CODE_PROGRESS.json`, `docs/C5_ENGINE_ADOPTION.md` and `docs/C3_C4_HOST_PROVIDER_STATUS.md` for evidence and boundaries.
