import type { KeyValueStore } from '../jobs/persistentJobs.js';

/** Durable browser/Android-WebView storage adapter. It requires IndexedDB from
 * the host; Node tests use a test double and do not prove device persistence. */
export class IndexedDbKeyValueStore implements KeyValueStore {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly databaseName = 'axon-code-user-workspace', private readonly storeName = 'records', private readonly factory: IDBFactory | undefined = globalThis.indexedDB) {
    if (!databaseName || !storeName) throw new Error('Database and object-store names are required.');
  }

  private open(): Promise<IDBDatabase> {
    if (!this.factory) return Promise.reject(new Error('IndexedDB is unavailable in this host environment.'));
    if (this.databasePromise) return this.databasePromise;
    const opening: Promise<IDBDatabase> = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory?.open(this.databaseName, 1);
      if (!request) { reject(new Error('Unable to open IndexedDB.')); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
      request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another open connection.'));
    });
    this.databasePromise = opening.catch((error: unknown): never => { this.databasePromise = null; throw error; });
    return this.databasePromise;
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const request = tx.objectStore(this.storeName).get(key);
      request.onsuccess = () => resolve(request.result ? request.result.value as T : null);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB read transaction aborted.'));
    });
  }

  async put<T>(key: string, value: T): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write transaction aborted.'));
    });
  }

  async mutate<T>(key: string, updater: (current: T | null) => T): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);
      let updated: T;
      request.onsuccess = () => {
        try {
          const current = request.result ? request.result.value as T : null;
          updated = updater(current);
          store.put({ key, value: updated });
        } catch (error) {
          tx.abort();
          reject(error);
        }
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB atomic read failed.'));
      tx.oncomplete = () => resolve(updated as T);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB atomic update failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB atomic update aborted.'));
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB delete transaction aborted.'));
    });
  }

  async list<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const results: Array<{ key: string; value: T }> = [];
      const tx = db.transaction(this.storeName, 'readonly');
      const request = tx.objectStore(this.storeName).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const row = cursor.value as { key: string; value: T };
        if (row.key.startsWith(prefix)) results.push({ key: row.key, value: row.value });
        cursor.continue();
      };
      tx.oncomplete = () => resolve(results.sort((a, b) => a.key.localeCompare(b.key)));
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB list failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB list transaction aborted.'));
    });
  }

  async close(): Promise<void> {
    if (!this.databasePromise) return;
    const db = await this.databasePromise;
    db.close();
    this.databasePromise = null;
  }
}
