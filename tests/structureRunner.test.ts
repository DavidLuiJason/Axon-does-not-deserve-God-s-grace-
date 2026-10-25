/** B03B2a RUNNER (Director-owned; do not change). Usage: node run.mjs tests/structureRunner.test.ts   Proves `linkClauses` in structure/links.ts. */
import { linkClauses } from '../src/brain/mind/meaning/structure/links';
import type { Gap, LinkKind, WordFacts, WordRange, StructureResult } from '../src/brain/mind/meaning/structure/types';

// Test-only stand-in for the dictionary facts the caller would supply.
const VERBS = new Set('am is are was were be rains rain raining snows gets arrive arrives finish finishes say says sleep sleeping asleep cooking cancel call set turn remind stop go leave leaves lock wake wait shop eat like give pick do does have has can start starts end ends tell stay'.split(' ').filter((w) => w !== 'asleep'));
const SUBJECTS = new Set('i you he she it we they there'.split(' '));
let checks = 0; const fails: string[] = [];
function eq(a: unknown, b: unknown, label: string): void { checks += 1; if (JSON.stringify(a) !== JSON.stringify(b)) fails.push(`${label}: got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`); }
function prep(text: string): { words: WordFacts[]; ranges: WordRange[]; asks: boolean[] } {
  const words: WordFacts[] = []; let pending: Gap = 'none'; const trailingQ: boolean[] = [];
  for (const raw of text.split(' ').filter((x) => x.length > 0)) {
    let w = raw; let after: Gap = 'none'; let q = false;
    while (w.length > 0 && ',;:.?!'.includes(w[w.length - 1]!)) { const c = w[w.length - 1]!; if (c === '?') q = true; after = '.?!'.includes(c) ? 'strong' : after === 'strong' ? 'strong' : 'weak'; w = w.slice(0, -1); }
    const norm = w.toLowerCase();
    words.push({ norm, verb: VERBS.has(norm), subject: SUBJECTS.has(norm), gapBefore: words.length === 0 ? 'none' : pending }); trailingQ.push(q); pending = after;
  }
  const ranges: WordRange[] = []; const asks: boolean[] = []; let from = 0;
  for (let i = 1; i <= words.length; i += 1) if (i === words.length || words[i]!.gapBefore !== 'none') { ranges.push({ from, to: i }); asks.push(trailingQ[i - 1]!); from = i; }
  return { words, ranges, asks };
}
const pieceText = (words: WordFacts[], r: WordRange): string => words.slice(r.from, r.to).map((w) => w.norm).join(' ');
type Case = [string, string[], Array<[LinkKind, string, string | null]>];
const CASES: Case[] = [
  ['If it rains, cancel the trip.', ['if it rains', 'cancel the trip'], [['condition', 'if it rains', 'cancel the trip']]],
  ['Cancel the trip if it rains', ['cancel the trip', 'if it rains'], [['condition', 'if it rains', 'cancel the trip']]],
  ['Call me when it rains', ['call me', 'when it rains'], [['time', 'when it rains', 'call me']]],
  ['When it rains, call me.', ['when it rains', 'call me'], [['time', 'when it rains', 'call me']]],
  ['When is the meeting?', ['when is the meeting'], []],
  ['Set a timer because I am cooking', ['set a timer', 'because i am cooking'], [['reason', 'because i am cooking', 'set a timer']]],
  ['Because it is late, stop.', ['because it is late', 'stop'], [['reason', 'because it is late', 'stop']]],
  ['Turn off the lights unless I say stay', ['turn off the lights', 'unless i say stay'], [['condition', 'unless i say stay', 'turn off the lights']]],
  ['Remind me after I finish lunch', ['remind me', 'after i finish lunch'], [['time', 'after i finish lunch', 'remind me']]],
  ['Remind me after the meeting', ['remind me after the meeting'], []],
  ['Wake me before 7', ['wake me before 7'], []],
  ['Wake me before it gets light', ['wake me', 'before it gets light'], [['time', 'before it gets light', 'wake me']]],
  ['Do it while I sleep', ['do it', 'while i sleep'], [['time', 'while i sleep', 'do it']]],
  ['If it rains', ['if it rains'], [['condition', 'if it rains', null]]],
  ['If', ['if'], []],
  ['What if it rains?', ['what if it rains'], []],
  ['Cancel it if it rains and it is cold', ['cancel it', 'if it rains and it is cold'], [['condition', 'if it rains and it is cold', 'cancel it']]],
  ['If it rains, cancel the trip, and call Tom.', ['if it rains', 'cancel the trip', 'and call tom'], [['condition', 'if it rains', 'cancel the trip']]],
  ['Call Tom. If it rains, cancel the trip.', ['call tom', 'if it rains', 'cancel the trip'], [['condition', 'if it rains', 'cancel the trip']]],
  ['Call me when ready', ['call me when ready'], []],
  ['Call me when you arrive, then wait', ['call me', 'when you arrive', 'then wait'], [['time', 'when you arrive', 'call me']]],
  ['If you can, call me', ['if you can', 'call me'], [['condition', 'if you can', 'call me']]],
  ['Stop if it rains because I am cold', ['stop', 'if it rains', 'because i am cold'], [['condition', 'if it rains', 'stop'], ['reason', 'because i am cold', 'stop']]],
  ['Because it is late, if it rains, stop', ['because it is late', 'if it rains', 'stop'], [['reason', 'because it is late', 'stop'], ['condition', 'if it rains', 'stop']]],
  ['After I eat, call me.', ['after i eat', 'call me'], [['time', 'after i eat', 'call me']]],
  ['Before you go, lock the door.', ['before you go', 'lock the door'], [['time', 'before you go', 'lock the door']]],
  ['I like cake because it is sweet.', ['i like cake', 'because it is sweet'], [['reason', 'because it is sweet', 'i like cake']]],
  ['Go unless', ['go unless'], []],
  ['Give me the gift', ['give me the gift'], []],
  ['Call me, if it rains.', ['call me', 'if it rains'], [['condition', 'if it rains', 'call me']]],
  ["Don't call me if he is asleep", ["don't call me", 'if he is asleep'], [['condition', 'if he is asleep', "don't call me"]]],
  ['While it is raining, stay in', ['while it is raining', 'stay in'], [['time', 'while it is raining', 'stay in']]],
  ['Cancel the trip? If it rains, yes.', ['cancel the trip', 'if it rains', 'yes'], [['condition', 'if it rains', 'yes']]],
  ['When? Tomorrow.', ['when', 'tomorrow'], []],
  ['if if if', ['if if if'], []],
  ['If it rains if it snows, stay', ['if it rains', 'if it snows', 'stay'], [['condition', 'if it rains', 'stay'], ['condition', 'if it snows', 'stay']]],
  ['Cancel if rains', ['cancel', 'if rains'], [['condition', 'if rains', 'cancel']]],
  ['Pick up the kids after school, then shop', ['pick up the kids after school', 'then shop'], []],
  ['Call Tom. If it rains', ['call tom', 'if it rains'], [['condition', 'if it rains', null]]],
  ['Call me if you', ['call me', 'if you'], [['condition', 'if you', 'call me']]],
  ['Do it. Because it is late', ['do it', 'because it is late'], [['reason', 'because it is late', null]]],
  ['Stop if because I am cold', ['stop if', 'because i am cold'], [['reason', 'because i am cold', 'stop if']]],
  ['', [], []],
];
for (const [text, pieces, links] of CASES) {
  const { words, ranges, asks } = prep(text); const before = JSON.stringify([words, ranges, asks]);
  const out: StructureResult = linkClauses(words, ranges, asks);
  eq(out.ranges.map((r) => pieceText(words, r)), pieces, `pieces "${text}"`);
  eq(out.links.map((l) => [l.kind, pieceText(words, out.ranges[l.dependent]!), l.main === null ? null : pieceText(words, out.ranges[l.main]!)]), links, `links "${text}"`);
  // the may-not-run-alone rule: a dependent clause, and the main clause of a condition or a time link, never runs alone; a reason does not hold its main back
  const gated = new Set<number>(); for (const l of out.links) { gated.add(l.dependent); if (l.main !== null && l.kind !== 'reason') gated.add(l.main); }
  eq(out.mayRunAlone, out.ranges.map((_, i) => !gated.has(i)), `mayRunAlone "${text}"`);
  // invariants
  let cursor = 0; let ok = true; for (const r of out.ranges) { if (r.from !== cursor || r.to <= r.from) ok = false; cursor = r.to; } eq(ok && cursor === words.length, true, `ranges cover "${text}"`);
  eq(out.links.every((l, i) => l.dependent >= 0 && l.dependent < out.ranges.length && l.main !== l.dependent && (l.main === null || (l.main >= 0 && l.main < out.ranges.length)) && (i === 0 || out.links[i - 1]!.dependent < l.dependent) && words[out.ranges[l.dependent]!.from]!.norm === l.marker), true, `links shape "${text}"`);
  eq(JSON.stringify([words, ranges, asks]), before, `input not changed "${text}"`);
  eq(JSON.stringify(linkClauses(words, ranges, asks)), JSON.stringify(out), `same answer twice "${text}"`);
}
// hostile and speed
const noThrow = (f: () => unknown, label: string) => { checks += 1; try { const r = f() as StructureResult; if (!r || !Array.isArray(r.ranges) || !Array.isArray(r.links) || !Array.isArray(r.mayRunAlone)) fails.push(`${label}: bad shape`); } catch (e) { fails.push(`${label} threw ${(e as Error).message}`); } };
noThrow(() => linkClauses(undefined as never, undefined as never, undefined as never), 'undefined'); noThrow(() => linkClauses(null as never, [] as never, [] as never), 'null');
noThrow(() => linkClauses([], [{ from: 0, to: 5 }], [false]), 'range beyond words'); noThrow(() => linkClauses([{ norm: 'if', verb: true, subject: false, gapBefore: 'none' }], [], []), 'no ranges');
noThrow(() => linkClauses([{ norm: 'if', verb: true, subject: false, gapBefore: 'none' }], [{ from: 0, to: 1 }], []), 'asks missing');
noThrow(() => linkClauses([{ norm: 'if' } as never], [{ from: 0, to: 1 }], [false]), 'missing facts');
for (const [label, unit] of [['if it', 'if it rains '], ['because', 'because i am '], ['mixed', 'a if it rains because i am when you go ']] as const) {
  const text = unit.repeat(7000); const { words, ranges, asks } = prep(text); const t0 = Date.now(); const out = linkClauses(words, ranges, asks); const ms = Date.now() - t0;
  checks += 1; if (ms > 500) fails.push(`speed ${label}: ${ms} ms for ${words.length} words (limit 500)`); eq(out.mayRunAlone.length, out.ranges.length, `hostile length ${label}`);
}
console.log(`structureRunner: ${checks} checks, ${fails.length} failures`);
if (fails.length) { console.log(fails.slice(0, 40).join('\n')); process.exit(1); }
console.log('STRUCTURE RUNNER OK');
