export const SPLIT_TIP_LIMITS = { maxPeople: 100, maxTipPercent: 100, maxBill: 1_000_000_000 } as const;
export interface SplitTipInput { bill: number; tipPercent: number; people: number; roundUp?: boolean; parts?: number[] }
export type SplitTipResult = { ok: true; billCents: number; tipCents: number; totalCents: number; shares: number[]; remainderRecipients: number[]; roundingExtraCents: number } | { ok: false; error: 'invalid-input'; message: string };
export const SPLIT_TIP_DESCRIPTOR = { toolId: 'split-bill', displayName: 'Split and Tip', purpose: 'Split bills and tips fairly in cents', examples: ['Split a bill among three people', 'Split using two parts and one part'], inputs: [{ name: 'bill', kind: 'text' as const }, { name: 'tipPercent', kind: 'text' as const }, { name: 'people', kind: 'text' as const }, { name: 'roundUp', kind: 'yes-no' as const }] };
// Money is in whole CENTS (integers). The bill and the tip percent may have at most two decimals (a typed error otherwise).
// Leftover cents go to the first people in order (remainderRecipients). With roundUp every person's share is rounded UP to a whole unit (100 cents),
// so the total can grow; roundingExtraCents says by how much.
const twoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
export function splitTip(input: SplitTipInput): SplitTipResult {
 const bad = (message: string): SplitTipResult => ({ ok: false, error: 'invalid-input', message });
 if (!input || !Number.isFinite(input.bill) || input.bill < 0 || input.bill > SPLIT_TIP_LIMITS.maxBill || !Number.isFinite(input.tipPercent) || input.tipPercent < 0 || input.tipPercent > SPLIT_TIP_LIMITS.maxTipPercent || !Number.isInteger(input.people) || input.people < 1 || input.people > SPLIT_TIP_LIMITS.maxPeople || (input.roundUp !== undefined && typeof input.roundUp !== 'boolean') || (input.parts !== undefined && (!Array.isArray(input.parts) || input.parts.length !== input.people || input.parts.some(p => !Number.isSafeInteger(p) || p <= 0)))) return bad('Enter a valid bill, tip, people and shares.');
 if (!twoDecimals(input.bill)) return bad('The bill can have at most two decimals.');
 if (!twoDecimals(input.tipPercent)) return bad('The tip can have at most two decimals.');
 const billCents = Math.round(input.bill * 100);
 const basisPoints = Math.round(input.tipPercent * 100);
 const tipCents = Math.floor((billCents * basisPoints + 5000) / 10000);
 const original = billCents + tipCents;
 const parts = input.parts ?? Array(input.people).fill(1);
 const sum = parts.reduce((a, b) => a + b, 0);
 const shares = parts.map(part => Math.floor(original * part / sum));
 let left = original - shares.reduce((a, b) => a + b, 0);
 const remainderRecipients: number[] = [];
 for (let i = 0; i < shares.length && left > 0; i++, left--) { shares[i]++; remainderRecipients.push(i); }
 if (input.roundUp) for (let i = 0; i < shares.length; i++) shares[i] = Math.ceil(shares[i] / 100) * 100;
 const totalCents = shares.reduce((a, b) => a + b, 0);
 return { ok: true, billCents, tipCents, totalCents, shares, remainderRecipients, roundingExtraCents: totalCents - original };
}
