/** PROPOSED, the owner's yes is WAITING. */
export type RandomOperation = 'pick' | 'shuffle' | 'coin-flip' | 'roll-dice' | 'random-integer' | 'split-teams';

export const RANDOM_OPERATION_WORDS: Readonly<Record<string, RandomOperation>> = Object.freeze({
  pick: 'pick',
  choose: 'pick',
  shuffle: 'shuffle',
  'coin-flip': 'coin-flip',
  'flip-coin': 'coin-flip',
  'roll-dice': 'roll-dice',
  'random-integer': 'random-integer',
  'split-teams': 'split-teams'
});
export const RANDOM_OPERATION_CHOICES: readonly string[] = Object.freeze(Object.keys(RANDOM_OPERATION_WORDS));

export function foldRandomOperation(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const key = value.toLowerCase();
  return Object.prototype.hasOwnProperty.call(RANDOM_OPERATION_WORDS, key) ? RANDOM_OPERATION_WORDS[key] : value;
}
