import type { HostPlatform } from '../runtime/platformCapabilities.js';
import type { EnvironmentLock } from './lockfiles.js';
import { EnvironmentLockService } from './lockfiles.js';
import type { EnvironmentCompatibilityResult } from './environmentIntelligence.js';

export interface ManagedEnvironmentRecord {
  id: string; projectId: string; platform: HostPlatform; ecosystem: string; lockSha256: string;
  state: 'READY' | 'DEGRADED' | 'DESTROYED'; createdAt: number; lastUsedAt: number; providerId: string;
}
export interface EnvironmentRecordStore { get(id: string): Promise<ManagedEnvironmentRecord | null>; put(record: ManagedEnvironmentRecord): Promise<void>; list(projectId?: string): Promise<ManagedEnvironmentRecord[]>; }
export interface EnvironmentProviderAttestation { available: boolean; isolated: boolean; filesystemScoped: boolean; networkBlocked: boolean; memoryLimited: boolean; timeLimited: boolean; unprivileged: boolean; childProcessConfinement: boolean; notes: string[]; }
export interface EnvironmentProvider {
  id: string;
  probe(): Promise<EnvironmentProviderAttestation>;
  create(input: { id: string; projectId: string; lock: EnvironmentLock; networkAllowed: false; unprivileged: true }): Promise<{ success: boolean; diagnostics: string[] }>;
  destroy(environmentId: string): Promise<void>;
}

/** Reproducible isolated environment lifecycle manager; actual creation requires a concrete host provider. */
export class EnvironmentManager {
  private sequence = 0;
  constructor(private readonly store: EnvironmentRecordStore, private readonly locks: EnvironmentLockService, private readonly now: () => number = Date.now) {}
  async prepare(input: { projectId: string; platform: HostPlatform; ecosystem: string; lock: EnvironmentLock; compatibility: EnvironmentCompatibilityResult; provider: EnvironmentProvider; approved: boolean }): Promise<{ state: 'READY' | 'BLOCKED' | 'FAILED'; environment?: ManagedEnvironmentRecord; diagnostics: string[] }> {
    if (!input.approved || !input.projectId.trim() || input.lock.projectId !== input.projectId || input.lock.ecosystem !== input.ecosystem) return { state: 'BLOCKED', diagnostics: ['Environment preparation requires approval and matching project/ecosystem identity.'] };
    if (!await this.locks.verify(input.lock)) return { state: 'BLOCKED', diagnostics: ['Environment lockfile integrity verification failed.'] };
    if (!input.compatibility.compatible) return { state: 'BLOCKED', diagnostics: ['Host does not satisfy required toolchains or conservative resource estimates.', ...input.compatibility.missing, ...input.compatibility.warnings] };
    if (!input.provider || typeof input.provider.id !== 'string' || !input.provider.id.trim()) return { state: 'BLOCKED', diagnostics: ['Environment provider identity is invalid.'] };
    let probe: EnvironmentProviderAttestation;
    try { probe = await input.provider.probe(); }
    catch (error) { return { state: 'BLOCKED', diagnostics: [`Environment provider probe failed: ${String(error)}`] }; }
    if (!probe.available || !probe.isolated || !probe.filesystemScoped || !probe.networkBlocked || !probe.memoryLimited || !probe.timeLimited || !probe.unprivileged || !probe.childProcessConfinement) return { state: 'BLOCKED', diagnostics: ['Environment provider lacks required OS isolation or child-process confinement.', ...probe.notes] };
    const id = `env-${this.now()}-${++this.sequence}`;
    let result: { success: boolean; diagnostics: string[] };
    try { result = await input.provider.create({ id, projectId: input.projectId, lock: input.lock, networkAllowed: false, unprivileged: true }); }
    catch (error) { return { state: 'FAILED', diagnostics: [`Environment provider failed during creation: ${String(error)}`] }; }
    if (!result.success) return { state: 'FAILED', diagnostics: result.diagnostics };
    const now = this.now();
    const record: ManagedEnvironmentRecord = { id, projectId: input.projectId, platform: input.platform, ecosystem: input.ecosystem, lockSha256: input.lock.sha256, state: 'READY', createdAt: now, lastUsedAt: now, providerId: input.provider.id };
    try { await this.store.put(record); }
    catch (error) {
      try { await input.provider.destroy(id); }
      catch (cleanupError) { return { state: 'FAILED', diagnostics: [...result.diagnostics, `Environment record persistence failed: ${String(error)}`, `Provider cleanup also failed: ${String(cleanupError)}`] }; }
      return { state: 'FAILED', diagnostics: [...result.diagnostics, `Environment record persistence failed; newly created environment was rolled back: ${String(error)}`] };
    }
    return { state: 'READY', environment: structuredClone(record), diagnostics: result.diagnostics };
  }
  async destroy(id: string, provider: EnvironmentProvider, approved: boolean): Promise<void> {
    if (!approved) throw new Error('Destroying an environment requires explicit approval.');
    const current = await this.store.get(id); if (!current || current.state === 'DESTROYED') return;
    if (current.providerId !== provider.id) throw new Error('Environment provider identity does not match the record.');
    await provider.destroy(id); await this.store.put({ ...current, state: 'DESTROYED', lastUsedAt: this.now() });
  }
  list(projectId?: string): Promise<ManagedEnvironmentRecord[]> { return this.store.list(projectId); }
}

export class MemoryEnvironmentRecordStore implements EnvironmentRecordStore {
  private readonly rows = new Map<string, ManagedEnvironmentRecord>();
  async get(id: string): Promise<ManagedEnvironmentRecord | null> { const item = this.rows.get(id); return item ? structuredClone(item) : null; }
  async put(record: ManagedEnvironmentRecord): Promise<void> { this.rows.set(record.id, structuredClone(record)); }
  async list(projectId?: string): Promise<ManagedEnvironmentRecord[]> { return [...this.rows.values()].filter((item) => !projectId || item.projectId === projectId).map((item) => structuredClone(item)); }
}

import type { KeyValueStore } from '../jobs/persistentJobs.js';
export class KeyValueEnvironmentRecordStore implements EnvironmentRecordStore {
  constructor(private readonly store: KeyValueStore) {}
  get(id: string): Promise<ManagedEnvironmentRecord | null> { return this.store.get<ManagedEnvironmentRecord>(`environment/${id}`); }
  async put(record: ManagedEnvironmentRecord): Promise<void> { await this.store.put(`environment/${record.id}`, record); }
  async list(projectId?: string): Promise<ManagedEnvironmentRecord[]> { return (await this.store.list<ManagedEnvironmentRecord>('environment/')).map((row) => row.value).filter((row) => !projectId || row.projectId === projectId); }
}
