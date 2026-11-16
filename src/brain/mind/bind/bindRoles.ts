/**
 * SLOT-ROLE rule (Director, 2026-11-16): a tool with several text slots says WHICH quoted text is which by the single word
 * right before the opening quote (not by order). One frozen record, single lowercase words only (FL13: no phrase lists).
 * Used by `argumentBinder.ts` rule 4a. A tool not listed here keeps the order rule. Slots are filled ONLY when every quoted
 * text carries exactly one marker, each slot gets at most one text and every required text slot is covered; otherwise nothing
 * is filled by role and the order rule decides as before.
 */
export const TEXT_ROLE_MARKERS: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, true>>>>>> = Object.freeze({
  'find-replace': Object.freeze({
    pattern: Object.freeze({ replace: true, find: true, substitute: true }),
    replacement: Object.freeze({ with: true, by: true, to: true }),
    text: Object.freeze({ in: true, within: true, inside: true, from: true, on: true }),
  }),
});

/** the lowercase word that ends right before `at` (letters and digits only), or '' */
export function wordBefore(message: string, at: number): string {
  let end = at;
  while (end > 0 && message.charAt(end - 1) === ' ') end--;
  let start = end;
  while (start > 0) {
    const c = message.charCodeAt(start - 1);
    const lower = c >= 65 && c <= 90 ? c + 32 : c;
    if ((lower >= 97 && lower <= 122) || (lower >= 48 && lower <= 57)) start--; else break;
  }
  return message.slice(start, end).toLowerCase();
}
