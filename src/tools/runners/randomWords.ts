/** PROPOSED, the owner's yes is WAITING. */
export type RandomOperation = 'pick' | 'shuffle' | 'coin-flip' | 'roll-dice' | 'random-integer' | 'split-teams';

export const RANDOM_OPERATION_WORDS: Readonly<Record<string, RandomOperation>> = Object.freeze({
  pick: 'pick',
  choose: 'pick',
  flip: 'coin-flip',
  toss: 'coin-flip',
  roll: 'roll-dice',
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

const LIST_OPERATIONS: Readonly<Record<string, true>> = Object.freeze({ pick: true, shuffle: true, 'split-teams': true });

/** the items as the runner reads them: a JSON list of strings (the runner splits a plain text only by lines, the person writes commas) */
export function itemList(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) { try { const parsed: unknown = JSON.parse(trimmed); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : []; } catch { return []; } }
  return value.split(String.fromCharCode(10)).join(',').split(',').map((item) => item.trim()).filter((item) => item !== '');
}

/** Lane step (Director 471): fold the spoken operation word to the engine word and give list operations their items as a JSON list. */
export function normaliseRandomArgs(args: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const operation = foldRandomOperation(args.operation);
  const next: Record<string, unknown> = { ...args, operation };
  if (typeof operation === 'string' && Object.prototype.hasOwnProperty.call(LIST_OPERATIONS, operation) && typeof args.items === 'string') next.items = JSON.stringify(itemList(args.items));
  return next;
}
/** the items as plain lines, for the task record */
export function itemLines(value: unknown): string { return itemList(value).join(String.fromCharCode(10)); }
