/**
 * B04C0b-C PROOF (Director, 2026-10-28). Never changed by a builder. Run: node run.mjs tests/valueEvidenceRunner.test.ts
 * It checks the VALUE EVIDENCE rules 8 to 11 of src/brain/mind/resolve/resolveTypes.ts: the schema field `values`, the scoring in Resolution
 * and the adapter field `ProvidedSlot.value`. Pure: no dictionary, no clock.
 */
import { ACTION_SCHEMAS, getSchema } from '../src/brain/mind/schema/actionSchemas';
import { VALUE_KIND_LABELS } from '../src/brain/mind/schema/schemaTypes';
import { resolveClause } from '../src/brain/mind/resolve/resolve';
import { VALUE_WEIGHT } from '../src/brain/mind/resolve/resolveTypes';
import type { ResolveInput } from '../src/brain/mind/resolve/resolveTypes';
import { buildResolveInputs } from '../src/brain/mind/resolve/clauseInputs';
import type { AdapterInput } from '../src/brain/mind/resolve/clauseInputsTypes';

let checks = 0;
const problems: string[] = [];
function check(condition: unknown, message: string): void { checks += 1; if (!condition) problems.push(message); }
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const KINDS = VALUE_KIND_LABELS.split(' ');

// ---- PART 1: the schema field `values`
const declared: Record<string, string[]> = { 'percentage-helper': ['percent'], converter: ['quantity'], timer: ['duration'], 'date-calculator': ['date'] };
check(ACTION_SCHEMAS.length === 63, 'there are 63 schemas');
for (const schema of ACTION_SCHEMAS) {
  const want = declared[schema.tool];
  const values = schema.values;
  if (want) check(same(values, want), `${schema.tool}: values must be ${JSON.stringify(want)}, got ${JSON.stringify(values)}`);
  else check(values === undefined, `${schema.tool}: values must be ABSENT (not an empty list), got ${JSON.stringify(values)}`);
  if (values) {
    check(values.length >= 1 && values.length <= 2 && new Set(values).size === values.length, `${schema.tool}: 1 or 2 distinct values`);
    check(values.every((kind) => KINDS.includes(kind)), `${schema.tool}: values come from the labels`);
    check(Object.isFrozen(values) && Object.isFrozen(schema), `${schema.tool}: frozen`);
  }
}
check(getSchema('timer')?.values?.[0] === 'duration', 'getSchema reaches the field');

// ---- PART 2: Resolution
const base = (over: Partial<ResolveInput>): ResolveInput => ({ act: 'ask', polarity: 'positive', verbs: [], objects: [], names: [], provided: [], ...over });
const num = { kind: 'number' as const };
const percent = { kind: 'number' as const, value: 'percent' as const };
const quantity = { kind: 'quantity' as const, value: 'quantity' as const };
const duration = { kind: 'duration' as const, value: 'duration' as const };
const date = { kind: 'date' as const, value: 'date' as const };
const time = { kind: 'time' as const, value: 'time' as const };

const pct = resolveClause(base({ provided: [percent, num] }));
check(pct.kind === 'match' && pct.tool === 'percentage-helper', 'a percent alone reaches the percentage helper');
check(pct.kind === 'match' && pct.evidence === 'value', 'that match says evidence "value"');
check(pct.kind === 'match' && pct.candidates[0]?.score === VALUE_WEIGHT, 'its score is VALUE_WEIGHT times 1 / 1 (the key is declared by one schema)');
check(pct.kind === 'match' && same(pct.candidates[0]?.matched, ['v|percent']), 'the matched key is v|percent');
const qty = resolveClause(base({ act: 'command', provided: [quantity] }));
check(qty.kind === 'match' && qty.tool === 'converter' && qty.evidence === 'value', 'a quantity alone reaches the converter (act command too)');
const dur = resolveClause(base({ provided: [duration] }));
check(dur.kind === 'match' && dur.tool === 'timer', 'a duration alone reaches the timer');
const dat = resolveClause(base({ provided: [date] }));
check(dat.kind === 'match' && dat.tool === 'date-calculator', 'a date alone reaches the date calculator');
const tie = resolveClause(base({ provided: [duration, date] }));
check(tie.kind === 'ask' && tie.choices.includes('timer') && tie.choices.includes('date-calculator'), 'a duration and a date alone tie, so Resolution asks (same margin rule)');
const twice = resolveClause(base({ provided: [percent, percent, percent] }));
check(twice.kind === 'match' && twice.candidates[0]?.score === VALUE_WEIGHT, 'the same kind three times counts once');
const none = resolveClause(base({ provided: [num, num, num] }));
check(none.kind === 'none', 'bare numbers are never evidence');
check(resolveClause(base({ provided: [{ kind: 'text' }, { kind: 'text' }] })).kind === 'none', 'quoted text is never evidence');
check(resolveClause(base({ provided: [time] })).kind === 'none', 'a time is a label but no tool declares it yet: nothing found');
check(resolveClause(base({ act: 'greet', provided: [percent] })).kind === 'not-a-request', 'the act filter still comes first');
const neg = resolveClause(base({ polarity: 'negative', provided: [percent] }));
check(neg.kind === 'negated' && neg.tool === 'percentage-helper', 'a negative clause with a percent is negated, naming the tool');
const hostile = resolveClause(base({ provided: [{ kind: 'number', value: 'bogus' } as never, { kind: 'number', value: 7 } as never, { kind: 'number', value: '__proto__' } as never] }));
check(hostile.kind === 'none', 'an unknown or non-string value kind gives no key and never throws');
const both = resolveClause(base({ act: 'command', verbs: ['convert:v'], provided: [quantity] }));
check(both.kind === 'match' && both.tool === 'converter' && both.evidence === 'both', 'concept plus value: converter wins, evidence "both"');
const concept = resolveClause(base({ act: 'command', objects: ['stopwatch:n'] }));
check(concept.kind === 'match' && concept.tool === 'stopwatch' && concept.evidence === 'concept', 'concept only: evidence "concept"');
check(resolveClause(base({ act: 'chat' })).kind === 'not-a-request' && !('evidence' in resolveClause(base({ act: 'chat' }))), 'results without a candidate carry no evidence');
check(!('evidence' in resolveClause(base({ provided: [num] }))), 'a none result carries no evidence');
// a value key must never be passed to `related`, and must not be matched by closeness
const seen: string[] = [];
resolveClause(base({ verbs: ['convert:v'], objects: ['unit:n'], provided: [quantity, percent, duration, date] }), { related: (a, b) => { seen.push(a, b); return 0; } });
check(seen.length > 0 && seen.every((key) => key.includes(':')), 'related is called only with "lemma:pos" keys, never with a value kind');
const closeAll = resolveClause(base({ provided: [percent] }), { related: () => 1 });
check(closeAll.kind === 'match' && closeAll.tool === 'percentage-helper' && closeAll.candidates.length === 1, 'closeness cannot make a value key match another tool');
// same input, same output; input untouched
const frozenInput = Object.freeze(base({ provided: Object.freeze([Object.freeze({ ...percent })]) as never }));
check(same(resolveClause(frozenInput), resolveClause(frozenInput)), 'pure and repeatable on frozen input');
// a tool that declares no value scores exactly as before: concept-only results keep their old scores
const old = resolveClause(base({ act: 'command', verbs: ['count:v'], objects: ['word:n'], provided: [num] }));
const oldNoValue = resolveClause(base({ act: 'command', verbs: ['count:v'], objects: ['word:n'] }));
check(same(old.candidates, oldNoValue.candidates), 'a bare number leaves every score unchanged');

// ---- PART 3: the adapter field `ProvidedSlot.value`
const text = 'abcdefghijklmnopqrstuvwxyz0123456789';
const mk = (kinds: string[]): AdapterInput => ({
  tokens: [], segments: [{ kind: 'language', start: 0, end: 30 }, { kind: 'material', start: 30, end: 36 }],
  clauses: [{ act: 'ask', polarity: 'positive' }], words: [{ norm: text, start: 0, end: 36 }],
  pieces: [{ from: 0, to: 1, clause: 0, mayRunAlone: true, parts: { verb: null, object: null, details: [] } }],
  values: kinds.map((kind, i) => ({ kind, start: i * 3, end: i * 3 + 2 }))
});
const provided = (kinds: string[]) => buildResolveInputs(mk(kinds))[0]!.input.provided;
check(same(provided(['number']), [{ kind: 'number' }, { kind: 'text' }]) && !('value' in provided(['number'])[0]!), 'a number: slot number, no `value` key at all');
check(same(provided(['roman']), [{ kind: 'number' }, { kind: 'text' }]), 'a Roman numeral: slot number, no value');
check(same(provided(['percent']), [{ kind: 'number', value: 'percent' }, { kind: 'text' }]), 'a percent: slot number AND value percent');
check(same(provided(['quantity']), [{ kind: 'quantity', value: 'quantity' }, { kind: 'text' }]), 'a quantity');
check(same(provided(['duration']), [{ kind: 'duration', value: 'duration' }, { kind: 'text' }]), 'a duration');
check(same(provided(['date']), [{ kind: 'date', value: 'date' }, { kind: 'text' }]), 'a date');
check(same(provided(['time']), [{ kind: 'time', value: 'time' }, { kind: 'text' }]), 'a time');
check(same(provided(['datetime']), [{ kind: 'date', value: 'date' }, { kind: 'time', value: 'time' }, { kind: 'text' }]), 'a datetime: a date entry then a time entry, each with its value');
check(same(provided(['bogus']), [{ kind: 'text' }]), 'an unknown value kind gives nothing (the material still gives text)');
check(same(provided(['percent', 'number', 'date']).map((slot) => slot.value ?? null), ['percent', null, 'date', null]), 'order by start position is kept with the values');

if (problems.length > 0) {
  console.log(`VALUE EVIDENCE RUNNER FAILED: ${problems.length} problem(s) in ${checks} checks`);
  for (const problem of problems.slice(0, 40)) console.log(` - ${problem}`);
  process.exit(1);
}
console.log(`VALUE EVIDENCE RUNNER OK: ${checks} checks`);
