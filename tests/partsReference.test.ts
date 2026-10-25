/**
 * B03B2b DIRECTOR REFERENCE TEST (written 2026-10-25 by the Director, independent of the builder's own runner).
 * Proves `readClauseParts` (structure/clauseParts.ts). Test-only stand-ins supply the dictionary facts.
 * The builder's own 167-check runner (mini-base, Director-owned) was not available when this was written; this file is the independent proof.
 */
import { readClauseParts } from '../src/brain/mind/meaning/structure/clauseParts';
import type { PartFacts } from '../src/brain/mind/meaning/structure/partsTypes';

const VERBS = new Set('go work set send tell call pick carry put move turn remind cancel wake open show give want is are am be please'.split(' '));
const AUX = new Set('is are am be was can will do does'.split(' '));
const NOUNS = new Set('call timer work walk turn box'.split(' '));
const DETERMINERS = new Set('a an the my your this that'.split(' '));
const mk = (text: string): PartFacts[] => text.toLowerCase().split(' ').map((w) => ({ norm: w, verb: VERBS.has(w) || AUX.has(w), aux: AUX.has(w), noun: NOUNS.has(w), determiner: DETERMINERS.has(w) }));

let checks = 0; const fails: string[] = [];
function eq(got: unknown, expected: unknown, label: string): void { checks += 1; if (JSON.stringify(got) !== JSON.stringify(expected)) fails.push(`${label}: got ${JSON.stringify(got)} expected ${JSON.stringify(expected)}`); }

function check(text: string, verb: string | null, object: string | null, details: string[], infinitive: string | null, copula = false): void {
  const words = mk(text); const r = readClauseParts(words, [{ from: 0, to: words.length }])[0]!;
  const slice = (a: number, b: number): string => words.slice(a, b).map((x) => x.norm).join(' ');
  eq({
    verb: r.verb === null ? null : words[r.verb]!.norm,
    object: r.object ? slice(r.object.from, r.object.to) : null,
    details: r.details.map((d) => `${d.marker}:${slice(d.from, d.to)}`),
    infinitive: r.infinitive === null ? null : slice(r.infinitive, r.infinitive + 2),
    copula: r.copula,
  }, { verb, object, details, infinitive, copula }, text);
}
check('Set a timer for 5 minutes', 'set', 'a timer', ['for:for 5 minutes'], null);
check('Send it to Tom by Friday', 'send', 'it', ['to:to tom', 'by:by friday'], null);
check('Tell Tom to wake me', 'tell', 'tom to wake me', [], 'to wake');
check('Remind me at 7 in the kitchen', 'remind', 'me', ['at:at 7', 'in:in the kitchen'], null);
check('Cancel it', 'cancel', 'it', [], null);
check('Cancel', 'cancel', null, [], null);
check('The box is heavy', 'is', null, [], null, true);
check('The call is late', 'is', null, [], null, true);
check('Go to work', 'go', null, ['to:to work'], null);
check('Give the call to Tom', 'give', 'the call', ['to:to tom'], null);
check('Turn off the light', 'turn', 'off the light', [], null);
check('Look at', null, null, [], null);
check('Please set a timer', 'please', 'set a timer', [], null); // known limit: the caller's verb flag decides

// One result per range, hostile input never throws, inputs are not changed, speed.
const words = mk('set a timer for 5 minutes');
const before = JSON.stringify(words);
const results = readClauseParts(words, [{ from: 0, to: 5 }, { from: 0, to: 99 }, { from: 3, to: 3 }, { from: -1, to: 2 }, { from: 1.5, to: 3 }] as never);
eq(results.length, 5, 'one result per range');
eq(results.slice(1).every((x) => x.verb === null && x.object === null && x.details.length === 0 && x.infinitive === null), true, 'bad ranges give empty parts');
eq(readClauseParts(null as never, [{ from: 0, to: 1 }]), [], 'null words');
eq(readClauseParts(words, null as never), [], 'null ranges');
eq(readClauseParts([{ norm: 1 } as never], [{ from: 0, to: 1 }]).length, 1, 'malformed facts give one empty result');
eq(JSON.stringify(words) === before, true, 'inputs not changed');
const big = Array.from({ length: 200000 }, () => words[3]!);
const t0 = Date.now(); readClauseParts(big, [{ from: 0, to: big.length }]);
eq(Date.now() - t0 < 2000, true, '200,000 words in under two seconds');

if (fails.length > 0) { console.error(fails.join('\n')); throw new Error(`B03B2b reference test: ${fails.length} of ${checks} failed`); }
console.log(`B03B2b PARTS REFERENCE TEST OK: ${checks} checks`);
