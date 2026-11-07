/**
 * CONNECT1-B proposed action. Not registered; the Director registers it with the chat action and switch.
 */
import type { ActionDef } from '../kernel/types';
import { textCompare } from './engines/text/textCompare';
export const TEXT_COMPARE_ACTION: ActionDef = {
  id: 'text.compare', capabilityId: 'text-tools', label: 'Compare text', executionClass: 'instant',
  inputFields: [
    { name: 'original', type: 'string', required: true, prompt: 'Paste the first text.' },
    { name: 'revised', type: 'string', required: true, prompt: 'Paste the second text.' },
    { name: 'mode', type: 'string', required: true, prompt: 'Compare by line or word?' }
  ],
  outputFields: [{ name: 'differences', type: 'string' }, { name: 'same', type: 'number' }, { name: 'add', type: 'number' }, { name: 'remove', type: 'number' }], resources: {}, cancel: 'none',
  evidence: 'The text comparison engine returned the differences between the two supplied texts.',
  run: async input => { const r = textCompare(String(input.original), String(input.revised), String(input.mode) as 'line'|'word'); if (!r.ok) throw new Error('Text Compare refused: ' + r.error); return { differences: JSON.stringify(r.differences), same: r.counts.same, add: r.counts.add, remove: r.counts.remove }; }
};
