import type { KeyValueStore } from '../jobs/persistentJobs.js';
import { isPortableProjectPath } from '../pathSafety.js';
import type { AtomicWorkspaceFileStore } from '../workspace/workingCopy.js';

interface WorkspaceFileRecord {
  schema: 'axon-workspace-file/v1';
  workspaceId: string;
  path: string;
  content: string;
  updatedAt: number;
  deleted?: false;
}
interface WorkspaceFileTombstone {
  schema: 'axon-workspace-file/v1';
  workspaceId: string;
  path: string;
  updatedAt: number;
  deleted: true;
}
type StoredWorkspaceFile = WorkspaceFileRecord | WorkspaceFileTombstone;

/**
 * Persistent workspace adapter over KeyValueStore (normally IndexedDbKeyValueStore).
 * Every compare/write/delete operation is a single atomic KeyValueStore mutation.
 * It addresses only the user workspace namespace, never AXON's protected source.
 */
export class IndexedDbWorkspaceFileStore implements AtomicWorkspaceFileStore {
  constructor(private readonly store: KeyValueStore, private readonly now: () => number = Date.now, private readonly maxFileBytes = 16 * 1024 * 1024) {
    if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 1) throw new Error('Workspace file size limit must be a positive safe integer.');
  }

  async read(workspaceId: string, path: string): Promise<string | null> {
    this.validate(workspaceId, path);
    const record = await this.store.get<StoredWorkspaceFile>(this.fileKey(workspaceId, path));
    if (!record) return null;
    this.validateRecord(record, workspaceId, path);
    return record.deleted ? null : record.content;
  }

  async write(workspaceId: string, path: string, content: string): Promise<void> {
    this.validate(workspaceId, path); this.validateContent(content);
    await this.store.mutate<StoredWorkspaceFile>(this.fileKey(workspaceId, path), (current) => {
      if (current) this.validateRecord(current, workspaceId, path);
      return this.activeRecord(workspaceId, path, content);
    });
  }

  async delete(workspaceId: string, path: string): Promise<void> {
    this.validate(workspaceId, path);
    const key = this.fileKey(workspaceId, path);
    await this.store.mutate<StoredWorkspaceFile>(key, (current) => {
      if (current) this.validateRecord(current, workspaceId, path);
      return this.tombstone(workspaceId, path);
    });
  }

  async list(workspaceId: string): Promise<string[]> {
    this.validateWorkspaceId(workspaceId);
    const rows = await this.store.list<StoredWorkspaceFile>(this.workspacePrefix(workspaceId));
    const paths = new Set<string>();
    for (const row of rows) {
      if (!row.value) throw new Error('Persistent workspace contains an empty record.');
      this.validateRecord(row.value, workspaceId, row.value.path);
      if (row.key !== this.fileKey(workspaceId, row.value.path)) throw new Error('Persistent workspace record key does not match its canonical path.');
      if (!row.value.deleted) paths.add(row.value.path);
    }
    return [...paths].sort((a, b) => a.localeCompare(b));
  }

  async writeIfAbsent(workspaceId: string, path: string, content: string): Promise<boolean> {
    this.validate(workspaceId, path); this.validateContent(content);
    let created = false;
    await this.store.mutate<StoredWorkspaceFile>(this.fileKey(workspaceId, path), (current) => {
      if (current) this.validateRecord(current, workspaceId, path);
      if (current && !current.deleted) return current;
      created = true;
      return this.activeRecord(workspaceId, path, content);
    });
    return created;
  }

  async compareAndWrite(workspaceId: string, path: string, expectedContent: string, nextContent: string): Promise<boolean> {
    this.validate(workspaceId, path); this.validateContent(expectedContent); this.validateContent(nextContent);
    let changed = false;
    await this.store.mutate<StoredWorkspaceFile>(this.fileKey(workspaceId, path), (current) => {
      if (current) this.validateRecord(current, workspaceId, path);
      if (!current || current.deleted || current.content !== expectedContent) return current ?? this.tombstone(workspaceId, path);
      changed = true;
      return this.activeRecord(workspaceId, path, nextContent);
    });
    return changed;
  }

  async deleteIfContent(workspaceId: string, path: string, expectedContent: string): Promise<boolean> {
    this.validate(workspaceId, path); this.validateContent(expectedContent);
    let deleted = false;
    await this.store.mutate<StoredWorkspaceFile>(this.fileKey(workspaceId, path), (current) => {
      if (current) this.validateRecord(current, workspaceId, path);
      if (!current || current.deleted || current.content !== expectedContent) return current ?? this.tombstone(workspaceId, path);
      deleted = true;
      return this.tombstone(workspaceId, path);
    });
    return deleted;
  }

  private validate(workspaceId: string, path: string): void {
    this.validateWorkspaceId(workspaceId);
    if (!isPortableProjectPath(path)) throw new Error(`Workspace path is unsafe or non-portable: '${path}'.`);
  }
  private validateWorkspaceId(workspaceId: string): void {
    if (typeof workspaceId !== 'string' || !workspaceId.trim() || workspaceId.length > 200 || /[\u0000-\u001f\u007f]/.test(workspaceId)) throw new Error('Workspace ID must be a non-empty, bounded identifier.');
  }
  private validateContent(content: string): void {
    if (typeof content !== 'string') throw new Error('Workspace content must be text.');
    if (new TextEncoder().encode(content).byteLength > this.maxFileBytes) throw new Error(`Workspace file exceeds ${this.maxFileBytes} bytes.`);
  }
  private validateRecord(record: StoredWorkspaceFile, workspaceId: string, path: string): void {
    if (record.schema !== 'axon-workspace-file/v1' || record.workspaceId !== workspaceId || record.path !== path || !isPortableProjectPath(record.path)) throw new Error('Persistent workspace record failed identity or path validation.');
    if (!record.deleted) this.validateContent(record.content);
  }
  private workspacePrefix(workspaceId: string): string { return `axon-user-workspaces/${encodeURIComponent(workspaceId)}/files/`; }
  private fileKey(workspaceId: string, path: string): string { return `${this.workspacePrefix(workspaceId)}${encodeURIComponent(path)}`; }
  private activeRecord(workspaceId: string, path: string, content: string): WorkspaceFileRecord {
    return { schema: 'axon-workspace-file/v1', workspaceId, path, content, updatedAt: this.now() };
  }
  private tombstone(workspaceId: string, path: string): WorkspaceFileTombstone {
    return { schema: 'axon-workspace-file/v1', workspaceId, path, updatedAt: this.now(), deleted: true };
  }
}
