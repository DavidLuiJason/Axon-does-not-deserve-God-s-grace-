/** LIVE8-2: the closed set of Case Converter mode words. Known answers are hand-written. */
import { CASE_MODE_WORDS, CASE_MODE_CHOICES, foldCaseMode } from '../src/tools/runners/caseModeWords';
import { CASE_CONVERT_MODES } from '../src/tools/engines/text/caseConvert';
import { findRunner } from '../src/tools/runners/runnerRegistry';
import { LIVE_CHOICES } from '../src/tools/runners/liveSwitches';
let n = 0; const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const APPROVED: Record<string, string> = { upper: 'UPPER', uppercase: 'UPPER', lower: 'lower', lowercase: 'lower', title: 'Title', sentence: 'Sentence', camel: 'camelCase', camelcase: 'camelCase', pascal: 'PascalCase', pascalcase: 'PascalCase', snake: 'snake_case', snake_case: 'snake_case', kebab: 'kebab-case', 'kebab-case': 'kebab-case', constant: 'CONSTANT_CASE', constant_case: 'CONSTANT_CASE' };
check(JSON.stringify(CASE_MODE_WORDS) === JSON.stringify(APPROVED), 'the closed set is exactly the approved set (a new word must change this test on purpose)');
check(Object.keys(APPROVED).length === 16 && CASE_MODE_CHOICES.length === 16, 'sixteen words');
check(CASE_CONVERT_MODES.every((mode) => Object.values(CASE_MODE_WORDS).includes(mode)), 'every engine mode is reachable by some word');
check(Object.values(CASE_MODE_WORDS).every((mode) => (CASE_CONVERT_MODES as readonly string[]).includes(mode)), 'every word folds to a real engine mode');
check(Object.isFrozen(CASE_MODE_WORDS) && Object.isFrozen(CASE_MODE_CHOICES), 'both frozen');
check(!('capitals' in CASE_MODE_WORDS) && !('caps' in CASE_MODE_WORDS), 'capitals and all caps are NOT in the set');
for (const [word, mode] of Object.entries(APPROVED)) check(foldCaseMode(word) === mode && foldCaseMode(word.toUpperCase()) === mode, 'fold ' + word);
for (const mode of CASE_CONVERT_MODES) check(foldCaseMode(mode) === mode, 'engine mode passes through: ' + mode);
check(foldCaseMode('shout') === 'shout' && foldCaseMode('toString') === 'toString' && foldCaseMode('__proto__') === '__proto__', 'unknown words (even object names) come back unchanged');
check(foldCaseMode(5) === 5 && foldCaseMode(undefined) === undefined, 'non-text comes back unchanged');
check(JSON.stringify(LIVE_CHOICES['case-converter']?.mode) === JSON.stringify(CASE_MODE_CHOICES), 'the lane supplies exactly this set to the binder');
const runner = findRunner('case-converter')!;
const deps = { now: 0, randomBelow: () => 0, random01: () => 0 };
const ask = async (mode: unknown) => runner.run({ text: 'hello big world', mode } as never, deps);
const WANT: Record<string, string> = { uppercase: 'HELLO BIG WORLD', lowercase: 'hello big world', title: 'Hello Big World', camel: 'helloBigWorld', pascal: 'HelloBigWorld', snake: 'hello_big_world', kebab: 'hello-big-world', constant: 'HELLO_BIG_WORLD', UPPER: 'HELLO BIG WORLD', Title: 'Hello Big World', camelCase: 'helloBigWorld' };
for (const [mode, want] of Object.entries(WANT)) { const o = await ask(mode); check(o.ok && o.reply === want, 'runner answers for ' + mode); }
check((await ask('shout')).ok === false && (await ask(undefined)).ok === false, 'the runner still refuses an unknown or missing mode');
console.log('caseModeWords: ' + n + ' checks passed');
