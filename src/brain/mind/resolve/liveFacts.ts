/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B04B4P1 (Director glue, SHADOW). Builds the live ToolFact list from what AXON really has: the Tools menu
 * (catalog), the capability registry (chat status), the chat abilities and the left-out ids.
 * Pure: everything arrives as an argument (the registry fills at app start, so nothing is read at import time).
 * statusMapFrom (options.ts) turns the result into options.status (wired in B04B4P2).
 * Fields filled: kind, id, name, description, group, subgroup, screen, chat, leftOut.
 * Not filled (B04B4P2 decides if Resolution needs them): purposes, inputs.
 */
import type { CatalogTool } from '../../../tools/toolCatalog';
import type { Capability, ChatActionStatus } from '../../../capabilities/types';
import type { AbilitySource } from '../../../tools/toolFactSources';
import type { ToolFact } from '../schema/schemaTypes';

export interface LiveFactsInput {
  readonly catalog: readonly CatalogTool[];
  readonly capabilities: readonly Capability[];
  readonly abilities: readonly AbilitySource[];
  readonly leftOut: readonly string[];
  readonly chatLinks: Readonly<Record<string, string>>;
}

const RANK: Readonly<Record<ChatActionStatus, number>> = {
  'not-built': 0,
  'needs-screen': 1,
  'needs-permission': 2,
  available: 3,
};

/** The best chat status among the given action statuses; no action at all means not-built. */
function bestStatus(statuses: readonly ChatActionStatus[]): ChatActionStatus {
  let best: ChatActionStatus = 'not-built';
  for (const status of statuses) if (RANK[status] > RANK[best]) best = status;
  return best;
}

function actionStatusesFor(capabilities: readonly Capability[], part: string): ChatActionStatus[] {
  const out: ChatActionStatus[] = [];
  const exact = `act.${part}`;
  const engine = `act.engine.${part}`;
  for (const capability of capabilities) {
    for (const action of capability.chatActions ?? []) {
      if (action.id === exact || action.id === engine || action.id.startsWith(`${exact}.`)) out.push(action.status);
    }
  }
  return out;
}

export function buildLiveFacts(input: LiveFactsInput): ToolFact[] {
  const leftOut = new Set(input.leftOut);
  const facts: ToolFact[] = [];
  for (const tool of input.catalog) {
    const part = input.chatLinks[tool.id] ?? tool.id;
    facts.push({
      kind: 'tool',
      id: tool.id,
      name: tool.name,
      description: tool.description,
      group: tool.groupId,
      ...(tool.subgroup ? { subgroup: tool.subgroup } : {}),
      screen: tool.status === 'available',
      chat: bestStatus(actionStatusesFor(input.capabilities, part)),
      leftOut: leftOut.has(tool.id),
    });
  }
  for (const ability of input.abilities) {
    const own = input.capabilities.find((capability) => capability.id === ability.capabilityId);
    facts.push({
      kind: 'ability',
      id: ability.id,
      name: ability.name,
      description: ability.description,
      group: 'ability',
      screen: ability.screen,
      chat: bestStatus((own?.chatActions ?? []).map((action) => action.status)),
      leftOut: false,
    });
  }
  return facts;
}
