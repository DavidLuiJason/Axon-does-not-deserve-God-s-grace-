/** Small versioned per-tool store. Corrupt/future data is never silently replaced. */
export const TOOL_STORE_SCHEMA_VERSION = 1 as const;
export const TOOL_STORE_LIMITS = { bytesPerTool: 200 * 1024, keyLength: 256 } as const;
export interface ToolStoreStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export type ToolStoreError = 'invalid-tool-id' | 'invalid-key' | 'invalid-value' | 'value-too-large' | 'store-too-large' | 'storage-read-failed' | 'storage-write-failed' | 'storage-remove-failed' | 'invalid-stored-data' | 'newer-schema' | 'export-failed' | 'erase-blocked';
export type StoreResult<T extends object = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: ToolStoreError; message: string };
interface StoredShape { schemaVersion: number; values: Record<string, unknown> }
const fail = (error: ToolStoreError, message: string): { ok: false; error: ToolStoreError; message: string } => ({ ok: false, error, message });
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const memoryStorage = (): ToolStoreStorage => { const map = new Map<string,string>(); return { getItem: k => map.get(k) ?? null, setItem: (k,v) => { map.set(k,v); }, removeItem: k => { map.delete(k); } }; };
function safeJson(value: unknown): string | null { try { const s = JSON.stringify(value); return typeof s === 'string' ? s : null; } catch { return null; } }
function bytes(s: string): number { return new TextEncoder().encode(s).byteLength; }
function validStored(value: unknown): value is StoredShape { return object(value) && typeof value.schemaVersion === 'number' && Number.isSafeInteger(value.schemaVersion) && object(value.values); }
export function createToolStore(toolId: string, storage?: ToolStoreStorage) {
  const validId = typeof toolId === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(toolId);
  const key = validId ? `axon.tool.${toolId}.v1` : '';
  const target = storage ?? memoryStorage();
  let values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  let issue: { error: ToolStoreError; message: string } | null = validId ? null : { error: 'invalid-tool-id', message: 'Tool ID must use lowercase letters, digits and hyphens.' };
  let blocked = false;
  if (validId) {
    try {
      const raw = target.getItem(key);
      if (raw !== null) {
        if (bytes(raw) > TOOL_STORE_LIMITS.bytesPerTool) { issue = { error: 'store-too-large', message: 'Stored data exceeds the per-tool size limit; it was left untouched.' }; blocked = true; }
        else {
          let parsed: unknown;
          try { parsed = JSON.parse(raw); } catch { parsed = null; }
          if (!validStored(parsed)) { issue = { error: 'invalid-stored-data', message: 'Stored data is corrupt or has an invalid structure; it was left untouched.' }; blocked = true; }
          else if (parsed.schemaVersion > TOOL_STORE_SCHEMA_VERSION) { issue = { error: 'newer-schema', message: 'Stored data uses a newer schema and was left untouched.' }; blocked = true; }
          else if (parsed.schemaVersion !== TOOL_STORE_SCHEMA_VERSION) { issue = { error: 'invalid-stored-data', message: 'Stored data schema is unsupported; it was left untouched.' }; blocked = true; }
          else {
            const clone: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
            for (const [k,v] of Object.entries(parsed.values)) {
              if (!validKey(k) || safeJson(v) === null) { issue = { error: 'invalid-stored-data', message: 'Stored data contains an invalid key or value; it was left untouched.' }; blocked = true; break; }
              Object.defineProperty(clone,k,{value:v,enumerable:true,configurable:true,writable:true});
            }
            if (!blocked) values = clone;
          }
        }
      }
    } catch { issue = { error: 'storage-read-failed', message: 'Stored data could not be read; no writes will be attempted until recovery.' }; blocked = true; }
  }
  function validKey(k: unknown): k is string { return typeof k === 'string' && k.length > 0 && k.length <= TOOL_STORE_LIMITS.keyLength && !/[\u0000-\u001f\u007f]/u.test(k); }
  function snapshot(next: Record<string, unknown>): string | null { const data: StoredShape = { schemaVersion: TOOL_STORE_SCHEMA_VERSION, values: next }; return safeJson(data); }
  function persist(next: Record<string, unknown>): StoreResult {
    if (issue) return { ok: false, error: issue.error, message: issue.message };
    const raw = snapshot(next); if (raw === null) return fail('invalid-value','Values must be JSON-serializable.');
    if (bytes(raw) > TOOL_STORE_LIMITS.bytesPerTool) return fail('store-too-large',`Store would exceed ${TOOL_STORE_LIMITS.bytesPerTool} bytes.`);
    try { target.setItem(key,raw); values = next; return { ok:true }; }
    catch { return fail('storage-write-failed','Data could not be saved; the in-memory value was not changed.'); }
  }
  return {
    key,
    status(): StoreResult { return issue ? {ok:false,error:issue.error,message:issue.message} : {ok:true}; },
    get(k: unknown): StoreResult<{ value: unknown | null }> {
      if (issue) return {ok:false,error:issue.error,message:issue.message};
      if (!validKey(k)) return fail('invalid-key','Key must be a non-empty string within the key limit.');
      const encoded = safeJson(values[k]);
      if (Object.prototype.hasOwnProperty.call(values,k) && encoded === null) return fail('invalid-stored-data','Stored value cannot be safely copied.');
      return {ok:true,value:Object.prototype.hasOwnProperty.call(values,k) ? JSON.parse(encoded as string) as unknown : null};
    },
    set(k: unknown, value: unknown): StoreResult {
      if (issue) return {ok:false,error:issue.error,message:issue.message};
      if (!validKey(k)) return fail('invalid-key','Key must be a non-empty string within the key limit.');
      const encoded = safeJson(value); if (encoded === null) return fail('invalid-value','Value must be JSON-serializable and cannot be undefined.');
      if (bytes(encoded) > TOOL_STORE_LIMITS.bytesPerTool) return fail('value-too-large',`Value exceeds ${TOOL_STORE_LIMITS.bytesPerTool} bytes.`);
      const next: Record<string,unknown> = Object.create(null) as Record<string,unknown>;
      for (const [name,v] of Object.entries(values)) Object.defineProperty(next,name,{value:v,enumerable:true,configurable:true,writable:true});
      Object.defineProperty(next,k,{value:JSON.parse(encoded) as unknown,enumerable:true,configurable:true,writable:true});
      return persist(next);
    },
    remove(k: unknown): StoreResult {
      if (issue) return {ok:false,error:issue.error,message:issue.message};
      if (!validKey(k)) return fail('invalid-key','Key must be a non-empty string within the key limit.');
      const next: Record<string,unknown> = Object.create(null) as Record<string,unknown>;
      for (const [name,v] of Object.entries(values)) if (name !== k) Object.defineProperty(next,name,{value:v,enumerable:true,configurable:true,writable:true});
      return persist(next);
    },
    exportData(): StoreResult<{ text: string }> {
      if (issue) return {ok:false,error:issue.error,message:issue.message};
      const raw = snapshot(values); if (raw === null) return fail('export-failed','Data could not be serialized.');
      if (bytes(raw) > TOOL_STORE_LIMITS.bytesPerTool) return fail('store-too-large','Data exceeds the export size limit.');
      return {ok:true,text:raw};
    },
    // eraseAll() refuses to wipe unreadable (corrupt, too large, newer-schema) data by accident; an explicit user action passes { force: true },
    // otherwise a corrupt store could never be repaired and the tool would stay broken for good.
    eraseAll(options?: { force?: boolean }): StoreResult {
      if (!validId) return fail('invalid-tool-id','Tool ID must use lowercase letters, digits and hyphens.');
      if (issue && blocked && options?.force !== true) return fail('erase-blocked','Unsafe stored data was left untouched; call eraseAll({ force: true }) after the person confirms.');
      try { target.removeItem(key); values = Object.create(null) as Record<string,unknown>; issue = null; blocked = false; return {ok:true}; }
      catch { return fail('storage-remove-failed','Stored data could not be erased.'); }
    },
  };
}
