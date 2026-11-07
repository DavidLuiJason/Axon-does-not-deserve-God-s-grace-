/**
 * CONNECT1-B proposed action. Not registered; the Director registers it with the chat action and switch.
 */
import type { ActionDef } from '../kernel/types';
import { pickRandom, shuffle, coinFlip, rollDice, randomInteger, splitTeams } from './engines/create/randomPicker';
export const RANDOM_ACTION: ActionDef = {
  id: 'create.random', capabilityId: 'creation-tools', // DIRECTOR TO CONFIRM: follows the accepted batch-one creation capability.
  label: 'Random picker', executionClass: 'instant',
  inputFields: [
    { name: 'operation', type: 'string', required: true, prompt: 'Pick, shuffle, flip a coin, roll dice, choose an integer or split teams?' },
    { name: 'items', type: 'string', required: false, prompt: 'Provide the list, dice notation or min,max bounds.' },
    { name: 'count', type: 'number', required: false, prompt: 'How many items or teams?' },
    { name: 'random', type: 'string', required: false, prompt: 'The runner receives an injected random provider; this text slot is not executable.' }
  ],
  outputFields: [{ name: 'result', type: 'string' }], resources: {}, cancel: 'none',
  evidence: 'The random picker engine returned a selection using the cryptographic random source.',
  run: async input => {
    // The runner injects deps.randomBelow, but TaskContext has no random source. The engine default is used here; the Director must resolve this injection gap before registration.
    const op = String(input.operation); const items = String(input.items ?? ''); const count = input.count === undefined ? 1 : Number(input.count);
    let r: any;
    if (op === 'coin-flip') r = coinFlip();
    else if (op === 'pick') r = pickRandom(items.split(/\r?\n|,/).map(s=>s.trim()).filter(Boolean), count, false);
    else if (op === 'shuffle') r = shuffle(items.split(/\r?\n|,/).map(s=>s.trim()).filter(Boolean));
    else if (op === 'roll-dice') r = rollDice(items);
    else if (op === 'random-integer') { const parts=items.split(',').map(Number); r = parts.length===2 ? randomInteger(parts[0]!,parts[1]!) : {ok:false,error:'invalid-range'}; }
    else if (op === 'split-teams') r = splitTeams(items.split(/\r?\n|,/).map(s=>s.trim()).filter(Boolean), count);
    else throw new Error('Random Picker refused: invalid operation');
    if (!r.ok) throw new Error('Random Picker refused: ' + r.error);
    return { result: JSON.stringify(r) };
  }
};
