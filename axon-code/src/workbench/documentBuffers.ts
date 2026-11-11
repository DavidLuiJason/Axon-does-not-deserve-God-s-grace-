import type { AtomicWorkspaceFileStore, WorkingCopyManager } from '../workspace/workingCopy.js';
import { normalizeProjectPath } from '../pathSafety.js';

export type DocumentContentSource = 'USER' | 'AXON_BRAIN';
export interface DocumentBufferSnapshot { workspaceId: string; path: string; baseText: string; bufferText: string; dirty: boolean; source: DocumentContentSource; approvalReference: string; updatedAt: number; }

/**
 * Editor buffer adapter. The caller supplies every byte of proposed content.
 * AXON Code does not generate/author code; it stages and commits user- or
 * AXON-Brain-supplied changes against a version-checked working copy.
 */
export class DocumentBufferManager {
  private readonly buffers = new Map<string, DocumentBufferSnapshot>();
  constructor(private readonly store: AtomicWorkspaceFileStore, private readonly now: () => number = Date.now, private readonly maxDocumentBytes = 8 * 1024 * 1024, private readonly maxOpenDocuments = 128) {
    if (!Number.isSafeInteger(maxDocumentBytes) || maxDocumentBytes < 1 || !Number.isSafeInteger(maxOpenDocuments) || maxOpenDocuments < 1 || maxOpenDocuments > 10_000) throw new Error('Invalid document buffer limit.');
  }
  async open(workspaceId: string, path: string): Promise<DocumentBufferSnapshot> {
    const canonical = normalizeProjectPath(path);
    if (!workspaceId.trim() || canonical !== path || !canonical) throw new Error('Invalid document identity.');
    const text = await this.store.read(workspaceId, canonical);
    if (text === null) throw new Error(`Document '${canonical}' was not found.`);
    this.assertSize(text);
    const key = keyOf(workspaceId, canonical);
    const existing = this.buffers.get(key);
    if (existing) return structuredClone(existing);
    if (this.buffers.size >= this.maxOpenDocuments) throw new Error('Open document buffer limit reached; save or close a document before opening another.');
    const snapshot: DocumentBufferSnapshot = { workspaceId, path: canonical, baseText: text, bufferText: text, dirty: false, source: 'USER', approvalReference: 'opened-read-only', updatedAt: this.now() };
    this.buffers.set(key, snapshot); return structuredClone(snapshot);
  }
  supplyContent(input: { workspaceId: string; path: string; content: string; source: DocumentContentSource; approvalReference: string }): DocumentBufferSnapshot {
    if (!input || typeof input !== 'object' || !['USER', 'AXON_BRAIN'].includes(input.source) || typeof input.approvalReference !== 'string' || !input.approvalReference.trim()) throw new Error('A valid USER/AXON_BRAIN content source and approval reference are required.');
    const key = keyOf(input.workspaceId, input.path); const current = this.buffers.get(key);
    if (!current) throw new Error('Open the document before supplying replacement content.');
    if (input.source !== 'USER' && input.source !== 'AXON_BRAIN') throw new Error('Only user- or AXON-Brain-supplied content is accepted.');
    if (!input.approvalReference.trim()) throw new Error('A content-supply reference is required.');
    this.assertSize(input.content);
    const updated = { ...current, bufferText: input.content, dirty: input.content !== current.baseText, source: input.source, approvalReference: input.approvalReference, updatedAt: this.now() };
    this.buffers.set(key, updated); return structuredClone(updated);
  }
  async save(workspaceId: string, path: string, approval: { approved: boolean; approvalReference: string }): Promise<DocumentBufferSnapshot> {
    const key = keyOf(workspaceId, path); const current = this.buffers.get(key);
    if (!current) throw new Error('Document is not open.');
    if (!current.dirty) return structuredClone(current);
    if (!approval || approval.approved !== true || typeof approval.approvalReference !== 'string' || !approval.approvalReference.trim()) throw new Error('Saving modified source requires explicit approval.' );
    const saved = await this.store.compareAndWrite(workspaceId, path, current.baseText, current.bufferText);
    if (!saved) throw new Error('Document source changed outside this buffer; refusing to overwrite a stale snapshot.');
    const next = { ...current, baseText: current.bufferText, dirty: false, approvalReference: approval.approvalReference, updatedAt: this.now() };
    this.buffers.set(key, next); return structuredClone(next);
  }
  discard(workspaceId: string, path: string): void {
    const key = keyOf(workspaceId, path); const current = this.buffers.get(key);
    if (!current) return;
    if (current.dirty) this.buffers.set(key, { ...current, bufferText: current.baseText, dirty: false, updatedAt: this.now() });
  }
  close(workspaceId: string, path: string, allowDiscard: boolean): void {
    const key = keyOf(workspaceId, path); const current = this.buffers.get(key);
    if (current?.dirty && !allowDiscard) throw new Error('Document has unsaved changes; explicit discard approval is required.');
    this.buffers.delete(key);
  }
  list(workspaceId?: string): DocumentBufferSnapshot[] { return [...this.buffers.values()].filter((item) => !workspaceId || item.workspaceId === workspaceId).map((item) => structuredClone(item)); }
  private assertSize(content: string): void { if (typeof content !== 'string' || new TextEncoder().encode(content).byteLength > this.maxDocumentBytes) throw new Error('Document exceeds the configured buffer size.'); }
}
function keyOf(workspaceId: string, path: string): string {
  if (typeof workspaceId !== 'string' || !workspaceId.trim() || /[\u0000-\u001f\u007f]/.test(workspaceId) || typeof path !== 'string' || normalizeProjectPath(path) !== path) throw new Error('Invalid workspace/document key.');
  return `${workspaceId}\u0000${path}`;
}

/** Type-level helper for callers that want to expose a WorkingCopyManager-backed buffer store. */
export type DocumentWorkingCopy = WorkingCopyManager;
