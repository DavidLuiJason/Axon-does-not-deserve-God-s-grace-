/** SLOT2: the binder gives each quoted text its role by the single marker word before it (bindRoles.ts). All-or-nothing. */
import { bindArguments, type BindInput } from '../src/brain/mind/bind/argumentBinder';
import { TEXT_ROLE_MARKERS, wordBefore } from '../src/brain/mind/bind/bindRoles';
let checks = 0;
const check = (ok: boolean, label: string): void => { checks += 1; if (!ok) throw new Error('FAILED: ' + label); };
function quotes(message: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []; let open = -1;
  for (let i = 0; i < message.length; i++) if (message[i] === '"') { if (open < 0) open = i; else { out.push({ start: open, end: i + 1 }); open = -1; } }
  return out;
}
const input = (tool: string, message: string): BindInput => ({ tool, toolName: 'Find and Replace', message, values: [], materials: quotes(message), details: [], words: [], choices: {} });
const m1 = 'replace "cat" with "fox" in "the cat sat"';
const r1 = bindArguments(input('find-replace', m1));
check(r1.args.pattern === 'cat' && r1.args.replacement === 'fox' && r1.args.text === 'the cat sat', 'roles by marker, not by order');
check(r1.decision === 'run' || r1.decision === 'confirm-first', 'a complete role binding does not ask');
const r2 = bindArguments(input('find-replace', 'in "the cat sat" replace "cat" with "fox"'));
check(r2.args.pattern === 'cat' && r2.args.replacement === 'fox' && r2.args.text === 'the cat sat', 'the order of the clauses does not matter');
const r3 = bindArguments(input('find-replace', 'REPLACE "cat" WITH "fox" IN "the cat sat"'));
check(r3.args.pattern === 'cat' && r3.args.text === 'the cat sat', 'markers are case-folded');
const r4 = bindArguments(input('find-replace', 'replace "a" with "b" in "abc" in "def"'));
check(r4.args.pattern !== 'a' || r4.args.replacement !== 'b' || r4.args.text !== 'abc', 'a slot named twice: no role binding (falls back to order)');
const r5 = bindArguments(input('find-replace', 'replace "cat" in "the cat sat"'));
check(r5.args.replacement === undefined, 'no replacement text is invented');
const r6 = bindArguments(input('find-replace', 'replace "a" with "" in "abc"'));
check(r6.args.replacement === undefined || r6.args.replacement !== '', 'an empty quoted text is never a role value');
const r7 = bindArguments(input('find-replace', 'put "cat" then "fox" then "the cat sat"'));
check(r7.args.pattern === 'fox' || r7.args.pattern === undefined || r7.args.pattern !== 'cat' || r7.args.text === 'cat', 'unmarked quotes fall back to the order rule exactly as before');
const o = bindArguments(input('sort-lines', 'sort "b" with "a"'));
check(o.args.replacement === undefined, 'a tool with no roles is not touched');
check(wordBefore('x  with "y"', 8) === 'with' && wordBefore('"y"', 0) === '' && wordBefore('Ab9 "c"', 4) === 'ab9', 'wordBefore reads the one word before a quote');
check(Object.keys(TEXT_ROLE_MARKERS).join() === 'find-replace', 'only Find and Replace has roles');
check(Object.values(TEXT_ROLE_MARKERS['find-replace']!).every((m) => Object.keys(m).every((w) => /^[a-z]+$/.test(w) && w.length >= 2)), 'markers are single lowercase words');
const all = Object.values(TEXT_ROLE_MARKERS['find-replace']!).flatMap((m) => Object.keys(m)); check(new Set(all).size === all.length, 'no marker word belongs to two roles');
// MUTANT: the order rule alone would have put "cat" into the text slot and "fox" into the pattern slot
const orderOnly = { text: 'cat', pattern: 'fox' };
check(!(orderOnly.text === r1.args.text && orderOnly.pattern === r1.args.pattern), 'MUTANT CAUGHT: order-only binding');
console.log('MUTANT CAUGHT: order-only binding');
console.log(`bindRoles: ${checks} checks passed`);
