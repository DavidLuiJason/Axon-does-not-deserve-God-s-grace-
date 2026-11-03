import { analyzeLink } from '../src/web/linkAnalyzer';
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function includes<T>(values: readonly T[], value: T, message: string): void { assert(values.includes(value), message); }
const result = analyzeLink('https://user:secret@Example.COM:443/a?utm_source=news&keep=1&fbclid=abc#section');
assert(result.ok, 'valid link analyzes');
assert(result.value.normalizedUrl === 'https://example.com/a?keep=1', 'tracking, credentials, fragment and default port removed');
includes(result.value.flags, 'credentials-present', 'credential flag');
includes(result.value.flags, 'tracking-parameters-removed', 'tracking flag');
includes(result.value.flags, 'fragment-removed', 'fragment flag');
assert(!result.value.originalUrl.includes('user') && !result.value.originalUrl.includes('secret'), 'original URL representation redacts userinfo');
assert(result.value.removedTrackingParameters.length === 2, 'both tracking keys recorded');
const http = analyzeLink('http://127.0.0.1:8080/path');
assert(http.ok, 'HTTP IP link analyzes');
includes(http.value.flags, 'insecure-http', 'HTTP warning');
includes(http.value.flags, 'ip-address-host', 'IP host flag');
includes(http.value.flags, 'nonstandard-port', 'nonstandard port flag');
includes(http.value.flags, 'localhost-host', 'localhost flag');
const idn = analyzeLink('https://xn--bcher-kva.example/');
assert(idn.ok, 'punycode link analyzes');
includes(idn.value.flags, 'punycode-host', 'punycode flag');
const unsupported = analyzeLink('javascript:alert(1)');
assert(!unsupported.ok && unsupported.error === 'unsupported-protocol', 'non-http protocol rejected');
const invalid = analyzeLink('https://bad host');
assert(!invalid.ok && invalid.error === 'invalid-url', 'whitespace URL rejected');
// Director regression: secrets in query values are never echoed.
const secretLink = analyzeLink('https://a.com/p?q=1&Password=SECRET1&api_key=SECRET2&access-token=SECRET3');
assert(secretLink.ok && !JSON.stringify(secretLink).includes('SECRET') && secretLink.value.flags.includes('secret-parameter-redacted'), 'query secrets are redacted in both URLs');
console.log('PASS linkAnalyzer: credential redaction, tracking removal, fixed flags, host and protocol cases');
