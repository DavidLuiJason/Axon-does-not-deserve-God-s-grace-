/** Deterministic URL hygiene analysis. It does not fetch links or claim that a URL is safe. */
export type LinkFlag =
  | 'insecure-http'
  | 'credentials-present'
  | 'tracking-parameters-removed'
  | 'fragment-removed'
  | 'nonstandard-port'
  | 'ip-address-host'
  | 'localhost-host'
  | 'punycode-host'
  | 'secret-parameter-redacted';
export type LinkAnalysis = Readonly<{
  originalUrl: string;
  normalizedUrl: string;
  flags: readonly LinkFlag[];
  removedTrackingParameters: readonly string[];
}>;
export type LinkAnalyzerResult =
  | { ok: true; value: LinkAnalysis }
  | { ok: false; error: 'invalid-url' | 'unsupported-protocol' | 'too-large'; message: string };

export const LINK_ANALYZER_LIMITS = Object.freeze({ maxUrlCharacters: 8_192, maxTrackingNames: 500 });
const TRACKING_EXACT = new Set([
  'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid', 'igshid',
  'ref_src', 'ref_url', 'mc_cid', 'mc_eid', 'vero_id', 'vero_conv', 'oly_anon_id', 'oly_enc_id',
  '_hsenc', '_hsmi', 'mkt_tok', 'spm', 'srsltid', 'si',
]);

function isTrackingParameter(name: string): boolean {
  const key = name.toLowerCase();
  return TRACKING_EXACT.has(key) || key.startsWith('utm_') || key.startsWith('mc_');
}

function isSecretParameter(name: string): boolean {
  const key = name.toLowerCase().replace(/[-_.]/g, '');
  return ['password', 'passwd', 'pwd', 'secret', 'token', 'apikey', 'auth', 'sessionid', 'signature'].some((part) => key.includes(part));
}

function redactSecretParameters(url: URL): boolean {
  let changed = false;
  const pairs: [string, string][] = [];
  url.searchParams.forEach((v, k) => {
    if (isSecretParameter(k) && v.length > 0) { pairs.push([k, 'REDACTED']); changed = true; }
    else pairs.push([k, v]);
  });
  if (changed) { url.search = ''; for (const [k, v] of pairs) url.searchParams.append(k, v); }
  return changed;
}

function isIpAddress(host: string): boolean {
  if (host.startsWith('[') && host.endsWith(']')) return true;
  const parts = host.split('.');
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isLoopbackHost(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host === '[::1]') return true;
  return host.startsWith('127.') && isIpAddress(host);
}

/** Removes credentials, common tracking query parameters and fragments; flags are descriptive, not a safety verdict. */
export function analyzeLink(value: unknown): LinkAnalyzerResult {
  if (typeof value !== 'string' || value.length === 0) return { ok: false, error: 'invalid-url', message: 'A non-empty URL is required.' };
  if (value.length > LINK_ANALYZER_LIMITS.maxUrlCharacters) return { ok: false, error: 'too-large', message: 'The URL exceeds the supported character limit.' };
  if (/[\u0000-\u0020\u007f]/.test(value)) return { ok: false, error: 'invalid-url', message: 'URLs containing whitespace or control characters are rejected.' };
  let url: URL;
  try { url = new URL(value); }
  catch { return { ok: false, error: 'invalid-url', message: 'The URL is not valid.' }; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, error: 'unsupported-protocol', message: 'Only HTTP and HTTPS links are supported.' };
  if (!url.hostname) return { ok: false, error: 'invalid-url', message: 'The URL must contain a host.' };
  const flags: LinkFlag[] = [];
  const add = (flag: LinkFlag): void => { if (!flags.includes(flag)) flags.push(flag); };
  const originalSafe = new URL(url.toString());
  if (originalSafe.username || originalSafe.password) { originalSafe.username = ''; originalSafe.password = ''; }
  const secretInQuery = redactSecretParameters(originalSafe);
  if (url.protocol === 'http:') add('insecure-http');
  if (url.username || url.password) { add('credentials-present'); url.username = ''; url.password = ''; }
  if (url.hash.length > 0) { add('fragment-removed'); url.hash = ''; }
  if (redactSecretParameters(url) || secretInQuery) add('secret-parameter-redacted');
  const removed: string[] = [];
  const kept: [string, string][] = [];
  url.searchParams.forEach((v, k) => {
    if (isTrackingParameter(k)) removed.push(k);
    else kept.push([k, v]);
  });
  if (removed.length > LINK_ANALYZER_LIMITS.maxTrackingNames) return { ok: false, error: 'too-large', message: 'The URL contains too many tracking parameters.' };
  if (removed.length > 0) {
    add('tracking-parameters-removed');
    url.search = '';
    for (const [key, val] of kept) url.searchParams.append(key, val);
  }
  const host = url.hostname.toLowerCase();
  if (url.port && !((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80'))) add('nonstandard-port');
  if (isIpAddress(host)) add('ip-address-host');
  if (isLoopbackHost(host)) add('localhost-host');
  if (host.split('.').some((part) => part.startsWith('xn--'))) add('punycode-host');
  url.hostname = host;
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  return { ok: true, value: Object.freeze({
    originalUrl: originalSafe.toString(),
    normalizedUrl: url.toString(),
    flags: Object.freeze(flags),
    removedTrackingParameters: Object.freeze(removed),
  }) };
}
