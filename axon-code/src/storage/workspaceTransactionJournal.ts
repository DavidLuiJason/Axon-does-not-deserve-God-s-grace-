import type { KeyValueStore } from '../jobs/persistentJobs.js';
import { normalizeProjectPath } from '../pathSafety.js';

export type WorkspaceTransactionState = 'PREPARED' | 'COMMITTED' | 'ABORTED';
export interface WorkspaceTransactionRecord {
  id: string;
  workspaceId: string;
  path: string;
  state: WorkspaceTransactionState;
  beforeSha256: string | null;
  afterSha256: string;
  createdAt: number;
  updatedAt: number;
  note?: string;
}

async function hashText(value: string | null): Promise<string | null> {
  if (value === null) return null;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto SHA-256 is required for workspace transaction journaling.');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Durable intent journal. A PREPARED record is never silently replayed: recovery compares the actual file hash and reports the required action. */
export class WorkspaceTransactionJournal {
  constructor(private readonly store: KeyValueStore, private readonly now: () => number = Date.now, private readonly maxRecords = 5000) {
    if (!Number.isSafeInteger(maxRecords) || maxRecords < 1) throw new Error('Journal record limit must be a positive safe integer.');
  }

  async prepare(input: { id: string; workspaceId: string; path: string; before: string | null; after: string }): Promise<WorkspaceTransactionRecord> {
    if (!input.id.trim() || !input.workspaceId.trim() || normalizeProjectPath(input.path) !== input.path || typeof input.after !== 'string' || (input.before !== null && typeof input.before !== 'string')) {
      throw new Error('Workspace transaction identity or path is invalid.');
    }
    const timestamp = this.now();
    const record: WorkspaceTransactionRecord = { id: input.id, workspaceId: input.workspaceId, path: input.path, state: 'PREPARED',
      beforeSha256: await hashText(input.before), afterSha256: (await hashText(input.after))!, createdAt: timestamp, updatedAt: timestamp };
    await this.store.mutate<WorkspaceTransactionRecord[]>(this.key(input.workspaceId), (current) => {
      const rows = current ?? [];
      if (rows.some((row) => row.id === input.id)) throw new Error('Workspace transaction ID already exists.');
      if (rows.length >= this.maxRecords) throw new Error('Workspace transaction journal reached its configured limit.');
      return [...rows, record];
    });
    return record;
  }

  async finish(workspaceId: string, id: string, state: 'COMMITTED' | 'ABORTED', note?: string): Promise<WorkspaceTransactionRecord> {
    let updated: WorkspaceTransactionRecord | undefined;
    await this.store.mutate<WorkspaceTransactionRecord[]>(this.key(workspaceId), (current) => {
      const rows = current ?? [];
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) throw new Error('Workspace transaction does not exist.');
      const row = rows[index]!;
      if (row.state !== 'PREPARED') throw new Error('Only a PREPARED transaction can be finalized.');
      updated = { ...row, state, updatedAt: this.now(), ...(note ? { note: note.slice(0, 500) } : {}) };
      const next = [...rows]; next[index] = updated; return next;
    });
    return updated!;
  }

  async inspectRecovery(workspaceId: string, readFile: (path: string) => Promise<string | null>): Promise<Array<{ record: WorkspaceTransactionRecord; disposition: 'ALREADY_APPLIED' | 'NOT_APPLIED' | 'CONFLICT' }>> {
    const rows = await this.store.get<WorkspaceTransactionRecord[]>(this.key(workspaceId)) ?? [];
    const results = [];
    for (const record of rows) {
      if (record.workspaceId !== workspaceId || normalizeProjectPath(record.path) !== record.path) throw new Error('Workspace transaction journal contains an invalid record.');
      if (record.state !== 'PREPARED') continue;
      const actual = await hashText(await readFile(record.path));
      const disposition = actual === record.afterSha256 ? 'ALREADY_APPLIED' : actual === record.beforeSha256 ? 'NOT_APPLIED' : 'CONFLICT';
      results.push({ record, disposition } as const);
    }
    return results;
  }

  async list(workspaceId: string): Promise<WorkspaceTransactionRecord[]> {
    return (await this.store.get<WorkspaceTransactionRecord[]>(this.key(workspaceId))) ?? [];
  }

  private key(workspaceId: string): string { return `workspace-tx/${workspaceId}`; }
}
