import type { KeyValueStore } from '../jobs/persistentJobs.js';
import type { CapturedProjectFile, ProjectSelection, ProjectSelectionManager } from './projectSelection.js';
import type { AtomicWorkspaceFileStore } from './workingCopy.js';

export interface ConditionalWorkspaceFileStore extends AtomicWorkspaceFileStore {}

export interface RemovePreview {
  id: string;
  workspaceId: string;
  selection: ProjectSelection;
  fileCount: number;
  totalBytes: number;
  fingerprint: string;
  confirmationPhrase: string;
  createdAt: number;
  expiresAt: number;
}
export interface RemoveApproval { approvedByUser: boolean; approvalReference: string; confirmationText: string; }
export type TrashStatus = 'PREPARED' | 'COMMITTED' | 'RESTORING' | 'RESTORED' | 'RECOVERY_REQUIRED';
interface WorkspaceLockRecord { owner: string; expiresAt: number; }
export interface WorkspaceTrashRecord {
  id: string;
  workspaceId: string;
  createdAt: number;
  status: TrashStatus;
  fingerprint: string;
  files: CapturedProjectFile[];
  lastError?: string;
}
export interface RemoveResult { status: 'REMOVED_TO_TRASH' | 'RESTORED' | 'RECOVERY_REQUIRED'; trashId: string; fileCount: number; }

function createId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `trash-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

class SerialByWorkspace {
  private readonly tails = new Map<string, Promise<void>>();
  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.tails.set(key, current);
    await previous.catch(() => undefined);
    try { return await task(); }
    finally { release(); if (this.tails.get(key) === current) this.tails.delete(key); }
  }
}

/** Durable, approval-gated soft removal. The host store must implement atomic compare/delete and create-if-absent. */
export class WorkspaceLifecycleManager {
  private readonly previews = new Map<string, RemovePreview>();
  private readonly locks = new SerialByWorkspace();
  constructor(
    private readonly source: ConditionalWorkspaceFileStore,
    private readonly journal: KeyValueStore,
    private readonly selectionManager: ProjectSelectionManager,
    private readonly previewTtlMs = 5 * 60_000,
    private readonly now: () => number = Date.now
  ) {
    if (!Number.isSafeInteger(previewTtlMs) || previewTtlMs < 1_000) throw new Error('Removal preview lifetime is invalid.');
    if (typeof source.deleteIfContent !== 'function' || typeof source.writeIfAbsent !== 'function') throw new Error('Workspace removal requires atomic compare-and-delete and create-if-absent host operations.');
  }

  async previewRemove(selection: ProjectSelection): Promise<RemovePreview> {
    const files = await this.selectionManager.capture(selection);
    const existingPaths = await this.source.list(selection.workspaceId);
    const removesAll = files.length === existingPaths.length && files.every((file) => existingPaths.includes(file.path));
    const phrase = removesAll ? `REMOVE ALL ${files.length} FILES` : `REMOVE ${files.length} SELECTED FILES`;
    const createdAt = this.now();
    const preview: RemovePreview = {
      id: createId(), workspaceId: selection.workspaceId, selection: structuredClone(selection), fileCount: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0), fingerprint: selection.fingerprint,
      confirmationPhrase: phrase, createdAt, expiresAt: createdAt + this.previewTtlMs
    };
    this.previews.set(preview.id, preview);
    return structuredClone(preview);
  }

  async confirmRemove(previewId: string, approval: RemoveApproval): Promise<RemoveResult> {
    const preview = this.previews.get(previewId);
    if (!preview) throw new Error('Removal preview is missing or has already been used.');
    if (this.now() > preview.expiresAt) { this.previews.delete(previewId); throw new Error('Removal preview expired; generate a new preview.'); }
    if (!approval || approval.approvedByUser !== true || typeof approval.approvalReference !== 'string' || !approval.approvalReference.trim()) throw new Error('Explicit user approval and an approval reference are required.');
    if (approval.confirmationText !== preview.confirmationPhrase) throw new Error('Removal confirmation phrase does not match the preview.');
    return this.withWorkspaceLock(preview.workspaceId, async (renewLock) => {
      const files = await this.selectionManager.capture(preview.selection);
      const record: WorkspaceTrashRecord = { id: createId(), workspaceId: preview.workspaceId, createdAt: this.now(), status: 'PREPARED', fingerprint: preview.fingerprint, files };
      await this.journal.put(`workspace-trash/${record.id}`, record);
      try {
        for (const file of files) {
          await renewLock();
          const ok = await this.source.deleteIfContent(preview.workspaceId, file.path, file.content);
          if (!ok) throw new Error(`File '${file.path}' changed or disappeared during removal; removal aborted.`);
        }
        record.status = 'COMMITTED';
        await this.journal.put(`workspace-trash/${record.id}`, record);
        this.previews.delete(previewId);
        return { status: 'REMOVED_TO_TRASH', trashId: record.id, fileCount: files.length };
      } catch (error) {
        record.status = 'RESTORING';
        record.lastError = error instanceof Error ? error.message : String(error);
        await this.journal.put(`workspace-trash/${record.id}`, record);
        const recovery = await this.restoreRecord(record, renewLock);
        this.previews.delete(previewId);
        if (recovery.status !== 'RESTORED') return { status: 'RECOVERY_REQUIRED', trashId: record.id, fileCount: files.length };
        throw error;
      }
    });
  }

  async undoRemove(trashId: string): Promise<RemoveResult> {
    const record = await this.journal.get<WorkspaceTrashRecord>(`workspace-trash/${trashId}`);
    if (!record || (record.status !== 'COMMITTED' && record.status !== 'RESTORING' && record.status !== 'RECOVERY_REQUIRED')) throw new Error('No committed or recoverable removal exists for this ID.');
    return this.withWorkspaceLock(record.workspaceId, async (renewLock) => {
      record.status = 'RESTORING';
      await this.journal.put(`workspace-trash/${record.id}`, record);
      const result = await this.restoreRecord(record, renewLock);
      return { status: result.status === 'RESTORED' ? 'RESTORED' : 'RECOVERY_REQUIRED', trashId: record.id, fileCount: record.files.length };
    });
  }

  async recoverInterruptedRemovals(workspaceId?: string): Promise<RemoveResult[]> {
    const rows = await this.journal.list<WorkspaceTrashRecord>('workspace-trash/');
    const results: RemoveResult[] = [];
    for (const row of rows) {
      const record = row.value;
      if (workspaceId && record.workspaceId !== workspaceId) continue;
      if (record.status !== 'PREPARED' && record.status !== 'RESTORING' && record.status !== 'RECOVERY_REQUIRED') continue;
      const result = await this.withWorkspaceLock(record.workspaceId, async (renewLock) => this.restoreRecord(record, renewLock));
      results.push({ status: result.status, trashId: record.id, fileCount: record.files.length });
    }
    return results;
  }

  async listTrash(workspaceId: string): Promise<WorkspaceTrashRecord[]> {
    const rows = await this.journal.list<WorkspaceTrashRecord>('workspace-trash/');
    return rows.map((row) => row.value).filter((record) => record.workspaceId === workspaceId).sort((a, b) => b.createdAt - a.createdAt);
  }

  private async withWorkspaceLock<T>(workspaceId: string, task: (renew: () => Promise<void>) => Promise<T>): Promise<T> {
    return this.locks.run(workspaceId, async () => {
      const owner = createId();
      const key = `workspace-lock/${workspaceId}`;
      const leaseMs = 10 * 60_000;
      await this.journal.mutate<WorkspaceLockRecord>(key, (current) => {
        if (current && current.expiresAt > this.now()) throw new Error('Another workspace action is already running; retry after it completes.');
        return { owner, expiresAt: this.now() + leaseMs };
      });
      const renew = async (): Promise<void> => {
        await this.journal.mutate<WorkspaceLockRecord>(key, (current) => {
          if (!current || current.owner !== owner || current.expiresAt <= this.now()) throw new Error('Workspace action lease was lost; stopping safely.');
          return { owner, expiresAt: this.now() + leaseMs };
        });
      };
      try { return await task(renew); }
      finally {
        await this.journal.mutate<WorkspaceLockRecord>(key, (current) => current?.owner === owner ? { owner: '', expiresAt: 0 } : (current ?? { owner: '', expiresAt: 0 })).catch(() => undefined);
      }
    });
  }

  private async restoreRecord(record: WorkspaceTrashRecord, renewLock: () => Promise<void>): Promise<{ status: 'RESTORED' | 'RECOVERY_REQUIRED' }> {
    try {
      for (const file of record.files) {
        await renewLock();
        const current = await this.source.read(record.workspaceId, file.path);
        if (current === file.content) continue;
        if (current !== null) throw new Error(`Cannot restore '${file.path}' because newer or conflicting content exists.`);
        const restored = await this.source.writeIfAbsent(record.workspaceId, file.path, file.content);
        if (!restored && await this.source.read(record.workspaceId, file.path) !== file.content) throw new Error(`Atomic restore conflict for '${file.path}'.`);
      }
      record.status = 'RESTORED';
      delete record.lastError;
      await this.journal.put(`workspace-trash/${record.id}`, record);
      return { status: 'RESTORED' };
    } catch (error) {
      record.status = 'RECOVERY_REQUIRED';
      record.lastError = error instanceof Error ? error.message : String(error);
      await this.journal.put(`workspace-trash/${record.id}`, record);
      return { status: 'RECOVERY_REQUIRED' };
    }
  }
}
