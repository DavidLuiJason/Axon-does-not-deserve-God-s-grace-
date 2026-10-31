/**
 * C1 PART 1: RUNNER REGISTRY AND PER-TOOL SWITCH (Director, 2026-10-31).
 *
 * One place that knows every runner (C2a to C2e) and a switch per tool: OFF means the legacy handler still answers (nothing changes
 * for the owner), ON means the runner answers. Every tool starts OFF; a family goes live only at its own go-live step.
 * PURE: no clock, no randomness, no storage. Never throws and never rejects. Never changes `args` or `deps`.
 * It does not choose the tool (Resolution does, FL12) and does not build the arguments (the binder, C1 part 2).
 */

import type { RunnerArgs, RunnerDeps, RunnerOutcome, ToolRunner } from './runnerTypes';
import { runnerFail } from './runnerTypes';
import { TEXT_RUNNERS } from './textRunners';
import { NUMBER_RUNNERS } from './numberRunners';
import { TIME_RUNNERS } from './timeRunners';
import { CREATE_RUNNERS } from './createRunners';

export type RunnerMode = 'legacy' | 'runner';
/** tool id -> mode. A tool that is absent, or has any value other than 'runner', is LEGACY. */
export type RunnerSwitches = Readonly<Record<string, RunnerMode>>;

export const ALL_RUNNERS: readonly ToolRunner[] = Object.freeze([
  ...TEXT_RUNNERS, ...NUMBER_RUNNERS, ...TIME_RUNNERS, ...CREATE_RUNNERS,
]);

/** Every tool OFF. Go-live edits a COPY of this per family; this object itself never changes. */
export const DEFAULT_SWITCHES: RunnerSwitches = Object.freeze({});

export type Execution =
  | { readonly route: 'legacy'; readonly toolId: string; readonly why: 'switch-off' | 'no-runner' }
  | { readonly route: 'runner'; readonly toolId: string; readonly outcome: RunnerOutcome };

export function findRunner(toolId: string, registry: readonly ToolRunner[] = ALL_RUNNERS): ToolRunner | null {
  if (typeof toolId !== 'string') return null;
  for (const r of registry) if (r.toolId === toolId) return r;
  return null;
}

export function modeFor(toolId: string, switches: RunnerSwitches = DEFAULT_SWITCHES): RunnerMode {
  if (switches === null || typeof switches !== 'object' || typeof toolId !== 'string') return 'legacy';
  return Object.prototype.hasOwnProperty.call(switches, toolId) && switches[toolId] === 'runner' ? 'runner' : 'legacy';
}

/** Tool ids that have a runner, in registry order. */
export function runnerToolIds(registry: readonly ToolRunner[] = ALL_RUNNERS): string[] {
  return registry.map((r) => r.toolId);
}

/** Decides legacy or runner; runs the runner only when the switch is ON and a runner exists. */
export async function execute(
  toolId: string,
  args: RunnerArgs,
  deps: RunnerDeps,
  switches: RunnerSwitches = DEFAULT_SWITCHES,
  registry: readonly ToolRunner[] = ALL_RUNNERS,
): Promise<Execution> {
  const runner = findRunner(toolId, registry);
  if (runner === null) return { route: 'legacy', toolId, why: 'no-runner' };
  if (modeFor(toolId, switches) !== 'runner') return { route: 'legacy', toolId, why: 'switch-off' };
  try {
    const outcome = await runner.run(args, deps);
    return { route: 'runner', toolId, outcome };
  } catch {
    return { route: 'runner', toolId, outcome: runnerFail(toolId, 'engine-refused', 'The tool could not complete the request.') };
  }
}
