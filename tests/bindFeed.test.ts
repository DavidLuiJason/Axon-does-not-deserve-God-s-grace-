/** BIND-FEED (BF1): the feed from the real stages' output to the binder's input. Pure checks on hand-built structures (no dictionary). */
import { buildBindInputs } from '../src/brain/mind/bind/bindFeed';
import { bindArguments } from '../src/brain/mind/bind/argumentBinder';
import { REF_WORDS } from '../src/brain/mind/meaning/structure/refWords';

let n = 0;
function check(ok: boolean, name: string): void { n++; if (!ok) throw new Error('FAILED: ' + name); }
const UNITS = ['words', 'word', 'characters', 'character', 'chars', 'char', 'letters', 'letter', 'lines', 'line', 'all'];
const refsNone = { pointers: [], relay: null, needsPrevious: false };
function wordsOf(text: string) { const out: { norm: string; start: number; end: number }[] = []; let at = 0; for (const w of text.split(' ')) { out.push({ norm: w.toLowerCase(), start: at, end: at + w.length }); at += w.length + 1; } return out; }
const match = (piece: number, extra: object = {}) => ({ piece, clause: 0, mayRunAlone: true, resolution: { kind: 'match', tool: 'text-counter', missingSlots: [], confidence: 0.9, reason: 'x', candidates: [], evidence: 'concept' }, ...extra }) as never;
const feed = (message: string, structure: object, resolutions: unknown[], segments: unknown[] = [], values: unknown[] = []) =>
  buildBindInputs({ message, segments: segments as never, structure: structure as never, values: values as never, resolutions: resolutions as never, choicesFor: () => ({ unit: UNITS }), toolNameFor: () => 'Text Counter' });
const piece = (from: number, to: number, details: object[], pointers: object[] = [], object: object | null = { from: 1, to: 2 }) =>
  ({ from, to, clause: 0, mayRunAlone: true, parts: { verb: 0, copula: false, object, details, infinitive: null }, refs: { ...refsNone, pointers } });

// A: quoted text is a material; the marker-only detail is empty and dropped
const mA = 'count words in "hello world"';
const sA = { words: wordsOf('count words in'), pieces: [piece(0, 3, [{ marker: 'in', from: 2, to: 3 }])], links: [] };
const iA = feed(mA, sA, [match(0)], [{ kind: 'material', start: 15, end: 28 }]);
check(iA.length === 1 && iA[0]!.input.tool === 'text-counter' && iA[0]!.input.toolName === 'Text Counter', 'A one item, tool, name');
check(JSON.stringify(iA[0]!.input.materials) === '[{"start":15,"end":28}]' && iA[0]!.input.details.length === 0, 'A material kept, marker-only detail dropped');
check(iA[0]!.input.message === mA && iA[0]!.input.words.length === 3 && iA[0]!.input.evidence === 'concept' && iA[0]!.input.choices.unit!.includes('chars'), 'A message, words, evidence, injected choices');
const bA = bindArguments(iA[0]!.input);
check(bA.decision === 'run' && bA.args.text === 'hello world' && bA.args.unit === 'words', 'A binds and runs on the quoted text');

// B: unquoted detail starts AFTER the marker word
const mB = 'count words in the fox';
const sB = { words: wordsOf(mB), pieces: [piece(0, 5, [{ marker: 'in', from: 2, to: 5 }])], links: [] };
const iB = feed(mB, sB, [match(0)]);
check(JSON.stringify(iB[0]!.input.details) === '[{"start":15,"end":22}]', 'B detail excludes the marker word');
check(bindArguments(iB[0]!.input).args.text === 'the fox', 'B binds the text after the marker');

// C: an earlier pointer covers its determiner (and a following "one"); the pointer is not text
const mC = 'count words in the above';
const sC = { words: wordsOf(mC), pieces: [piece(0, 5, [{ marker: 'in', from: 2, to: 5 }], [{ kind: 'earlier', at: 4 }])], links: [] };
const iC = feed(mC, sC, [match(0)]);
check(JSON.stringify(iC[0]!.input.references) === '[{"start":15,"end":24}]', 'C earlier pointer covers "the above"');
const bC = bindArguments(iC[0]!.input);
check(bC.decision === 'ask' && bC.missing.some((m) => m.slot === 'text'), 'C a pointer is not text: asks');
const mC2 = 'count words in the last one';
const sC2 = { words: wordsOf(mC2), pieces: [piece(0, 6, [{ marker: 'in', from: 2, to: 6 }], [{ kind: 'earlier', at: 4 }])], links: [] };
check(JSON.stringify(feed(mC2, sC2, [match(0)])[0]!.input.references) === '[{"start":15,"end":27}]', 'C2 earlier pointer with "one" covers "the last one"');

// D: a plain pointer word covers itself
const mD = 'count words in it';
const sD = { words: wordsOf(mD), pieces: [piece(0, 4, [{ marker: 'in', from: 2, to: 4 }], [{ kind: 'thing', at: 3 }])], links: [] };
check(JSON.stringify(feed(mD, sD, [match(0)])[0]!.input.references) === '[{"start":15,"end":17}]', 'D thing pointer covers the word');

// E: only a match of a piece that may run alone yields an item
for (const kind of ['ask', 'none', 'negated', 'unavailable', 'not-a-request']) {
  check(feed(mA, sA, [{ piece: 0, clause: 0, mayRunAlone: true, resolution: { kind, tool: 'text-counter', choices: ['text-counter'], confidence: 0.5, reason: 'x', candidates: [] } }]).length === 0, 'E ' + kind + ' gives no item');
}
check(feed(mA, sA, [match(0, { mayRunAlone: false })]).length === 0, 'E a conditional piece never runs alone');
check(feed(mA, sA, [match(7)]).length === 0, 'E unknown piece gives no item');

// F: two pieces: values and materials belong to their own piece
const mF = 'count words in "a" and count lines in "b"';
const wF = wordsOf('count words in').concat([{ norm: 'and', start: 19, end: 22 }, { norm: 'count', start: 23, end: 28 }, { norm: 'lines', start: 29, end: 34 }, { norm: 'in', start: 35, end: 37 }]);
const sF = { words: wF, pieces: [piece(0, 3, [{ marker: 'in', from: 2, to: 3 }]), piece(4, 7, [{ marker: 'in', from: 6, to: 7 }])], links: [] };
const iF = feed(mF, sF, [match(0), match(1)], [{ kind: 'material', start: 15, end: 18 }, { kind: 'material', start: 38, end: 41 }], [{ kind: 'number', start: 16, end: 17, confidence: 0.9, value: 1 }, { kind: 'number', start: 39, end: 40, confidence: 0.9, value: 2 }]);
check(iF.length === 2 && iF[0]!.input.materials.length === 1 && iF[0]!.input.materials[0]!.start === 15 && iF[1]!.input.materials[0]!.start === 38, 'F each piece keeps its own material');
check(iF[0]!.input.values.length === 1 && iF[0]!.input.values[0]!.value === 1 && iF[1]!.input.values.length === 1 && iF[1]!.input.values[0]!.value === 2, 'F each piece keeps its own values');

// G: robustness and purity
check(feed(mA, null as never, [match(0)]).length === 0 && feed(null as never, sA, [match(0)]).length === 0, 'G null structure or message gives []');
check(feed(mA, { words: 'x', pieces: 'y' }, [match(0)]).length === 0 && feed(mA, sA, 'z' as never).length === 0, 'G malformed gives []');
const before = JSON.stringify([mC, sC, [match(0)]]); feed(mC, sC, [match(0)]);
check(JSON.stringify([mC, sC, [match(0)]]) === before, 'G inputs are not changed');
let seen = ''; buildBindInputs({ message: mA, segments: [], structure: sA as never, values: [], resolutions: [match(0)] as never, choicesFor: (t) => { seen += t; return {}; }, toolNameFor: (t) => { seen += '|' + t; return 'T'; } });
check(seen.split('text-counter').length === 3 && seen.includes('|text-counter'), 'G names and choices come from the injected functions (each asked once for the tool)');

// H: the closed pointer group carries the two words added by BIND-FEED
const earlier = REF_WORDS.earlier.split(' ');
check(earlier.includes('above') && earlier.includes('following') && earlier.includes('last'), 'H earlier group has above and following');
console.log('bindFeed.test.ts: ' + n + ' checks passed');
