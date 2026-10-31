/**
 * LIVE1a: THE ONE LIVE-SWITCH FILE (docs/LIVE0_DESIGN.md section 4).
 * `LIVE_SWITCHES` is a copy of `DEFAULT_SWITCHES` with a family's tools set to 'runner' at its go-live. Everything is OFF today.
 * `tests/liveSwitches.test.ts` PINS this list, so turning a tool on changes that test on purpose. Switching back is one line.
 */
import { DEFAULT_SWITCHES, type RunnerSwitches } from './runnerRegistry';
import { TIME_RUNNERS } from './timeRunners';
import { TEXT_COUNTER_UNITS } from './textCounterRunner';
import { TEXT_COUNT_ACTION } from '../../kernel/textCount';

/** LIVE2 go-live (2026-10-31, after LIVE2a): Text Counter is the first tool ON. SWITCH BACK = delete the 'text-counter' entry below and set PINNED_ON to [] in tests/liveSwitches.test.ts. */
export const LIVE_SWITCHES: RunnerSwitches = Object.freeze({ ...DEFAULT_SWITCHES, 'text-counter': 'runner' as const });

/** The choice words each live tool's binder may fill, per slot (one source: the runner's own closed set). */
export const LIVE_CHOICES: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = Object.freeze({ 'text-counter': Object.freeze({ unit: TEXT_COUNTER_UNITS }) });

/** Tools whose runner keeps an engine state (timer, stopwatch, tally counter, ...): the lane never runs them until a STATE design says who stores it. */
export const STATE_TOOL_IDS: readonly string[] = Object.freeze(TIME_RUNNERS.map((runner) => runner.toolId));

/** LIVE2a: the task-engine action that records each live tool's run, exactly as the old chat path did (same action, same input keys). A tool with no entry here never answers through the lane. */
export const LIVE_TASKS: Readonly<Record<string, { readonly actionId: string; readonly input: (args: Readonly<Record<string, unknown>>) => Record<string, unknown> }>> = Object.freeze({
  'text-counter': Object.freeze({ actionId: TEXT_COUNT_ACTION.id, input: (args: Readonly<Record<string, unknown>>) => ({ text: args.text, ...(args.unit !== undefined ? { unit: args.unit } : {}) }) }),
});
