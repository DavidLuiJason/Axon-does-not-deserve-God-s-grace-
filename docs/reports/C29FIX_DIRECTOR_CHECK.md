# C29-FIX Director check (2026-10-31)
MEASURED by Director (tsx available): lane clean (6 files, 0 out of lane); unitCategories 59 checks, physics 171, toolsNumbers 67, valuesQuantities 61, tools 220, calculatorUpgrade, calculatorReadAs, valuesRunner, languageKitRunner, romanNumeral all pass; engine files strict-tsc clean. Full test:kernel NOT RUN this turn (turn budget).
Builder's NOT RUN items (tsx missing) now run: toolsNumbers, valuesQuantities.
DEFECTS FOUND AND FIXED BY DIRECTOR: (1) 5 mW converted as megawatt (5,000,000 W): milliwatt added, and a case-insensitive match that fits two units is now refused (unknown-unit) instead of guessed (kn/kN, mw/mW/MW); (2) message "3 quantity needed" now "3 quantities needed".
Mutants by Director: ambiguity rule removed and mW factor wrong, both caught. Builder's M1-M8 not re-run (their report lists the caught checks).
Open: legacy case-insensitive guesses for single matches (e.g. "b" for byte) unchanged; owner decides later.
