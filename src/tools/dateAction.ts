/** Wave 4: task action for the stateless Date Calculator. It delegates to the existing date runner. */
import type { ActionDef } from '../kernel/types';
import { TIME_RUNNERS } from './runners/timeRunners';

const DATE_RUNNER = TIME_RUNNERS.find((runner) => runner.toolId === 'date-calculator');

export const DATE_ACTION: ActionDef = {
  id: 'date.calculate',
  capabilityId: 'axon-tools',
  label: 'Calculate calendar dates',
  executionClass: 'instant',
  inputFields: [
    { name: 'operation', type: 'string', required: true, prompt: 'Choose a calendar operation.' },
    { name: 'date', type: 'string', required: true, prompt: 'Provide a date in YYYY-MM-DD form.' },
    { name: 'otherDate', type: 'string', required: false, prompt: 'Provide the second date in YYYY-MM-DD form.' },
    { name: 'amount', type: 'number', required: false, prompt: 'Provide the number of calendar units.' },
    { name: 'unit', type: 'string', required: false, prompt: 'Choose years, months or days.' },
  ],
  outputFields: [{ name: 'reply', type: 'string' }],
  resources: {},
  cancel: 'none',
  evidence: 'The existing Date Calculator runner completed the requested stateless calendar operation.',
  run: async (input) => {
    if (!DATE_RUNNER) throw new Error('Date Calculator runner is unavailable.');
    const outcome = await DATE_RUNNER.run(input, {
      now: 0,
      randomBelow: () => 0,
      random01: () => 0,
    });
    if (!outcome.ok) throw new Error(`Date Calculator refused: ${outcome.message}`);
    return { reply: outcome.reply };
  },
};
