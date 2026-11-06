export const DEVICE_RESOURCES = Object.freeze([
  Object.freeze({ name: 'ramMb', unit: 'megabytes', ownerCost: false }),
  Object.freeze({ name: 'cpuMs', unit: 'milliseconds', ownerCost: false }),
  Object.freeze({ name: 'storageMb', unit: 'megabytes', ownerCost: false }),
  Object.freeze({ name: 'batteryPct', unit: 'percent', ownerCost: false }),
  Object.freeze({ name: 'networkMb', unit: 'megabytes', ownerCost: true }),
] as const);
