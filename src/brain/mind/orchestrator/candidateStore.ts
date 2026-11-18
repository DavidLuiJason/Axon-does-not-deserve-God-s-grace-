// CANDIDATE STORE (pure). Keeps what reflection proposed to learn, as CANDIDATES only (never trusted knowledge), and can be saved and restored as text.
// The app decides where that text is kept; nothing here promotes a candidate or touches the Charter, permissions or source.
import type { Candidate } from '../reflect/reflect.ts';

export const STORE_LIMIT = 200;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const kindOk = (k: unknown): k is Candidate['kind'] => k === 'LESSON' || k === 'MISTAKE' || k === 'PREFERENCE' || k === 'TOOL_NOTE';
const clean = (v: unknown): Candidate | null => {
  if (!isObj(v) || !kindOk(v.kind) || typeof v.text !== 'string' || v.text.trim() === '' || v.text.length > 500 || v.stage !== 'CANDIDATE') return null;
  if (typeof v.needsRegressionTest !== 'boolean' || typeof v.source !== 'string' || v.source.length > 200) return null;
  if (v.expiresAfterDays !== null && !(typeof v.expiresAfterDays === 'number' && Number.isInteger(v.expiresAfterDays) && v.expiresAfterDays > 0 && v.expiresAfterDays <= 3650)) return null;
  if (v.kind === 'MISTAKE' && v.needsRegressionTest !== true) return null;
  return { kind: v.kind, text: v.text, stage: 'CANDIDATE', needsRegressionTest: v.needsRegressionTest, expiresAfterDays: v.expiresAfterDays as number | null, source: v.source };
};

export function createCandidateStore() {
  let items: Candidate[] = [];
  const key = (c: Candidate): string => c.kind + '|' + c.text;
  return {
    add(candidates: readonly Candidate[]): number {
      let added = 0;
      for (const raw of candidates) {
        const c = clean(raw);
        if (c === null || items.some((x) => key(x) === key(c))) continue;
        items.push(c);
        added++;
      }
      if (items.length > STORE_LIMIT) items = items.slice(items.length - STORE_LIMIT);
      return added;
    },
    list(): readonly Candidate[] { return items.map((c) => ({ ...c })); },
    size(): number { return items.length; },
    exportText(): string { return JSON.stringify({ version: 1, items }); },
    /** Replaces the store with saved text. Anything invalid is refused as a whole and the store stays as it was. */
    importText(text: string): boolean {
      let data: unknown;
      try { data = JSON.parse(text); } catch { return false; }
      if (!isObj(data) || data.version !== 1 || !Array.isArray(data.items) || data.items.length > STORE_LIMIT) return false;
      const next: Candidate[] = [];
      for (const raw of data.items) {
        const c = clean(raw);
        if (c === null) return false;
        if (!next.some((x) => key(x) === key(c))) next.push(c);
      }
      items = next;
      return true;
    },
  };
}
