export type PackageAction = 'REUSE_VERIFIED_CACHE' | 'INSTALL_LOCKED_ARTIFACT' | 'BUILD_FROM_SOURCE' | 'BLOCKED';
export interface PackageRequirement { ecosystem: string; name: string; version: string; source: string; expectedSha256?: string; optional?: boolean; }
export interface PackageEnvironmentPolicy {
  allowedSources: readonly string[];
  allowNetwork: boolean;
  allowBuildFromSource: boolean;
  allowLifecycleScripts: boolean;
  maxInstallBytes: number;
}
export interface PackagePlanItem { requirement: PackageRequirement; action: PackageAction; reason: string; }
export interface PackagePlan { planId: string; items: PackagePlanItem[]; blocked: boolean; requiresApproval: boolean; totalExpectedBytes: number; maxInstallBytes: number; warnings: string[]; networkAllowed: boolean; allowedSources: string[]; allowBuildFromSource: boolean; planSha256: string; }
export interface PackageCache { get(key: string): Promise<Uint8Array | null>; put(key: string, bytes: Uint8Array): Promise<void>; }
export interface PackageManagerProbe { available: boolean; isolatedEnvironment: boolean; verifiedSources: string[]; lifecycleScriptsCanBeDisabled: boolean; childProcessConfinement: boolean; notes: string[]; }
export interface PackageManagerAdapter {
  id: string;
  probe(): Promise<PackageManagerProbe>;
  install(input: { environmentId: string; requirements: readonly PackageRequirement[]; allowedSources: readonly string[]; lifecycleScripts: false; networkAllowed: boolean; unprivileged: true; maxInstallBytes: number }): Promise<{ success: boolean; installed: string[]; diagnostics: string[] }>;
  installFromCache?(input: { environmentId: string; requirement: PackageRequirement; artifact: Uint8Array; lifecycleScripts: false; networkAllowed: false; unprivileged: true; maxInstallBytes: number }): Promise<{ success: boolean; installed: string[]; diagnostics: string[] }>;
  buildFromSource?(input: { environmentId: string; requirement: PackageRequirement; lifecycleScripts: false; networkAllowed: false; unprivileged: true; maxInstallBytes: number }): Promise<{ success: boolean; installed: string[]; diagnostics: string[] }>;
}

export class PackagePlanService {
  private sequence = 0;
  constructor(private readonly cache: PackageCache) {}
  async plan(requirements: readonly PackageRequirement[], policy: PackageEnvironmentPolicy, estimatedBytes: ReadonlyMap<string, number> = new Map()): Promise<PackagePlan> {
    if (!policy || !Array.isArray(policy.allowedSources) || policy.allowedSources.length > 256 || policy.allowedSources.some((source) => typeof source !== 'string' || !source.trim()) || new Set(policy.allowedSources).size !== policy.allowedSources.length || typeof policy.allowNetwork !== 'boolean' || typeof policy.allowBuildFromSource !== 'boolean' || typeof policy.allowLifecycleScripts !== 'boolean' || !Number.isSafeInteger(policy.maxInstallBytes) || policy.maxInstallBytes < 0) throw new Error('Invalid package installation policy.');
    if (policy.allowLifecycleScripts) throw new Error('AXON Code managed package installation keeps lifecycle scripts disabled. A separate reviewed build task is required for any install-time script.')
    const items: PackagePlanItem[] = [], warnings: string[] = [];
    let total = 0, blocked = false;
    const seen = new Set<string>();
    for (const requirement of requirements) {
      if (!requirement || typeof requirement.name !== 'string' || !requirement.name.trim() || typeof requirement.version !== 'string' || !requirement.version.trim() || typeof requirement.ecosystem !== 'string' || !requirement.ecosystem.trim() || typeof requirement.source !== 'string' || !requirement.source.trim()) throw new Error('Package identity and version are required.');
      const key = `${requirement.ecosystem}:${requirement.name}@${requirement.version}`.toLowerCase();
      if (/[\*^~<>]|\b(?:latest|stable)\b/i.test(requirement.version)) { items.push({ requirement: { ...requirement }, action: 'BLOCKED', reason: 'A floating package version is not reproducible; resolve and pin an exact version first.' }); blocked = true; continue; }
      if (requirement.expectedSha256 && !/^[a-f0-9]{64}$/i.test(requirement.expectedSha256)) { items.push({ requirement: { ...requirement }, action: 'BLOCKED', reason: 'Expected SHA-256 is malformed.' }); blocked = true; continue; }
      if (!requirement.expectedSha256) { items.push({ requirement: { ...requirement }, action: 'BLOCKED', reason: 'A pinned artifact SHA-256 is required for a reproducible installation.' }); blocked = true; continue; }
      const allowedSource = policy.allowedSources.some((source) => source === requirement.source);
      if (!allowedSource) { items.push({ requirement: { ...requirement }, action: 'BLOCKED', reason: 'Package source is not in the approved source allow-list.' }); blocked = true; continue; }
      if (seen.has(key)) { warnings.push(`Duplicate package requirement '${key}' was collapsed.`); continue; }
      seen.add(key);
      const hasSizeEstimate = estimatedBytes.has(key);
      const size = estimatedBytes.get(key) ?? 0;
      if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Invalid size estimate for '${key}'.`);
      total += size;
      if (!Number.isSafeInteger(total)) throw new Error('Package size estimate overflow.');
      if (requirement.expectedSha256) {
        const cached = await this.cache.get(requirement.expectedSha256.toLowerCase());
        if (cached) {
          if ((await sha256Hex(cached)).toLowerCase() !== requirement.expectedSha256.toLowerCase()) { items.push({ requirement: { ...requirement }, action: 'BLOCKED', reason: 'Cached artifact failed SHA-256 verification.' }); blocked = true; continue; }
          const effectiveSize = hasSizeEstimate ? size : cached.byteLength;
          if (effectiveSize > policy.maxInstallBytes || total - size + effectiveSize > policy.maxInstallBytes) { items.push({ requirement: { ...requirement }, action: 'BLOCKED', reason: 'Verified cache artifact exceeds the configured storage budget.' }); blocked = true; continue; }
          total = total - size + effectiveSize;
          items.push({ requirement: { ...requirement }, action: 'REUSE_VERIFIED_CACHE', reason: 'A content-addressed cache artifact passed SHA-256 verification.' }); continue;
        }
      }
      if (!hasSizeEstimate || size < 1) { items.push({ requirement: { ...requirement }, action: 'BLOCKED', reason: 'A bounded package-size estimate is required before downloading or building.' }); blocked = true; continue; }
      if (size > policy.maxInstallBytes || total > policy.maxInstallBytes) { items.push({ requirement: { ...requirement }, action: 'BLOCKED', reason: 'Package installation exceeds the configured storage/download budget.' }); blocked = true; continue; }
      if (!policy.allowNetwork) { items.push({ requirement: { ...requirement }, action: policy.allowBuildFromSource ? 'BUILD_FROM_SOURCE' : 'BLOCKED', reason: 'No verified cache entry is available and network access is disabled.' }); if (!policy.allowBuildFromSource) blocked = true; continue; }
      items.push({ requirement: { ...requirement }, action: 'INSTALL_LOCKED_ARTIFACT', reason: 'Installation requires explicit approval, an isolated environment and lifecycle scripts disabled.' });
    }
    const planData = { planId: `pkg-plan-${++this.sequence}`, items, blocked, requiresApproval: items.some((item) => item.action === 'INSTALL_LOCKED_ARTIFACT' || item.action === 'BUILD_FROM_SOURCE' || item.action === 'REUSE_VERIFIED_CACHE'), totalExpectedBytes: total, maxInstallBytes: policy.maxInstallBytes, warnings, networkAllowed: policy.allowNetwork, allowedSources: [...policy.allowedSources], allowBuildFromSource: policy.allowBuildFromSource };
    const planSha256 = await sha256Hex(new TextEncoder().encode(JSON.stringify(planData)));
    return { ...planData, planSha256 };
  }

  async execute(plan: PackagePlan, adapter: PackageManagerAdapter, approval: { approved: boolean; approvalReference: string; environmentId: string }, allowedSources: readonly string[]): Promise<{ status: 'INSTALLED' | 'BLOCKED' | 'FAILED'; installed: string[]; diagnostics: string[] }> {
    if (!approval || approval.approved !== true || typeof approval.approvalReference !== 'string' || !approval.approvalReference.trim() || typeof approval.environmentId !== 'string' || !approval.environmentId.trim()) return { status: 'BLOCKED', installed: [], diagnostics: ['Explicit user/Brain installation approval and environment identity are required.'] };
    const { planSha256, ...planData } = plan;
    if (!/^[a-f0-9]{64}$/i.test(planSha256) || (await sha256Hex(new TextEncoder().encode(JSON.stringify(planData)))).toLowerCase() !== planSha256.toLowerCase()) return { status: 'BLOCKED', installed: [], diagnostics: ['Package plan integrity verification failed; regenerate the plan.'] };
    if (plan.blocked || plan.items.some((item) => item.action === 'BLOCKED')) return { status: 'BLOCKED', installed: [], diagnostics: ['Package plan contains blocked requirements.'] };
    if (!Array.isArray(plan.allowedSources) || plan.allowedSources.some((source) => !allowedSources.includes(source))) return { status: 'BLOCKED', installed: [], diagnostics: ['Execution source allow-list differs from the reviewed package plan.'] };
    let probe: PackageManagerProbe;
    try { probe = await adapter.probe(); } catch (error) { return { status: 'BLOCKED', installed: [], diagnostics: [`Package-manager probe failed: ${String(error)}`] }; }
    if (!probe.available || !probe.isolatedEnvironment || !probe.lifecycleScriptsCanBeDisabled || !probe.childProcessConfinement) return { status: 'BLOCKED', installed: [], diagnostics: ['Package manager lacks required isolation or lifecycle-script controls.', ...probe.notes] };
    const installed: string[] = [], diagnostics: string[] = [];
    if (!adapter.id.trim()) return { status: 'BLOCKED', installed, diagnostics: ['Package-manager adapter identity is invalid.'] };
    for (const item of plan.items.filter((row) => row.action === 'REUSE_VERIFIED_CACHE')) {
      if (!item.requirement.expectedSha256 || !adapter.installFromCache || !probe.verifiedSources.includes(item.requirement.source)) return { status: 'BLOCKED', installed, diagnostics: ['The host package manager cannot stage the verified offline cache artifact.'] };
      const artifact = await this.cache.get(item.requirement.expectedSha256.toLowerCase());
      if (!artifact || (await sha256Hex(artifact)).toLowerCase() !== item.requirement.expectedSha256.toLowerCase()) return { status: 'BLOCKED', installed, diagnostics: [`Cached artifact for '${item.requirement.name}' is missing or corrupt.`] };
      const result = await adapter.installFromCache({ environmentId: approval.environmentId, requirement: item.requirement, artifact, lifecycleScripts: false, networkAllowed: false, unprivileged: true, maxInstallBytes: plan.maxInstallBytes });
      diagnostics.push(...result.diagnostics); if (!result.success) return { status: 'FAILED', installed, diagnostics }; installed.push(...result.installed);
    }
    const networkItems = plan.items.filter((row) => row.action === 'INSTALL_LOCKED_ARTIFACT');
    if (networkItems.length) {
      if (!plan.networkAllowed) return { status: 'BLOCKED', installed, diagnostics: ['The approved package plan prohibits network installation.'] };
      if (networkItems.some((item) => !plan.allowedSources.includes(item.requirement.source) || !allowedSources.includes(item.requirement.source) || !probe.verifiedSources.includes(item.requirement.source))) return { status: 'BLOCKED', installed, diagnostics: ['A package source is not verified by both the plan and the selected manager.'] };
      const result = await adapter.install({ environmentId: approval.environmentId, requirements: networkItems.map((item) => item.requirement), allowedSources: plan.allowedSources, lifecycleScripts: false, networkAllowed: true, unprivileged: true, maxInstallBytes: plan.maxInstallBytes });
      diagnostics.push(...result.diagnostics); if (!result.success) return { status: 'FAILED', installed, diagnostics }; installed.push(...result.installed);
    }
    for (const item of plan.items.filter((row) => row.action === 'BUILD_FROM_SOURCE')) {
      if (!plan.allowBuildFromSource || !adapter.buildFromSource) return { status: 'BLOCKED', installed, diagnostics: ['Source builds are not enabled or the package manager has no isolated source-build provider.'] };
      const result = await adapter.buildFromSource({ environmentId: approval.environmentId, requirement: item.requirement, lifecycleScripts: false, networkAllowed: false, unprivileged: true, maxInstallBytes: plan.maxInstallBytes });
      diagnostics.push(...result.diagnostics); if (!result.success) return { status: 'FAILED', installed, diagnostics }; installed.push(...result.installed);
    }
    return { status: 'INSTALLED', installed, diagnostics };
  }
}

export class MemoryPackageCache implements PackageCache {
  private readonly rows = new Map<string, Uint8Array>();
  async get(key: string): Promise<Uint8Array | null> { const row = this.rows.get(key); return row ? row.slice() : null; }
  async put(key: string, bytes: Uint8Array): Promise<void> { this.rows.set(key, bytes.slice()); }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto SHA-256 is unavailable.');
  // Copy into a fresh ArrayBuffer-backed array so the call type-checks on every TypeScript version (a Uint8Array may be backed by a SharedArrayBuffer).
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

/** Content-addressed verified cache. Corrupt or mismatched cached artifacts are rejected. */
export class VerifiedPackageCache {
  constructor(private readonly cache: PackageCache, private readonly maxArtifactBytes = 256 * 1024 * 1024) {
    if (!Number.isSafeInteger(maxArtifactBytes) || maxArtifactBytes < 1) throw new Error('Invalid cache artifact limit.');
  }
  async put(expectedSha256: string, bytes: Uint8Array): Promise<void> {
    if (!/^[a-f0-9]{64}$/i.test(expectedSha256) || !(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > this.maxArtifactBytes) throw new Error('Invalid verified-cache artifact input.');
    const actual = await sha256Hex(bytes);
    if (actual.toLowerCase() !== expectedSha256.toLowerCase()) throw new Error('Package artifact SHA-256 does not match the expected digest.');
    await this.cache.put(actual, bytes);
  }
  async get(expectedSha256: string): Promise<Uint8Array | null> {
    if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) throw new Error('Invalid SHA-256 lookup key.');
    const bytes = await this.cache.get(expectedSha256.toLowerCase());
    if (!bytes) return null;
    if (bytes.byteLength > this.maxArtifactBytes || (await sha256Hex(bytes)).toLowerCase() !== expectedSha256.toLowerCase()) throw new Error('Cached package artifact failed integrity verification.');
    return bytes;
  }
}
