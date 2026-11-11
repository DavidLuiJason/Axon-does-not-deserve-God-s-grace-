import type { CodePatch } from '../types.js';
import type { KeyValueStore } from '../jobs/persistentJobs.js';
import { normalizeProjectPath } from '../pathSafety.js';

export interface WorkspaceFileStore {
  /** Implementations must map this token only into user-data storage, never AXON's protected source. */
  read(workspaceId: string, path: string): Promise<string | null>;
  write(workspaceId: string, path: string, content: string): Promise<void>;
  delete(workspaceId: string, path: string): Promise<void>;
  list(workspaceId: string): Promise<string[]>;
}

export interface AtomicWorkspaceFileStore extends WorkspaceFileStore {
  writeIfAbsent(workspaceId: string, path: string, content: string): Promise<boolean>;
  compareAndWrite(workspaceId: string, path: string, expectedContent: string, nextContent: string): Promise<boolean>;
  deleteIfContent(workspaceId: string, path: string, expectedContent: string): Promise<boolean>;
}

export interface WorkspaceApproval {
  approvedByUser: boolean;
  approvalReference?: string;
}

export interface AppliedWorkspacePatch {
  id: string;
  file: string;
  before: string;
  after: string;
  reason: string;
  appliedAt: number;
  undoneAt?: number;
}

export interface WorkspaceJournalStore {
  read(workspaceId: string): Promise<AppliedWorkspacePatch[]>;
  write(workspaceId: string, entries: readonly AppliedWorkspacePatch[]): Promise<void>;
  mutate(workspaceId: string, updater: (entries: AppliedWorkspacePatch[]) => AppliedWorkspacePatch[]): Promise<AppliedWorkspacePatch[]>;
}

export class KeyValueWorkspaceJournalStore implements WorkspaceJournalStore {
  constructor(private readonly store: KeyValueStore) {}
  async read(workspaceId: string): Promise<AppliedWorkspacePatch[]> {
    return (await this.store.get<AppliedWorkspacePatch[]>(`workspace-journal/${workspaceId}`)) ?? [];
  }
  async write(workspaceId: string, entries: readonly AppliedWorkspacePatch[]): Promise<void> {
    await this.store.put(`workspace-journal/${workspaceId}`, [...entries]);
  }
  async mutate(workspaceId: string, updater: (entries: AppliedWorkspacePatch[]) => AppliedWorkspacePatch[]): Promise<AppliedWorkspacePatch[]> {
    return this.store.mutate<AppliedWorkspacePatch[]>(`workspace-journal/${workspaceId}`, (current) => updater(current ?? []));
  }
}

export class MemoryWorkspaceJournalStore implements WorkspaceJournalStore {
  private readonly rows = new Map<string, AppliedWorkspacePatch[]>();
  async read(workspaceId: string): Promise<AppliedWorkspacePatch[]> { return structuredClone(this.rows.get(workspaceId) ?? []); }
  async write(workspaceId: string, entries: readonly AppliedWorkspacePatch[]): Promise<void> { this.rows.set(workspaceId, structuredClone([...entries])); }
  async mutate(workspaceId: string, updater: (entries: AppliedWorkspacePatch[]) => AppliedWorkspacePatch[]): Promise<AppliedWorkspacePatch[]> {
    const next = updater(structuredClone(this.rows.get(workspaceId) ?? []));
    this.rows.set(workspaceId, structuredClone(next));
    return structuredClone(next);
  }
}

const validPath = (path: string): boolean => normalizeProjectPath(path) === path;

/** User-data working copy manager with version-checked patching and a pluggable durable undo journal. */
export class WorkingCopyManager {
  constructor(
    private readonly store: AtomicWorkspaceFileStore,
    private readonly journal: WorkspaceJournalStore = new MemoryWorkspaceJournalStore(),
    private readonly now: () => number = Date.now
  ) {}

  async create(workspaceId: string, files: Readonly<Record<string, string>>): Promise<void> {
    if (!workspaceId.trim()) throw new Error('Workspace ID is required.');
    const entries = Object.entries(files);
    if (!entries.length) throw new Error('A working copy requires at least one file.');
    const seen = new Set<string>();
    for (const [path, content] of entries) {
      if (!validPath(path) || typeof content !== 'string' || seen.has(path)) throw new Error(`Invalid working-copy file '${path}' (duplicate or unsafe path).`);
      seen.add(path);
    }
    const written: Array<{ path: string; content: string }> = [];
    try {
      for (const [path, content] of entries) {
        const created = await this.store.writeIfAbsent(workspaceId, path, content);
        if (!created) throw new Error(`Working-copy file '${path}' already exists.`);
        written.push({ path, content });
      }
      await this.journal.write(workspaceId, []);
    } catch (error) {
      let cleanupFailed = false;
      for (const item of written.reverse()) {
        const deleted = await this.store.deleteIfContent(workspaceId, item.path, item.content).catch(() => false);
        if (!deleted) cleanupFailed = true;
      }
      if (cleanupFailed) throw new Error(`Working-copy creation failed and rollback was incomplete: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async applyPatch(workspaceId: string, patch: CodePatch, approval: WorkspaceApproval): Promise<AppliedWorkspacePatch> {
    if (!validPath(patch.file)) throw new Error('Patch path is unsafe.');
    if (patch.safety !== 'mechanical' && (!approval.approvedByUser || !approval.approvalReference?.trim())) {
      throw new Error('Logic-changing or unknown patches require explicit user approval and an approval reference.');
    }
    const current = await this.store.read(workspaceId, patch.file);
    if (current === null) throw new Error(`Workspace file '${patch.file}' does not exist.`);
    if (current !== patch.baseText) throw new Error('Patch source snapshot is stale; refusing to apply.');
    if (!Number.isInteger(patch.startOffset) || !Number.isInteger(patch.endOffset) || patch.startOffset < 0 || patch.endOffset < patch.startOffset || patch.endOffset > current.length) {
      throw new Error('Patch offsets are invalid.');
    }
    if (current.slice(patch.startOffset, patch.endOffset) !== patch.oldText) throw new Error('Patch oldText does not match the current source range.');
    const after = current.slice(0, patch.startOffset) + patch.newText + current.slice(patch.endOffset);
    const changed = await this.store.compareAndWrite(workspaceId, patch.file, current, after);
    if (!changed) throw new Error('Workspace file changed during patch application; refusing a concurrent stale write.');
    const record: AppliedWorkspacePatch = {
      id: `${workspaceId}:${this.now()}:${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
      file: patch.file, before: current, after, reason: patch.reason, appliedAt: this.now()
    };
    try {
      await this.journal.mutate(workspaceId, (history) => [...history, record]);
    } catch (error) {
      const rolledBack = await this.store.compareAndWrite(workspaceId, patch.file, after, current).catch(() => false);
      if (!rolledBack) throw new Error(`Patch journal failed and safe rollback could not be confirmed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
    return { ...record };
  }

  async undo(workspaceId: string, patchId?: string): Promise<AppliedWorkspacePatch> {
    const history = await this.journal.read(workspaceId);
    const index = [...history].map((entry, i) => ({ entry, i })).reverse()
      .find(({ entry }) => !entry.undoneAt && (patchId === undefined || entry.id === patchId));
    if (!index) throw new Error('No matching applied patch is available to undo.');
    const record = index.entry;
    const current = await this.store.read(workspaceId, record.file);
    if (current !== record.after) throw new Error('Workspace file changed after the patch; refusing unsafe undo.');
    const restored = await this.store.compareAndWrite(workspaceId, record.file, record.after, record.before);
    if (!restored) throw new Error('Workspace file changed during undo; refusing a concurrent overwrite.');
    const updated = { ...record, undoneAt: this.now() };
    try {
      await this.journal.mutate(workspaceId, (entries) => {
        const at = entries.findIndex((entry) => entry.id === record.id);
        if (at < 0 || entries[at]?.undoneAt) throw new Error('Patch journal changed before undo could be committed.');
        const next = [...entries]; next[at] = updated; return next;
      });
    } catch (error) {
      const restoredForward = await this.store.compareAndWrite(workspaceId, record.file, record.before, record.after).catch(() => false);
      if (!restoredForward) throw new Error(`Undo journal failed and safe rollback could not be confirmed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
    return updated;
  }

  async snapshot(workspaceId: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const path of await this.store.list(workspaceId)) {
      const content = await this.store.read(workspaceId, path);
      if (content !== null) result[path] = content;
    }
    return result;
  }
}

export class MemoryWorkspaceFileStore implements AtomicWorkspaceFileStore {
  private readonly workspaces = new Map<string, Map<string, string>>();
  async read(workspaceId: string, path: string): Promise<string | null> { return this.workspaces.get(workspaceId)?.get(path) ?? null; }
  async write(workspaceId: string, path: string, content: string): Promise<void> {
    const files = this.workspaces.get(workspaceId) ?? new Map<string, string>();
    files.set(path, content); this.workspaces.set(workspaceId, files);
  }
  async writeIfAbsent(workspaceId: string, path: string, content: string): Promise<boolean> {
    const files = this.workspaces.get(workspaceId) ?? new Map<string, string>();
    if (files.has(path)) return false;
    files.set(path, content); this.workspaces.set(workspaceId, files); return true;
  }
  async compareAndWrite(workspaceId: string, path: string, expectedContent: string, nextContent: string): Promise<boolean> {
    const files = this.workspaces.get(workspaceId);
    if (!files || files.get(path) !== expectedContent) return false;
    files.set(path, nextContent); return true;
  }
  async delete(workspaceId: string, path: string): Promise<void> { this.workspaces.get(workspaceId)?.delete(path); }
  async deleteIfContent(workspaceId: string, path: string, expectedContent: string): Promise<boolean> {
    const files = this.workspaces.get(workspaceId);
    if (!files || files.get(path) !== expectedContent) return false;
    files.delete(path);
    return true;
  }
  async list(workspaceId: string): Promise<string[]> { return [...(this.workspaces.get(workspaceId)?.keys() ?? [])].sort(); }
}
