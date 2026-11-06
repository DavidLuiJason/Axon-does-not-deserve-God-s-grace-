export const TASK_RESOURCES = Object.freeze([
  Object.freeze({ name: 'steps', unit: 'steps', ownerCost: false }),
  Object.freeze({ name: 'toolCalls', unit: 'calls', ownerCost: false }),
  Object.freeze({ name: 'files', unit: 'files', ownerCost: false }),
  Object.freeze({ name: 'outputKb', unit: 'kilobytes', ownerCost: false }),
  Object.freeze({ name: 'tests', unit: 'tests', ownerCost: false }),
] as const);
