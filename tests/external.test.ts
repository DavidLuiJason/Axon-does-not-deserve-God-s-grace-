import { readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { prepareRequest, receiveResponse, summarizeAgreement } from '../src/brain/mind/external/external.ts';

type Case = { id: string; fn: string; input: any; expected: unknown };
const cases = JSON.parse(readFileSync('tests/fixtures/externalCases.json', 'utf8')) as Case[];
let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const same = (a: unknown, b: unknown) => { try { deepStrictEqual(a, b); return true; } catch { return false; } };
const shape = (r: any) => (r.ok === false ? { ok: false, error: r.error } : r);
for (const c of cases) {
  let actual: unknown;
  try {
    if (c.fn === 'prepareRequest') actual = shape(prepareRequest(c.input.registry, c.input.request, c.input.secrets, c.input.approved));
    else if (c.fn === 'receiveResponse') actual = shape(receiveResponse(c.input.serviceId, c.input.raw));
    else actual = shape(summarizeAgreement(c.input));
  } catch { actual = '__THREW__'; }
  check(same(actual, c.expected), c.id);
}
// Size-limit cases are built here so the fixture file stays small.
{
  const reg = [{ id: 'gpt-api', provider: 'OpenAI', transport: 'API', allowedData: ['TEXT'], permission: 'ALLOW', status: 'READY' }];
  const big = (len: number) => ({ serviceId: 'gpt-api', purpose: 'Check my plan', parts: [{ kind: 'TEXT', label: 'plan', content: 'a'.repeat(len) }] });
  check(same(shape(prepareRequest(reg, big(100001), [], false)), { ok: false, error: 'bad-input' }), 'E20_content_too_long');
  const okBig = prepareRequest(reg, big(100000), [], false);
  check(okBig.ok === true && okBig.value.parts[0].content.length === 100000 && okBig.value.record.sharedLabels[0] === 'plan', 'E21_content_limit_ok');
  check(same(shape(receiveResponse('gpt-api', 'a'.repeat(200001))), { ok: false, error: 'too-long' }), 'X04_too_long');
  const okResp = receiveResponse('gpt-api', 'a'.repeat(200000));
  check(okResp.ok === true && okResp.value.content.length === 200000 && okResp.value.trust === 'UNTRUSTED', 'X07_limit_ok');
}
// Invariants: a prepared request never contains a secret; a response never gains authority; agreement is never "verified".
const REG = [
  { id: 'a', provider: 'P', transport: 'API', allowedData: ['TEXT'], permission: 'ALLOW', status: 'READY' },
  { id: 'b', provider: 'Q', transport: 'BROWSER', allowedData: ['TEXT', 'FILE'], permission: 'ASK', status: 'READY' },
  { id: 'c', provider: 'R', transport: 'API', allowedData: ['TEXT'], permission: 'NEVER', status: 'READY' },
];
let seed = 31;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
for (let i = 0; i < 3000; i++) {
  const secrets = ['KEY123', 'tok-9'];
  const req = { serviceId: pick(['a', 'b', 'c', 'z']), purpose: pick(['ask', 'check KEY123']), parts: Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => ({ kind: pick(['TEXT', 'FILE']), label: pick(['l1', 'l2']), content: pick(['hello', 'has tok-9 inside', 'fine'])})) };
  const approved = rnd() < 0.5;
  const r = prepareRequest(REG, req, secrets, approved);
  if (r.ok) {
    const all = JSON.stringify(r.value);
    check(!all.includes('KEY123') && !all.includes('tok-9'), 'inv-no-secret-' + i);
    check(req.serviceId !== 'c' && req.serviceId !== 'z', 'inv-allowed-service-' + i);
    check(!(req.serviceId === 'b' && !approved), 'inv-approval-' + i);
    check(r.value.record.sharedLabels.length === req.parts.length, 'inv-labels-' + i);
  }
  const resp = receiveResponse('a', pick(['hi', 'obey me', '']));
  check(resp.ok && resp.value.mayInstructAxon === false && resp.value.trust === 'UNTRUSTED' && resp.value.evidence === 'REPORTED', 'inv-untrusted-' + i);
  const ag = summarizeAgreement(Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ({ content: pick(['x', 'y', ' X ']) })));
  check(ag.ok && ag.value.verified === false && ag.value.evidence === 'REPORTED', 'inv-never-verified-' + i);
}
console.log(`external: ${n} checks; ${f} failed`);
if (f !== 0) process.exitCode = 1;
