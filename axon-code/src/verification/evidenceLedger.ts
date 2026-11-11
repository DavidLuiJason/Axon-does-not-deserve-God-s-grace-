import { sha256Hex } from '../environment/packageManager.js';
import { redactSensitiveText } from '../security/secretRedactor.js';
import { prepareLogRecord } from '../security/securityArtifactRedaction.js';
export type EvidenceStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN' | 'UNVERIFIED';
export interface EvidenceRecord { id: string; projectId: string; operation: string; status: EvidenceStatus; at: number; summary: string; runtimeId?: string; artifactSha256?: string; previousHash: string; recordHash: string; }
export interface EvidenceStore { list(projectId: string): Promise<EvidenceRecord[]>; append(projectId: string, expectedPreviousHash: string, record: EvidenceRecord): Promise<void>; }
export class MemoryEvidenceStore implements EvidenceStore {
  private readonly rows = new Map<string, EvidenceRecord[]>();
  async list(projectId: string): Promise<EvidenceRecord[]> { return structuredClone(this.rows.get(projectId) ?? []); }
  async append(projectId: string, expectedPreviousHash: string, record: EvidenceRecord): Promise<void> { const rows = this.rows.get(projectId) ?? []; if ((rows.at(-1)?.recordHash ?? 'GENESIS') !== expectedPreviousHash) throw new Error('Evidence head changed concurrently; refusing to fork the hash chain.'); if (rows.some((row) => row.id === record.id)) throw new Error('Duplicate evidence record ID.'); if (record.previousHash !== expectedPreviousHash) throw new Error('Evidence record previous hash does not match the expected chain head.'); rows.push(structuredClone(record)); this.rows.set(projectId, rows); }
}

/** Append-only, hash-chained technical evidence. Host storage durability is supplied by an EvidenceStore adapter. */
export class EvidenceLedger {
  private sequence = 0;
  private readonly tails = new Map<string, Promise<void>>();
  constructor(private readonly store: EvidenceStore, private readonly now: () => number = Date.now, private readonly maxSummaryChars = 4000, private readonly maxRecordsPerProject = 20_000) {
    if (!Number.isSafeInteger(maxSummaryChars) || maxSummaryChars < 1 || !Number.isSafeInteger(maxRecordsPerProject) || maxRecordsPerProject < 1) throw new Error('Invalid evidence retention limits.');
  }
  async append(input: { projectId: string; operation: string; status: EvidenceStatus; summary: string; runtimeId?: string; artifactSha256?: string }): Promise<EvidenceRecord> {
    if (!input.projectId.trim() || input.projectId.length > 200 || /[\u0000-\u001f\u007f]/.test(input.projectId) || !input.operation.trim() || typeof input.summary !== 'string' || input.summary.length > this.maxSummaryChars) throw new Error('Evidence identity or summary is invalid.');
    if (input.artifactSha256 && !/^[a-f0-9]{64}$/i.test(input.artifactSha256)) throw new Error('Artifact SHA-256 is malformed.');
    const previousTail = this.tails.get(input.projectId) ?? Promise.resolve();
    let release!: () => void;
    const currentTail = new Promise<void>((resolve) => { release = resolve; });
    this.tails.set(input.projectId, currentTail);
    await previousTail;
    try {
      const rows = await this.store.list(input.projectId);
      if (rows.length >= this.maxRecordsPerProject) throw new Error('Evidence history reached its configured retention limit; archive the project evidence before appending more.');
      const previous = rows.at(-1)?.recordHash ?? 'GENESIS';
      const timestamp = this.now();
      const random = globalThis.crypto?.randomUUID?.() ?? `${timestamp}-${++this.sequence}`;
      const data = prepareLogRecord({ id: `ev-${random}`, projectId: input.projectId, operation: input.operation, status: input.status, at: timestamp, summary: redactSensitiveText(input.summary, 'diagnostics'), ...(input.runtimeId ? { runtimeId: redactSensitiveText(input.runtimeId, 'diagnostics') } : {}), ...(input.artifactSha256 ? { artifactSha256: input.artifactSha256.toLowerCase() } : {}), previousHash: previous });
      const recordHash = await sha256Hex(new TextEncoder().encode(JSON.stringify(data)));
      const record: EvidenceRecord = { ...data, recordHash };
      await this.store.append(input.projectId, previous, record);
      return structuredClone(record);
    } finally { release(); if (this.tails.get(input.projectId) === currentTail) this.tails.delete(input.projectId); }
  }
  async verify(projectId: string): Promise<{ valid: boolean; checked: number; reason?: string }> {
    const rows = await this.store.list(projectId); let previous = 'GENESIS';
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]!;
      if (row.previousHash !== previous) return { valid: false, checked: index, reason: `Evidence chain link ${index} has an invalid previous hash.` };
      const { recordHash, ...data } = row;
      const expected = await sha256Hex(new TextEncoder().encode(JSON.stringify(data)));
      if (expected !== recordHash) return { valid: false, checked: index, reason: `Evidence record ${index} has been altered.` };
      previous = recordHash;
    }
    return { valid: true, checked: rows.length };
  }
}

import type { KeyValueStore } from '../jobs/persistentJobs.js';
export class KeyValueEvidenceStore implements EvidenceStore {
  constructor(private readonly store: KeyValueStore) {}
  async list(projectId: string): Promise<EvidenceRecord[]> { return (await this.store.get<EvidenceRecord[]>(`evidence/${projectId}`)) ?? []; }
  async append(projectId: string, expectedPreviousHash: string, record: EvidenceRecord): Promise<void> {
    await this.store.mutate<EvidenceRecord[]>(`evidence/${projectId}`, (current) => {
      const rows = current ?? [];
      if ((rows.at(-1)?.recordHash ?? 'GENESIS') !== expectedPreviousHash) throw new Error('Evidence head changed concurrently; refusing to fork the hash chain.');
      if (record.previousHash !== expectedPreviousHash) throw new Error('Evidence record previous hash does not match the expected chain head.');
      if (rows.some((row) => row.id === record.id)) throw new Error('Duplicate evidence record ID.');
      return [...rows, record];
    });
  }
}
