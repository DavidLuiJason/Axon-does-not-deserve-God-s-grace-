export type HostPlatform = 'android' | 'ios' | 'browser' | 'windows' | 'linux' | 'macos' | 'server' | 'unknown';
export type CapabilityState = 'AVAILABLE' | 'MISSING_DEPENDENCY' | 'UNSUPPORTED' | 'BLOCKED' | 'NOT_IMPLEMENTED' | 'UNKNOWN';

export interface HostPlatformSnapshot {
  platform: HostPlatform;
  architecture: string;
  osVersion?: string;
  runtimeVersion?: string;
  detectedAt: number;
  evidence: 'HOST_PROBE' | 'OWNER_REPORTED' | 'UNKNOWN';
}

export interface RuntimeCapabilityReport {
  runtimeId: string;
  state: CapabilityState;
  host: HostPlatform;
  requiredComponents: string[];
  missingComponents: string[];
  isolation: 'worker' | 'process' | 'container' | 'remote' | 'none';
  evidence: 'HOST_PROBE' | 'ADAPTER_REPORT' | 'NOT_CHECKED';
  notes: string[];
}

export interface PlatformCapabilityAdapter {
  readonly platform: HostPlatform;
  probe(signal?: AbortSignal): Promise<HostPlatformSnapshot>;
}

/** Platform and runtime are separate axes; a platform label never proves a runtime exists. */
export class PlatformCapabilityRegistry {
  private readonly adapters = new Map<HostPlatform, PlatformCapabilityAdapter>();

  register(adapter: PlatformCapabilityAdapter): void {
    if (this.adapters.has(adapter.platform)) throw new Error(`Platform adapter '${adapter.platform}' is already registered.`);
    this.adapters.set(adapter.platform, adapter);
  }

  async probe(platform: HostPlatform, signal?: AbortSignal): Promise<HostPlatformSnapshot | null> {
    const adapter = this.adapters.get(platform);
    return adapter ? adapter.probe(signal) : null;
  }

  listRegistered(): HostPlatform[] { return [...this.adapters.keys()].sort(); }
}

export interface RuntimeRequirementProbe {
  runtimeId: string;
  host: HostPlatform;
  requiredComponents: readonly string[];
  availableComponents: readonly string[];
  isolation: RuntimeCapabilityReport['isolation'];
  implementationState: 'BUILT' | 'NOT_IMPLEMENTED';
  blocked?: boolean;
}

export function evaluateRuntimeRequirements(input: RuntimeRequirementProbe): RuntimeCapabilityReport {
  const available = new Set(input.availableComponents);
  const missingComponents = input.requiredComponents.filter((item) => !available.has(item));
  const state: CapabilityState = input.blocked ? 'BLOCKED' : input.implementationState === 'NOT_IMPLEMENTED' ? 'NOT_IMPLEMENTED' :
    missingComponents.length > 0 ? 'MISSING_DEPENDENCY' : 'AVAILABLE';
  return {
    runtimeId: input.runtimeId,
    host: input.host,
    state,
    requiredComponents: [...input.requiredComponents],
    missingComponents,
    isolation: input.isolation,
    evidence: 'HOST_PROBE',
    notes: state === 'AVAILABLE' ? ['Required components are reported present; execution still requires an adapter test.'] :
      state === 'MISSING_DEPENDENCY' ? ['Required host components are missing.'] :
      state === 'NOT_IMPLEMENTED' ? ['This runtime engine is not implemented.'] : ['Execution is blocked by host policy.']
  };
}

export const DECLARED_HOST_TARGETS: readonly HostPlatform[] = Object.freeze(['android', 'ios', 'browser', 'windows', 'linux', 'macos', 'server']);
