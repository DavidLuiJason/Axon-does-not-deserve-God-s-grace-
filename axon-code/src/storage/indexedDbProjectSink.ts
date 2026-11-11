import type { KeyValueStore } from '../jobs/persistentJobs.js';
import type { TransactionalExtractionSink } from '../security/zipExtractor.js';

interface ActiveProjectVersion { versionId: string; committedAt: number; }
interface ProjectFileManifest { path: string; sizeBytes: number; chunkCount: number; }
interface ProjectManifest { projectId: string; versionId: string; committedAt: number; files: ProjectFileManifest[]; }
interface ExtractionSession { projectId: string; versionId: string; prefix: string; currentPath: string | null; expectedBytes: number; actualBytes: number; chunkCount: number; files: ProjectFileManifest[]; }

let versionCounter = 0;

/**
 * Transactional project sink over KeyValueStore. With IndexedDbKeyValueStore this
 * persists project chunks in IndexedDB; the active-version pointer is written last,
 * so an interrupted extraction never replaces the last committed project snapshot.
 */
export class IndexedDbProjectExtractionSink implements TransactionalExtractionSink {
  private session: ExtractionSession | null = null;
  constructor(private readonly store: KeyValueStore, private readonly now: () => number = Date.now) {}

  async begin(projectId: string): Promise<void> {
    if (this.session) throw new Error('An extraction is already active in this sink.');
    if (!projectId.trim()) throw new Error('Project ID is required.');
    const versionId = `${this.now()}-${++versionCounter}`;
    const prefix = `axon-projects/${projectId}/versions/${versionId}/`;
    this.session = { projectId, versionId, prefix, currentPath: null, expectedBytes: 0, actualBytes: 0, chunkCount: 0, files: [] };
  }

  async beginFile(path: string, expectedBytes: number): Promise<void> {
    const session = this.requireSession();
    if (session.currentPath !== null || session.files.some((file) => file.path === path) || !path || !Number.isSafeInteger(expectedBytes) || expectedBytes < 0) {
      throw new Error('Project sink rejected an invalid or duplicate file entry.');
    }
    session.currentPath = path; session.expectedBytes = expectedBytes; session.actualBytes = 0; session.chunkCount = 0;
  }

  async writeChunk(path: string, chunk: Uint8Array): Promise<void> {
    const session = this.requireSession();
    if (session.currentPath !== path || !(chunk instanceof Uint8Array)) throw new Error('Chunk does not match the active project file.');
    session.actualBytes += chunk.byteLength;
    if (session.actualBytes > session.expectedBytes) throw new Error('Project sink received more bytes than the declared file size.');
    const key = `${session.prefix}files/${encodeURIComponent(path)}/chunk/${String(session.chunkCount).padStart(8, '0')}`;
    await this.store.put(key, new Uint8Array(chunk));
    session.chunkCount += 1;
  }

  async endFile(path: string): Promise<void> {
    const session = this.requireSession();
    if (session.currentPath !== path || session.actualBytes !== session.expectedBytes) throw new Error('Project file byte count does not match its declared size.');
    session.files.push({ path, sizeBytes: session.actualBytes, chunkCount: session.chunkCount });
    session.currentPath = null; session.expectedBytes = 0; session.actualBytes = 0; session.chunkCount = 0;
  }

  async commit(): Promise<void> {
    const session = this.requireSession();
    if (session.currentPath !== null) throw new Error('Cannot commit while a project file is incomplete.');
    const committedAt = this.now();
    const manifest: ProjectManifest = { projectId: session.projectId, versionId: session.versionId, committedAt, files: [...session.files] };
    await this.store.put(`${session.prefix}manifest`, manifest);
    const activeKey = `axon-projects/${session.projectId}/active`;
    await this.store.mutate<ActiveProjectVersion>(activeKey, () => ({ versionId: session.versionId, committedAt }));
    this.session = null;
  }

  async rollback(_reason: string): Promise<void> {
    const session = this.session;
    if (!session) return;
    const rows = await this.store.list(`${session.prefix}`);
    for (const row of rows) await this.store.delete(row.key);
    this.session = null;
  }

  private requireSession(): ExtractionSession {
    if (!this.session) throw new Error('No active project extraction exists.');
    return this.session;
  }
}

/** Reads only the currently committed version; incomplete staging versions are invisible. */
export class IndexedDbProjectReader {
  constructor(private readonly store: KeyValueStore) {}

  async readFile(projectId: string, path: string): Promise<Uint8Array | null> {
    const active = await this.store.get<ActiveProjectVersion>(`axon-projects/${projectId}/active`);
    if (!active) return null;
    const prefix = `axon-projects/${projectId}/versions/${active.versionId}/`;
    const manifest = await this.store.get<ProjectManifest>(`${prefix}manifest`);
    if (!manifest || manifest.projectId !== projectId || manifest.versionId !== active.versionId) throw new Error('Active project manifest is missing or inconsistent.');
    const file = manifest.files.find((item) => item.path === path);
    if (!file) return null;
    const chunks: Uint8Array[] = [];
    for (let index = 0; index < file.chunkCount; index += 1) {
      const chunk = await this.store.get<Uint8Array>(`${prefix}files/${encodeURIComponent(path)}/chunk/${String(index).padStart(8, '0')}`);
      if (!(chunk instanceof Uint8Array)) throw new Error(`Committed project chunk ${index} is missing.`);
      chunks.push(chunk);
    }
    const result = new Uint8Array(file.sizeBytes);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    if (offset !== file.sizeBytes) throw new Error('Committed project file size does not match its manifest.');
    return result;
  }

  async listFiles(projectId: string): Promise<string[]> {
    const active = await this.store.get<ActiveProjectVersion>(`axon-projects/${projectId}/active`);
    if (!active) return [];
    const manifest = await this.store.get<ProjectManifest>(`axon-projects/${projectId}/versions/${active.versionId}/manifest`);
    if (!manifest || manifest.projectId !== projectId) throw new Error('Active project manifest is missing or inconsistent.');
    return manifest.files.map((file) => file.path).sort();
  }
}
