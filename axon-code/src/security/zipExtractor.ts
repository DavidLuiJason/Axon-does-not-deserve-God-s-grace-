import { normalizeProjectPath } from '../pathSafety.js';
import {
  inspectArchiveManifest,
  type ArchiveSafetyPolicy,
  type ArchiveSafetyReport
} from './archiveSafety.js';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const MAX_EOCD_SEARCH = 22 + 0xffff;

export interface ParsedZipEntry {
  path: string;
  compressedBytes: number;
  uncompressedBytes: number;
  crc32: number;
  compressionMethod: number;
  flags: number;
  localHeaderOffset: number;
  isDirectory: boolean;
  isSymlink: boolean;
  encrypted: boolean;
}

export interface ParsedZipArchive {
  entries: ParsedZipEntry[];
  centralDirectoryOffset: number;
  centralDirectorySize: number;
  manifestReport: ArchiveSafetyReport;
}

export interface ZipExtractionPolicy extends ArchiveSafetyPolicy {
  maxArchiveBytes: number;
  chunkBytes: number;
  allowMethods: readonly number[];
}

export const DEFAULT_ZIP_EXTRACTION_POLICY: Readonly<ZipExtractionPolicy> = Object.freeze({
  maxEntries: 10_000,
  maxEntryBytes: 128 * 1024 * 1024,
  maxTotalUncompressedBytes: 1024 * 1024 * 1024,
  maxCompressionRatio: 150,
  maxPathCharacters: 1024,
  maxArchiveBytes: 512 * 1024 * 1024,
  rejectSymlinks: true,
  rejectEncryptedEntries: true,
  caseInsensitiveCollisionCheck: true,
  chunkBytes: 64 * 1024,
  allowMethods: [0, 8]
});

export interface TransactionalExtractionSink {
  begin(extractionId: string): Promise<void>;
  beginFile(path: string, expectedBytes: number): Promise<void>;
  writeChunk(path: string, chunk: Uint8Array): Promise<void>;
  endFile(path: string): Promise<void>;
  commit(): Promise<void>;
  rollback(reason: string): Promise<void>;
}

export interface ZipExtractionResult {
  success: boolean;
  filesWritten: number;
  bytesWritten: number;
  archive: ParsedZipArchive;
  findings: string[];
  evidence: 'ZIP_BYTES_PARSED_AND_CONTENT_VERIFIED';
}

function assertRange(bytes: Uint8Array, offset: number, length: number, label: string): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > bytes.byteLength) {
    throw new Error(`${label} is outside the ZIP byte range.`);
  }
}

function decodeName(bytes: Uint8Array, start: number, length: number, utf8Flag: boolean): string {
  assertRange(bytes, start, length, 'ZIP file name');
  const slice = bytes.subarray(start, start + length);
  if (!utf8Flag && slice.some((value) => value > 0x7f)) throw new Error('Non-ASCII ZIP names without the UTF-8 flag are rejected.');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(slice);
  } catch {
    // ASCII-only legacy names are unambiguous without CP437 conversion.
    if (slice.some((value) => value > 0x7f)) throw new Error('Non-UTF-8 ZIP names are rejected; repackage using UTF-8 names.');
    return new TextDecoder('ascii').decode(slice);
  }
}

function locateEocd(bytes: Uint8Array): number {
  const minimum = Math.max(0, bytes.byteLength - MAX_EOCD_SEARCH);
  for (let i = bytes.byteLength - 22; i >= minimum; i -= 1) {
    if (i + 22 <= bytes.byteLength && new DataView(bytes.buffer, bytes.byteOffset + i, 22).getUint32(0, true) === EOCD) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + i, 22);
      const commentLength = view.getUint16(20, true);
      if (i + 22 + commentLength === bytes.byteLength) return i;
    }
  }
  throw new Error('ZIP end-of-central-directory record was not found or is malformed.');
}

export function parseZipArchive(bytes: Uint8Array, policy: Partial<ZipExtractionPolicy> = {}): ParsedZipArchive {
  const p = { ...DEFAULT_ZIP_EXTRACTION_POLICY, ...policy };
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 22) throw new Error('ZIP input is empty or too small.');
  if (!Number.isSafeInteger(p.maxArchiveBytes) || p.maxArchiveBytes < 22 || bytes.byteLength > p.maxArchiveBytes) throw new Error('ZIP byte stream exceeds the configured archive-size limit.');
  const eocdOffset = locateEocd(bytes);
  const eocd = new DataView(bytes.buffer, bytes.byteOffset + eocdOffset, 22);
  const diskNumber = eocd.getUint16(4, true);
  const centralDisk = eocd.getUint16(6, true);
  const entriesOnDisk = eocd.getUint16(8, true);
  const totalEntries = eocd.getUint16(10, true);
  const centralSize = eocd.getUint32(12, true);
  const centralOffset = eocd.getUint32(16, true);
  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) throw new Error('Multi-disk ZIP archives are not supported.');
  if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error('Zip64 archives are not yet supported.');
  if (totalEntries > p.maxEntries) throw new Error(`ZIP entry count exceeds the configured limit (${p.maxEntries}).`);
  assertRange(bytes, centralOffset, centralSize, 'Central directory');
  if (centralOffset + centralSize > eocdOffset) throw new Error('Central directory overlaps the ZIP trailer.');

  const entries: ParsedZipEntry[] = [];
  let cursor = centralOffset;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < totalEntries; i += 1) {
    assertRange(bytes, cursor, 46, 'Central directory entry');
    if (view.getUint32(cursor, true) !== CENTRAL) throw new Error(`Invalid central directory signature at entry ${i}.`);
    const versionMadeBy = view.getUint16(cursor + 4, true);
    const flags = view.getUint16(cursor + 8, true);
    const compressionMethod = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedBytes = view.getUint32(cursor + 20, true);
    const uncompressedBytes = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const diskStart = view.getUint16(cursor + 34, true);
    const externalAttributes = view.getUint32(cursor + 38, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    if (diskStart !== 0) throw new Error('Split-entry ZIP archives are not supported.');
    if (compressedBytes === 0xffffffff || uncompressedBytes === 0xffffffff || localHeaderOffset === 0xffffffff) throw new Error('Zip64 entry fields are not supported.');
    const recordLength = 46 + nameLength + extraLength + commentLength;
    assertRange(bytes, cursor, recordLength, 'Central directory record');
    const path = decodeName(bytes, cursor + 46, nameLength, (flags & 0x0800) !== 0);
    const hostSystem = versionMadeBy >>> 8;
    const unixMode = externalAttributes >>> 16;
    const isSymlink = (hostSystem === 3 || hostSystem === 19) && (unixMode & 0xf000) === 0xa000;
    const isDirectory = path.endsWith('/') || ((hostSystem === 3 || hostSystem === 19) && (unixMode & 0xf000) === 0x4000);
    entries.push({ path, compressedBytes, uncompressedBytes, crc32: crc, compressionMethod, flags,
      localHeaderOffset, isDirectory, isSymlink, encrypted: (flags & (0x0001 | 0x0040 | 0x2000)) !== 0 });
    cursor += recordLength;
  }
  if (cursor > centralOffset + centralSize) throw new Error('Central directory entries exceed their declared size.');

  const manifestReport = inspectArchiveManifest(entries.map((entry) => ({
    path: entry.path, compressedBytes: entry.compressedBytes, uncompressedBytes: entry.uncompressedBytes,
    isDirectory: entry.isDirectory, isSymlink: entry.isSymlink, encrypted: entry.encrypted
  })), p);
  for (const entry of entries) {
    const pathWithoutSlash = entry.isDirectory && entry.path.endsWith('/') ? entry.path.slice(0, -1) : entry.path;
    const normalized = normalizeProjectPath(pathWithoutSlash);
    const canonical = normalized && (entry.isDirectory ? `${normalized}/` : normalized);
    if (!canonical || canonical !== entry.path) throw new Error(`UNSAFE_ARCHIVE_PATH: ZIP entry '${entry.path}' is not a canonical safe project path.`);
  }
  const methodFindings = entries.filter((entry) => !entry.isDirectory && !p.allowMethods.includes(entry.compressionMethod));
  if (methodFindings.length) {
    manifestReport.safeToExtract = false;
    for (const entry of methodFindings) manifestReport.findings.push({ code: 'UNSUPPORTED_COMPRESSION_METHOD', path: entry.path, message: `Compression method ${entry.compressionMethod} is not supported.`, severity: 'error' });
  }
  if (!manifestReport.safeToExtract) throw new Error(`ZIP manifest rejected: ${manifestReport.findings.map((finding) => finding.code).join(', ')}.`);

  // Validate local-header locations, names, compression flags and non-overlapping payload ranges.
  const ranges: Array<{ start: number; end: number; path: string }> = [];
  const seenOffsets = new Set<number>();
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (seenOffsets.has(entry.localHeaderOffset)) throw new Error('Multiple entries point to the same local header.');
    seenOffsets.add(entry.localHeaderOffset);
    assertRange(bytes, entry.localHeaderOffset, 30, `Local header for ${entry.path}`);
    if (view.getUint32(entry.localHeaderOffset, true) !== LOCAL) throw new Error(`Invalid local header for '${entry.path}'.`);
    const localFlags = view.getUint16(entry.localHeaderOffset + 6, true);
    const localMethod = view.getUint16(entry.localHeaderOffset + 8, true);
    const localNameLength = view.getUint16(entry.localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(entry.localHeaderOffset + 28, true);
    if ((localFlags & (0x0001 | 0x0040 | 0x2000)) !== 0 || localFlags !== entry.flags || localMethod !== entry.compressionMethod) throw new Error(`Local header flags or compression method mismatch for '${entry.path}'.`);
    const localName = decodeName(bytes, entry.localHeaderOffset + 30, localNameLength, (localFlags & 0x0800) !== 0);
    if (localName !== entry.path) throw new Error(`Local and central file names do not match for '${entry.path}'.`);
    const localCrc = view.getUint32(entry.localHeaderOffset + 14, true);
    const localCompressed = view.getUint32(entry.localHeaderOffset + 18, true);
    const localUncompressed = view.getUint32(entry.localHeaderOffset + 22, true);
    const dataStart = entry.localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + entry.compressedBytes;
    assertRange(bytes, dataStart, entry.compressedBytes, `Compressed data for ${entry.path}`);
    if ((entry.flags & 0x0008) === 0) {
      if (localCrc !== entry.crc32 || localCompressed !== entry.compressedBytes || localUncompressed !== entry.uncompressedBytes) throw new Error(`Local and central size/CRC metadata mismatch for '${entry.path}'.`);
    } else if (![0, entry.crc32].includes(localCrc) || ![0, entry.compressedBytes].includes(localCompressed) || ![0, entry.uncompressedBytes].includes(localUncompressed)) {
      throw new Error(`Invalid data-descriptor placeholder values in local header for '${entry.path}'.`);
    }
    if (dataEnd > centralOffset) throw new Error(`Compressed data for '${entry.path}' overlaps the central directory.`);
    let occupiedEnd = dataEnd;
    if ((entry.flags & 0x0008) !== 0) {
      assertRange(bytes, dataEnd, 12, `Data descriptor for ${entry.path}`);
      const descriptorHasSignature = view.getUint32(dataEnd, true) === 0x08074b50;
      const signedStart = dataEnd + 4;
      const signedMatches = descriptorHasSignature && signedStart + 12 <= bytes.byteLength &&
        view.getUint32(signedStart, true) === entry.crc32 && view.getUint32(signedStart + 4, true) === entry.compressedBytes &&
        view.getUint32(signedStart + 8, true) === entry.uncompressedBytes;
      const descriptorStart = signedMatches ? signedStart : dataEnd;
      assertRange(bytes, descriptorStart, 12, `Data descriptor fields for ${entry.path}`);
      if (view.getUint32(descriptorStart, true) !== entry.crc32 || view.getUint32(descriptorStart + 4, true) !== entry.compressedBytes || view.getUint32(descriptorStart + 8, true) !== entry.uncompressedBytes) {
        throw new Error(`Data descriptor values do not match the central directory for '${entry.path}'.`);
      }
      occupiedEnd = descriptorStart + 12;
    }
    if (occupiedEnd > centralOffset) throw new Error(`Local record for '${entry.path}' overlaps the central directory.`);
    ranges.push({ start: entry.localHeaderOffset, end: occupiedEnd, path: entry.path });
  }
  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i += 1) {
    const previous = ranges[i - 1];
    const current = ranges[i];
    if (previous && current && current.start < previous.end) throw new Error(`ZIP entries overlap: '${previous.path}' and '${current.path}'.`);
  }
  return { entries, centralDirectoryOffset: centralOffset, centralDirectorySize: centralSize, manifestReport };
}

function crc32Update(crc: number, chunk: Uint8Array): number {
  let value = crc;
  for (const byte of chunk) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) !== 0 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  }
  return value >>> 0;
}

function streamFromBytes(bytes: Uint8Array, chunkBytes: number): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) { controller.close(); return; }
      const next = bytes.slice(offset, Math.min(bytes.byteLength, offset + chunkBytes));
      offset += next.byteLength;
      controller.enqueue(next);
    }
  });
}

async function* outputChunks(bytes: Uint8Array, entry: ParsedZipEntry, chunkBytes: number): AsyncGenerator<Uint8Array> {
  if (entry.compressionMethod === 0) {
    for (let offset = 0; offset < bytes.byteLength; offset += chunkBytes) yield bytes.slice(offset, Math.min(bytes.byteLength, offset + chunkBytes));
    return;
  }
  if (entry.compressionMethod !== 8) throw new Error(`Unsupported compression method ${entry.compressionMethod}.`);
  if (typeof DecompressionStream === 'undefined') throw new Error('This host has no DEFLATE decompression stream; provide a vetted inflater adapter.');
  let decompressor: DecompressionStream;
  try { decompressor = new DecompressionStream('deflate-raw' as CompressionFormat); }
  catch { throw new Error('This host does not support raw DEFLATE decompression.'); }
  const reader = streamFromBytes(bytes, chunkBytes).pipeThrough(decompressor as unknown as ReadableWritablePair<Uint8Array, Uint8Array>).getReader(); // type-only cast: the DOM typings of newer TypeScript versions disagree about the stream's chunk type; behaviour is unchanged
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      yield item.value;
    }
  } finally { await reader.cancel().catch(() => undefined); }
}

/** Parses actual ZIP bytes and streams verified output into an atomic host sink. */
export class SafeZipExtractor {
  private readonly policy: ZipExtractionPolicy;
  constructor(policy: Partial<ZipExtractionPolicy> = {}) {
    this.policy = { ...DEFAULT_ZIP_EXTRACTION_POLICY, ...policy };
    if (!Number.isInteger(this.policy.chunkBytes) || this.policy.chunkBytes < 1024 || !this.policy.allowMethods.length) throw new Error('Invalid ZIP extraction policy.');
  }

  async extract(bytes: Uint8Array, sink: TransactionalExtractionSink, extractionId: string, signal?: AbortSignal): Promise<ZipExtractionResult> {
    const archive = parseZipArchive(bytes, this.policy);
    if (!extractionId.trim()) throw new Error('Extraction ID is required.');
    let filesWritten = 0;
    let bytesWritten = 0;
    await sink.begin(extractionId);
    try {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (const entry of archive.entries) {
        if (signal?.aborted) throw new Error('ZIP extraction cancelled.');
        if (entry.isDirectory) continue;
        const nameLength = view.getUint16(entry.localHeaderOffset + 26, true);
        const extraLength = view.getUint16(entry.localHeaderOffset + 28, true);
        const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength;
        const compressed = bytes.subarray(dataStart, dataStart + entry.compressedBytes);
        await sink.beginFile(entry.path, entry.uncompressedBytes);
        let crc = 0xffffffff;
        let fileBytes = 0;
        for await (const chunk of outputChunks(compressed, entry, this.policy.chunkBytes)) {
          if (signal?.aborted) throw new Error('ZIP extraction cancelled.');
          fileBytes += chunk.byteLength;
          bytesWritten += chunk.byteLength;
          if (fileBytes > entry.uncompressedBytes || fileBytes > this.policy.maxEntryBytes || bytesWritten > this.policy.maxTotalUncompressedBytes) {
            throw new Error(`Actual decompressed output exceeded a configured size limit at '${entry.path}'.`);
          }
          crc = crc32Update(crc, chunk);
          await sink.writeChunk(entry.path, chunk);
        }
        const actualCrc = (crc ^ 0xffffffff) >>> 0;
        if (fileBytes !== entry.uncompressedBytes) throw new Error(`Uncompressed size mismatch for '${entry.path}'. Expected ${entry.uncompressedBytes}, got ${fileBytes}.`);
        if (actualCrc !== entry.crc32) throw new Error(`CRC-32 verification failed for '${entry.path}'.`);
        await sink.endFile(entry.path);
        filesWritten += 1;
      }
      await sink.commit();
      return { success: true, filesWritten, bytesWritten, archive, findings: [], evidence: 'ZIP_BYTES_PARSED_AND_CONTENT_VERIFIED' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await sink.rollback(reason).catch(() => undefined);
      throw error;
    }
  }
}

/** Small bounded sink useful for tests and tiny projects; production hosts should provide durable sinks. */
export class MemoryTransactionalExtractionSink implements TransactionalExtractionSink {
  private staged = new Map<string, Uint8Array[]>();
  private previousCommitted = new Map<string, Uint8Array>();
  readonly committed = new Map<string, Uint8Array>();
  private currentPath: string | null = null;
  private currentChunks: Uint8Array[] = [];
  private stagedBytes = 0;
  private currentFileBytes = 0;
  constructor(private readonly maxBytes = 16 * 1024 * 1024) {}

  async begin(_extractionId: string): Promise<void> {
    this.staged = new Map(); this.previousCommitted = new Map(this.committed);
    this.currentPath = null; this.currentChunks = []; this.stagedBytes = 0; this.currentFileBytes = 0;
  }
  async beginFile(path: string, expectedBytes: number): Promise<void> {
    if (this.currentPath !== null || this.staged.has(path) || expectedBytes < 0 || expectedBytes > this.maxBytes || this.stagedBytes + expectedBytes > this.maxBytes) {
      throw new Error('Memory sink rejected duplicate, nested or oversized file.');
    }
    this.currentPath = path; this.currentChunks = []; this.currentFileBytes = 0;
  }
  async writeChunk(path: string, chunk: Uint8Array): Promise<void> {
    if (this.currentPath !== path) throw new Error('Chunk does not match the active file.');
    if (this.stagedBytes + this.currentFileBytes + chunk.byteLength > this.maxBytes) throw new Error('Memory sink total-size limit exceeded.');
    this.currentChunks.push(new Uint8Array(chunk)); this.currentFileBytes += chunk.byteLength;
  }
  async endFile(path: string): Promise<void> {
    if (this.currentPath !== path) throw new Error('End-file does not match the active file.');
    this.staged.set(path, this.currentChunks); this.stagedBytes += this.currentFileBytes;
    this.currentChunks = []; this.currentPath = null; this.currentFileBytes = 0;
  }
  async commit(): Promise<void> {
    if (this.currentPath !== null) throw new Error('Cannot commit while a file is incomplete.');
    const next = new Map<string, Uint8Array>();
    for (const [path, chunks] of this.staged) {
      const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const combined = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
      next.set(path, combined);
    }
    this.committed.clear();
    for (const [path, bytes] of next) this.committed.set(path, bytes);
    this.staged.clear(); this.previousCommitted.clear(); this.stagedBytes = 0;
  }
  async rollback(_reason: string): Promise<void> {
    this.staged.clear(); this.currentChunks = []; this.currentPath = null; this.currentFileBytes = 0; this.stagedBytes = 0;
    this.committed.clear();
    for (const [path, bytes] of this.previousCommitted) this.committed.set(path, bytes);
    this.previousCommitted.clear();
  }
}
