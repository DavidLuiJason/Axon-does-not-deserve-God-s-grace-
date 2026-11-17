// Storage backend for routine-store.mjs on top of localStorage (or any storage with getItem/setItem). Never throws.
// One key, one JSON string, size-capped. The global app state keeps its own key in src/state/storage.ts; this does not touch it.
export const ROUTINES_STORAGE_KEY = 'axon.routines.v1';

export function createLocalBackend({ storage = globalThis.localStorage, key = ROUTINES_STORAGE_KEY, maxBytes = 400000 } = {}) {
  return {
    async load() { try { return storage?.getItem(key) ?? null; } catch { return null; } },
    async save(text) {
      if (typeof text !== 'string' || text.length > maxBytes) throw new Error('routines-too-large');
      if (!storage) throw new Error('no-storage');
      storage.setItem(key, text);
    },
  };
}

export const PROFILES_STORAGE_KEY = 'axon.app-profiles.v1';
/** Load and save the owner's app names and notes (see axon-apps/app-profiles.mjs) under their own key. */
export function createProfilesPersistence({ storage = globalThis.localStorage, key = PROFILES_STORAGE_KEY } = {}) {
  return {
    async load() { try { const raw = storage?.getItem(key); return raw ? JSON.parse(raw) : {}; } catch { return {}; } },
    async save(profiles) { try { storage.setItem(key, JSON.stringify(profiles.toJSON())); return true; } catch { return false; } },
  };
}
