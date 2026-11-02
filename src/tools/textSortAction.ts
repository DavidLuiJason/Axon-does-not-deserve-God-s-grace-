/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LIVE9-1: the kernel task action for Sort Lines, so a chat run is recorded as a TASK exactly like Text Counter's and Case Converter's.
 * It runs the SAME pure engine as the screen and the runner (FL14). It is NOT registered in `axonEngine.ts` yet: a registered kernel action
 * needs an 'available' chat action (tests/capabilityTruth.test.ts), and chat must not claim Sort Lines before the switch is on (FL10).
 * Registration, the chat action and the `LIVE_TASKS` entry arrive together with the switch (LIVE9-3).
 */
import type { ActionDef } from '../kernel/types';
import { sortLines, type SortLineMode } from './engines/text/sortLines';

export const TEXT_SORT_ACTION: ActionDef = {
  id: 'text.sort',
  capabilityId: 'text-tools',
  label: 'Sort lines',
  executionClass: 'instant',
  inputFields: [
    { name: 'text', type: 'string', required: true, prompt: 'Which lines should I sort? Paste or type them, one per line, and send them.' },
    { name: 'mode', type: 'string', required: false, prompt: 'How should I sort them? For example ascending, descending, by length, natural, reverse or shuffle.' },
  ],
  outputFields: [{ name: 'text', type: 'string' }, { name: 'lineCount', type: 'number' }],
  resources: {},
  cancel: 'none',
  evidence: 'The task ended COMPLETED and the sorted lines were computed from the exact text and mode it was given.',
  run: async (input) => {
    const mode = input.mode === undefined ? undefined : (String(input.mode) as SortLineMode);
    const result = sortLines(String(input.text), mode === undefined ? {} : { mode }, mode === 'shuffle' ? Math.random : undefined);
    if (!result.ok) throw new Error(`Sort Lines refused: ${result.error}`);
    return { text: result.text, lineCount: result.lineCount };
  },
};
