/** Game-specific 15-tier progression. Tiers describe capability bands, not timer multipliers. */
export const TIER_LABELS = [
  'Introduction','Basic practice','Simple combinations','Growing complexity','Interacting ideas',
  'Demanding challenges','Advanced combinations','Strategic reasoning','Complex decisions','Advanced problem-solving',
  'Expert techniques','High-level reasoning','Very advanced','Near-maximum practical','Highest supported'
];

export function getTierProfile(gameId, tier, profiles = {}) {
  if (!Number.isInteger(tier) || tier < 1 || tier > 15) throw new RangeError('tier must be an integer from 1 to 15');
  const profile = profiles[gameId];
  if (!profile || !Array.isArray(profile.tiers) || profile.tiers.length !== 15) {
    throw new Error(`Missing 15-tier game-specific profile: ${gameId}`);
  }
  const selected = profile.tiers[tier - 1];
  if (!selected || !Number.isInteger(selected.levels) || selected.levels < 1 || !selected.mechanics) {
    throw new Error(`Invalid tier definition for ${gameId}, tier ${tier}`);
  }
  return { tier, label: TIER_LABELS[tier - 1], ...selected };
}

export function buildTierPlan(gameId, profiles) {
  return Array.from({ length: 15 }, (_, i) => ({
    ...getTierProfile(gameId, i + 1, profiles),
    tier: i + 1,
    levels: Array.from({ length: getTierProfile(gameId, i + 1, profiles).levels }, (_, j) => j + 1)
  }));
}
