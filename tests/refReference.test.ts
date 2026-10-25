import { readReferences } from '../src/brain/mind/meaning/structure/references';
import { readClauseParts } from '../src/brain/mind/meaning/structure/clauseParts';
import type { RefFacts } from '../src/brain/mind/meaning/structure/refTypes';
const S = (s: string) => new Set(s.split(' '));
const VERBS = S('convert delete open tell remind make stop call know is are am be was will do does say ask send set run play show'), AUX = S('is are am be was will do does');
const NOUNS = S('file week timer mom tom pdf song man joke'), DET = S('a an the this that these those my your');
const SUBJ = S('i you he she it we they there'), FIRST = S('me my myself us we i'), SPEECH = S('tell remind ask say');
const mk = (t: string): RefFacts[] => t.toLowerCase().split(' ').map((w) => ({ norm: w, verb: VERBS.has(w), noun: NOUNS.has(w), determiner: DET.has(w), subject: SUBJ.has(w), first: FIRST.has(w), speech: SPEECH.has(w) }));
let n = 0; const fails: string[] = [];
const eq = (g: unknown, e: unknown, l: string) => { n++; if (JSON.stringify(g) !== JSON.stringify(e)) fails.push(`${l}: got ${JSON.stringify(g)} want ${JSON.stringify(e)}`); };
function run(t: string) {
  const w = mk(t), r = [{ from: 0, to: w.length }];
  const parts = readClauseParts(w.map((x) => ({ norm: x.norm, verb: x.verb, aux: AUX.has(x.norm), noun: x.noun, determiner: x.determiner })), r);
  return { w, r, parts, out: readReferences(w, r, parts)[0]! };
}
const ptr = (t: string) => { const { w, out } = run(t); return out.pointers.map((p) => `${p.kind}:${w[p.at]!.norm}`); };
eq(ptr('convert that'), ['thing:that'], 'convert that');
eq(ptr('convert it to pdf'), ['thing:it'], 'convert it to pdf');
eq(ptr('convert that file'), [], 'that + noun');
eq(ptr('i know that he left'), [], 'that + subject');
eq(ptr('tell him it is late'), [], 'it + verb');
eq(ptr('it is raining'), [], 'subject it');
eq(ptr('that is fine'), [], 'subject that');
eq(ptr('convert that one'), ['thing:that'], 'that one');
eq(ptr('do it again'), ['thing:it', 'again:again'], 'order');
eq(ptr('again'), ['again:again'], 'again alone');
eq(ptr('again convert the file'), ['again:again'], 'again before verb');
eq(ptr('delete the last one'), ['earlier:last'], 'last one');
eq(ptr('open the same'), ['earlier:same'], 'the same');
eq(ptr('open the last week'), [], 'time not pointer');
eq(ptr('delete last one'), [], 'no determiner');
eq(ptr('delete the previous ones'), ['earlier:previous'], 'ones');
eq(run('again').out.needsPrevious, true, 'again needsPrev');
eq(run('the last one').out.needsPrevious, true, 'last one needsPrev');
eq(run('that one').out.needsPrevious, true, 'that one needsPrev');
eq(run('convert it').out.needsPrevious, false, 'verb => no needsPrev');
eq(run('hello there').out.needsPrevious, false, 'no pointer => no needsPrev');
const rel = (t: string) => { const { w, out } = run(t); const x = out.relay; return x && { v: w[x.verb]!.norm, a: w.slice(x.addressee.from, x.addressee.to).map((y) => y.norm).join(' '), c: w.slice(x.content.from, x.content.to).map((y) => y.norm).join(' '), me: x.addresseeIsSpeaker }; };
eq(rel('tell tom to call me'), { v: 'tell', a: 'tom', c: 'to call me', me: false }, 'relay tom');
eq(rel('remind me to call mom'), { v: 'remind', a: 'me', c: 'to call mom', me: true }, 'relay me');
eq(rel('tell the man to stop'), { v: 'tell', a: 'the man', c: 'to stop', me: false }, 'multi-word addressee');
eq(rel('tell me a joke'), null, 'no infinitive');
eq(rel('tell tom'), null, 'tell tom');
eq(rel('tell to open it'), null, 'no addressee');
eq(rel('make him tell tom to stop'), null, 'main verb not speech');
eq(rel('convert it to pdf'), null, 'non-speech');
eq(ptr('tell tom to open it'), ['thing:it'], 'pointer inside relay content');
// two clauses, output length, bad input, purity, speed
{ const w = mk('delete it then do it again'), r = [{ from: 0, to: 2 }, { from: 3, to: 6 }];
  const p = readClauseParts(w.map((x) => ({ norm: x.norm, verb: x.verb, aux: AUX.has(x.norm), noun: x.noun, determiner: x.determiner })), r);
  const before = JSON.stringify([w, r, p]); const a = readReferences(w, r, p);
  eq(a.map((x) => x.pointers.map((q) => q.at)), [[1], [4, 5]], 'two clauses (indices are global)');
  eq(JSON.stringify([w, r, p]) === before && JSON.stringify(readReferences(w, r, p)) === JSON.stringify(a), true, 'pure');
  const bad = readReferences(w, [{ from: 0, to: 2 }, { from: 5, to: 99 }, { from: 3, to: 3 }, { from: -1, to: 2 }, { from: 1.5, to: 3 }] as never, [p[0]!] as never);
  eq(bad.length, 5, 'length = ranges'); eq(bad.slice(1).every((x) => x.pointers.length === 0 && x.relay === null && !x.needsPrevious), true, 'empty entries');
  eq(readReferences(null as never, r, p), [], 'null words'); eq(readReferences(w, 'x' as never, p), [], 'bad ranges'); eq(readReferences(w, r, null as never), [], 'null parts');
  eq(readReferences([{ norm: 1 } as never], [{ from: 0, to: 1 }], [p[0]!]).length, 1, 'malformed facts'); }
{ const one = mk('again')[0]!, m = mk('convert')[0]!; const big = [m, ...Array.from({ length: 69999 }, () => one)];
  const pa = [{ verb: 0, copula: false, object: null, details: [], infinitive: null }];
  let t = Date.now(); const o = readReferences(big, [{ from: 0, to: big.length }], pa as never); eq(Date.now() - t < 1500, true, 'one 70k clause'); eq(o[0]!.pointers.length, 69999, 'all pointers listed');
  const rs = Array.from({ length: 35000 }, (_, i) => ({ from: i * 2, to: i * 2 + 2 })); const ps = rs.map(() => pa[0]); const w2 = Array.from({ length: 70000 }, (_, i) => (i % 2 ? one : m));
  const ps2 = rs.map((r) => ({ ...pa[0]!, verb: r.from })); t = Date.now(); readReferences(w2, rs, ps2 as never); eq(Date.now() - t < 500, true, '70k words many clauses'); void ps; }
{ const w = mk('tell tom to stop'); const P = (copula: boolean) => [{ verb: 0, copula, object: null, details: [], infinitive: 2 }] as never;
  eq(readReferences(w, [{ from: 0, to: 4 }], P(true))[0]!.relay, null, 'copula clause is never a relay'); eq(readReferences(w, [{ from: 0, to: 4 }], P(false))[0]!.relay !== null, true, 'same clause without copula is a relay');
  const v = mk('that'); v[0] = { ...v[0]!, verb: true }; eq(readReferences(v, [{ from: 0, to: 1 }], [{ verb: 0, copula: false, object: null, details: [], infinitive: null }] as never)[0]!.pointers, [], 'the verb word itself is not a pointer'); }
if (fails.length) { console.error(fails.join('\n')); throw new Error(`refReference: ${fails.length} of ${n} failed`); }
console.log(`REF REFERENCE OK: ${n} checks`);
