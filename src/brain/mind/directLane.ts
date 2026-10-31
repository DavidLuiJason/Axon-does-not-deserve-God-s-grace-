/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LIVE1a: the DIRECT LANE (docs/LIVE0_DESIGN.md section 2). Inside stage 8 it answers through a tool runner ONLY when it is certain
 * to answer like today; in every other case it YIELDS (says why, plain words) and the legacy executor answers unchanged.
 * Pure apart from the injected `run`. It knows no tool (FL13): switches, state needs, tool guards, names and choices are injected (FL14).
 * It never throws: every problem is a yield.
 */
import type { BrainReply } from '../types';
import type { Meaning } from './types';
import type { PieceResolution } from './resolve/clauseInputsTypes';
import type { FeedSegment, FeedValue } from './bind/bindFeed';
import { buildBindInputs } from './bind/bindFeed';
import { bindArguments } from './bind/argumentBinder';
import type { RunnerArgs, RunnerDeps, RunnerOutcome } from '../../tools/runners/runnerTypes';

export type LaneRun = (toolId: string, args: RunnerArgs, deps: RunnerDeps) => Promise<{ readonly route: 'legacy' | 'runner'; readonly outcome?: RunnerOutcome }>;
/** A tool's own safe-guard: returns a plain reason to YIELD, or null when the lane may answer. */
export type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;
export interface LaneConfig {
  readonly isOn: (toolId: string) => boolean;
  readonly needsState: (toolId: string) => boolean;
  readonly guards: Readonly<Record<string, LaneGuard>>;
  readonly run: LaneRun;
  readonly choicesFor: (toolId: string) => Readonly<Record<string, readonly string[]>>;
  readonly toolNameFor: (toolId: string) => string;
  readonly deps: () => RunnerDeps;
  /** OWNER DECISION (LIVE2): false (the default) means the lane yields whenever the binder had to assume something, because the old handler would then answer differently; true answers and says the assumption aloud (the owner-approved 2026-10-28 rule). */
  readonly allowDefaults?: boolean;
}
export interface LaneInput {
  readonly message: string;
  readonly holdsConversation: boolean;
  readonly segments: readonly FeedSegment[];
  readonly values: readonly FeedValue[];
  readonly meaning?: Meaning;
  readonly resolutions?: readonly PieceResolution[];
}
export type LaneOutcome =
  | { readonly kind: 'yield'; readonly reason: string }
  | { readonly kind: 'answer'; readonly reply: BrainReply; readonly note: string };

const yields = (reason: string): LaneOutcome => ({ kind: 'yield', reason });

export async function runDirectLane(input: LaneInput, config: LaneConfig): Promise<LaneOutcome> {
  try {
    if (input.holdsConversation) return yields('a conversation is waiting on an answer');
    const meaning = input.meaning;
    const structure = meaning?.structure;
    const resolutions = input.resolutions;
    if (!meaning || !structure || !resolutions) return yields('the message was not fully read');
    if (structure.pieces.length !== 1 || meaning.clauses.length !== 1 || resolutions.length !== 1) return yields('the message has more than one piece');
    if (structure.links.length > 0) return yields('the pieces are linked');
    const clause = meaning.clauses[0]!;
    const piece = structure.pieces[0]!;
    if (clause.polarity !== 'positive') return yields('the request is negated');
    if (meaning.teaching && meaning.teaching.length > 0) return yields('the message teaches or corrects');
    if (piece.refs.relay !== null) return yields('the message passes something on');
    if (piece.refs.needsPrevious) return yields('the message needs the one before it');
    const found = resolutions[0]!;
    if (found.resolution.kind !== 'match' || found.mayRunAlone !== true || found.reading === 'alternative') return yields('no single sure tool was found');
    const tool = found.resolution.tool;
    if (!config.isOn(tool)) return yields(`the switch for ${tool} is off`);
    if (config.needsState(tool)) return yields(`${tool} needs stored state`);
    const items = buildBindInputs({
      message: input.message, segments: input.segments, structure, values: input.values, resolutions: [...resolutions],
      choicesFor: config.choicesFor, toolNameFor: config.toolNameFor,
    });
    if (items.length !== 1) return yields('the arguments could not be built');
    const bound = bindArguments(items[0]!.input);
    if (bound.decision !== 'run') return yields(`the binder says ${bound.decision}`);
    if (bound.assumptions.length > 0 && config.allowDefaults !== true) return yields('the binder had to assume something, so the old handler may answer differently');
    const guard = config.guards[tool];
    const refusal = guard ? guard(bound.args, input.message) : null;
    if (refusal !== null) return yields(refusal);
    const executed = await config.run(tool, bound.args, config.deps());
    if (executed.route !== 'runner' || !executed.outcome) return yields(`the runner for ${tool} did not answer`);
    if (!executed.outcome.ok) return yields(`the runner for ${tool} refused: ${executed.outcome.message}`);
    const said = bound.assumptions.length > 0;
    const content = said ? `${bound.understood}\n\n${executed.outcome.reply}` : executed.outcome.reply;
    return { kind: 'answer', reply: { content, source: `runner:${tool}` }, note: said ? `direct lane answered with ${tool}; defaults said aloud` : `direct lane answered with ${tool}` };
  } catch (error) {
    return yields(`the lane failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
