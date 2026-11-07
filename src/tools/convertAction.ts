/**
 * CONNECT1-B proposed action. Not registered; the Director registers it with the chat action and switch.
 */
import type { ActionDef } from '../kernel/types';
import { convert } from './converter/convert';
import { CONVERTER_KINDS } from './converter/kinds';
export const CONVERT_ACTION: ActionDef = {
  id: 'convert.run', capabilityId: 'conversion-tools', // DIRECTOR TO CONFIRM: toolCatalog.ts is not in this mini-base.
  label: 'Convert value', executionClass: 'instant',
  inputFields: [
    { name: 'from', type: 'string', required: true, prompt: 'Which source unit or format?' },
    { name: 'to', type: 'string', required: true, prompt: 'Which target unit or format?' },
    { name: 'input', type: 'string', required: true, prompt: 'What value should I convert?' },
    { name: 'text', type: 'string', required: false, prompt: 'Optional structured text input.' },
    { name: 'delimiter', type: 'string', required: false, prompt: 'Optional CSV delimiter.' },
    { name: 'header', type: 'boolean', required: false, prompt: 'Does the data include a header row?' },
    { name: 'detectTypes', type: 'boolean', required: false, prompt: 'Should data types be detected?' },
    { name: 'rootName', type: 'string', required: false, prompt: 'Optional root name for the output.' },
    { name: 'indent', type: 'string', required: false, prompt: 'Choose 2 or 4 spaces for indentation.' },
    { name: 'image', type: 'string', required: false, prompt: 'Image file input is not supported by this text action.' },
    { name: 'toFormat', type: 'string', required: false, prompt: 'Optional output format for file conversion.' },
    { name: 'maxSide', type: 'number', required: false, prompt: 'Optional maximum image side.' },
    { name: 'html', type: 'string', required: false, prompt: 'Optional HTML source.' },
  ],
  outputFields: [{ name: 'value', type: 'string' }], resources: {}, cancel: 'none',
  evidence: 'The converter engine returned the converted value for the selected source and target.',
  run: async input => {
    const from = String(input.from); const to = String(input.to); const value = String(input.input);
    const matches = CONVERTER_KINDS.filter(k => k.units.some(u => u.id === from) && k.units.some(u => u.id === to));
    if (matches.length !== 1) throw new Error('Converter refused: source and target do not identify exactly one conversion kind');
    if (input.image !== undefined || input.maxSide !== undefined || input.toFormat !== undefined) throw new Error('Converter refused: file and image conversion are not available in a text action');
    if (input.text !== undefined || input.delimiter !== undefined || input.header !== undefined || input.html !== undefined) throw new Error('Converter refused: the runner does not support these optional input slots for this engine path');
    const options: { detectTypes?: boolean; rootName?: string; indent?: 2 | 4 } = {};
    if (input.detectTypes !== undefined) options.detectTypes = Boolean(input.detectTypes);
    if (input.rootName !== undefined) options.rootName = String(input.rootName);
    if (input.indent !== undefined) { if (input.indent !== '2' && input.indent !== '4') throw new Error('Converter refused: indentation must be 2 or 4'); options.indent = Number(input.indent) as 2 | 4; }
    const result = convert({ kind: matches[0]!.id, from, to, input: value, ...(Object.keys(options).length ? { options } : {}) });
    if (!result.ok) throw new Error('Converter refused: ' + result.error);
    return { value: result.value };
  }
};
