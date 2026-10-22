import { detectConvertible, planFileConversion, type ConvertibleFile, type FilePlanError } from './fileConvertPlan';
export const BATCH_LIMITS = Object.freeze({ maxFiles: 50, maxTotalBytes: 100 * 1024 * 1024, maxImageFiles: 30, maxHeldBytes: 64 * 1024 * 1024 });
export type BatchErrorCode = 'invalid-input' | 'too-many-files' | 'too-large' | 'too-many-images' | 'memory-cap' | 'unknown-id' | 'already-completed' | 'cancelled' | 'duplicate-name' | 'zip-limit';
export type BatchError = { ok: false; error: BatchErrorCode; message: string };
export type BatchItem = { id: string; name: string; size: number; head: Uint8Array; status: 'ready' | 'skipped'; reason?: string; outputName: string };
export type BatchPlan = { ok: true; to: string; items: BatchItem[]; totalBytes: number };
export type BatchOutput = { id: string; name: string; bytes: Uint8Array; sizeBefore: number; message?: string };
export type BatchSnapshot = { ready: number; done: number; failed: number; skipped: number; remaining: number; percent: number; state: 'idle' | 'running' | 'cancelled' | 'done' };
export type BatchCompletion = { ok: true } | BatchError;
export type BatchRun = { next: () => BatchItem | null; complete: (id: string, result: { ok: boolean; bytes?: Uint8Array; message?: string }) => BatchCompletion; cancel: () => void; snapshot: () => BatchSnapshot; drain: () => BatchOutput[]; reportRows: () => BatchReportRow[] };
export type BatchReportRow = { name: string; result: 'converted' | 'failed' | 'skipped' | 'cancelled'; sizeBefore: number; sizeAfter?: number; note: string };
export const BATCH_CONVERT_DESCRIPTOR = { toolId: 'batch-convert', displayName: 'Batch Convert Planner', purpose: 'Plan one-target conversions for multiple files, track safe execution, and produce a report and ZIP-ready outputs.', examples: ['Convert a group of CSV files to JSON.', 'Plan a batch of pictures for WebP output.', 'Review failed and skipped conversions before making a ZIP.'], inputs: [{ name: 'files', kind: 'file' as const }, { name: 'to', kind: 'choice' as const }, { name: 'maxHeldBytes', kind: 'text' as const }] };
const error = (code: BatchErrorCode, message: string): BatchError => ({ ok: false, error: code, message });
const key = (s: string) => s.normalize('NFC').toLocaleLowerCase('en-US');
const ext = (s: string) => { const b = s.split(/[\\/]/).pop() ?? ''; const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i) : ''; };
function uniqueName(name: string, used: Set<string>, inputNames: Set<string>): string {
 const suffix = ext(name); const base = suffix ? name.slice(0, -suffix.length) : name; let candidate = name, n = 2;
 while (used.has(key(candidate)) || inputNames.has(key(candidate))) { candidate = `${base}-${n}${suffix}`; n++; }
 used.add(key(candidate)); return candidate;
}
export function planBatch(files: ConvertibleFile[], to: string): BatchPlan | BatchError {
 if (!Array.isArray(files)) return error('invalid-input', 'Provide a list of files.');
 if (files.length > BATCH_LIMITS.maxFiles) return error('too-many-files', `A batch can contain at most ${BATCH_LIMITS.maxFiles} files.`);
 let totalBytes = 0, imageFiles = 0;
 for (const f of files) {
  if (!f || typeof f.name !== 'string' || !Number.isSafeInteger(f.size) || f.size < 0 || !(f.head instanceof Uint8Array)) return error('invalid-input', 'Every file needs a name, non-negative integer size, and Uint8Array header.');
  totalBytes += f.size; if (!Number.isSafeInteger(totalBytes) || totalBytes > BATCH_LIMITS.maxTotalBytes) return error('too-large', `Batch total exceeds ${BATCH_LIMITS.maxTotalBytes} bytes (100 MiB).`);
  const d = detectConvertible(f); if (d.ok && d.family === 'image') imageFiles++;
 }
 if (imageFiles > BATCH_LIMITS.maxImageFiles) return error('too-many-images', `A batch can contain at most ${BATCH_LIMITS.maxImageFiles} image files.`);
 const used = new Set<string>(), inputNames = new Set(files.map(f => key(f.name)));
 const items: BatchItem[] = files.map((f, index) => {
  const detection = detectConvertible(f); const plan = detection.ok && detection.family !== 'unsupported' ? planFileConversion(f, to) : null;
  if (!detection.ok || detection.family === 'unsupported' || !plan || !plan.ok) {
   const reason = !detection.ok ? detection.message : detection.family === 'unsupported' ? detection.reason : (plan as FilePlanError | null)?.message ?? `This file cannot become ${String(to).toUpperCase()}.`;
   const name = uniqueName(f.name, used, inputNames); return { id: `file-${index + 1}`, name: f.name, size: f.size, head: f.head, status: 'skipped', reason, outputName: name };
  }
  const name = uniqueName(plan.outputName, used, inputNames); return { id: `file-${index + 1}`, name: f.name, size: f.size, head: f.head, status: 'ready', outputName: name };
 });
 return { ok: true, to, items, totalBytes };
}
export function createBatchRun(plan: BatchPlan, options?: { maxHeldBytes?: number }): BatchRun | BatchError {
 if (!plan || plan.ok !== true || !Array.isArray(plan.items)) return error('invalid-input', 'Provide a valid batch plan.');
 const cap = options?.maxHeldBytes ?? BATCH_LIMITS.maxHeldBytes;
 if (!Number.isSafeInteger(cap) || cap < 0 || cap > BATCH_LIMITS.maxTotalBytes) return error('invalid-input', `maxHeldBytes must be from 0 to ${BATCH_LIMITS.maxTotalBytes}.`);
 const statuses = new Map<string, 'ready' | 'running' | 'done' | 'failed' | 'skipped'>(); const byId = new Map<string, BatchItem>();
 for (const item of plan.items) { if (!item || typeof item.id !== 'string' || byId.has(item.id)) return error('invalid-input', 'Batch item ids must be unique strings.'); byId.set(item.id, item); statuses.set(item.id, item.status === 'skipped' ? 'skipped' : 'ready'); }
 let state: BatchSnapshot['state'] = 'idle'; let held: BatchOutput[] = []; let heldBytes = 0; const notes = new Map<string, string>(); const sizesAfter = new Map<string, number>();
 const snapshot = (): BatchSnapshot => {
  let ready = 0, done = 0, failed = 0, skipped = 0, running = 0;
  for (const s of statuses.values()) { if (s === 'ready') ready++; else if (s === 'running') running++; else if (s === 'done') done++; else if (s === 'failed') failed++; else skipped++; }
  const total = statuses.size, finished = done + failed + skipped; const percent = total ? Math.floor(finished * 100 / total) : 100;
  if (state !== 'cancelled' && ready === 0 && running === 0) state = 'done'; else if (state !== 'cancelled' && (running > 0 || done > 0 || failed > 0)) state = 'running';
  return { ready, done, failed, skipped, remaining: ready + running, percent, state };
 };
 return {
  next() { if (state === 'cancelled') return null; const item = plan.items.find(x => statuses.get(x.id) === 'ready'); if (!item) { snapshot(); return null; } statuses.set(item.id, 'running'); state = 'running'; return { ...item }; },
  complete(id, result) {
   if (state === 'cancelled') return error('cancelled', 'Cannot complete an item after the batch was cancelled.');
   const item = byId.get(id); if (!item) return error('unknown-id', `Unknown batch item id: ${id}.`);
   const status = statuses.get(id); if (status !== 'running') return error(status === 'done' || status === 'failed' || status === 'skipped' ? 'already-completed' : 'invalid-input', 'Only an item returned by next() can be completed, and it can be completed once.');
   if (!result || typeof result.ok !== 'boolean' || (result.bytes !== undefined && !(result.bytes instanceof Uint8Array))) return error('invalid-input', 'Completion needs an ok flag and optional output bytes.');
   const bytes = result.bytes?.byteLength ?? 0;
   if (result.ok && heldBytes + bytes > cap) return error('memory-cap', `Held outputs would exceed the ${cap}-byte memory cap; drain() outputs before continuing.`);
   if (result.ok) { statuses.set(id, 'done'); const output = { id, name: item.outputName, bytes: result.bytes ?? new Uint8Array(), sizeBefore: item.size, message: result.message }; held.push(output); heldBytes += bytes; sizesAfter.set(id, bytes); }
   else { statuses.set(id, 'failed'); notes.set(id, result.message ?? 'Conversion failed.'); }
   snapshot(); return { ok: true };
  },
  cancel() { if (state !== 'done') state = 'cancelled'; },
  snapshot,
  drain() { const result = held; held = []; heldBytes = 0; return result; },
  reportRows() { return plan.items.map(item => { const status = statuses.get(item.id); const result = status === 'done' ? 'converted' as const : status === 'failed' ? 'failed' as const : status === 'skipped' ? 'skipped' as const : state === 'cancelled' ? 'cancelled' as const : 'failed' as const; return { name: item.name, result, sizeBefore: item.size, ...(sizesAfter.has(item.id) ? { sizeAfter: sizesAfter.get(item.id) } : {}), note: status === 'done' ? 'Converted successfully.' : notes.get(item.id) ?? item.reason ?? (result === 'cancelled' ? 'Batch was cancelled before this item completed.' : status === 'ready' || status === 'running' ? 'Conversion has not completed.' : 'Conversion failed.') }; }); }
 };
}
export function batchReport(run: BatchRun | BatchPlan): { rows: BatchReportRow[]; text: string } {
 const rows: BatchReportRow[] = 'reportRows' in run ? run.reportRows() : run.items.map(i => ({ name: i.name, result: i.status === 'skipped' ? 'skipped' as const : 'cancelled' as const, sizeBefore: i.size, note: i.reason ?? 'Conversion has not completed.' }));
 return { rows, text: ['Batch conversion report', ...rows.map(r => `${r.name}\t${r.result}\t${r.sizeBefore} bytes${r.sizeAfter === undefined ? '' : ` -> ${r.sizeAfter} bytes`}\t${r.note}`)].join('\n') };
}
export function zipEntries(rows: Array<{ name: string; bytes: Uint8Array }>): { ok: true; entries: Array<{ name: string; bytes: Uint8Array }> } | BatchError {
 if (!Array.isArray(rows)) return error('invalid-input', 'Provide output rows.');
 const seen = new Set<string>(); let total = 0;
 for (const row of rows) { if (!row || typeof row.name !== 'string' || !(row.bytes instanceof Uint8Array)) return error('invalid-input', 'Each ZIP entry needs a name and Uint8Array bytes.'); const k = key(row.name); if (seen.has(k)) return error('duplicate-name', `Duplicate ZIP entry name: ${row.name}`); seen.add(k); total += row.bytes.byteLength; if (total > BATCH_LIMITS.maxTotalBytes) return error('zip-limit', `ZIP entries exceed ${BATCH_LIMITS.maxTotalBytes} uncompressed bytes.`); }
 return { ok: true, entries: rows.map(r => ({ name: r.name, bytes: r.bytes })) };
}
