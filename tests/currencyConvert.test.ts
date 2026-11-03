import { convertCurrency } from '../src/finance/currencyConvert';
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function equal<T>(actual: T, expected: T, message: string): void { assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`); }
const rates = { baseCurrency: 'USD', date: '2026-11-01', rates: { USD: '1', EUR: '0.9', NGN: '1500', TIE: '1.005' } };
const converted = convertCurrency({ amount: '10', fromCurrency: 'EUR', toCurrency: 'NGN', fractionDigits: 2, rates, asOf: '2026-11-03', staleAfterDays: 7 });
assert(converted.ok, 'valid conversion succeeds');
equal(converted.amount, '16666.67', 'decimal conversion and HALF UP');
equal(converted.rateAgeDays, 2, 'rate age computed from supplied dates');
equal(converted.stale, false, 'fresh rate not stale');
const tie = convertCurrency({ amount: '1', fromCurrency: 'USD', toCurrency: 'TIE', fractionDigits: 2, rates, asOf: '2026-11-03', staleAfterDays: 7 });
assert(tie.ok, 'tie conversion succeeds');
equal(tie.amount, '1.01', 'positive half rounds up');
const negative = convertCurrency({ amount: '-1', fromCurrency: 'USD', toCurrency: 'TIE', fractionDigits: 2, rates, asOf: '2026-11-03', staleAfterDays: 7 });
assert(negative.ok, 'negative conversion succeeds');
equal(negative.amount, '-1.01', 'negative half rounds away from zero');
const zeroDigits = convertCurrency({ amount: '1.5', fromCurrency: 'USD', toCurrency: 'USD', fractionDigits: 0, rates, asOf: '2026-11-03', staleAfterDays: 7 });
assert(zeroDigits.ok && zeroDigits.amount === '2', 'zero-decimal HALF UP');
const stale = convertCurrency({ amount: '1', fromCurrency: 'USD', toCurrency: 'NGN', fractionDigits: 2, rates, asOf: '2026-11-20', staleAfterDays: 7 });
assert(stale.ok && stale.stale && stale.rateAgeDays === 19, 'stale rates flagged, not silently refreshed');
const missing = convertCurrency({ amount: '1', fromCurrency: 'USD', toCurrency: 'GBP', fractionDigits: 2, rates, asOf: '2026-11-03', staleAfterDays: 7 });
assert(!missing.ok && missing.error === 'missing-rate', 'missing rate rejected');
const badAmount = convertCurrency({ amount: '1e3', fromCurrency: 'USD', toCurrency: 'NGN', fractionDigits: 2, rates, asOf: '2026-11-03', staleAfterDays: 7 });
assert(!badAmount.ok && badAmount.error === 'invalid-amount', 'scientific notation rejected');
const future = convertCurrency({ amount: '1', fromCurrency: 'USD', toCurrency: 'NGN', fractionDigits: 2, rates: { ...rates, date: '2026-11-04' }, asOf: '2026-11-03', staleAfterDays: 7 });
assert(!future.ok && future.error === 'future-rates', 'future-dated rate table rejected');
// Director additions: stale boundary, no negative zero, base rate must be exactly 1.
{
  const req = { amount: '1', fromCurrency: 'USD', toCurrency: 'EUR', fractionDigits: 2, rates, asOf: '2026-11-08', staleAfterDays: 7 };
  const edgeFresh = convertCurrency(req);
  assert(edgeFresh.ok && edgeFresh.rateAgeDays === 7 && edgeFresh.stale === false, 'age equal to the threshold is not stale');
  const negZero = convertCurrency({ ...req, amount: '-0.004', asOf: '2026-11-03' });
  assert(negZero.ok && negZero.amount === '0.00', 'a tiny negative amount never prints as -0.00');
  const badBase = convertCurrency({ ...req, rates: { ...rates, rates: { ...rates.rates, USD: '2' } } });
  assert(!badBase.ok && badBase.error === 'invalid-rate', 'a base currency rate other than 1 is refused');
}
console.log('PASS currencyConvert: exact rational conversion, positive/negative HALF UP, age/stale and validation');
