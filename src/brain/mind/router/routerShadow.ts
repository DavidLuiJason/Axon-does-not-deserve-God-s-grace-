/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ROUTER (SHADOW). Roadmap 7E: the Router decides per clause whether a request takes the FAST path (one capability, slots filled, exact engine),
 * the DEEP path (the future Council: risky, linked, no fit) or must ASK once. "Unsure goes UP, never down."
 *
 * SHADOW MEANS: this only READS what Resolution already produced (owner decision pending; Director default: Resolution output only, not dictionary senses)
 * and writes one line into the trace. It never changes a reply, a resolution or any state. PURE: same input, same output.
 *
 * THE RULES (first match wins, in this order):
 *   R1 a clause that may not run alone (conditional or linked)         -> DEEP
 *   R2 match, tool has no schema                                       -> DEEP (cannot judge the effect)
 *   R3 match, irreversible undo or an approval effect (sends/spends/deletes) -> DEEP
 *   R4 match, the argument binder says the input is missing (it sees quoted and detail text, which Resolution's slot list does not; without a
 *      binder answer Resolution's own missing list is used) -> ASK; the binder says confirm-first -> DEEP
 *   R5 match found only by the value the message carries               -> DEEP (the stage that runs it must confirm first)
 *   R6 match, one capability, slots filled                             -> FAST
 *   R7 several tools possible (Resolution asked)                       -> ASK
 *   R8 none, unavailable (planned/waiting), or negated                 -> DEEP
 *   R9 not a request: a greeting or thanks                             -> FAST (conversation words)
 *   R10 not a request, anything else (chat, a stated need, unknown)    -> DEEP
 * NOT USED (said loudly): close dictionary senses and the Meaning tone, because they need the owner's decision on the Router's inputs.
 * No phrase lists, no regex (FL13).
 */
import type { PieceResolution } from '../resolve/clauseInputsTypes';
import type { ActionSchema } from '../schema/schemaTypes';
import { APPROVAL_EFFECTS } from '../schema/schemaTypes';
import type { Meaning } from '../types';

export type Route = 'fast' | 'deep' | 'ask';
export interface PieceRoute { readonly piece: number; readonly clause: number; readonly route: Route; readonly rule: string; readonly reason: string }
/** What the argument binder said for a piece: run (everything needed is there), confirm-first, or ask. */
export type BinderDecision = 'run' | 'confirm-first' | 'ask';
export interface RouterResult { readonly routes: readonly PieceRoute[]; /** piece numbers, quick answers first, then asks, then deep (route by clause, quick answer first) */ readonly order: readonly number[] }

const GREETING_ACTS = 'greet thanks';

function isApprovalEffect(effect: string): boolean { return APPROVAL_EFFECTS.split(' ').includes(effect); }

export function routePiece(item: PieceResolution, act: string | undefined, schemaOf: (tool: string) => ActionSchema | null, decision?: BinderDecision): PieceRoute {
  const make = (route: Route, rule: string, reason: string): PieceRoute => ({ piece: item.piece, clause: item.clause, route, rule, reason });
  if (!item.mayRunAlone) return make('deep', 'R1', 'the clause is conditional or linked, so it never runs alone');
  const resolution = item.resolution;
  if (resolution.kind === 'match') {
    const schema = schemaOf(resolution.tool);
    if (!schema) return make('deep', 'R2', `no schema is known for ${resolution.tool}, so its effect cannot be judged`);
    if (schema.undo === 'irreversible' || schema.effects.some((effect) => isApprovalEffect(effect))) return make('deep', 'R3', `${resolution.tool} cannot be undone or needs approval`);
    if (decision === 'ask') return make('ask', 'R4', `${resolution.tool}: the binder says something needed was not said`);
    if (decision === 'confirm-first') return make('deep', 'R4', `${resolution.tool}: the binder says confirm first`);
    if (decision === undefined && resolution.missingSlots.length > 0) return make('ask', 'R4', `${resolution.tool} is missing: ${resolution.missingSlots.join(', ')}`);
    if (resolution.evidence === 'value') return make('deep', 'R5', `${resolution.tool} was found by what the message carries, not by what it says`);
    return make('fast', 'R6', `${resolution.tool}: one capability, slots filled`);
  }
  if (resolution.kind === 'ask') return make('ask', 'R7', `${resolution.choices.length} tools are possible`);
  if (resolution.kind === 'none' || resolution.kind === 'unavailable' || resolution.kind === 'negated') return make('deep', 'R8', `resolution said ${resolution.kind}`);
  if (act !== undefined && GREETING_ACTS.split(' ').includes(act)) return make('fast', 'R9', `a ${act} is plain conversation`);
  return make('deep', 'R10', 'not a request and not a greeting or thanks');
}

export function routeMessage(resolutions: readonly PieceResolution[], meaning: Meaning | undefined, schemaOf: (tool: string) => ActionSchema | null, decisionOf?: (piece: number) => BinderDecision | undefined): RouterResult {
  const routes = resolutions.map((item) => routePiece(item, meaning?.clauses[item.clause]?.act, schemaOf, decisionOf?.(item.piece)));
  const rank = (route: Route): number => (route === 'fast' ? 0 : route === 'ask' ? 1 : 2);
  const order = routes.map((route, index) => ({ piece: route.piece, rank: rank(route.route), index })).sort((a, b) => a.rank - b.rank || a.index - b.index).map((entry) => entry.piece);
  return { routes, order };
}

/** The one trace line (appended to the Resolution entry's note). */
export function routerNote(result: RouterResult): string {
  const count = (route: Route): number => result.routes.filter((entry) => entry.route === route).length;
  const parts = result.routes.map((entry) => `piece ${entry.piece} ${entry.route} (${entry.rule})`);
  return `ROUTER shadow: ${count('fast')} fast, ${count('ask')} ask, ${count('deep')} deep${parts.length > 0 ? ` [${parts.join('; ')}]` : ''}`;
}
