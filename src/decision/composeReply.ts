type EngineSuccess<T> = { readonly ok: true; readonly value: T };
type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type PieceAnswer =
  | { readonly kind: 'answered'; readonly own: string; readonly text: string }
  | { readonly kind: 'asks'; readonly own: string; readonly question: string; readonly holdLine: string }
  | { readonly kind: 'waits'; readonly own: string; readonly line: string }
  | { readonly kind: 'failed'; readonly own: string; readonly line: string; readonly reason: string };

export type ComposedReply = {
  readonly text: string;
  readonly answered: readonly number[];
  readonly pending: number | null;
  readonly held: readonly number[];
  readonly waiting: readonly number[];
  readonly failed: readonly number[];
};

const MESSAGE = 'Reply composer input is invalid.';
const KINDS = ['answered', 'asks', 'waits', 'failed'] as const;

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<PropertyKey, unknown> {
  if (!isObject(value)) return false;
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length) return false;
  for (const key of own) {
    if (typeof key !== 'string' || !keys.includes(key)) return false;
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
  }
  return true;
}

function validString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function failure<T>(error: string): EngineResult<T> {
  return Object.freeze({ ok: false as const, error, message: MESSAGE });
}

function freezeReply(value: {
  text: string;
  answered: number[];
  pending: number | null;
  held: number[];
  waiting: number[];
  failed: number[];
}): ComposedReply {
  Object.freeze(value.answered);
  Object.freeze(value.held);
  Object.freeze(value.waiting);
  Object.freeze(value.failed);
  return Object.freeze(value);
}

function validPiece(value: unknown): value is PieceAnswer {
  if (!isObject(value) || typeof value.kind !== 'string' ||
      !KINDS.includes(value.kind as typeof KINDS[number]) || !validString(value.own)) return false;

  if (value.kind === 'answered') {
    return exactKeys(value, ['kind', 'own', 'text']) && validString(value.text);
  }
  if (value.kind === 'asks') {
    return exactKeys(value, ['kind', 'own', 'question', 'holdLine']) &&
      validString(value.question) && validString(value.holdLine);
  }
  if (value.kind === 'waits') {
    return exactKeys(value, ['kind', 'own', 'line']) && validString(value.line);
  }
  return exactKeys(value, ['kind', 'own', 'line', 'reason']) &&
    validString(value.line) && validString(value.reason);
}

export function composeReply(input: unknown): EngineResult<ComposedReply> {
  try {
    if (!isObject(input)) return failure('bad-input');
    if (!exactKeys(input, ['pieces'])) return failure('unknown-key');

    const pieces = input.pieces;
    if (!Array.isArray(pieces) || pieces.length === 0) return failure('bad-pieces');
    for (const piece of pieces) {
      if (!validPiece(piece)) return failure('bad-pieces');
    }
    if (pieces.length > 6) return failure('too-many-pieces');

    const answered: number[] = [];
    const held: number[] = [];
    const waiting: number[] = [];
    const failed: number[] = [];
    let pending: number | null = null;
    const blocks: string[] = [];
    const multi = pieces.length >= 2;
    const block = (own: string, content: string): string => multi ? `${own}: ${content}` : content;

    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i];
      if (piece.kind === 'answered') {
        answered.push(i);
        blocks.push(block(piece.own, piece.text));
      }
    }
    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i];
      if (piece.kind === 'asks') {
        if (pending === null) {
          pending = i;
          blocks.push(block(piece.own, piece.question));
        } else {
          held.push(i);
          blocks.push(block(piece.own, piece.holdLine));
        }
      }
    }
    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i];
      if (piece.kind === 'waits') {
        waiting.push(i);
        blocks.push(block(piece.own, piece.line));
      } else if (piece.kind === 'failed') {
        failed.push(i);
        blocks.push(block(piece.own, piece.line));
      }
    }

    const value = freezeReply({
      text: blocks.join('\n\n'),
      answered,
      pending,
      held,
      waiting,
      failed
    });
    return Object.freeze({ ok: true as const, value });
  } catch {
    return failure('bad-input');
  }
}
