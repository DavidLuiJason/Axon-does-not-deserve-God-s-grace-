export const ACCOUNT_RESOURCES = Object.freeze([
  Object.freeze({ name: 'aiCalls', unit: 'calls', ownerCost: true }),
  Object.freeze({ name: 'turns', unit: 'turns', ownerCost: true }),
  Object.freeze({ name: 'contextChars', unit: 'characters', ownerCost: true }),
  Object.freeze({ name: 'attachments', unit: 'files', ownerCost: true }),
] as const);
