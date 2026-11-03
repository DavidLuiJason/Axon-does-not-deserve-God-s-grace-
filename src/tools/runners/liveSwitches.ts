/**
 * LIVE1a: THE ONE LIVE-SWITCH FILE (docs/LIVE0_DESIGN.md section 4).
 * `LIVE_SWITCHES` is a copy of `DEFAULT_SWITCHES` with a family's tools set to 'runner' at its go-live. Everything is OFF today.
 * `tests/liveSwitches.test.ts` PINS this list, so turning a tool on changes that test on purpose. Switching back is one line.
 */
import { DEFAULT_SWITCHES, type RunnerSwitches } from './runnerRegistry';
import { TIME_RUNNERS } from './timeRunners';
import { TEXT_COUNTER_UNITS } from './textCounterRunner';
import { TEXT_COUNT_ACTION } from '../../kernel/textCount';
import { CASE_MODE_CHOICES, foldCaseMode } from './caseModeWords';
import { SORT_MODE_CHOICES, foldSortMode } from './sortModeWords';
import { TEXT_CASE_ACTION } from '../textCaseAction';
import { TEXT_SORT_ACTION } from '../textSortAction';

/** LIVE9-3 go-live (2026-11-03): Sort Lines is the third tool ON. SWITCH BACK = delete the 'sort-lines' entry below and its LIVE_TASKS entry, delete its `act.sort-lines` chat action in registerAxonTools.ts (chat must not claim it, FL10), remove `TEXT_SORT_ACTION` from axonEngine.ts and set PINNED_ON in tests/liveSwitches.test.ts to ['case-converter','text-counter'].
 * LIVE8-3 go-live (2026-10-31): Case Converter is the second tool ON. SWITCH BACK = delete the 'case-converter' entry below, delete its `act.case-converter` chat action in registerAxonTools.ts (chat must not claim it, FL10) and set PINNED_ON in tests/liveSwitches.test.ts to ['text-counter'].
 * LIVE2 go-live (2026-10-31, after LIVE2a): Text Counter is the first tool ON. SWITCH BACK = delete the 'text-counter' entry below and set PINNED_ON to [] in tests/liveSwitches.test.ts. */
export const LIVE_SWITCHES: RunnerSwitches = Object.freeze({ ...DEFAULT_SWITCHES, 'text-counter': 'runner' as const, 'case-converter': 'runner' as const, 'sort-lines': 'runner' as const });

/** The choice words each live tool's binder may fill, per slot (one source: the runner's own closed set). */
export const LIVE_CHOICES: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = Object.freeze({ 'text-counter': Object.freeze({ unit: TEXT_COUNTER_UNITS }), 'case-converter': Object.freeze({ mode: CASE_MODE_CHOICES }), 'sort-lines': Object.freeze({ mode: SORT_MODE_CHOICES }) });

/** Tools whose runner keeps an engine state (timer, stopwatch, tally counter, ...): the lane never runs them until a STATE design says who stores it. */
export const STATE_TOOL_IDS: readonly string[] = Object.freeze(TIME_RUNNERS.map((runner) => runner.toolId));

/** LIVE2a: the task-engine action that records each live tool's run, exactly as the old chat path did (same action, same input keys). A tool with no entry here never answers through the lane. */
export const LIVE_TASKS: Readonly<Record<string, { readonly actionId: string; readonly input: (args: Readonly<Record<string, unknown>>) => Record<string, unknown> }>> = Object.freeze({
  'case-converter': Object.freeze({ actionId: TEXT_CASE_ACTION.id, input: (args: Readonly<Record<string, unknown>>) => ({ text: args.text, mode: foldCaseMode(args.mode) }) }),
  'sort-lines': Object.freeze({ actionId: TEXT_SORT_ACTION.id, input: (args: Readonly<Record<string, unknown>>) => ({ text: args.text, ...(args.mode !== undefined ? { mode: foldSortMode(args.mode) } : {}) }) }),
  'text-counter': Object.freeze({ actionId: TEXT_COUNT_ACTION.id, input: (args: Readonly<Record<string, unknown>>) => ({ text: args.text, ...(args.unit !== undefined ? { unit: args.unit } : {}) }) }),
});

/** LIVE9-2b: tools whose lane answer may use a declared default and SAY it aloud (owner rule 2026-10-28): only tools with NO old chat handler, so no old answer can differ. Text Counter keeps the LIVE2 rule (it yields when a default was needed). PROPOSED for Sort Lines (default ascending): the owner's yes is waiting. */
export const LIVE_SAY_DEFAULTS: readonly string[] = Object.freeze(['sort-lines']);
