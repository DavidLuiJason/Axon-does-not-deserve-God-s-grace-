/**
 * LIVE1a: THE ONE LIVE-SWITCH FILE (docs/LIVE0_DESIGN.md section 4).
 * `LIVE_SWITCHES` is a copy of `DEFAULT_SWITCHES` with a family's tools set to 'runner' at its go-live. Everything is OFF today.
 * `tests/liveSwitches.test.ts` PINS this list, so turning a tool on changes that test on purpose. Switching back is one line.
 */
import { DEFAULT_SWITCHES, type RunnerSwitches } from './runnerRegistry';
import { TIME_RUNNERS } from './timeRunners';
import { TEXT_COUNTER_UNITS } from './textCounterRunner';

/** Everything is OFF. LIVE2 (2026-10-31) measured the real brain and found the lane drops the task record the old path writes (no task line, no task id), so Text Counter stays OFF until LIVE2a fixes that. Going live = one line here plus the pin in tests/liveSwitches.test.ts. */
export const LIVE_SWITCHES: RunnerSwitches = Object.freeze({ ...DEFAULT_SWITCHES });

/** The choice words each live tool's binder may fill, per slot (one source: the runner's own closed set). */
export const LIVE_CHOICES: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = Object.freeze({ 'text-counter': Object.freeze({ unit: TEXT_COUNTER_UNITS }) });

/** Tools whose runner keeps an engine state (timer, stopwatch, tally counter, ...): the lane never runs them until a STATE design says who stores it. */
export const STATE_TOOL_IDS: readonly string[] = Object.freeze(TIME_RUNNERS.map((runner) => runner.toolId));
