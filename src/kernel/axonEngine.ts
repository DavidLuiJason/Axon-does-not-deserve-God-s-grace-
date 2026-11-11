/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The one task engine the app uses, with its real actions registered.
 * Test actions never go here.
 */

import { readDeviceProfile } from './deviceProfile';
import { createTaskEngine, type TaskEngine, type TaskEngineOptions } from './taskEngine';
import { TEXT_COUNT_ACTION } from './textCount';
import { TEXT_CASE_ACTION } from '../tools/textCaseAction';
import { TEXT_SORT_ACTION } from '../tools/textSortAction';
import { NUMBER_WORDS_ACTION } from '../tools/numberWordsAction';
import { ENCODE_ACTION } from '../tools/encodeAction';
import { HASH_ACTION } from '../tools/hashAction';

export function createAxonEngine(options: TaskEngineOptions = {}): TaskEngine {
  const engine = createTaskEngine({ readProfile: () => readDeviceProfile(), ...options });
  engine.registerAction(TEXT_COUNT_ACTION);
  engine.registerAction(TEXT_CASE_ACTION);
  engine.registerAction(TEXT_SORT_ACTION);
  engine.registerAction(NUMBER_WORDS_ACTION);
  engine.registerAction(ENCODE_ACTION);
  engine.registerAction(HASH_ACTION);
  return engine;
}

let shared: TaskEngine | null = null;

export function getAxonEngine(): TaskEngine {
  if (!shared) shared = createAxonEngine();
  return shared;
}
