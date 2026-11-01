/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B05 part D2a DIALOGUE DRIVER (Director, 2026-11-01). SHADOW STEP: the Mind keeps the dialogue state, records every turn and
 * writes a real trace entry, but NO reply changes (nothing asks a question yet; that is D2b). Pure: state in, new state out.
 *
 * PARKING RULE (owner, 2026-11-01): when the owner changes topic while a question is open, AXON follows the NEW topic and keeps the
 * open question PARKED (it stays pending until it expires after PENDING_LIFE turns), so it can be mentioned afterwards (D2b).
 * Only an answer or a cancel clears it. A new request never does.
 */
import { readAnswer, type AnswerReading } from './dialogueAnswer';
import { clearPending } from './dialogueState';
import type { DialogueState, TurnOutcome } from './dialogueTypes';
import type { PieceResolution } from '../resolve/clauseInputsTypes';

/** How the Mind lets the dialogue stage read and write the one state of this chat. */
export interface DialogueHost {
  get(): DialogueState;
  set(next: DialogueState): void;
}

export interface DialogueStep {
  readonly reading: AnswerReading;
  readonly state: DialogueState;
  /** True when a new request arrived while a question was open and the question was kept. */
  readonly parked: boolean;
  /** One plain trace sentence. */
  readonly note: string;
}

/** True when Resolution found a tool (a match, an unavailable tool or a question about which tool): the message is a whole new request. */
export function readsAsRequest(resolutions: readonly PieceResolution[] | undefined): boolean {
  if (!resolutions) return false;
  for (const item of resolutions) {
    const kind = item.resolution.kind;
    if (kind === 'match' || kind === 'unavailable' || kind === 'ask') return true;
  }
  return false;
}

/** The turn to record: the first tool Resolution found. A match counts as answered, an unavailable tool as declined, a tool question as asked. */
export function turnFromResolutions(resolutions: readonly PieceResolution[] | undefined): { tool: string | null; outcome: TurnOutcome } {
  if (resolutions) {
    for (const item of resolutions) {
      const resolution = item.resolution;
      if (resolution.kind === 'match') return { tool: resolution.tool, outcome: 'answered' };
      if (resolution.kind === 'unavailable') return { tool: resolution.tool, outcome: 'declined' };
      if (resolution.kind === 'ask') return { tool: null, outcome: 'asked' };
    }
  }
  return { tool: null, outcome: 'none' };
}

/** Reads the message against the pending question and returns the new state. SHADOW: it only moves the pending question, it never makes a reply. */
export function stepDialogue(state: DialogueState, text: string, newRequest: boolean): DialogueStep {
  const reading = readAnswer(state, text, { newRequest });
  if (reading.kind === 'none') return { reading, state, parked: false, note: `shadow: no pending question (${state.turnCount} turns so far)` };
  if (reading.kind === 'answers') return { reading, state: clearPending(state), parked: false, note: 'shadow: the message answers the pending question; cleared' };
  if (reading.kind === 'cancels') return { reading, state: clearPending(state), parked: false, note: 'shadow: the owner cancelled the pending question; cleared' };
  if (reading.kind === 'new-topic') return { reading, state, parked: true, note: 'shadow: a new request came while a question was open; the question stays parked' };
  return { reading, state, parked: false, note: 'shadow: unclear reply; the pending question stays' };
}
