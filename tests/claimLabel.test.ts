import { labelClaim } from '../src/web/claimLabel';
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function label(evidence: unknown): string { const result = labelClaim(evidence); assert(result.ok, 'claim evidence should validate'); return result.label; }
assert(label([]) === 'UNKNOWN', 'empty evidence is UNKNOWN');
const oneGroup = [
  { id: 'e1', independenceGroup: 'publisher-a', stance: 'supports', kind: 'verified' },
  { id: 'e2', independenceGroup: 'publisher-a', stance: 'supports', kind: 'verified' },
];
assert(label(oneGroup) === 'REPORTED', 'repetition in one independence group cannot upgrade');
const independent = [...oneGroup, { id: 'e3', independenceGroup: 'publisher-b', stance: 'supports', kind: 'verified' }];
assert(label(independent) === 'VERIFIED', 'two independent verified groups upgrade');
assert(label([{ id: 'e1', independenceGroup: 'report-a', stance: 'supports', kind: 'reported' }]) === 'REPORTED', 'reported source stays REPORTED');
assert(label([{ id: 'e1', independenceGroup: 'reasoning', stance: 'supports', kind: 'inference' }]) === 'INFERRED', 'inference stays INFERRED');
assert(label([{ id: 'e1', independenceGroup: 'source-a', stance: 'supports', kind: 'reported' }, { id: 'e2', independenceGroup: 'source-b', stance: 'refutes', kind: 'reported' }]) === 'DISPUTED', 'conflicting sides are DISPUTED');
assert(label([{ id: 'e1', independenceGroup: 'source-a', stance: 'refutes', kind: 'reported' }]) === 'DISPUTED', 'refuting evidence cannot be presented as support');
const duplicate = labelClaim([{ id: 'same', independenceGroup: 'a', stance: 'supports', kind: 'reported' }, { id: 'same', independenceGroup: 'b', stance: 'supports', kind: 'reported' }]);
assert(!duplicate.ok && duplicate.error === 'duplicate-evidence-id', 'duplicate evidence identity rejected');
// Director regression: the same source written with other case or spacing is one group, never two.
const sameSource = labelClaim([
  { id: 'a', independenceGroup: 'Example News', stance: 'supports', kind: 'verified' },
  { id: 'b', independenceGroup: '  example   news ', stance: 'supports', kind: 'verified' },
]);
assert(sameSource.ok && sameSource.label === 'REPORTED', 'case or spacing variants of one group never reach VERIFIED');
console.log('PASS claimLabel: vocabulary, independent groups, repetition guard, conflict and duplicate identity');
