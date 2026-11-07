/**
 * CONNECT1-B proposed action. Not registered; the Director registers it with the chat action and switch.
 */
import type { ActionDef } from '../kernel/types';
import { evaluate } from './engines/numbers/calculator';
export const CALCULATE_ACTION: ActionDef = {
  id: 'number.calculate', capabilityId: 'number-tools', // DIRECTOR TO CONFIRM: toolCatalog.ts is not in this mini-base.
  label: 'Calculate', executionClass: 'instant',
  inputFields: [
    { name: 'expression', type: 'string', required: true, prompt: 'What mathematical expression should I calculate?' },
    { name: 'angle', type: 'string', required: false, prompt: 'Use degrees or radians for angles?' }
  ],
  outputFields: [{ name: 'value', type: 'number' }, { name: 'formatted', type: 'string' }], resources: {}, cancel: 'none',
  evidence: 'The calculator engine evaluated the supplied expression and returned its numeric result.',
  run: async input => { const angle = input.angle === undefined ? undefined : String(input.angle) as 'deg'|'rad'; const r = evaluate(String(input.expression), angle ? { angle } : {}); if (!r.ok) throw new Error('Calculator refused: ' + r.error); return { value: r.value, formatted: r.formatted }; }
};
