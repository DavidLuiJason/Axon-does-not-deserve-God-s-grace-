import assert from 'node:assert/strict';
import { findReplaceMany, parseFindReplacePairs } from '../src/tools/engines/text/findReplaceMany';

const parsed = parseFindReplacePairs('cat=>dog\ndog=>fox\npath=>one=>two', '=>');
assert.equal(parsed.ok, true);
if (parsed.ok) assert.deepEqual(parsed.pairs, [
  { find: 'cat', replace: 'dog' },
  { find: 'dog', replace: 'fox' },
  { find: 'path', replace: 'one=>two' },
]);
const ordered = findReplaceMany('cat path', parsed.ok ? parsed.pairs : []);
assert.equal(ordered.ok, true);
if (ordered.ok) {
  assert.equal(ordered.text, 'fox one=>two');
  assert.deepEqual(ordered.replacementsByPair, [1, 1, 1]);
  assert.equal(ordered.replacements, 3);
}
const reversed = findReplaceMany('cat', [{ find: 'dog', replace: 'fox' }, { find: 'cat', replace: 'dog' }]);
assert.equal(reversed.ok, true);
if (reversed.ok) assert.equal(reversed.text, 'dog', 'pair order must be observable');
const overlap = findReplaceMany('aaaaa', [{ find: 'aa', replace: 'X' }]);
assert.equal(overlap.ok, true);
if (overlap.ok) assert.equal(overlap.text, 'XXa', 'matches are non-overlapping and left-to-right');
const literalTokens = findReplaceMany('abc abc', [{ find: 'abc', replace: '$&-$1' }]);
assert.equal(literalTokens.ok, true);
if (literalTokens.ok) assert.equal(literalTokens.text, '$&-$1 $&-$1');
const insensitive = findReplaceMany('AXON axon AxOn', [{ find: 'axon', replace: 'core' }], { caseSensitive: false });
assert.equal(insensitive.ok, true);
if (insensitive.ok) assert.equal(insensitive.text, 'core core core');
assert.equal(parseFindReplacePairs('missing separator', '|').ok, false);
assert.equal(parseFindReplacePairs('=>value', '=>').ok, false);
assert.equal(parseFindReplacePairs('x|y', '').ok, false);
assert.equal(findReplaceMany('text', [{ find: '', replace: 'x' }]).ok, false);
assert.equal(findReplaceMany('text', [{ find: 'x', replace: 1 }]).ok, false);
const explosive = findReplaceMany('a'.repeat(30_000), Array.from({ length: 6 }, () => ({ find: 'a', replace: 'aa' })));
assert.equal(explosive.ok, false, 'growth is bounded');
console.log('BATCH1 J1: 19 assertions passed');
