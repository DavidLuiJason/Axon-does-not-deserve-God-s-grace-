/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B05 part D0 DIALOGUE STATE: the CONTRACT. Written by the Director (2026-11-01). The builder reads it and never changes it.
 *
 * WHAT IT IS: the short memory of ONE chat, kept small on purpose: the last few turns, ONE pending question, and the topic.
 * Everything here is pure data in, new data out (no clock, no storage, no dictionary, no screen): the caller gives `at`.
 * D0 changes NO behaviour: nothing reads this yet. D1 (answer to a pending question), D2 (speak the question), D3 (it, that,
 * more, again) and D5 (wiring) come later (docs/B05_PLAN.md).
 *
 * RULES (docs/B05_PLAN.md, owner questions Q5 to Q7, Director defaults): a new chat starts with `emptyDialogue()`; the state is
 * NOT saved across app restarts (serialise and restore exist for tests and the trace only); a pending question lives 3 turns.
 * No word lists: nothing here looks at what the owner said, it only keeps it (clipped).
 */

export const DIALOGUE_VERSION = 1;
/** Hard caps, so the state stays small on a weak phone. */
export const MAX_TURNS = 8;
export const MAX_TEXT = 500;
export const MAX_ARGS = 6;
export const MAX_ARG_VALUE = 200;
export const MAX_RESULT = 200;
export const MAX_OPTIONS = 4;
export const MAX_OPTION = 80;
/** A pending question is dropped when this many turns have passed since it was asked without it being answered or cleared. */
export const PENDING_LIFE = 3;

/** The closed LABELS of the data format (not vocabulary: nothing is matched against what the owner says). One string each. */
export const PENDING_KIND_LABELS = 'choice text-slot yes-no confirm';
export const OUTCOME_LABELS = 'answered asked declined none';

/** choice: pick one of 2 to 4 options. text-slot: a missing piece of text for `slot`. yes-no and confirm: a yes or no. */
export type PendingKind = 'choice' | 'text-slot' | 'yes-no' | 'confirm';
/** answered: a tool gave a result. asked: AXON asked a question. declined: AXON said it cannot or will not. none: nothing happened (chat, greeting). */
export type TurnOutcome = 'answered' | 'asked' | 'declined' | 'none';

export interface TurnRecord {
  /** The turn id given by the caller (for example the utterance id). */
  readonly id: string;
  /** The caller's time stamp. */
  readonly at: number;
  /** What the owner said, trimmed and clipped to MAX_TEXT. */
  readonly text: string;
  /** The tool the turn was about, or null. */
  readonly tool: string | null;
  readonly outcome: TurnOutcome;
  /** The values the tool was given (at most MAX_ARGS, each clipped to MAX_ARG_VALUE). */
  readonly args: Readonly<Record<string, string>>;
  /** A short reference to what the turn produced (clipped to MAX_RESULT), or null. Never the full result. */
  readonly result: string | null;
}

export interface PendingQuestion {
  readonly kind: PendingKind;
  /** The question as shown to the owner, trimmed and clipped to MAX_TEXT. */
  readonly question: string;
  /** For a choice: 2 to MAX_OPTIONS options, best first. Empty for every other kind. */
  readonly options: readonly string[];
  /** For a text-slot: the name of the missing slot. null for every other kind. */
  readonly slot: string | null;
  /** The tool the answer is for, or null. */
  readonly tool: string | null;
  /** The value of `turnCount` when the question was asked. */
  readonly askedTurn: number;
}

export interface DialogueState {
  readonly version: number;
  /** The last MAX_TURNS turns, oldest first. */
  readonly turns: readonly TurnRecord[];
  /** At most ONE pending question. */
  readonly pending: PendingQuestion | null;
  /** The tool of the most recent ANSWERED turn, or null. Asking or declining does not change it. */
  readonly topic: string | null;
  /** How many turns were recorded in this chat in total (not capped). */
  readonly turnCount: number;
}

/** What the caller gives to `setPending` (the state adds `askedTurn`). */
export interface PendingInput {
  readonly kind: PendingKind;
  readonly question: string;
  readonly options?: readonly string[];
  readonly slot?: string | null;
  readonly tool?: string | null;
}

/** What the caller gives to `recordTurn`. */
export interface TurnInput {
  readonly id: string;
  readonly at: number;
  readonly text: string;
  readonly tool?: string | null;
  readonly outcome: TurnOutcome;
  readonly args?: Readonly<Record<string, string>>;
  readonly result?: string | null;
}
