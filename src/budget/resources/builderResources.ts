export const BUILDER_RESOURCES = Object.freeze([
  Object.freeze({ name: 'builderMemoryMb', unit: 'megabytes', ownerCost: false }),
  Object.freeze({ name: 'archiveExpandMb', unit: 'megabytes', ownerCost: false }),
  Object.freeze({ name: 'repoFiles', unit: 'files', ownerCost: false }),
  Object.freeze({ name: 'testMinutes', unit: 'minutes', ownerCost: false }),
  Object.freeze({ name: 'reviewCommands', unit: 'commands', ownerCost: false }),
] as const);
