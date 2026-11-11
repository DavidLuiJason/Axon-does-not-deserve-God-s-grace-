import { StoragePressureError } from './memory-store.mjs';

function estimateBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

/** IndexedDB-backed append-only observation store with bounded eviction. */
export class IndexedDbPreservationStore {
  constructor({ databaseName = 'axon-screen-intelligence', maxBytes = 128 * 1024 * 1024, maxRecords = 10000, indexedDB = globalThis.indexedDB } = {}) {
    if (!indexedDB) throw new Error('IndexedDB is unavailable in this runtime.');
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024) throw new RangeError('maxBytes must be at least 1024.');
    if (!Number.isSafeInteger(maxRecords) || maxRecords < 1) throw new RangeError('maxRecords must be positive.');
    this.databaseName = databaseName;
    this.maxBytes = maxBytes;
    this.maxRecords = maxRecords;
    this.indexedDB = indexedDB;
    this.dbPromise = null;
  }
  async #db() {
    if (!this.dbPromise) this.dbPromise = new Promise((resolve, reject) => {
      const request = this.indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const records = db.createObjectStore('observations', { keyPath: 'id' });
        records.createIndex('sessionId', 'sessionId', { unique: false });
        records.createIndex('createdAt', 'createdAt', { unique: false });
        db.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
    });
    return this.dbPromise;
  }
  async append(observation, { pinned = false } = {}) {
    const db = await this.#db();
    const bytes = estimateBytes(observation);
    if (bytes > this.maxBytes) throw new StoragePressureError('Observation exceeds the configured persistent-store limit.');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['observations', 'meta'], 'readwrite');
      const records = tx.objectStore('observations');
      const meta = tx.objectStore('meta');
      let result;
      const usageReq = meta.get('usage');
      usageReq.onsuccess = () => {
        const usage = usageReq.result ?? { key: 'usage', bytes: 0, count: 0 };
        const existingReq = records.get(observation.id);
        existingReq.onsuccess = () => {
          if (existingReq.result) { result = { stored: true, duplicate: true, bytes: 0 }; return; }
          const incoming = { ...observation, _storeBytes: bytes, _pinned: Boolean(pinned), createdAt: observation.timestamp.utc };
        if (usage.bytes + bytes <= this.maxBytes && usage.count < this.maxRecords) {
          records.put(incoming);
          meta.put({ key: 'usage', bytes: usage.bytes + bytes, count: usage.count + 1 });
          result = { stored: true, bytes };
          return;
        }
        const cursorReq = records.index('createdAt').openCursor();
        let currentBytes = usage.bytes;
        let currentCount = usage.count;
        const evictNext = (cursor) => {
          if (currentBytes + bytes <= this.maxBytes && currentCount < this.maxRecords) {
            records.put(incoming);
            meta.put({ key: 'usage', bytes: currentBytes + bytes, count: currentCount + 1 });
            result = { stored: true, bytes };
            return;
          }
          if (!cursor) {
            tx.abort();
            reject(new StoragePressureError());
            return;
          }
          const value = cursor.value;
          if (!value._pinned) {
            currentBytes -= value._storeBytes ?? estimateBytes(value);
            currentCount -= 1;
            cursor.delete();
          }
          cursor.continue();
        };
        cursorReq.onsuccess = () => evictNext(cursorReq.result);
        };
        existingReq.onerror = () => { try { tx.abort(); } catch { /* transaction already closed */ } };
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed.'));
      tx.onabort = () => { if (!result) reject(tx.error ?? new StoragePressureError()); };
    });
  }
  async list(sessionId) {
    const db = await this.#db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('observations', 'readonly');
      const request = sessionId
        ? tx.objectStore('observations').index('sessionId').getAll(sessionId)
        : tx.objectStore('observations').getAll();
      request.onsuccess = () => resolve(request.result
        .sort((a, b) => String(a.timestamp?.utc).localeCompare(String(b.timestamp?.utc)) || a.sequence - b.sequence)
        .map(({ _storeBytes, _pinned, createdAt, ...item }) => item));
      request.onerror = () => reject(request.error);
    });
  }
  async get(id) {
    const db = await this.#db();
    return new Promise((resolve, reject) => {
      const request = db.transaction('observations', 'readonly').objectStore('observations').get(id);
      request.onsuccess = () => {
        if (!request.result) return resolve(null);
        const { _storeBytes, _pinned, createdAt, ...item } = request.result;
        resolve(item);
      };
      request.onerror = () => reject(request.error);
    });
  }
  async pin(id, pinned = true) {
    const db = await this.#db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('observations', 'readwrite');
      const store = tx.objectStore('observations');
      const request = store.get(id);
      let found = false;
      request.onsuccess = () => {
        if (!request.result) return;
        found = true;
        request.result._pinned = Boolean(pinned);
        store.put(request.result);
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve(found);
      tx.onerror = () => reject(tx.error);
    });
  }
  async deleteSession(sessionId) {
    const db = await this.#db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['observations', 'meta'], 'readwrite');
      const records = tx.objectStore('observations');
      const request = records.index('sessionId').openCursor(IDBKeyRange.only(sessionId));
      let removed = 0;
      let removedBytes = 0;
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          if (!cursor.value._pinned) {
            removed += 1;
            removedBytes += cursor.value._storeBytes ?? estimateBytes(cursor.value);
            cursor.delete();
          }
          cursor.continue();
          return;
        }
        const usageRequest = tx.objectStore('meta').get('usage');
        usageRequest.onsuccess = () => {
          const usage = usageRequest.result ?? { key: 'usage', bytes: 0, count: 0 };
          tx.objectStore('meta').put({ key: 'usage', bytes: Math.max(0, usage.bytes - removedBytes), count: Math.max(0, usage.count - removed) });
        };
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve({ removed });
      tx.onerror = () => reject(tx.error);
    });
  }
  async stats() {
    const db = await this.#db();
    return new Promise((resolve, reject) => {
      const request = db.transaction('meta', 'readonly').objectStore('meta').get('usage');
      request.onsuccess = () => resolve({ ...(request.result ?? { bytes: 0, count: 0 }), maxBytes: this.maxBytes, maxRecords: this.maxRecords });
      request.onerror = () => reject(request.error);
    });
  }
  async close() { if (this.dbPromise) (await this.dbPromise).close(); this.dbPromise = null; }
}
