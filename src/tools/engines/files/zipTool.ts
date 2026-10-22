import JSZip from 'jszip';

export const ZIP_TOOL_LIMITS = { maxEntries: 5000, maxUncompressedBytes: 200 * 1024 * 1024, maxCompressionRatio: 200, maxInputBytes: 250 * 1024 * 1024, maxEntryNameBytes: 1024 } as const;
export type ZipErrorCode = 'invalid-input' | 'invalid-name' | 'too-many-entries' | 'too-large' | 'compression-ratio' | 'encrypted-entry' | 'entry-not-found' | 'duplicate-name' | 'corrupt-zip' | 'invalid-limits';
export type ZipError = { ok: false; error: ZipErrorCode; message: string };
export type ZipResult<T> = { ok: true; value: T } | ZipError;
export type ZipFileInput = { name: string; bytes: Uint8Array };
export type ZipEntryInfo = { name: string; size: number; compressedSize: number; isDirectory: boolean; encrypted: boolean };
export type ExtractLimits = { maxBytes?: number; maxCompressionRatio?: number };
export const ZIP_TOOL_DESCRIPTOR = { toolId: 'zip-tool', displayName: 'ZIP Tool', purpose: 'Create, list and safely extract ZIP archives with path and resource limits.', examples: ['List files inside a ZIP archive', 'Extract one named file from a ZIP', 'Create a ZIP from selected files'], inputs: [{ name: 'files', kind: 'file' as const }, { name: 'archive', kind: 'file' as const }, { name: 'entryName', kind: 'text' as const }, { name: 'store', kind: 'yes-no' as const }] } as const;
function err(error: ZipErrorCode, message: string): ZipError { return { ok: false, error, message }; }
export function validateEntryName(name: unknown): ZipResult<string> {
 if (typeof name !== 'string' || !name.length) return err('invalid-name', 'ZIP entry name must not be empty.');
 if (name.length > ZIP_TOOL_LIMITS.maxEntryNameBytes || /[\x00-\x1f\x7f]/.test(name)) return err('invalid-name', 'ZIP entry name is too long or contains control characters.');
 if (name.startsWith('/') || name.startsWith('\\') || name.includes('\\') || /^[A-Za-z]:/.test(name)) return err('invalid-name', 'Absolute paths, backslashes and drive-letter paths are not allowed.');
 if (name.split('/').some(part => part === '..')) return err('invalid-name', 'Parent-directory segments are not allowed in ZIP entry names.');
 return { ok: true, value: name };
}
function normalName(name: string): string { return name.replace(/\/{2,}/g, '/').replace(/\.\//g, '').replace(/\/$/, ''); }
export async function createZip(files: readonly ZipFileInput[], options: { store: boolean }): Promise<ZipResult<Uint8Array>> {
 if (!Array.isArray(files) || !options || typeof options.store !== 'boolean') return err('invalid-input', 'Files and a store boolean are required.');
 if (files.length > ZIP_TOOL_LIMITS.maxEntries) return err('too-many-entries', 'Archive exceeds 5,000 entries.'); const zip = new JSZip(); const seen = new Set<string>(); let total = 0;
 for (const file of files) { const valid = validateEntryName(file?.name); if (!valid.ok) return valid; if (!(file.bytes instanceof Uint8Array)) return err('invalid-input', 'Each file must contain bytes as a Uint8Array.'); const norm = normalName(file.name); if (seen.has(norm)) return err('duplicate-name', `Duplicate ZIP entry name after normalisation: ${file.name}`); seen.add(norm); total += file.bytes.byteLength; if (total > ZIP_TOOL_LIMITS.maxUncompressedBytes) return err('too-large', 'Files exceed 200 MB uncompressed.'); zip.file(file.name, file.bytes, { binary: true, createFolders: false, compression: options.store ? 'STORE' : 'DEFLATE' }); }
 try { const bytes = await zip.generateAsync({ type: 'uint8array', compression: options.store ? 'STORE' : 'DEFLATE' }); return { ok: true, value: bytes }; } catch { return err('corrupt-zip', 'ZIP creation failed.'); }
}
// ---- Reading (Director rewrite, 2026-10-20) ----
// The metadata (names, sizes, flags, CRC) is read from the ZIP central directory by this file, not from JSZip's private fields, and JSZip is NEVER asked to
// check CRCs while loading (that makes it inflate every entry up front, which defeats every size cap). Entries are inflated one at a time as a stream with caps.
type Central = { name: string; flags: number; crc: number; compressedSize: number; uncompressedSize: number; isDirectory: boolean };
function readCentral(bytes: Uint8Array): Central[] | null {
 if (bytes.byteLength < 22) return null;
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let eocd = -1;
 for (let i = bytes.byteLength - 22; i >= Math.max(0, bytes.byteLength - 22 - 65535); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
 if (eocd < 0) return null;
 const count = view.getUint16(eocd + 10, true), offset = view.getUint32(eocd + 16, true);
 if (count === 0xffff || offset === 0xffffffff || offset >= bytes.byteLength) return null; // ZIP64 or damaged
 const out: Central[] = []; const decoder = new TextDecoder('utf-8'); let i = offset;
 for (let n = 0; n < count; n++) {
  if (i + 46 > bytes.byteLength || view.getUint32(i, true) !== 0x02014b50) return null;
  const flags = view.getUint16(i + 8, true), crc = view.getUint32(i + 16, true), compressedSize = view.getUint32(i + 20, true), uncompressedSize = view.getUint32(i + 24, true);
  const nameLength = view.getUint16(i + 28, true), extraLength = view.getUint16(i + 30, true), commentLength = view.getUint16(i + 32, true);
  if (i + 46 + nameLength + extraLength + commentLength > bytes.byteLength) return null;
  const name = decoder.decode(bytes.subarray(i + 46, i + 46 + nameLength));
  out.push({ name, flags, crc, compressedSize, uncompressedSize, isDirectory: name.endsWith('/') });
  i += 46 + nameLength + extraLength + commentLength;
 }
 return out;
}
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes: Uint8Array): number { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const inputOk = (input: unknown): input is Uint8Array => input instanceof Uint8Array && input.byteLength >= 22 && input.byteLength <= ZIP_TOOL_LIMITS.maxInputBytes;

export async function listZip(input: Uint8Array): Promise<ZipResult<ZipEntryInfo[]>> {
 if (!inputOk(input)) return err('invalid-input', 'ZIP input must be between 22 bytes and 250 MB.');
 try {
  const central = readCentral(input); if (!central) return err('corrupt-zip', 'Input is not a readable ZIP archive or it is corrupt.');
  if (central.length > ZIP_TOOL_LIMITS.maxEntries) return err('too-many-entries', 'Archive exceeds 5,000 entries.');
  if (!central.some(e => (e.flags & 1) === 1)) await JSZip.loadAsync(input, { createFolders: false }); // structure check only (no CRC check, nothing is inflated); JSZip refuses encrypted archives, which are listed (marked encrypted) and refused on extraction instead
  const seen = new Set<string>(); let total = 0; const result: ZipEntryInfo[] = [];
  for (const e of central) {
   const v = validateEntryName(e.name); if (!v.ok) return v;
   const norm = normalName(e.name); if (seen.has(norm)) return err('duplicate-name', `Duplicate ZIP entry name after normalisation: ${e.name}`); seen.add(norm);
   if (e.compressedSize === 0xffffffff || e.uncompressedSize === 0xffffffff) return err('too-large', 'ZIP64 sized entries are not supported.');
   total += e.uncompressedSize; if (total > ZIP_TOOL_LIMITS.maxUncompressedBytes) return err('too-large', 'Archive exceeds the 200 MB uncompressed-size limit.');
   if (e.uncompressedSize > 0 && (e.compressedSize === 0 || e.uncompressedSize / e.compressedSize > ZIP_TOOL_LIMITS.maxCompressionRatio)) return err('compression-ratio', `Entry ${e.name} exceeds the compression-ratio limit.`);
   result.push({ name: e.name, size: e.uncompressedSize, compressedSize: e.compressedSize, isDirectory: e.isDirectory, encrypted: (e.flags & 1) === 1 });
  }
  return { ok: true, value: result };
 } catch { return err('corrupt-zip', 'Input is not a readable ZIP archive or it is corrupt.'); }
}

type Inflated = { ok: true; value: Uint8Array } | { ok: false; reason: 'too-large' | 'compression-ratio' | 'corrupt' };
type StreamLike = { on(event: string, handler: (arg?: never) => void): StreamLike; resume(): void; pause(): void };
function inflateCapped(entry: JSZip.JSZipObject, maxBytes: number, ratioBytes: number): Promise<Inflated> {
 return new Promise<Inflated>(resolve => {
  const chunks: Uint8Array[] = []; let total = 0; let done = false;
  const finish = (r: Inflated) => { if (!done) { done = true; resolve(r); } };
  let helper: StreamLike;
  try { helper = (entry as unknown as { internalStream(type: string): StreamLike }).internalStream('uint8array'); } catch { finish({ ok: false, reason: 'corrupt' }); return; }
  helper.on('data', ((chunk: Uint8Array) => {
   if (done) return;
   total += chunk.byteLength;
   if (total > maxBytes) { helper.pause(); finish({ ok: false, reason: 'too-large' }); return; }
   if (total > ratioBytes) { helper.pause(); finish({ ok: false, reason: 'compression-ratio' }); return; }
   chunks.push(chunk);
  }) as never).on('error', (() => finish({ ok: false, reason: 'corrupt' })) as never).on('end', (() => {
   const out = new Uint8Array(total); let at = 0; for (const c of chunks) { out.set(c, at); at += c.byteLength; } finish({ ok: true, value: out });
  }) as never);
  helper.resume();
 });
}

export async function extractEntry(input: Uint8Array, name: string, limits: ExtractLimits = {}): Promise<ZipResult<Uint8Array>> {
 const valid = validateEntryName(name); if (!valid.ok) return valid;
 if (!inputOk(input)) return err('invalid-input', 'ZIP input must be between 22 bytes and 250 MB.');
 const maxBytes = limits.maxBytes ?? ZIP_TOOL_LIMITS.maxUncompressedBytes, maxRatio = limits.maxCompressionRatio ?? ZIP_TOOL_LIMITS.maxCompressionRatio;
 if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > ZIP_TOOL_LIMITS.maxUncompressedBytes || !Number.isFinite(maxRatio) || maxRatio <= 0 || maxRatio > ZIP_TOOL_LIMITS.maxCompressionRatio) return err('invalid-limits', 'Extraction limits exceed the supported safety caps.');
 try {
  const central = readCentral(input); if (!central) return err('corrupt-zip', 'Input is not a readable ZIP archive or it is corrupt.');
  const record = central.find(e => e.name === name); if (!record) return err('entry-not-found', `No ZIP entry named ${name} was found.`);
  if ((record.flags & 1) === 1) return err('encrypted-entry', 'This ZIP entry is encrypted and cannot be extracted without a password.');
  if (record.isDirectory) return err('invalid-input', 'A directory cannot be extracted as a file.');
  if (record.compressedSize === 0xffffffff || record.uncompressedSize === 0xffffffff) return err('too-large', 'ZIP64 sized entries are not supported.');
  if (record.uncompressedSize > maxBytes) return err('too-large', 'Entry exceeds the uncompressed-size limit.');
  if (record.uncompressedSize > 0 && (record.compressedSize === 0 || record.uncompressedSize / record.compressedSize > maxRatio)) return err('compression-ratio', 'Entry exceeds the compression-ratio limit.');
  const zip = await JSZip.loadAsync(input, { createFolders: false }); const entry = zip.file(name); if (!entry) return err('entry-not-found', `No ZIP entry named ${name} was found.`);
  // The header may lie: inflate as a stream and stop the moment either cap is crossed. The ratio cap is measured against the REAL compressed size from the central directory.
  const inflated = await inflateCapped(entry, maxBytes, record.compressedSize * maxRatio);
  if (!inflated.ok) return inflated.reason === 'too-large' ? err('too-large', 'Inflated entry exceeds the uncompressed-size limit.') : inflated.reason === 'compression-ratio' ? err('compression-ratio', 'Inflated entry exceeds the compression-ratio limit.') : err('corrupt-zip', 'The ZIP entry is corrupt or could not be safely inflated.');
  if (inflated.value.byteLength !== record.uncompressedSize || crc32(inflated.value) !== record.crc) return err('corrupt-zip', 'The ZIP entry does not match its recorded size or checksum.');
  return { ok: true, value: inflated.value };
 } catch { return err('corrupt-zip', 'The ZIP entry is corrupt or could not be safely inflated.'); }
}
