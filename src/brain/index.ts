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

export function getAxonBrain(): Mind {
  if (!shared) {
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
    shared = createMind({ providers: [localRules, ...BRAIN_PROVIDERS], fallback: createFoundation({ abilities: { answerRequestFallback } }), planned: PLANNED_SOURCES, liveFacts: () => buildLiveFacts({ catalog: CATALOG_TOOLS, capabilities: listCapabilities(), abilities: ABILITY_SOURCES, leftOut: LEFT_OUT_TOOL_IDS, chatLinks: CHAT_ACTION_LINKS }) });
  }
  return shared;
}
