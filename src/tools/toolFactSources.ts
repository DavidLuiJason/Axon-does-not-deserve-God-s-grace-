/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B04B4P1 (Director). The few facts the live tool list cannot read from the catalog or the registry by itself.
 * ABILITY_SOURCES: the three chat abilities (not Tools-menu tools) and the registry capability each reads its chat status from.
 * CHAT_ACTION_LINKS: where a tool's registry action id differs from its tool id (tool id to action id part).
 */
export interface AbilitySource {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly capabilityId: string;
  readonly screen: boolean;
}

export const ABILITY_SOURCES: readonly AbilitySource[] = [
 {
  id: 'settings',
  name: 'Settings',
  description: "Open AXON Settings.",
  capabilityId: 'cap.settings',
  screen: true,
 },
 {
  id: 'taught-meanings',
  name: 'Taught Meanings',
  description: "Teach AXON what a word or phrase means, list what was taught, forget one meaning or all of them.",
  capabilityId: 'cap.taught-meanings',
  screen: false,
 },
 {
  id: 'axon-source',
  name: 'AXON Source',
  description: "Export the AXON source project.",
  capabilityId: 'cap.axon-source',
  screen: true,
 },
];

export const CHAT_ACTION_LINKS: Readonly<Record<string, string>> = {
  dictionary: 'english-dictionary',
};
