/**
 * One place that builds everything AXON Web offers, so screens and the brain/tool layer do not wire parts by hand.
 *  - controller: the owner's browser commands (the owner screen calls these; AXON never gets this handle).
 *  - agent: the brain/tools handle for AXON's own private tab (search, read, click ...).
 *  - owner: the owner's panel for AXON's tab (approvals, extra steps, take over). Give it only to the owner's screen.
 * On a phone use createAndroidAxonWebHost() (androidAxonWebHost.ts); this file has no native imports so it can be tested.
 */
import { createAxonWebAgent, type AxonOwnerPanel, type AxonWebAgent, type AxonWebAgentOptions } from './axonWebAgent.ts';
import type { AxonSessionEngine } from './axonSessionTypes.ts';
import { BrowserController } from './browserController.ts';
import type { BrowserEngineAdapter } from './browserEngineAdapter.ts';
import { BrowserLongTail, type BrowserTailPlugin } from './browserLongTail.ts';

export type AxonWebHost = Readonly<{ controller: BrowserController; agent: AxonWebAgent; owner: AxonOwnerPanel; adapter: BrowserEngineAdapter }>;
export type AxonWebHostParts = Readonly<{
  adapter: BrowserEngineAdapter;
  tail: BrowserTailPlugin;
  engine: AxonSessionEngine;
  agentOptions?: Omit<AxonWebAgentOptions, 'engine'>;
}>;

export function createAxonWebHost(parts: AxonWebHostParts): AxonWebHost {
  const controller = new BrowserController(parts.adapter, new BrowserLongTail(parts.adapter, parts.tail));
  const { agent, owner } = createAxonWebAgent({ ...(parts.agentOptions ?? {}), engine: parts.engine });
  return Object.freeze({ controller, agent, owner, adapter: parts.adapter });
}
