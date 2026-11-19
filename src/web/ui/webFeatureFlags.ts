/**
 * Which AXON Web features the screens may treat as working.
 * The screens are built once. When an engine is ready, Director 204 flips the matching flag here in a small zip;
 * no screen needs to change. While a flag is false the UI stays fully usable but says "coming soon" at the moment
 * the feature would be used (for incognito and stealth: when a search or address is submitted).
 */
export const WEB_FEATURES = {
  incognito: false,
  stealth: false,
} as const;

export type WebFeatureName = keyof typeof WEB_FEATURES;
