/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ROUTER (SHADOW) helper: asks the argument binder, per piece, whether everything the tool needs was said. Resolution's own slot list cannot see
 * quoted text or detail text, so "count words in \"hello world\"" would wrongly look like a missing input (MEASURED 2026-11-01).
 * Pure and read-only: it builds the same binder input the direct lane builds and never runs a tool. Any failure for a piece means no answer for it.
 */
import type { PieceResolution } from '../resolve/clauseInputsTypes';
import type { FeedSegment, FeedValue } from '../bind/bindFeed';
import { buildBindInputs } from '../bind/bindFeed';
import { bindArguments } from '../bind/argumentBinder';
import type { MeaningStructure } from '../meaning/structure/glueTypes';
import type { BinderDecision } from './routerShadow';

export interface BinderFeed {
  readonly message: string;
  readonly segments: readonly FeedSegment[];
  readonly structure: MeaningStructure;
  readonly values: readonly FeedValue[];
  readonly resolutions: readonly PieceResolution[];
  readonly choicesFor?: (tool: string) => Readonly<Record<string, readonly string[]>>;
  readonly toolNameFor?: (tool: string) => string;
}

export function binderDecisions(feed: BinderFeed): ReadonlyMap<number, BinderDecision> {
  const out = new Map<number, BinderDecision>();
  try {
    const items = buildBindInputs({
      message: feed.message, segments: feed.segments, structure: feed.structure, values: feed.values, resolutions: [...feed.resolutions],
      choicesFor: feed.choicesFor ?? (() => ({})), toolNameFor: feed.toolNameFor ?? ((tool: string) => tool),
    });
    for (const item of items) {
      try { out.set(item.piece, bindArguments(item.input).decision); } catch { /* no answer for this piece */ }
    }
  } catch { /* no answers at all */ }
  return out;
}
