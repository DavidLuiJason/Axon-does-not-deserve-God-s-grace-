import { sha256Hex } from './packageManager.js';
import type { PackageRequirement } from './packageManager.js';
export interface EnvironmentLock {
  schemaVersion: 1;
  projectId: string;
  ecosystem: string;
  runtimeVersion: string;
  hostConstraint: string;
  packages: Array<{ name: string; version: string; source: string; sha256: string }>;
  createdAt: number;
  sha256: string;
}

/** Produces/verifies deterministic dependency lock records; it does not resolve or download packages. */
export class EnvironmentLockService {
  async create(input: { projectId: string; ecosystem: string; runtimeVersion: string; hostConstraint: string; packages: readonly PackageRequirement[]; now?: number }): Promise<EnvironmentLock> {
    if (!input.projectId.trim() || !input.ecosystem.trim() || !input.runtimeVersion.trim() || !input.hostConstraint.trim()) throw new Error('Lockfile environment identity is incomplete.');
    if (!Array.isArray(input.packages) || input.packages.length > 100_000) throw new Error('Lockfile package list is invalid or too large.');
    const packages = input.packages.map((item) => {
      if (typeof item.name !== 'string' || !item.name.trim() || typeof item.version !== 'string' || !item.version.trim() || typeof item.source !== 'string' || !item.source.trim() || !item.expectedSha256 || !/^[a-f0-9]{64}$/i.test(item.expectedSha256)) throw new Error(`Package '${item.name}' lacks a pinned version, source or SHA-256.`);
      return { name: item.name, version: item.version, source: item.source, sha256: item.expectedSha256.toLowerCase() };
    }).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
    for (let i = 1; i < packages.length; i++) if (packages[i - 1]!.name.toLowerCase() === packages[i]!.name.toLowerCase() && packages[i - 1]!.version === packages[i]!.version) throw new Error('Lockfile contains a duplicate package identity.');
    const data = { schemaVersion: 1 as const, projectId: input.projectId, ecosystem: input.ecosystem, runtimeVersion: input.runtimeVersion, hostConstraint: input.hostConstraint, packages, createdAt: input.now ?? Date.now() };
    const sha256 = await sha256Hex(new TextEncoder().encode(JSON.stringify(data)));
    return { ...data, sha256 };
  }
  async verify(lock: EnvironmentLock): Promise<boolean> {
    if (lock.schemaVersion !== 1 || !Number.isSafeInteger(lock.createdAt) || !/^[a-f0-9]{64}$/i.test(lock.sha256)) return false;
    const { sha256, ...data } = lock;
    return (await sha256Hex(new TextEncoder().encode(JSON.stringify(data)))).toLowerCase() === sha256.toLowerCase();
  }
}
