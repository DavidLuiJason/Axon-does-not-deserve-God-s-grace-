/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The one Brain the app uses, with its sources wired in. New sources and new
 * commands are added here and nowhere else.
 */

import { getAxonEngine } from '../kernel/axonEngine';
import { PLANNED_SOURCES } from './brain';
import { createMind, type Mind } from './mind';
import { createFoundation } from './foundation';
import { createUserLexicon, type KeyValueStore, type UserLexicon } from './lexicon';
import { createLocalRules } from './localRules';
import { createDictionaryProvider } from './knowledge/dictionaryProvider';
import { TEXT_COUNT_COMMAND } from './textCountCommand';
import { answerAbilityQuestion, answerRequestFallback, describeAbilities } from './abilities';
import { buildLiveFacts } from './mind/resolve/liveFacts';
import { CATALOG_TOOLS } from '../tools/toolCatalog';
import { LEFT_OUT_TOOL_IDS } from '../tools/leftOutTools';
import { ABILITY_SOURCES, CHAT_ACTION_LINKS } from '../tools/toolFactSources';
import { listCapabilities } from '../capabilities';
import { execute } from '../tools/runners/runnerRegistry';
import { LIVE_CHOICES, LIVE_SWITCHES, LIVE_TASKS, STATE_TOOL_IDS } from '../tools/runners/liveSwitches';
import type { RunnerSwitches } from '../tools/runners/runnerRegistry';
import { LANE_GUARDS } from './mind/laneGuards';
import type { LaneConfig } from './mind/directLane';
import type { KnowledgeSlot } from './knowledge/slot';

export const BRAIN_COMMANDS = [TEXT_COUNT_COMMAND];
const BRAIN_PROVIDERS = [createDictionaryProvider()];
export const BRAIN_PROVIDER_IDS = BRAIN_PROVIDERS.map((provider) => provider.id);

let shared: Mind | null = null;
let sharedLexicon: UserLexicon | null = null;

function phoneStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The owner's taught meanings (user data, kept on this phone only). */
export function getUserLexicon(): UserLexicon {
  if (!sharedLexicon) sharedLexicon = createUserLexicon(phoneStorage());
  return sharedLexicon;
}

/** LIVE2: the direct lane's wiring (docs/LIVE0_DESIGN.md). Switches come from the one pinned file; the lane yields to the old handler in every case it is not sure about. */
export function buildLaneConfig(switches: RunnerSwitches = LIVE_SWITCHES): LaneConfig {
  return {
    isOn: (toolId) => switches[toolId] === 'runner',
    needsState: (toolId) => STATE_TOOL_IDS.includes(toolId),
    guards: LANE_GUARDS,
    run: (toolId, args, deps) => execute(toolId, args, deps, switches),
    record: async (toolId, args) => {
      const link = LIVE_TASKS[toolId];
      if (!link) return null;
      try {
        const engine = getAxonEngine();
        const submitted = await engine.submit(link.actionId, link.input(args));
        if (!submitted.ok) return null;
        const done = await engine.whenDone(submitted.task.id);
        if (done.state !== 'COMPLETED') return null;
        const ms = done.startedAt !== undefined && done.endedAt !== undefined ? Math.max(0, done.endedAt - done.startedAt) : 0;
        return { taskId: done.id, line: `Ran as task ${done.id}: ${done.state} in ${ms} ms, from your exact input.` };
      } catch { return null; }
    },
    choicesFor: (toolId) => LIVE_CHOICES[toolId] ?? {},
    toolNameFor: (toolId) => CATALOG_TOOLS.find((tool) => tool.id === toolId)?.name ?? toolId,
    deps: () => ({ now: Date.now(), randomBelow: () => 0, random01: () => 0 }),
  };
}

/** The one Brain, built fresh. `lane: false` is exactly the brain as it was before LIVE2 (used by the proof test); the app uses `getAxonBrain`. */
export function createAxonBrain(options: { lane: boolean; slot?: KnowledgeSlot; switches?: RunnerSwitches } = { lane: true }): Mind {
  const localRules = createLocalRules({
    commands: BRAIN_COMMANDS,
    engine: getAxonEngine(),
    planned: PLANNED_SOURCES,
    lexicon: getUserLexicon(),
    abilities: {
      describe: () => describeAbilities({ lexiconExists: true }),
      answer: answerAbilityQuestion,
    },
  });
  return createMind({ providers: [localRules, ...BRAIN_PROVIDERS], fallback: createFoundation({ abilities: { answerRequestFallback } }), planned: PLANNED_SOURCES, ...(options.slot ? { slot: options.slot } : {}), ...(options.lane ? { lane: buildLaneConfig(options.switches) } : {}), liveFacts: () => buildLiveFacts({ catalog: CATALOG_TOOLS, capabilities: listCapabilities(), abilities: ABILITY_SOURCES, leftOut: LEFT_OUT_TOOL_IDS, chatLinks: CHAT_ACTION_LINKS }) });
}

export function getAxonBrain(): Mind {
  if (!shared) shared = createAxonBrain({ lane: true });
  return shared;
}
