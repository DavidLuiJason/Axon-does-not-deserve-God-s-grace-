/** Deterministic bounded store used by tests and non-persistent runtimes. */
export class StoragePressureError extends Error {
  constructor(message = 'No safe storage capacity remains for this observation.') {
    super(message);
    this.name = 'StoragePressureError';
    this.code = 'STORAGE_PRESSURE';
  }
}

function estimateBytes(value) {
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }
  catch { return Infinity; }
}

export class MemoryPreservationStore {
  #records = new Map();
  #bytes = 0;
  constructor({ maxBytes = 4 * 1024 * 1024, maxRecords = 2000 } = {}) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024) throw new RangeError('maxBytes must be at least 1024');
    if (!Number.isSafeInteger(maxRecords) || maxRecords < 1) throw new RangeError('maxRecords must be positive');
    this.maxBytes = maxBytes;
    this.maxRecords = maxRecords;
  }
  async append(observation, { pinned = false } = {}) {
    const bytes = estimateBytes(observation);
    if (!Number.isFinite(bytes) || bytes > this.maxBytes) throw new StoragePressureError('Observation exceeds the preservation-store limit.');
    if (this.#records.has(observation.id)) return { stored: true, duplicate: true, bytes: 0 };
    while (this.#bytes + bytes > this.maxBytes || this.#records.size >= this.maxRecords) {
      const oldest = [...this.#records.values()].find((entry) => !entry.pinned);
      if (!oldest) throw new StoragePressureError();
      this.#records.delete(oldest.observation.id);
      this.#bytes -= oldest.bytes;
    }
    this.#records.set(observation.id, { observation, bytes, pinned: Boolean(pinned) });
    this.#bytes += bytes;
    return { stored: true, duplicate: false, bytes };
  }
  async list(sessionId) {
    return [...this.#records.values()]
      .map((entry) => entry.observation)
      .filter((item) => !sessionId || item.sessionId === sessionId)
      .sort((a, b) => String(a.timestamp?.utc).localeCompare(String(b.timestamp?.utc)) || a.sequence - b.sequence);
  }
  async get(id) { return this.#records.get(id)?.observation ?? null; }
  async deleteSession(sessionId) {
    let removed = 0;
    for (const [id, entry] of this.#records) {
      if (entry.observation.sessionId === sessionId && !entry.pinned) {
        this.#records.delete(id);
        this.#bytes -= entry.bytes;
        removed += 1;
      }
    }
    return { removed };
  }
  async pin(id, pinned = true) {
    const entry = this.#records.get(id);
    if (!entry) return false;
    entry.pinned = Boolean(pinned);
    return true;
  }
  async stats() { return { records: this.#records.size, bytes: this.#bytes, maxBytes: this.maxBytes, maxRecords: this.maxRecords }; }
  async close() {}
}
