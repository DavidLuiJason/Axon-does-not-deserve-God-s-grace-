/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LIVE8-1: the kernel task action for Case Converter, so a chat run is recorded as a TASK exactly like Text Counter's (`text.count`).
 * It runs the SAME pure engine as the screen and the runner (FL14). It is NOT registered in `axonEngine.ts` yet: a registered kernel action
 * needs an 'available' chat action (tests/capabilityTruth.test.ts), and chat must not claim Case Converter before the switch is on (FL10).
 * Registration, the registry chat action and the `LIVE_TASKS` entry arrive together with the switch (LIVE8-3).
 */
import type { ActionDef } from '../kernel/types';
import { caseConvert, type CaseConvertMode } from './engines/text/caseConvert';

export const TEXT_CASE_ACTION: ActionDef = {
  id: 'text.case',
  capabilityId: 'text-tools',
  label: 'Convert text case',
  executionClass: 'instant',
  inputFields: [
    { name: 'text', type: 'string', required: true, prompt: 'What text should I convert? Paste or type it and send it.' },
    { name: 'mode', type: 'string', required: true, prompt: 'Which style should I convert it to? For example upper, lower, title, sentence, camel, pascal, snake, kebab or constant.' },
  ],
  outputFields: [{ name: 'text', type: 'string' }],
  resources: {},
  cancel: 'none',
  evidence: 'The task ended COMPLETED and the converted text was computed from the exact text and style it was given.',
  run: async (input) => {
    const result = caseConvert(String(input.text), String(input.mode) as CaseConvertMode);
    if (!result.ok) throw new Error(`Case Converter refused: ${result.error}`);
    return { text: result.text };
  },
};
