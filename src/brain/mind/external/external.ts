// P07 EXTERNAL-AI CONTRACT (pure). Rules for talking to an outside AI service. It never sends anything itself.
// Whatever an outside AI says is only what it said: UNTRUSTED, evidence REPORTED, and it can never give AXON orders.
export type EngineSuccess<T> = { readonly ok: true; readonly value: T };
export type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
export type EngineResult<T> = EngineSuccess<T> | EngineFailure;
export type Permission = 'ALLOW' | 'ASK' | 'NEVER';
export type DataKind = 'TEXT' | 'FILE';

export type AiServiceEntry = {
  readonly id: string;
  readonly provider: string;
  readonly transport: 'API' | 'BROWSER';
  readonly allowedData: readonly DataKind[];
  readonly permission: Permission;
  readonly status: 'READY' | 'UNAVAILABLE';
};
export type AiPart = { readonly kind: DataKind; readonly label: string; readonly content: string };
export type AiRequest = { readonly serviceId: string; readonly purpose: string; readonly parts: readonly AiPart[] };
export type PreparedRequest = {
  readonly serviceId: string;
  readonly transport: 'API' | 'BROWSER';
  readonly parts: readonly AiPart[];
  readonly record: { readonly serviceId: string; readonly provider: string; readonly purpose: string; readonly sharedLabels: readonly string[] };
};
export type AiResult = {
  readonly serviceId: string;
  readonly content: string;
  readonly trust: 'UNTRUSTED';
  readonly evidence: 'REPORTED';
  readonly mayInstructAxon: false;
};
export type Agreement = { readonly count: number; readonly distinct: number; readonly agree: boolean; readonly verified: false; readonly evidence: 'REPORTED' };

export const LIMITS = Object.freeze({ maxParts: 20, maxPartChars: 100000, maxResponseChars: 200000 });
const fail = (error: string, message: string): EngineFailure => ({ ok: false, error, message });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export function prepareRequest(registry: unknown, request: unknown, secrets: unknown, approved: unknown): EngineResult<PreparedRequest> {
  if (!Array.isArray(registry) || !isObj(request) || !Array.isArray(secrets) || typeof approved !== 'boolean') return fail('bad-input', 'Registry, request, secrets and approval are required.');
  if (!secrets.every((s) => typeof s === 'string')) return fail('bad-input', 'secrets must be a list of strings.');
  if (!nonEmpty(request.serviceId) || !nonEmpty(request.purpose) || !Array.isArray(request.parts)) return fail('bad-input', 'The request needs serviceId, purpose and parts.');
  const parts = request.parts as readonly unknown[];
  if (parts.length < 1 || parts.length > LIMITS.maxParts) return fail('bad-input', 'A request needs 1 to ' + LIMITS.maxParts + ' parts.');
  for (const p of parts) {
    if (!isObj(p) || (p.kind !== 'TEXT' && p.kind !== 'FILE') || !nonEmpty(p.label) || typeof p.content !== 'string' || p.content.length > LIMITS.maxPartChars) return fail('bad-input', 'A part is not valid.');
  }
  const service = (registry as readonly unknown[]).find((e) => isObj(e) && e.id === request.serviceId) as AiServiceEntry | undefined;
  if (!service) return fail('unknown-service', 'That AI service is not registered.');
  if (service.status !== 'READY') return fail('unavailable', 'That AI service is not ready.');
  if (service.permission === 'NEVER') return fail('forbidden', 'The owner has forbidden this AI service.');
  if (service.permission === 'ASK' && !approved) return fail('needs-approval', 'The owner must approve before this AI service is used.');
  const typed = parts as readonly AiPart[];
  for (const p of typed) if (!service.allowedData.includes(p.kind)) return fail('data-not-allowed', 'This AI service may not receive ' + p.kind + ' data.');
  for (const s of secrets as readonly string[]) {
    if (s !== '' && typed.some((p) => p.content.includes(s) || p.label.includes(s) || (request.purpose as string).includes(s))) return fail('secret-in-request', 'The request contains a secret and was not prepared.');
  }
  return { ok: true, value: {
    serviceId: service.id, transport: service.transport, parts: typed.map((p) => ({ ...p })),
    record: { serviceId: service.id, provider: service.provider, purpose: request.purpose as string, sharedLabels: typed.map((p) => p.label) },
  } };
}

export function receiveResponse(serviceId: unknown, raw: unknown): EngineResult<AiResult> {
  if (!nonEmpty(serviceId) || typeof raw !== 'string') return fail('bad-input', 'A service id and a text response are required.');
  if (raw.length > LIMITS.maxResponseChars) return fail('too-long', 'The response is too long.');
  return { ok: true, value: { serviceId, content: raw, trust: 'UNTRUSTED', evidence: 'REPORTED', mayInstructAxon: false } };
}

/** The answer in lower case with every run of whitespace collapsed to one space (so spacing alone never makes two answers differ). */
const sameLookingText = (content: string): string => {
  const words: string[] = [];
  let word = '';
  for (const char of content.trim().toLowerCase()) {
    if (char.trim() === '') { if (word) words.push(word); word = ''; } else word += char;
  }
  if (word) words.push(word);
  return words.join(' ');
};

// Agreement between AI answers is never proof. It is reported, and "verified" is always false.
export function summarizeAgreement(results: unknown): EngineResult<Agreement> {
  if (!Array.isArray(results) || results.length < 1 || results.length > 20 || !results.every((r) => isObj(r) && typeof r.content === 'string')) return fail('bad-input', 'Give 1 to 20 results.');
  const distinct = new Set((results as readonly { content: string }[]).map((r) => sameLookingText(r.content))).size;
  return { ok: true, value: { count: results.length, distinct, agree: results.length > 1 && distinct === 1, verified: false, evidence: 'REPORTED' } };
}
