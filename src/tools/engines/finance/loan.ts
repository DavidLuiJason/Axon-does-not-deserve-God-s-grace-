// Money is in whole CENTS (integers) in every result. A regular payment is the exact annuity payment rounded to the nearest cent (at least 1 cent);
// each month's interest is rounded to the nearest cent; a payment is never below the month's interest (no negative amortisation);
// the last payment is adjusted so the balance ends at exactly zero (it can be a balloon when the rate is extreme).
export const LOAN_LIMITS = { maxAmount: 1_000_000_000, maxMonths: 1200, maxRate: 100 } as const;
export interface LoanInput { amount: number; yearlyRate: number; term: number; termUnit?: 'years' | 'months'; extraPayment?: number }
export interface LoanRow { number: number; payment: number; principal: number; interest: number; balance: number }
export type LoanResult = { ok: true; monthlyPayment: number; totalInterest: number; totalPaid: number; numberOfPayments: number; lastPayment: number; monthsSaved: number; interestSaved: number; schedule: LoanRow[] } | { ok: false; error: 'invalid-input'; message: string };
export const LOAN_DESCRIPTOR = { toolId: 'loan-calculator', displayName: 'Loan Calculator', purpose: 'Calculate amortized loan payments and repayment schedules', examples: ['Calculate a 5 year loan', 'Show savings from extra payments'], inputs: [{ name: 'amount', kind: 'text' as const }, { name: 'yearlyRate', kind: 'text' as const }, { name: 'term', kind: 'text' as const }, { name: 'extraPayment', kind: 'text' as const }] };
const cents = (n: number) => Math.round((n + Number.EPSILON) * 100);
function amortize(amount: number, rate: number, months: number, extra: number): { rows: LoanRow[]; interest: number } {
 const r = rate / 1200;
 const raw = r === 0 ? amount / months : amount * r / (-Math.expm1(-months * Math.log1p(r)));
 const regular = Math.max(1, Math.round(raw));
 let balance = amount, interestTotal = 0;
 const rows: LoanRow[] = [];
 for (let n = 1; n <= months; n++) {
  const interest = Math.round(balance * r);
  const payment = Math.min(balance + interest, Math.max(regular, interest) + extra);
  const principal = payment - interest;
  balance -= principal; interestTotal += interest;
  rows.push({ number: n, payment, principal, interest, balance });
  if (balance === 0) return { rows, interest: interestTotal };
 }
 if (balance > 0) {
  const last = rows[rows.length - 1];
  last.principal += balance; last.payment += balance; last.balance = 0;
 }
 return { rows, interest: interestTotal };
}
export function calculateLoan(input: LoanInput): LoanResult {
 if (!input || !Number.isFinite(input.amount) || !Number.isFinite(input.yearlyRate) || !Number.isInteger(input.term) || (input.termUnit !== undefined && input.termUnit !== 'years' && input.termUnit !== 'months') || input.amount <= 0 || input.amount > LOAN_LIMITS.maxAmount || input.yearlyRate < 0 || input.yearlyRate > 100 || !Number.isFinite(input.extraPayment ?? 0) || (input.extraPayment ?? 0) < 0 || input.term <= 0 || !Number.isSafeInteger(cents(input.amount)) || !Number.isSafeInteger(cents(input.extraPayment ?? 0))) return { ok: false, error: 'invalid-input', message: 'Enter a valid amount, rate, term and extra payment.' };
 const months = input.term * (input.termUnit === 'months' ? 1 : 12);
 if (months > LOAN_LIMITS.maxMonths) return { ok: false, error: 'invalid-input', message: 'Term exceeds 1200 months.' };
 const amount = cents(input.amount), extra = cents(input.extraPayment ?? 0);
 const base = amortize(amount, input.yearlyRate, months, 0);
 const actual = amortize(amount, input.yearlyRate, months, extra);
 return { ok: true, monthlyPayment: base.rows[0].payment, totalInterest: actual.interest, totalPaid: amount + actual.interest, numberOfPayments: actual.rows.length, lastPayment: actual.rows[actual.rows.length - 1].payment, monthsSaved: base.rows.length - actual.rows.length, interestSaved: base.interest - actual.interest, schedule: actual.rows };
}
export function scheduleToCsv(rows: LoanRow[]): string { return ['number,payment,principal,interest,balance', ...rows.map(r => [r.number,r.payment,r.principal,r.interest,r.balance].join(','))].join('\n'); }
