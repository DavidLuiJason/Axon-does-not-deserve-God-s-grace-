/** Bounded regular-expression testing engine. Execution of untrusted patterns should use an interruptible worker runner. */
export const PATTERN_TEST_LIMITS = { patternLength: 2048, textLength: 100_000, matches: 5000, replacementLength: 10_000 } as const;
export type PatternTestError = 'invalid-input' | 'pattern-too-long' | 'text-too-long' | 'replacement-too-long' | 'too-many-matches' | 'execution-failed';
export interface PatternMatch { index: number; text: string; groups: string[]; namedGroups: Record<string, string | undefined> }
export type PatternTestResult = { ok: true; matches: PatternMatch[]; replacedText: string | null; messages: string[] } | { ok: false; error: PatternTestError; message: string };
export interface PatternTestInput { pattern: string; flags?: string; text: string; replacement?: string }
export const PATTERN_TEST_DESCRIPTOR = {
  toolId: 'pattern-tester', displayName: 'Pattern Tester', purpose: 'Test JavaScript regular expressions against text and inspect matches or replacements.',
  examples: ['Find every number in a text', 'Check whether a pattern matches a line', 'Preview a replacement before applying it'],
  inputs: [
    { name: 'pattern', kind: 'text' as const, prompt: 'Enter a JavaScript regular expression pattern.' },
    { name: 'flags', kind: 'text' as const, prompt: 'Optional flags: g, i, m, s, u, y.' },
    { name: 'text', kind: 'text' as const, prompt: 'Enter the text to test.' },
    { name: 'replacement', kind: 'text' as const, prompt: 'Optional replacement text.' },
  ],
};
const fail = (error: PatternTestError, message: string): PatternTestResult => ({ ok: false, error, message });
const allowedFlags = new Set(['g', 'i', 'm', 's', 'u', 'y']);
export function testPattern(input: PatternTestInput): PatternTestResult {
  if (!input || typeof input !== 'object' || typeof input.pattern !== 'string' || typeof input.text !== 'string' || (input.flags !== undefined && typeof input.flags !== 'string') || (input.replacement !== undefined && typeof input.replacement !== 'string')) return fail('invalid-input', 'Pattern, text, flags and replacement must be strings when provided.');
  const flags = input.flags ?? '';
  if (input.pattern.length > PATTERN_TEST_LIMITS.patternLength) return fail('pattern-too-long', `Pattern exceeds ${PATTERN_TEST_LIMITS.patternLength} characters.`);
  if (input.text.length > PATTERN_TEST_LIMITS.textLength) return fail('text-too-long', `Text exceeds ${PATTERN_TEST_LIMITS.textLength} characters.`);
  if (input.replacement !== undefined && input.replacement.length > PATTERN_TEST_LIMITS.replacementLength) return fail('replacement-too-long', `Replacement exceeds ${PATTERN_TEST_LIMITS.replacementLength} characters.`);
  if ([...flags].some(f => !allowedFlags.has(f)) || new Set(flags).size !== flags.length) return fail('invalid-input', 'Flags must be unique characters from g, i, m, s, u and y.');
  try {
    const regex = new RegExp(input.pattern, flags);
    const matches: PatternMatch[] = [];
    // A non-global expression finds at most one match; global/sticky expressions enumerate matches.
    const enumerate = flags.includes('g') || flags.includes('y');
    while (true) {
      const match = regex.exec(input.text);
      if (!match) break;
      if (matches.length >= PATTERN_TEST_LIMITS.matches) return fail('too-many-matches', `More than ${PATTERN_TEST_LIMITS.matches} matches; narrow the pattern or text.`);
      const named: Record<string, string | undefined> = Object.create(null) as Record<string, string | undefined>;
      if (match.groups) for (const key of Object.keys(match.groups)) Object.defineProperty(named, key, { value: match.groups[key], enumerable: true, configurable: true, writable: true });
      matches.push({ index: match.index, text: match[0], groups: match.slice(1), namedGroups: named });
      if (!enumerate) break;
      if (match[0].length === 0) {
        // Advance one UTF-16 code unit (or one Unicode code point in u mode) to avoid an infinite loop.
        const next = regex.lastIndex;
        if (next >= input.text.length) break;
        regex.lastIndex = next + (flags.includes('u') && /[\uD800-\uDBFF]/u.test(input.text[next]) && next + 1 < input.text.length && /[\uDC00-\uDFFF]/u.test(input.text[next + 1]) ? 2 : 1);
      }
    }
    let replacedText: string | null = null;
    if (input.replacement !== undefined) {
      try { replacedText = input.text.replace(new RegExp(input.pattern, flags), input.replacement); }
      catch { return fail('execution-failed', 'The replacement could not be completed.'); }
    }
    return { ok: true, matches, replacedText, messages: matches.length ? [`Found ${matches.length} match${matches.length === 1 ? '' : 'es'}.`] : ['No matches found.'] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The pattern is invalid.';
    return fail('invalid-input', `Invalid regular expression: ${message}`);
  }
}
export type TimeoutResult<T> = { ok: true; value: T } | { ok: false; error: 'timeout' | 'runner-failed' };
export type TimeoutRunner = <T>(task: () => T | Promise<T>, ms: number) => Promise<T>;
/** The injected runner must enforce interruption (normally by terminating a Web Worker). */
export async function runWithTimeout<T>(task: () => T | Promise<T>, ms: number, runner: TimeoutRunner): Promise<TimeoutResult<T>> {
  if (typeof task !== 'function' || typeof runner !== 'function' || !Number.isFinite(ms) || ms <= 0) return { ok: false, error: 'runner-failed' };
  try { return { ok: true, value: await runner(task, ms) }; }
  catch (error) { return { ok: false, error: error instanceof Error && error.message === 'timeout' ? 'timeout' : 'runner-failed' }; }
}
