// The brain boundary (FL12) forbids importing src/brain here, so the guard type is declared locally; it must stay the same shape as LaneGuard in src/brain/mind/directLane.ts.
type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;

const ACTIONS: Readonly<Record<string, true>> = Object.freeze({
  pick: true, choose: true, select: true, shuffle: true, roll: true,
  flip: true, randomize: true, draw: true, split: true
});
const PROBABILITY: Readonly<Record<string, true>> = Object.freeze({
  probability: true, odds: true, likelihood: true, chance: true
});
const OPERATIONS: Readonly<Record<string, true>> = Object.freeze({
  pick: true, shuffle: true, 'coin-flip': true, 'roll-dice': true,
  'random-integer': true, 'split-teams': true
});

function wordsOf(value: string): string[] {
  const words: string[] = [];
  let word = '';
  for (const char of value.toLowerCase()) {
    const code = char.charCodeAt(0);
    if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) word += char;
    else if (word) { words.push(word); word = ''; }
  }
  if (word) words.push(word);
  return words;
}

function hasAny(words: readonly string[], set: Readonly<Record<string, true>>): boolean {
  return words.some(word => Object.prototype.hasOwnProperty.call(set, word));
}

function itemCount(value: string): number {
  return value.split(String.fromCharCode(10)).join(',').split(',')
    .map(item => item.trim()).filter(Boolean).length;
}

export const randomPickerGuard: LaneGuard = (args, message) => {
  const operation = args.operation;
  if (typeof operation !== 'string' || !Object.prototype.hasOwnProperty.call(OPERATIONS, operation)) {
    return 'the random operation is not supported';
  }
  const words = wordsOf(message);
  if (hasAny(words, PROBABILITY)) return 'the request asks about probability rather than asking the picker to act';
  if (!hasAny(words, ACTIONS)) return 'the request does not clearly ask for a random selection or draw';
  if (operation === 'pick' || operation === 'shuffle' || operation === 'split-teams') {
    if (typeof args.items !== 'string') return 'a list of items is required';
    if (itemCount(args.items) < 2) return 'at least two items are required for this operation';
  }
  if (operation === 'roll-dice' && typeof args.items !== 'string') return 'dice notation is required';
  if (operation === 'random-integer' && typeof args.items !== 'string') return 'a minimum and maximum are required';
  return null;
};
