/** LIVE9-2: the closed set of Sort Lines mode words (PROPOSED, the owner's yes waiting). Known answers are hand-written. */
import { readSortReverse } from '../src/tools/runners/sortModeWords';
import { SORT_MODE_WORDS, SORT_MODE_CHOICES, foldSortMode } from '../src/tools/runners/sortModeWords';
import { SORT_LINE_MODES } from '../src/tools/engines/text/sortLines';
import { findRunner } from '../src/tools/runners/runnerRegistry';
import { LIVE_CHOICES, LIVE_SWITCHES, LIVE_SAY_DEFAULTS } from '../src/tools/runners/liveSwitches';
import { buildLaneConfig } from '../src/brain/index';
import { SLOT_DEFAULTS } from '../src/brain/mind/bind/bindDefaults';
let n = 0; const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const PROPOSED: Record<string, string> = { ascending: 'ascending', alphabetical: 'ascending', alphabetically: 'ascending', descending: 'descending', length: 'by-length', natural: 'natural', reverse: 'reverse', shuffle: 'shuffle', random: 'shuffle', randomize: 'shuffle' };
check(JSON.stringify(SORT_MODE_WORDS) === JSON.stringify(PROPOSED), 'the closed set is exactly the proposed set (a new word must change this test on purpose)');
check(Object.keys(PROPOSED).length === 10 && SORT_MODE_CHOICES.length === 10, 'ten words');
check(SORT_LINE_MODES.every((mode) => Object.values(SORT_MODE_WORDS).includes(mode)), 'every engine mode is reachable by some word');
check(Object.values(SORT_MODE_WORDS).every((mode) => (SORT_LINE_MODES as readonly string[]).includes(mode)), 'every word folds to a real engine mode');
check(Object.isFrozen(SORT_MODE_WORDS) && Object.isFrozen(SORT_MODE_CHOICES), 'both frozen');
check(!('numerically' in SORT_MODE_WORDS) && !('az' in SORT_MODE_WORDS), 'numerically and a to z are NOT in the set');
for (const [word, mode] of Object.entries(PROPOSED)) check(foldSortMode(word) === mode && foldSortMode(word.toUpperCase()) === mode, 'fold ' + word);
for (const mode of SORT_LINE_MODES) check(foldSortMode(mode) === mode, 'engine mode passes through: ' + mode);
check(foldSortMode('sideways') === 'sideways' && foldSortMode('toString') === 'toString' && foldSortMode('__proto__') === '__proto__', 'unknown words (even object names) come back unchanged');
check(foldSortMode(5) === 5 && foldSortMode(undefined) === undefined, 'non-text comes back unchanged');
check(JSON.stringify(LIVE_CHOICES['sort-lines']?.mode) === JSON.stringify(SORT_MODE_CHOICES), 'the lane would supply exactly this set to the binder');
check(LIVE_SWITCHES['sort-lines'] === 'runner', 'the Sort Lines switch is ON since LIVE9-3');
const runner = findRunner('sort-lines')!;
const deps = { now: 0, randomBelow: () => 0, random01: () => 0 };
const ask = async (mode: unknown) => runner.run({ text: 'pear\napple\nfig', mode } as never, deps);
const WANT: Record<string, string> = { alphabetically: 'apple\nfig\npear', ascending: 'apple\nfig\npear', descending: 'pear\nfig\napple', reverse: 'fig\napple\npear', length: 'fig\npear\napple' };
for (const [mode, want] of Object.entries(WANT)) { const o = await ask(mode); check(o.ok && o.reply.startsWith(want + '\n'), 'runner answers for ' + mode); }
check((await ask('sideways')).ok === false, 'the runner still refuses an unknown mode');
const noMode = await runner.run({ text: 'b\na' } as never, deps); check(noMode.ok && noMode.reply.startsWith('a\nb\n'), 'no mode still sorts ascending (engine default)');
check(JSON.stringify(LIVE_SAY_DEFAULTS) === JSON.stringify(['sort-lines']), 'only Sort Lines may answer with a declared default (said aloud)');
const allow = buildLaneConfig().allowDefaults as (id: string) => boolean;
check(allow('sort-lines') === true && allow('text-counter') === false && allow('case-converter') === false, 'the lane lets only Sort Lines use a default; Text Counter keeps the LIVE2 rule');
check(SLOT_DEFAULTS['sort-lines']?.mode?.value === 'ascending' && (SORT_LINE_MODES as readonly string[]).includes(String(SLOT_DEFAULTS['sort-lines']!.mode!.value)), 'the declared default for mode is ascending, a real engine mode');
// Director (2026-11-04): 'sort in reverse' means descending; 'reverse the lines' still flips.
{
  const ok = (c: boolean, m: string): void => { if (!c) throw new Error('readSortReverse: ' + m); };
  ok(readSortReverse({ text: 'b\na', mode: 'reverse' }, 'sort "b\na" in reverse').mode === 'descending', 'sort + reverse is descending');
  ok(readSortReverse({ text: 'b\na', mode: 'reverse' }, 'arrange "b\na" in reverse').mode === 'descending', 'arrange + reverse is descending');
  ok(readSortReverse({ text: 'b\na', mode: 'Reverse' }, 'Alphabetize "b\na" Reverse').mode === 'descending', 'capitals do not matter');
  ok(readSortReverse({ text: 'b\na', mode: 'reverse' }, 'reverse the lines "b\na"').mode === 'reverse', 'no sorting verb: the lines are flipped');
  ok(readSortReverse({ text: 'sort\nfoo', mode: 'reverse' }, 'reverse the lines "sort\nfoo"').mode === 'reverse', 'a sorting word INSIDE the person\'s text never counts');
  ok(readSortReverse({ text: 'b\na', mode: 'ascending' }, 'sort "b\na"').mode === 'ascending', 'other modes pass through');
  const same = { text: 'x' };
  ok(readSortReverse(same, 'sort "x"') === same, 'no mode: the same object comes back');
}
console.log('sortModeWords: ' + n + ' checks passed');
