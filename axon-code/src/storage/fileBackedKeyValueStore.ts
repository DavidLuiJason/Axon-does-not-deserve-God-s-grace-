import type { KeyValueStore } from '../jobs/persistentJobs.js';

export interface FileKeyValueHost {
  read(path: string): Promise<string | null>;
  writeAtomic(path: string, contents: string): Promise<void>;
  remove(path: string): Promise<void>;
  list(directory: string): Promise<string[]>;
}
interface FileRecord { schema: 'axon-file-kv/v1'; key: string; value: unknown; sha256: string; }
interface RecordBody { schema: 'axon-file-kv/v1'; key: string; value: unknown; }

function encodeValue(value: unknown): unknown {
  if (value instanceof Uint8Array) return { __axonUint8Array: true, data: [...value] };
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) result[key] = encodeValue(item);
    return result;
  }
  return value;
}
function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    if (row['__axonUint8Array'] === true && Array.isArray(row['data']) && row['data'].every(item => Number.isInteger(item) && item >= 0 && item <= 255)) return Uint8Array.from(row['data'] as number[]);
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(row)) result[key] = decodeValue(item);
    return result;
  }
  return value;
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort().map(key => `${JSON.stringify(key)}:${canonical(row[key])}`).join(',')}}`;
}
async function digest(value: unknown): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto SHA-256 is required for file-store integrity.');
  const bytes = new TextEncoder().encode(canonical(value));
  const hash = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function validKey(key: string): boolean {
  return typeof key === 'string' && key.length > 0 && key.length <= 512 && !/[\u0000-\u001f\u007f]/.test(key);
}

/** Atomic file-backed KeyValueStore for Node/desktop hosts. Every record is hash-checked on read. */
export class FileBackedKeyValueStore implements KeyValueStore {
  private readonly locks = new Map<string, Promise<void>>();
  private quotaTail: Promise<void> = Promise.resolve();
  constructor(private readonly rootDirectory: string, private readonly host: FileKeyValueHost, private readonly maxTotalBytes = 64 * 1024 * 1024) {
    if (!rootDirectory || !Number.isSafeInteger(maxTotalBytes) || maxTotalBytes < 1) throw new Error('File-store root and positive quota are required.');
  }

  async get<T>(key: string): Promise<T | null> {
    this.assertKey(key);
    const row = await this.readRecord(key);
    return row ? decodeValue(row.value) as T : null;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.assertKey(key);
    await this.withKeyLock(key, async () => this.writeRecord(key, value));
  }

  async mutate<T>(key: string, updater: (current: T | null) => T): Promise<T> {
    this.assertKey(key);
    return this.withKeyLock(key, async () => {
      const current = await this.readRecord(key);
      const next = updater(current ? decodeValue(current.value) as T : null);
      await this.writeRecord(key, next);
      return next;
    });
  }

  async delete(key: string): Promise<void> {
    this.assertKey(key);
    await this.withKeyLock(key, () => this.host.remove(this.filePath(key)));
  }

  async list<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
    if (typeof prefix !== 'string' || prefix.length > 512 || /[\u0000-\u001f\u007f]/.test(prefix)) throw new Error('File-store list prefix is invalid.');
    const names = await this.host.list(this.rootDirectory);
    const results: Array<{ key: string; value: T }> = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      let key: string;
      try { key = decodeURIComponent(name.slice(0, -5)); } catch { throw new Error('File-store contains a malformed record filename.'); }
      if (!validKey(key) || !key.startsWith(prefix)) continue;
      const value = await this.get<T>(key);
      if (value !== null) results.push({ key, value });
    }
    return results.sort((a, b) => a.key.localeCompare(b.key));
  }

  private async readRecord(key: string): Promise<FileRecord | null> {
    const serialized = await this.host.read(this.filePath(key));
    if (serialized === null) return null;
    let record: FileRecord;
    try { record = JSON.parse(serialized) as FileRecord; } catch { throw new Error(`File-store record is malformed for key '${key}'.`); }
    if (!record || record.schema !== 'axon-file-kv/v1' || record.key !== key || typeof record.sha256 !== 'string' || !Object.prototype.hasOwnProperty.call(record, 'value')) throw new Error(`File-store record identity or schema is invalid for key '${key}'.`);
    const body: RecordBody = { schema: record.schema, key: record.key, value: record.value };
    if (await digest(body) !== record.sha256) throw new Error(`File-store record integrity verification failed for key '${key}'.`);
    return record;
  }

  private async writeRecord(key: string, value: unknown): Promise<void> {
    const body: RecordBody = { schema: 'axon-file-kv/v1', key, value: encodeValue(value) };
    const record: FileRecord = { ...body, sha256: await digest(body) };
    const serialized = JSON.stringify(record);
    const newBytes = new TextEncoder().encode(serialized).byteLength;
    await this.withQuotaLock(async () => {
      const names = await this.host.list(this.rootDirectory);
      let usedBytes = 0;
      const target = this.fileName(key);
      for (const name of names) {
        if (!name.endsWith('.json') || name === target) continue;
        const existing = await this.host.read(this.joinRoot(name));
        if (existing !== null) usedBytes += new TextEncoder().encode(existing).byteLength;
      }
      if (usedBytes + newBytes > this.maxTotalBytes) throw new Error(`File-store quota exceeded: ${usedBytes + newBytes} bytes requested, ${this.maxTotalBytes} bytes allowed.`);
      await this.host.writeAtomic(this.filePath(key), serialized);
    });
  }

  private async withQuotaLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.quotaTail;
    let release!: () => void;
    this.quotaTail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await operation(); }
    finally { release(); }
  }

  private async withKeyLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const tail = previous.then(() => gate);
    this.locks.set(key, tail);
    await previous;
    try { return await operation(); }
    finally { release(); if (this.locks.get(key) === tail) this.locks.delete(key); }
  }

  private assertKey(key: string): void { if (!validKey(key)) throw new Error('File-store key is invalid.'); }
  private fileName(key: string): string { return `${encodeURIComponent(key)}.json`; }
  private joinRoot(name: string): string { return `${this.rootDirectory.replace(/[\\/]+$/, '')}/${name}`; }
  private filePath(key: string): string { return this.joinRoot(this.fileName(key)); }
}
