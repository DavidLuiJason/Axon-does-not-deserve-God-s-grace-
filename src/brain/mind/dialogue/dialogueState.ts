/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B05 part D0 DIALOGUE STATE: pure functions over the contract in `dialogueTypes.ts`. No clock, storage or I/O; every function
 * returns a NEW state and never changes its input. Invalid input never throws: the state comes back unchanged.
 */

import {
  DIALOGUE_VERSION, MAX_ARGS, MAX_ARG_VALUE, MAX_OPTION, MAX_OPTIONS, MAX_RESULT, MAX_TEXT, MAX_TURNS, OUTCOME_LABELS, PENDING_KIND_LABELS, PENDING_LIFE,
  type DialogueState, type PendingInput, type PendingKind, type PendingQuestion, type TurnInput, type TurnOutcome, type TurnRecord,
} from './dialogueTypes';

const clip = (text: string, max: number): string => text.trim().slice(0, max);
const clipOrNull = (text: string | null | undefined, max: number): string | null => {
  if (typeof text !== 'string') return null;
  const value = clip(text, max);
  return value === '' ? null : value;
};

/** The closed labels live in one string each (dialogueTypes.ts), not in a list of words (meaningNoPhrases.test.ts). */
const KINDS: readonly string[] = PENDING_KIND_LABELS.split(' ');
const OUTCOMES: readonly string[] = OUTCOME_LABELS.split(' ');

export function emptyDialogue(): DialogueState {
  return { version: DIALOGUE_VERSION, turns: [], pending: null, topic: null, turnCount: 0 };
}

function cleanArgs(args: Readonly<Record<string, string>> | undefined): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!args) return out;
  let count = 0;
  for (const key of Object.keys(args)) {
    if (count >= MAX_ARGS) break;
    const value = args[key];
    if (typeof value !== 'string') continue;
    out[key] = clip(value, MAX_ARG_VALUE);
    count += 1;
  }
  return out;
}

function cleanTurn(input: TurnInput): TurnRecord | null {
  if (typeof input.id !== 'string' || input.id.trim() === '') return null;
  if (!OUTCOMES.includes(input.outcome)) return null;
  if (typeof input.at !== 'number' || !Number.isFinite(input.at)) return null;
  return {
    id: input.id,
    at: input.at,
    text: clip(typeof input.text === 'string' ? input.text : '', MAX_TEXT),
    tool: clipOrNull(input.tool, MAX_OPTION),
    outcome: input.outcome,
    args: cleanArgs(input.args),
    result: clipOrNull(input.result, MAX_RESULT),
  };
}

/** Adds one turn: keeps the last MAX_TURNS, counts it, moves the topic on an ANSWERED turn, and drops an expired pending question. */
export function recordTurn(state: DialogueState, input: TurnInput): DialogueState {
  const turn = cleanTurn(input);
  if (turn === null) return state;
  const turnCount = state.turnCount + 1;
  const expired = state.pending !== null && turnCount - state.pending.askedTurn >= PENDING_LIFE;
  return {
    version: DIALOGUE_VERSION,
    turns: [...state.turns, turn].slice(-MAX_TURNS),
    pending: expired ? null : state.pending,
    topic: turn.outcome === 'answered' && turn.tool !== null ? turn.tool : state.topic,
    turnCount,
  };
}

function cleanPending(input: PendingInput, askedTurn: number): PendingQuestion | null {
  if (!KINDS.includes(input.kind)) return null;
  const question = clip(typeof input.question === 'string' ? input.question : '', MAX_TEXT);
  if (question === '') return null;
  const tool = clipOrNull(input.tool, MAX_OPTION);
  if (input.kind === 'choice') {
    const options = (input.options ?? []).filter((o) => typeof o === 'string').map((o) => clip(o, MAX_OPTION)).filter((o) => o !== '').slice(0, MAX_OPTIONS);
    if (options.length < 2) return null;
    return { kind: 'choice', question, options, slot: null, tool, askedTurn };
  }
  if (input.kind === 'text-slot') {
    const slot = clipOrNull(input.slot, MAX_OPTION);
    if (slot === null) return null;
    return { kind: 'text-slot', question, options: [], slot, tool, askedTurn };
  }
  return { kind: input.kind, question, options: [], slot: null, tool, askedTurn };
}

/** Sets the ONE pending question (replacing any earlier one). It counts from the turns recorded so far. Invalid input leaves the state unchanged. */
export function setPending(state: DialogueState, input: PendingInput): DialogueState {
  const pending = cleanPending(input, state.turnCount);
  return pending === null ? state : { ...state, pending };
}

export function clearPending(state: DialogueState): DialogueState {
  return state.pending === null ? state : { ...state, pending: null };
}

/** The most recent turn that produced a result reference, or null. */
export function lastResultTurn(state: DialogueState): TurnRecord | null {
  for (let i = state.turns.length - 1; i >= 0; i -= 1) {
    const turn = state.turns[i];
    if (turn !== undefined && turn.result !== null) return turn;
  }
  return null;
}

export function serialiseDialogue(state: DialogueState): string {
  return JSON.stringify(state);
}

/** Restores a state from text. Anything wrong (not JSON, another version, a wrong shape) gives the EMPTY state; the caps are applied again, so a tampered text cannot grow the state. */
export function restoreDialogue(text: string): DialogueState {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return emptyDialogue(); }
  if (typeof raw !== 'object' || raw === null) return emptyDialogue();
  const obj = raw as Record<string, unknown>;
  if (obj.version !== DIALOGUE_VERSION || !Array.isArray(obj.turns) || typeof obj.turnCount !== 'number' || !Number.isFinite(obj.turnCount) || obj.turnCount < 0) return emptyDialogue();
  const turns: TurnRecord[] = [];
  for (const item of obj.turns as unknown[]) {
    if (typeof item !== 'object' || item === null) return emptyDialogue();
    const t = item as Record<string, unknown>;
    const turn = cleanTurn({
      id: t.id as string, at: t.at as number, text: t.text as string, tool: t.tool as string | null,
      outcome: t.outcome as TurnOutcome, args: t.args as Record<string, string>, result: t.result as string | null,
    });
    if (turn === null) return emptyDialogue();
    turns.push(turn);
  }
  const turnCount = Math.floor(obj.turnCount);
  let pending: PendingQuestion | null = null;
  if (obj.pending !== null && obj.pending !== undefined) {
    if (typeof obj.pending !== 'object') return emptyDialogue();
    const p = obj.pending as Record<string, unknown>;
    if (typeof p.askedTurn !== 'number' || !Number.isFinite(p.askedTurn)) return emptyDialogue();
    pending = cleanPending({ kind: p.kind as PendingKind, question: p.question as string, options: p.options as string[], slot: p.slot as string | null, tool: p.tool as string | null }, Math.floor(p.askedTurn));
    if (pending === null) return emptyDialogue();
    if (turnCount - pending.askedTurn >= PENDING_LIFE) pending = null;
  }
  const topic = clipOrNull(obj.topic as string | null | undefined, MAX_OPTION);
  return { version: DIALOGUE_VERSION, turns: turns.slice(-MAX_TURNS), pending, topic, turnCount };
}
