import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLaneRandom } from '../src/brain/laneRandom';
import { createAxonBrain } from '../src/brain/index';

let checks = 0;
function check(condition: unknown, label: string): void {
  checks += 1;
  if (!condition) throw new Error(`FAIL ${label}`);
}
function throws(fn: () => unknown): boolean {
  try { fn(); return false; } catch { return true; }
}

// 1. Range, bias and edge values with the real platform source.
const real = createLaneRandom();
const counts = [0, 0, 0, 0, 0, 0];
for (let i = 0; i < 6000; i += 1) {
  const v = real.randomBelow(6);
  check(Number.isInteger(v) && v >= 0 && v < 6, 'randomBelow(6) stays in 0..5');
  counts[v] = (counts[v] as number) + 1;
}
check(counts.every((c) => c > 800 && c < 1200), 'six buckets are all near 1000 of 6000 (a constant or a bias would fail)');
check(real.randomBelow(1) === 0, 'randomBelow(1) is always 0');
let sawHigh = false;
for (let i = 0; i < 200; i += 1) if (real.randomBelow(1000000) > 500000) sawHigh = true;
check(sawHigh, 'a large range is not stuck at the bottom');
for (let i = 0; i < 2000; i += 1) { const f = real.random01(); check(f >= 0 && f < 1, 'random01 is in [0, 1)'); }
check(new Set(Array.from({ length: 50 }, () => real.random01())).size > 45, 'random01 gives many different numbers');

// 2. Bad inputs are refused, never answered.
for (const bad of [0, -3, 2.5, Number.NaN, 4294967297]) check(throws(() => real.randomBelow(bad)), `randomBelow(${bad}) is refused`);

// 3. Rejection sampling: a value in the biased top slice is thrown away and the next one is used.
const script = [4294967295, 4294967295, 7];
let at = 0;
const scripted = createLaneRandom((w) => { w[0] = script[at] as number; at += 1; });
check(scripted.randomBelow(6) === 1, 'unusable top values are rejected, then 7 mod 6 = 1');
check(at === 3, 'it drew exactly three values');
const allOnes = createLaneRandom((w) => { w.fill(4294967295); });
check(allOnes.random01() < 1, 'random01 with all bits set is still below 1');
const allZero = createLaneRandom((w) => { w.fill(0); });
check(allZero.random01() === 0, 'random01 with no bits set is 0');

// 4. A source that fails or loops must throw, so the lane yields (never a constant, never Math.random).
check(throws(() => createLaneRandom(() => { throw new Error('none'); }).randomBelow(6)), 'a failing source throws');
check(throws(() => createLaneRandom((w) => { w[0] = 4294967295; }).randomBelow(6)), 'a source stuck in the rejected slice throws after a bounded number of tries');

// 5. Real brain: the live Sort Lines shuffle is now really random.
const root = process.cwd();
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const { Dictionary } = await import('../src/brain/dictionary');
const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(root, 'public/dictionary/en', p), 'utf8'), hash: sha });
const brain = createAxonBrain({ lane: true, slot: createDictionarySlot(async () => dictionary) });
const orders = new Set<string>();
for (let i = 0; i < 24; i += 1) {
  const r = await brain.askWithTrace({ text: 'shuffle the lines "a\nb\nc\nd\ne\nf"', place: 'chat' });
  check(r.reply.source === 'runner:sort-lines' && r.reply.taskId !== undefined, 'shuffle is still answered by the live Sort Lines runner with a task record');
  const shuffled = r.reply.content.split('\nLine count')[0] as string;
  check(shuffled.split('\n').slice().sort().join('') === 'abcdef', 'every shuffle keeps exactly the six lines');
  orders.add(shuffled);
}
check(orders.size >= 6, `24 shuffles of six lines gave at least 6 different results (it gave ${orders.size}); a constant source gives 1`);

console.log(`laneRandom: ${checks} checks passed`);
