/** Conservative claim labelling. Repeated evidence in one independence group never upgrades a claim. */
export type ClaimLabel = 'UNKNOWN' | 'INFERRED' | 'REPORTED' | 'VERIFIED' | 'DISPUTED';
export type ClaimEvidence = Readonly<{
  id: string;
  independenceGroup: string;
  stance: 'supports' | 'refutes';
  kind: 'inference' | 'reported' | 'verified';
}>;
export type ClaimLabelError = 'invalid-input' | 'too-many-evidence' | 'duplicate-evidence-id';
export type ClaimLabelResult =
  | { ok: true; label: ClaimLabel; supportingGroups: number; refutingGroups: number; evidenceCount: number; reason: string }
  | { ok: false; error: ClaimLabelError; message: string };

export const CLAIM_LABEL_LIMITS = Object.freeze({ maxEvidence: 10_000, maxIdCharacters: 160 });

/**
 * Rules, in priority order:
 * - no evidence => UNKNOWN;
 * - evidence on both sides => DISPUTED;
 * - VERIFIED requires verified support from at least two distinct independence groups;
 * - otherwise a reported source => REPORTED;
 * - inference alone => INFERRED.
 * Repetition within one group is counted once for the VERIFIED threshold.
 */
export function labelClaim(evidence: unknown): ClaimLabelResult {
  if (!Array.isArray(evidence)) return { ok: false, error: 'invalid-input', message: 'Claim evidence must be an array.' };
  if (evidence.length > CLAIM_LABEL_LIMITS.maxEvidence) return { ok: false, error: 'too-many-evidence', message: 'The evidence list exceeds its supported limit.' };
  const ids = new Set<string>();
  const supportGroups = new Set<string>();
  const refuteGroups = new Set<string>();
  const verifiedSupportGroups = new Set<string>();
  let hasReported = false;
  let hasInference = false;
  let hasVerified = false;
  for (let i = 0; i < evidence.length; i += 1) {
    const item = evidence[i];
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: 'invalid-input', message: `Evidence ${i + 1} must be an object.` };
    }
    const e = item as Record<string, unknown>;
    if (typeof e.id !== 'string' || e.id.trim().length === 0 || e.id.length > CLAIM_LABEL_LIMITS.maxIdCharacters
        || typeof e.independenceGroup !== 'string' || e.independenceGroup.trim().length === 0
        || (e.stance !== 'supports' && e.stance !== 'refutes')
        || (e.kind !== 'inference' && e.kind !== 'reported' && e.kind !== 'verified')) {
      return { ok: false, error: 'invalid-input', message: `Evidence ${i + 1} has an invalid id, group, stance or kind.` };
    }
    if (ids.has(e.id)) return { ok: false, error: 'duplicate-evidence-id', message: `Evidence id "${e.id}" is repeated.` };
    ids.add(e.id);
    const group = e.independenceGroup.trim().replace(/\s+/g, ' ').toLowerCase();
    if (e.stance === 'supports') {
      supportGroups.add(group);
      if (e.kind === 'verified') verifiedSupportGroups.add(group);
    } else refuteGroups.add(group);
    if (e.kind === 'reported') hasReported = true;
    if (e.kind === 'inference') hasInference = true;
    if (e.kind === 'verified') hasVerified = true;
  }
  if (evidence.length === 0) return { ok: true, label: 'UNKNOWN', supportingGroups: 0, refutingGroups: 0, evidenceCount: 0, reason: 'No evidence was supplied.' };
  if (refuteGroups.size > 0) {
    return { ok: true, label: 'DISPUTED', supportingGroups: supportGroups.size, refutingGroups: refuteGroups.size, evidenceCount: evidence.length, reason: supportGroups.size > 0 ? 'Evidence supports and refutes the claim.' : 'The supplied evidence refutes the claim; it is not established as true.' };
  }
  if (verifiedSupportGroups.size >= 2 && refuteGroups.size === 0) {
    return { ok: true, label: 'VERIFIED', supportingGroups: supportGroups.size, refutingGroups: 0, evidenceCount: evidence.length, reason: 'At least two independent groups provide verified supporting evidence.' };
  }
  if (hasReported || hasVerified) return { ok: true, label: 'REPORTED', supportingGroups: supportGroups.size, refutingGroups: 0, evidenceCount: evidence.length, reason: 'The claim has source support but does not meet the independent verification threshold.' };
  if (hasInference) return { ok: true, label: 'INFERRED', supportingGroups: supportGroups.size, refutingGroups: refuteGroups.size, evidenceCount: evidence.length, reason: 'The available support is inference, not independent verification.' };
  return { ok: true, label: 'UNKNOWN', supportingGroups: supportGroups.size, refutingGroups: refuteGroups.size, evidenceCount: evidence.length, reason: 'The evidence does not establish support for the claim.' };
}
