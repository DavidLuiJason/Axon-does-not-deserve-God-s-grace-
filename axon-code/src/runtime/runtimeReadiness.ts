import type { HostPlatform } from './platformCapabilities.js';
import type { StrictSandboxProbe } from './hostRuntimeSuite.js';

export type RuntimeReadinessState = 'AVAILABLE' | 'READY_FOR_VALIDATION' | 'BLOCKED' | 'MISSING_DEPENDENCY' | 'ADAPTER_REQUIRED' | 'NOT_IMPLEMENTED';

export interface RuntimeReadinessInput {
  runtimeId: string;
  host: HostPlatform;
  implementationPresent: boolean;
  toolchainAvailable: boolean;
  providerConnected: boolean;
  sandboxProbe?: StrictSandboxProbe | null;
  endToEndEvidence: boolean;
  requiredComponents?: string[];
  missingComponents?: string[];
  notes?: string[];
}

export interface RuntimeReadinessReport {
  runtimeId: string;
  host: HostPlatform;
  state: RuntimeReadinessState;
  canExecuteUserProject: boolean;
  requiredComponents: string[];
  missingComponents: string[];
  evidence: 'HOST_PROBE' | 'ADAPTER_ATTESTATION' | 'NOT_CHECKED';
  notes: string[];
}

/**
 * Central capability truth. A language compiler being installed is not enough;
 * a connected provider, every strict sandbox control, and end-to-end proof are required.
 */
export function assessRuntimeReadiness(input: RuntimeReadinessInput): RuntimeReadinessReport {
  if (!input.runtimeId.trim()) throw new Error('Runtime identity is required.');
  const required = [...new Set(input.requiredComponents ?? [])];
  const missing = [...new Set(input.missingComponents ?? [])];
  const notes = [...(input.notes ?? [])];
  let state: RuntimeReadinessState;
  let evidence: RuntimeReadinessReport['evidence'] = 'NOT_CHECKED';

  if (!input.implementationPresent) {
    state = 'NOT_IMPLEMENTED';
    notes.push('Runtime implementation is absent; a contract or project recogniser does not count as an execution engine.');
  } else if (!input.toolchainAvailable) {
    state = 'MISSING_DEPENDENCY';
    notes.push('Required compiler/interpreter/toolchain is not available on this host.');
  } else if (!input.providerConnected) {
    state = 'ADAPTER_REQUIRED';
    notes.push('No concrete execution provider is connected.');
  } else {
    const probe = input.sandboxProbe;
    const strictSandbox = Boolean(probe && probe.available && probe.isolationConfirmed && probe.networkBlocked &&
      probe.filesystemIsolated && probe.memoryLimitEnforced && probe.timeLimitEnforced && probe.unprivilegedIdentity);
    if (!strictSandbox) {
      state = 'BLOCKED';
      evidence = probe ? 'HOST_PROBE' : 'NOT_CHECKED';
      notes.push('Strict host isolation is not fully attested; arbitrary user-project execution is blocked.');
      if (probe) {
        const missingControls = [
          ['OS isolation', probe.isolationConfirmed], ['network denial', probe.networkBlocked],
          ['filesystem isolation', probe.filesystemIsolated], ['memory limit', probe.memoryLimitEnforced],
          ['time limit', probe.timeLimitEnforced], ['unprivileged identity', probe.unprivilegedIdentity]
        ].filter(([, ok]) => !ok).map(([name]) => String(name));
        notes.push(`Missing host controls: ${missingControls.join(', ') || 'provider availability'}.`);
      }
    } else if (missing.length > 0) {
      state = 'MISSING_DEPENDENCY';
      evidence = 'ADAPTER_ATTESTATION';
    } else if (!input.endToEndEvidence) {
      state = 'READY_FOR_VALIDATION';
      evidence = 'ADAPTER_ATTESTATION';
      notes.push('Host controls and toolchain are attested, but end-to-end project execution evidence is missing.');
    } else {
      state = 'AVAILABLE';
      evidence = 'ADAPTER_ATTESTATION';
      notes.push('Runtime passed host, isolation and end-to-end evidence gates.');
    }
  }

  return {
    runtimeId: input.runtimeId,
    host: input.host,
    state,
    canExecuteUserProject: state === 'AVAILABLE',
    requiredComponents: required,
    missingComponents: missing,
    evidence,
    notes
  };
}
