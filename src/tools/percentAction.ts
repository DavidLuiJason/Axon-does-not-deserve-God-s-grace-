/**
 * CONNECT1-B proposed action. Not registered; the Director registers it with the chat action and switch.
 */
import type { ActionDef } from '../kernel/types';
import { percentage, type PercentageMode } from './engines/numbers/percentage';

const REQUIRED_KEYS: Readonly<Record<string, readonly string[]>> = {
  'percent-of': ['x', 'y'],
  'what-percent': ['x', 'y'],
  change: ['a', 'b'],
  adjust: ['x', 'y'],
  'percent-of-what': ['x', 'y']
};

function validNumericValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /^[+-]?\d+(?:\.\d+)?$/.test(trimmed) && trimmed.length <= 100;
}

export const PERCENT_ACTION: ActionDef = {
  id: 'number.percent',
  capabilityId: 'number-tools', // DIRECTOR TO CONFIRM: toolCatalog.ts is not in this mini-base.
  label: 'Percentage helper',
  executionClass: 'instant',
  inputFields: [
    { name: 'mode', type: 'string', required: true, prompt: 'Which percentage operation?' },
    { name: 'values', type: 'string', required: true, prompt: 'Provide the required values as a JSON object.' }
  ],
  outputFields: [
    { name: 'value', type: 'number' },
    { name: 'formatted', type: 'string' }
  ],
  resources: {},
  cancel: 'none',
  evidence: 'The percentage engine returned the result for the selected operation and numeric values.',
  run: async input => {
    let values: unknown;
    try {
      values = typeof input.values === 'string' ? JSON.parse(input.values) : input.values;
    } catch {
      throw new Error('Percentage Helper refused: invalid values');
    }
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new Error('Percentage Helper refused: invalid values');
    }
    const mode = String(input.mode) as PercentageMode;
    const keys = REQUIRED_KEYS[mode];
    if (!keys) throw new Error('Percentage Helper refused: invalid-mode');
    const record = values as Record<string, unknown>;
    if (Object.keys(record).length !== keys.length) {
      throw new Error('Percentage Helper refused: invalid-value');
    }
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(record, key) || !validNumericValue(record[key])) {
        throw new Error('Percentage Helper refused: invalid-value');
      }
    }
    const result = percentage(mode, record as Record<string, number | string>);
    if (!result.ok) throw new Error('Percentage Helper refused: ' + result.error);
    return { value: result.value, formatted: result.formatted };
  }
};
