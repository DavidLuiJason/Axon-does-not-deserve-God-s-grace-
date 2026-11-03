import { screenTreeToText } from '../src/device/screenTreeText';
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function equal<T>(actual: T, expected: T, message: string): void { assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`); }
const result = screenTreeToText({
  text: 'Home',
  children: [
    { text: 'Visible row' },
    { visible: false, text: 'HIDDEN SECRET', children: [{ text: 'also hidden' }] },
    { type: 'password', value: 'super-secret', text: 'password label', children: [{ text: 'child secret' }] },
    { contentDescription: 'Open settings' },
  ],
});
assert(result.ok, 'valid screen tree extracts');
equal(result.text, 'Home\nVisible row\n[REDACTED]\nOpen settings', 'visible text only, password redacted');
equal(result.skippedHiddenNodes, 1, 'hidden subtree skipped');
equal(result.redactedPasswordNodes, 1, 'password node counted');
assert(!result.text.includes('super-secret') && !result.text.includes('HIDDEN SECRET') && !result.text.includes('child secret'), 'sensitive and hidden values absent');
const trunc = screenTreeToText({ text: 'abcdefghij' }, { maxCharacters: 4 });
assert(trunc.ok && trunc.text === 'abcd' && trunc.truncated, 'character ceiling truncates explicitly');
const depth = screenTreeToText({ children: [{ children: [{ text: 'deep' }] }] }, { maxDepth: 1 });
assert(!depth.ok && depth.error === 'too-deep', 'depth ceiling enforced');
const nodes = screenTreeToText({ children: [{}, {}, {}] }, { maxNodes: 2 });
assert(!nodes.ok && nodes.error === 'too-many-nodes', 'node ceiling enforced');
const malformed = screenTreeToText({ children: {} });
assert(!malformed.ok && malformed.error === 'invalid-tree', 'malformed children rejected');
// Director regression (Batch 2 verification): Android's isPassword, capitalised and compound types must redact.
for (const node of [{ isPassword: true, text: 'hunter2' }, { type: 'Password', text: 'hunter2' }, { inputType: 'textPassword', value: 'hunter2' }]) {
  const redacted = screenTreeToText({ children: [node] });
  assert(redacted.ok && !redacted.text.includes('hunter2') && redacted.redactedPasswordNodes === 1, 'password-like node is redacted');
}
// Director additions: every hidden marker, and too many roots.
for (const hiddenNode of [{ visible: false }, { hidden: true }, { displayed: false }]) {
  const out = screenTreeToText({ children: [{ ...hiddenNode, text: 'ghost', children: [{ text: 'ghost2' }] }, { text: 'shown' }] });
  assert(out.ok && out.text === 'shown' && out.skippedHiddenNodes === 1, 'hidden subtree is skipped');
}
{
  const roots = screenTreeToText([{ text: 'a' }, { text: 'b' }, { text: 'c' }], { maxNodes: 2 });
  assert(!roots.ok && roots.error === 'too-many-nodes', 'more roots than maxNodes is refused');
}
console.log('PASS screenTreeText: visible extraction, hidden subtree skip, password redaction and bounds');
const newlineBound = screenTreeToText([{ text: '12345' }, { text: '67890' }], { maxCharacters: 11 });
assert(newlineBound.ok && newlineBound.text.length <= 11, 'line separators are included in the output character ceiling');
