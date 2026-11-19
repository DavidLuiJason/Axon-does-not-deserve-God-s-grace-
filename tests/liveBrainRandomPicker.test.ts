/** Director 471 (ROUND-ALL): real-brain proof for Random Picker (coin flip, pick, shuffle). Random tool: properties, never values. Dice, integers and teams stay with the old path (reported). */
import { runLiveProof, makeSlot, type ProofReply } from './helpers/liveProof';
import { createAxonBrain } from '../src/brain/index';
import { getAxonEngine } from '../src/kernel/axonEngine';
const coin = (reply: ProofReply): string | null => (/The result is (heads|tails)\./.test(reply.content) ? null : 'no coin result');
const line = (reply: ProofReply, head: string): string[] | null => { const at = reply.content.indexOf(head); if (at < 0) return null; const end = reply.content.indexOf('.\n', at); return reply.content.slice(at + head.length, end).split(', '); };
const pick = (items: string[], n: number) => (reply: ProofReply): string | null => {
  const got = line(reply, 'Picked: '); if (got === null) return 'no picked line';
  if (got.length !== n) return `picked ${got.length} instead of ${n}`;
  if (new Set(got).size !== got.length && new Set(items).size === items.length) return 'the same item twice';
  return got.every((item) => items.includes(item)) ? null : 'picked an item that was not in the list';
};
const shuffled = (items: string[]) => (reply: ProofReply): string | null => {
  const got = line(reply, 'Shuffled order: '); if (got === null) return 'no shuffled line';
  return [...got].sort().join('|') === [...items].sort().join('|') ? null : 'not a permutation of the list';
};
const seenCoin = new Set<string>(); const seenOrders = new Set<string>();
const flip = (text: string): readonly [string, (r: ProofReply) => string | null] => [text, (r) => { const why = coin(r); const m = /The result is (heads|tails)/.exec(r.content); if (m) seenCoin.add(m[1]!); return why; }];
const order = (text: string, items: string[]): readonly [string, (r: ProofReply) => string | null] => [text, (r) => { const g = line(r, 'Shuffled order: '); if (g) seenOrders.add(g.join('>')); return shuffled(items)(r); }];
await runLiveProof({
  name: 'liveBrainRandomPicker', toolId: 'random-picker',
  answers: [
    flip('flip a coin'), flip('toss a coin'), flip('flip a coin please'), flip('Flip a coin'), flip('toss a coin now'), flip('flip a coin to decide'),
    ['pick a random item from "red, green, blue"', pick(['red', 'green', 'blue'], 1)], ['choose 2 names from "ann, bob, cy, dee"', pick(['ann', 'bob', 'cy', 'dee'], 2)],
    ['pick 3 items from "a, b, c, d, e"', pick(['a', 'b', 'c', 'd', 'e'], 3)], ['choose a name from "ann, bob"', pick(['ann', 'bob'], 1)],
    ['pick a random item from "ann,bob,cy"', pick(['ann', 'bob', 'cy'], 1)], ['pick an item from "x, y"', pick(['x', 'y'], 1)],
    ['choose an option from "yes, no, maybe"', pick(['yes', 'no', 'maybe'], 1)], ['pick 1 item from "k, l, m"', pick(['k', 'l', 'm'], 1)],
    ['pick 5 items from "a, b, c, d, e"', pick(['a', 'b', 'c', 'd', 'e'], 5)], ['pick a random name from "Zoë, Åsa, Łukasz"', pick(['Zoë', 'Åsa', 'Łukasz'], 1)],
    order('shuffle the list "a, b, c, d"', ['a', 'b', 'c', 'd']), order('shuffle the items "x, y, z"', ['x', 'y', 'z']), order('shuffle the names "ann, bob, cy"', ['ann', 'bob', 'cy']),
    order('shuffle the list "p,q,r,s"', ['p', 'q', 'r', 's']),
  ],
  mustNot: [
    'how do I flip a coin?', 'flip the switch', 'flip a pancake', 'pick a random item', 'pick my kids up', 'choose a name for my dog', 'pick one of two numbers', 'roll a dice', 'roll 2d6', 'roll a ball',
    'shuffle my playlist', 'shuffle the list', 'pick 2 items from "only"', 'pick a random item from ""', 'what are the odds of flipping a coin?', 'probability of picking red from "red, blue"',
    'flip a coin 10 times', 'flip two coins', 'do not flip a coin', 'pick a random item from "a, b" and "c, d"', 'split "a, b, c, d" into teams', 'pick a number between 1 and 10',
    'random number between 1 and 100', 'pick a random item from "a, b" in python', 'pick 5 items from "a, b"', 'pick 0 items from "a, b"', 'flip a coin and shuffle "a, b"',
    'pick a random item from "a, b, c" and tell me why', 'flip a coin for each of my friends', 'pick a random item from "' + 'x, '.repeat(300) + '"',
  ],
  others: ['hello', 'thank you', 'what can you do', 'tell me a joke', 'spell the number 42', 'sort the lines "b\na"', 'count words in "one two three"', 'create QR code containing "hello"', 'encode "hello" as base64', 'replace "cat" with "fox" in "the cat sat"', 'hash "abc" with sha-256'],
});
const spread = createAxonBrain({ lane: true, slot: await makeSlot() });
for (let k = 0; k < 40; k += 1) { const r = (await spread.askWithTrace({ text: 'flip a coin', place: 'chat' })).reply.content; const m = /The result is (heads|tails)/.exec(r); if (m) seenCoin.add(m[1]!); }
for (let k = 0; k < 12; k += 1) { const g = line((await spread.askWithTrace({ text: 'shuffle the list "a, b, c, d"', place: 'chat' })).reply as ProofReply, 'Shuffled order: '); if (g) seenOrders.add(g.join('>')); }
if (!(seenCoin.has('heads') && seenCoin.has('tails'))) throw new Error('liveBrainRandomPicker FAILED: forty-six coin flips never showed both sides (the source looks constant)');
if (seenOrders.size < 2) throw new Error('liveBrainRandomPicker FAILED: sixteen shuffles gave one order (the source looks constant)');
// EVIDENCE TRUTH: the task record holds exactly the result that was shown
const brain = createAxonBrain({ lane: true, slot: await makeSlot() });
for (const text of ['flip a coin', 'shuffle the list "a, b, c, d, e, f"', 'pick 2 names from "ann, bob, cy, dee"']) {
  const reply = (await brain.askWithTrace({ text, place: 'chat' })).reply;
  const done = await getAxonEngine().whenDone(String(reply.taskId));
  const stored = String((done.output as { result?: string } | undefined)?.result ?? '');
  const word = /heads|tails/.exec(reply.content)?.[0] ?? (line(reply as ProofReply, 'Shuffled order: ') ?? line(reply as ProofReply, 'Picked: ') ?? ['?']).join('","');
  if (!stored.includes(word)) throw new Error('liveBrainRandomPicker FAILED: the task record differs from the shown result: ' + stored + ' vs ' + word);
}
console.log('EVIDENCE TRUTH: the task record holds exactly the shown result (3 of 3)');
