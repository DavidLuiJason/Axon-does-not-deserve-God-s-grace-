# C01 report (Director-fixed delivery)

ChatGPT delivered loan.ts, splitTip.ts and two thin tests, reported them NOT RUN (its sandbox had no tsx or dependencies) and left Pattern Tester, Device Profile and Tool Store undone.
Director inspection (2026-10-18, MEASURED with tsx 4 and a global strict tsc):
- loan.test.ts FAILED on ChatGPT's own 4th case: the engine returned 'unpayable' for a loan whose exact payment is only just above the monthly interest (500 at 100% over 1,200 months), and for 999,999,999 at 99%. Cause: the cent-rounded payment fell below the month's interest and the code treated principal <= 0 as an error. Fixed: a payment is never below the month's interest, the last payment adjusts so the balance ends at exactly zero (a balloon for extreme rates), the false 'unpayable' error is removed, and the result gains `lastPayment`.
- splitTip: "round each share up to a whole unit" was wrong for uneven shares (shares like 2925 cents); fixed to round every person's share up; bill and tip with more than two decimals are now a typed error (1.005 used to round to 1.00 silently); the tip is computed in integer arithmetic.
- Descriptor ids corrected to the catalog ids: loan-calculator, split-bill.
- Tests rewritten with expected values derived INDEPENDENTLY in Python (Decimal, 80 digits; exact integers): loan 88 loans (hand-chosen extremes plus 80 seeded random) with 720 checks; splitTip 67 table cases plus 3,000 seeded random cases with 15,281 checks. Both pass; the two engine files pass strict tsc (DOM lib, no project types).
NOT RUN: the project's own type check (needs vite/client types): cloud build.
Test lines to add to test:kernel: tsx tests/loan.test.ts ; tsx tests/splitTip.test.ts
Still to do: Pattern Tester, Device Profile, Tool Store (prompt C11).
