export type RedactionContext = 'logs' | 'diagnostics' | 'exports' | 'crash-reports';

const REDACTED = '[REDACTED]';
const SECRET_KEY = /(?:^|[_-])(api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|authorization|cookie|set[_-]?cookie|session(?:[_-]?id)?|credential(?:s)?|password|passwd|secret|client[_-]?secret|private[_-]?key)(?:$|[_-])/i;

const TEXT_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, replacement: '[REDACTED PRIVATE KEY]' },
  { pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, replacement: REDACTED },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: REDACTED },
  { pattern: /\bsk-(?:proj-|live-)?[A-Za-z0-9_-]{20,}\b/g, replacement: REDACTED },
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, replacement: `Bearer ${REDACTED}` },
  { pattern: /(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|authorization|cookie|session(?:[_-]?id)?|credential(?:s)?|password|passwd|secret|client[_-]?secret)["']?\s*[:=]\s*["']?)([^"'&\s,;]+)/gi, replacement: `$1${REDACTED}` },
  { pattern: /(https?:\/\/[^:/\s]+:)([^@/\s]+)(@)/gi, replacement: `$1${REDACTED}$3` },
];

export function redactSensitiveText(input: string, _context: RedactionContext): string {
  if (typeof input !== 'string') throw new Error('Redaction input must be text.');
  return TEXT_PATTERNS.reduce((value, item) => value.replace(item.pattern, item.replacement), input);
}

export function redactSensitiveData<T>(input: T, context: RedactionContext): T {
  const visit = (value: unknown, seen: WeakSet<object>): unknown => {
    if (typeof value === 'string') return redactSensitiveText(value, context);
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value as object)) return '[CIRCULAR]';
    seen.add(value as object);
    if (Array.isArray(value)) return value.map((item) => visit(item, seen));
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SECRET_KEY.test(key) ? REDACTED : visit(item, seen);
    }
    return output;
  };
  return visit(input, new WeakSet()) as T;
}
