/**
 * LIVE1a: THE ONE LIVE-SWITCH FILE (docs/LIVE0_DESIGN.md section 4).
 * `LIVE_SWITCHES` is a copy of `DEFAULT_SWITCHES` with a family's tools set to 'runner' at its go-live. Everything is OFF today.
 * `tests/liveSwitches.test.ts` PINS this list, so turning a tool on changes that test on purpose. Switching back is one line.
 */
import { DEFAULT_SWITCHES, type RunnerSwitches } from './runnerRegistry';
import { TIME_RUNNERS } from './timeRunners';

export const LIVE_SWITCHES: RunnerSwitches = Object.freeze({ ...DEFAULT_SWITCHES });

/** Tools whose runner keeps an engine state (timer, stopwatch, tally counter, ...): the lane never runs them until a STATE design says who stores it. */
export const STATE_TOOL_IDS: readonly string[] = Object.freeze(TIME_RUNNERS.map((runner) => runner.toolId));
