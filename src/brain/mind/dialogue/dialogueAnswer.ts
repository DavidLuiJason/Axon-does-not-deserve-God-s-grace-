/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B05 part D1 ANSWER-TO-PENDING reader (Director, 2026-11-01). Pure: given the dialogue state and the owner's next message, say
 * whether it ANSWERS the pending question, CANCELS it, starts a NEW TOPIC, or is UNCLEAR. No word lists (FL13): the only words
 * known are the two closed sets already in the app (`CANCEL_WORDS` in followUpWords.ts, and yes/y/no/n as in asking.ts). Anything
 * else is decided by STRUCTURE (a number, an option's own name, quote marks) or by the caller telling us the message is a whole
 * new request (`newRequest`, which the pipeline knows from Resolution). Nothing calls this yet (wiring is D5).
 *
 * Q7 (Director default): while a yes/no or confirm question is pending, "no" is the ANSWER (false), not a cancel.
 * Not covered on purpose: ordinals ("the first one"), "yeah", "ok": each would be a word list, so each needs the owner's yes.
 */
import { CANCEL_WORDS } from '../../followUpWords';
import { PENDING_LIFE, MAX_TEXT, type DialogueState, type PendingQuestion } from './dialogueTypes';

export type AnswerVia = 'number' | 'name' | 'yes-no' | 'text';
export type AnswerReading =
  /** Nothing is pending (or it expired). */
  | { readonly kind: 'none' }
  /** The message answers the question. `index` is the chosen option (0-based) for a choice, else null. */
  | { readonly kind: 'answers'; readonly value: string | boolean; readonly via: AnswerVia; readonly index: number | null }
  | { readonly kind: 'cancels' }
  | { readonly kind: 'new-topic' }
  | { readonly kind: 'unclear' };

export interface AnswerContext {
  /** True when the pipeline read the message as a whole new request (Resolution found a tool, or the binder ran). */
  readonly newRequest?: boolean;
}

const YES = new Set(['yes', 'y']);
const NO = new Set(['no', 'n']);
const QUOTE_PAIRS: readonly (readonly [string, string])[] = [['"', '"'], ['\u201C', '\u201D']];

/** Lower case, trimmed, without the closing . ! or ? marks. (No regular expressions in the mind folder: tests/mindPipeline.test.ts.) */
function normalize(text: string): string {
  let out = text.trim().toLowerCase();
  while (out.length > 0 && '.!?'.includes(out.charAt(out.length - 1))) out = out.slice(0, -1);
  return out.trim();
}

/** True for a non-empty run of the digits 0 to 9. */
function isDigits(text: string): boolean {
  if (text === '') return false;
  for (const ch of text) if (ch < '0' || ch > '9') return false;
  return true;
}

function unwrapQuotes(text: string): string {
  for (const [open, close] of QUOTE_PAIRS) {
    if (text.length >= 2 && text.startsWith(open) && text.endsWith(close)) return text.slice(open.length, text.length - close.length).trim();
  }
  return text;
}

/** The pending question, only while it is still alive (it expires PENDING_LIFE turns after it was asked). */
export function livePending(state: DialogueState): PendingQuestion | null {
  const pending = state.pending;
  if (pending === null) return null;
  return state.turnCount - pending.askedTurn < PENDING_LIFE ? pending : null;
}

export function readAnswer(state: DialogueState, text: string, context: AnswerContext = {}): AnswerReading {
  const pending = livePending(state);
  if (pending === null) return { kind: 'none' };
  const raw = typeof text === 'string' ? text.trim() : '';
  const norm = normalize(raw);
  if (norm === '') return { kind: 'unclear' };

  if (pending.kind === 'yes-no' || pending.kind === 'confirm') {
    if (YES.has(norm)) return { kind: 'answers', value: true, via: 'yes-no', index: null };
    if (NO.has(norm)) return { kind: 'answers', value: false, via: 'yes-no', index: null };
  }
  if (CANCEL_WORDS.has(norm)) return { kind: 'cancels' };

  if (pending.kind === 'choice') {
    if (isDigits(norm)) {
      const chosen = pending.options[Number(norm) - 1];
      if (chosen !== undefined) return { kind: 'answers', value: chosen, via: 'number', index: Number(norm) - 1 };
    } else {
      const index = pending.options.findIndex((option) => option.toLowerCase() === norm);
      const chosen = pending.options[index];
      if (chosen !== undefined) return { kind: 'answers', value: chosen, via: 'name', index };
    }
  }
  if (pending.kind === 'text-slot' && context.newRequest !== true) {
    const value = unwrapQuotes(raw).slice(0, MAX_TEXT);
    return value === '' ? { kind: 'unclear' } : { kind: 'answers', value, via: 'text', index: null };
  }
  return context.newRequest === true ? { kind: 'new-topic' } : { kind: 'unclear' };
}
