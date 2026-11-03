/** Exact decimal currency conversion using caller-supplied rates and HALF UP rounding. */
export type CurrencyRates = Readonly<{
  baseCurrency: string;
  date: string;
  rates: Readonly<Record<string, string>>;
}>;
export type CurrencyConvertInput = Readonly<{
  amount: string;
  fromCurrency: string;
  toCurrency: string;
  fractionDigits: number;
  rates: CurrencyRates;
  asOf: string;
  staleAfterDays: number;
}>;
export type CurrencyConvertError =
  | 'invalid-input' | 'invalid-amount' | 'invalid-currency' | 'invalid-rate' | 'missing-rate'
  | 'invalid-date' | 'future-rates' | 'invalid-rounding' | 'too-large';
export type CurrencyConvertResult =
  | { ok: true; amount: string; fromCurrency: string; toCurrency: string; rateDate: string; rateAgeDays: number; stale: boolean; fractionDigits: number; rounding: 'HALF_UP' }
  | { ok: false; error: CurrencyConvertError; message: string };

export const CURRENCY_CONVERT_LIMITS = Object.freeze({ maxDecimalPlaces: 18, maxRateEntries: 300, maxStaleAfterDays: 36_600 });

type Decimal = { coefficient: bigint; scale: number };

export function isCurrencyDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const y = Number(value.slice(0, 4)), m = Number(value.slice(5, 7)), d = Number(value.slice(8, 10));
  if (y < 1 || m < 1 || m > 12 || d < 1) return false;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return d <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
}

function dayNumber(date: string): number {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10));
  const dt = new Date(0); dt.setUTCHours(0, 0, 0, 0); dt.setUTCFullYear(y, m - 1, d);
  return Math.floor(dt.getTime() / 86_400_000);
}

function parseDecimal(value: unknown, allowNegative: boolean): Decimal | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 80) return null;
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  if (!match) return null;
  const fraction = match[3] ?? '';
  if (fraction.length > CURRENCY_CONVERT_LIMITS.maxDecimalPlaces) return null;
  if (match[1] === '-' && !allowNegative) return null;
  const digits = `${match[2]}${fraction}`;
  let coefficient: bigint;
  try { coefficient = BigInt(digits); } catch { return null; }
  if (match[1] === '-') coefficient = -coefficient;
  return { coefficient, scale: fraction.length };
}

function pow10(power: number): bigint { return 10n ** BigInt(power); }

function formatRounded(numerator: bigint, denominator: bigint, digits: number): string {
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const scaled = absolute * pow10(digits);
  let quotient = scaled / denominator;
  const remainder = scaled % denominator;
  if (remainder * 2n >= denominator) quotient += 1n;
  const whole = quotient / pow10(digits);
  if (digits === 0) return `${negative && quotient !== 0n ? '-' : ''}${whole.toString()}`;
  const fraction = (quotient % pow10(digits)).toString().padStart(digits, '0');
  return `${negative && quotient !== 0n ? '-' : ''}${whole.toString()}.${fraction}`;
}

function validCode(value: unknown): value is string { return typeof value === 'string' && /^[A-Z]{3}$/.test(value); }

export function convertCurrency(input: unknown): CurrencyConvertResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'invalid-input', message: 'A conversion request object is required.' };
  const request = input as Record<string, unknown>;
  if (!validCode(request.fromCurrency) || !validCode(request.toCurrency)) return { ok: false, error: 'invalid-currency', message: 'Currency codes must be three uppercase letters.' };
  if (!Number.isInteger(request.fractionDigits) || (request.fractionDigits as number) < 0 || (request.fractionDigits as number) > 8) {
    return { ok: false, error: 'invalid-rounding', message: 'fractionDigits must be an integer from 0 to 8.' };
  }
  if (!Number.isInteger(request.staleAfterDays) || (request.staleAfterDays as number) < 0 || (request.staleAfterDays as number) > CURRENCY_CONVERT_LIMITS.maxStaleAfterDays) {
    return { ok: false, error: 'invalid-input', message: 'staleAfterDays must be a supported non-negative integer.' };
  }
  if (!isCurrencyDate(request.asOf)) return { ok: false, error: 'invalid-date', message: 'asOf must be a real YYYY-MM-DD date.' };
  const amount = parseDecimal(request.amount, true);
  if (amount === null) return { ok: false, error: 'invalid-amount', message: 'Amount must be a plain decimal string with at most 18 fractional digits.' };
  const ratesValue = request.rates;
  if (ratesValue === null || typeof ratesValue !== 'object' || Array.isArray(ratesValue)) return { ok: false, error: 'invalid-input', message: 'A caller-supplied rate table is required.' };
  const rates = ratesValue as Record<string, unknown>;
  if (!validCode(rates.baseCurrency) || !isCurrencyDate(rates.date) || rates.rates === null || typeof rates.rates !== 'object' || Array.isArray(rates.rates)) {
    return { ok: false, error: 'invalid-input', message: 'Rate table needs a base currency, valid date and rates object.' };
  }
  if (dayNumber(rates.date) > dayNumber(request.asOf)) return { ok: false, error: 'future-rates', message: 'Rate date cannot be later than the supplied as-of date.' };
  const rateMap = rates.rates as Record<string, unknown>;
  const keys = Object.keys(rateMap);
  if (keys.length === 0 || keys.length > CURRENCY_CONVERT_LIMITS.maxRateEntries) return { ok: false, error: 'too-large', message: 'The rate table is empty or exceeds its supported number of currencies.' };
  if (!Object.prototype.hasOwnProperty.call(rateMap, request.fromCurrency) || !Object.prototype.hasOwnProperty.call(rateMap, request.toCurrency)) {
    return { ok: false, error: 'missing-rate', message: 'The rate table must contain both requested currencies.' };
  }
  const fromRate = parseDecimal(rateMap[request.fromCurrency], false);
  const toRate = parseDecimal(rateMap[request.toCurrency], false);
  const baseRate = parseDecimal(rateMap[rates.baseCurrency], false);
  if (fromRate === null || toRate === null || baseRate === null || fromRate.coefficient <= 0n || toRate.coefficient <= 0n || baseRate.coefficient <= 0n) {
    return { ok: false, error: 'invalid-rate', message: 'Rates must be positive plain decimal strings with at most 18 fractional digits.' };
  }
  if (baseRate.coefficient !== pow10(baseRate.scale)) return { ok: false, error: 'invalid-rate', message: 'The base currency rate must equal exactly 1.' };
  for (const key of keys) {
    if (!validCode(key)) return { ok: false, error: 'invalid-currency', message: `Invalid currency code in rate table: ${key}.` };
    const parsed = parseDecimal(rateMap[key], false);
    if (parsed === null || parsed.coefficient <= 0n) return { ok: false, error: 'invalid-rate', message: `Invalid positive rate for ${key}.` };
  }
  // amount × (to units / base) ÷ (from units / base), retained as an exact rational.
  const numerator = amount.coefficient * toRate.coefficient * pow10(fromRate.scale);
  const denominator = pow10(amount.scale) * fromRate.coefficient * pow10(toRate.scale);
  if (denominator <= 0n) return { ok: false, error: 'invalid-rate', message: 'The conversion denominator must be positive.' };
  const rateAgeDays = dayNumber(request.asOf) - dayNumber(rates.date);
  return {
    ok: true,
    amount: formatRounded(numerator, denominator, request.fractionDigits as number),
    fromCurrency: request.fromCurrency,
    toCurrency: request.toCurrency,
    rateDate: rates.date,
    rateAgeDays,
    stale: rateAgeDays > (request.staleAfterDays as number),
    fractionDigits: request.fractionDigits as number,
    rounding: 'HALF_UP',
  };
}
