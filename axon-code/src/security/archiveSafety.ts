import { normalizeProjectPath } from '../pathSafety.js';

export interface ArchiveEntryMetadata {
  path: string;
  compressedBytes: number;
  uncompressedBytes: number;
  isDirectory?: boolean;
  isSymlink?: boolean;
  encrypted?: boolean;
}

export interface ArchiveSafetyPolicy {
  maxEntries: number;
  maxEntryBytes: number;
  maxTotalUncompressedBytes: number;
  maxCompressionRatio: number;
  maxPathCharacters: number;
  rejectSymlinks: boolean;
  rejectEncryptedEntries: boolean;
  caseInsensitiveCollisionCheck: boolean;
}

export const DEFAULT_ARCHIVE_POLICY: Readonly<ArchiveSafetyPolicy> = Object.freeze({
  maxEntries: 10_000,
  maxEntryBytes: 128 * 1024 * 1024,
  maxTotalUncompressedBytes: 1024 * 1024 * 1024,
  maxCompressionRatio: 150,
  maxPathCharacters: 1024,
  rejectSymlinks: true,
  rejectEncryptedEntries: true,
  caseInsensitiveCollisionCheck: true
});

export interface ArchiveSafetyFinding { code: string; path?: string; message: string; severity: 'error' | 'warning'; }
export interface ArchiveSafetyReport { safeToExtract: boolean; totalEntries: number; totalUncompressedBytes: number; findings: ArchiveSafetyFinding[]; evidence: 'METADATA_ONLY'; }

export function inspectArchiveManifest(entries: readonly ArchiveEntryMetadata[], policy: Partial<ArchiveSafetyPolicy> = {}): ArchiveSafetyReport {
  const p = { ...DEFAULT_ARCHIVE_POLICY, ...policy };
  const findings: ArchiveSafetyFinding[] = [];
  let totalUncompressedBytes = 0;
  if (!Number.isInteger(p.maxEntries) || p.maxEntries < 0 || !Number.isFinite(p.maxEntryBytes) || p.maxEntryBytes < 0 ||
      !Number.isFinite(p.maxTotalUncompressedBytes) || p.maxTotalUncompressedBytes < 0 || !Number.isFinite(p.maxCompressionRatio) || p.maxCompressionRatio < 1 ||
      !Number.isInteger(p.maxPathCharacters) || p.maxPathCharacters < 1) {
    return { safeToExtract: false, totalEntries: entries.length, totalUncompressedBytes: 0, findings: [{ code: 'INVALID_POLICY', message: 'Archive safety policy contains invalid limits.', severity: 'error' }], evidence: 'METADATA_ONLY' };
  }
  if (entries.length > p.maxEntries) findings.push({ code: 'ENTRY_COUNT_LIMIT', message: `Archive has ${entries.length} entries; the limit is ${p.maxEntries}.`, severity: 'error' });
  const paths = new Set<string>();
  const lowerPaths = new Set<string>();
  for (const entry of entries) {
    if (typeof entry.path !== 'string' || entry.path.length > p.maxPathCharacters) {
      findings.push({ code: 'INVALID_PATH_LENGTH', path: String(entry.path), message: 'Archive entry path is missing or exceeds the path-length limit.', severity: 'error' });
      continue;
    }
    const rawSegments = entry.path.split('/');
    if (rawSegments.includes('..')) {
      findings.push({ code: 'UNSAFE_ARCHIVE_PATH', path: entry.path, message: 'Archive entry contains a parent-traversal segment; extraction is blocked even if normalization would remain inside the project.', severity: 'error' });
      continue;
    }
    const normalized = normalizeProjectPath(entry.path.replace(/\/$/, ''));
    if (!normalized) {
      findings.push({ code: 'UNSAFE_ARCHIVE_PATH', path: entry.path, message: 'Archive entry path is absolute, traversing, or contains unsafe characters.', severity: 'error' });
    } else {
      const segments = normalized.split('/');
      if (segments.some((segment) => segment.includes(':') || /[ .]$/.test(segment) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(segment))) {
        findings.push({ code: 'NONPORTABLE_PATH_SEGMENT', path: normalized, message: 'Path contains a Windows alternate-stream, trailing-dot/space or reserved device-name segment.', severity: 'error' });
      }
      if (paths.has(normalized)) findings.push({ code: 'DUPLICATE_PATH', path: normalized, message: 'Archive contains duplicate normalized paths.', severity: 'error' });
      paths.add(normalized);
      if (p.caseInsensitiveCollisionCheck) {
        const folded = normalized.toLocaleLowerCase('en-US');
        if (lowerPaths.has(folded)) findings.push({ code: 'CASE_COLLISION', path: normalized, message: 'Archive contains paths that collide on case-insensitive filesystems.', severity: 'error' });
        lowerPaths.add(folded);
      }
    }
    if (![entry.compressedBytes, entry.uncompressedBytes].every((n) => Number.isFinite(n) && n >= 0)) {
      findings.push({ code: 'INVALID_SIZE_METADATA', path: entry.path, message: 'Entry size metadata is negative or non-finite.', severity: 'error' });
      continue;
    }
    totalUncompressedBytes += entry.uncompressedBytes;
    if (entry.uncompressedBytes > p.maxEntryBytes) findings.push({ code: 'ENTRY_SIZE_LIMIT', path: entry.path, message: 'Entry exceeds the maximum uncompressed size.', severity: 'error' });
    const ratio = entry.compressedBytes === 0 ? (entry.uncompressedBytes === 0 ? 1 : Infinity) : entry.uncompressedBytes / entry.compressedBytes;
    if (ratio > p.maxCompressionRatio) findings.push({ code: 'COMPRESSION_RATIO_LIMIT', path: entry.path, message: 'Entry exceeds the maximum permitted compression ratio.', severity: 'error' });
    if (p.rejectSymlinks && entry.isSymlink) findings.push({ code: 'SYMLINK_REJECTED', path: entry.path, message: 'Symbolic links are rejected until a safe extraction policy is implemented.', severity: 'error' });
    if (p.rejectEncryptedEntries && entry.encrypted) findings.push({ code: 'ENCRYPTED_ENTRY_REJECTED', path: entry.path, message: 'Encrypted archive entries are not inspected or extracted.', severity: 'error' });
  }
  if (!Number.isFinite(totalUncompressedBytes) || totalUncompressedBytes > p.maxTotalUncompressedBytes) {
    findings.push({ code: 'TOTAL_SIZE_LIMIT', message: 'Archive total uncompressed size exceeds the configured limit.', severity: 'error' });
  }
  return { safeToExtract: findings.every((f) => f.severity !== 'error'), totalEntries: entries.length, totalUncompressedBytes, findings, evidence: 'METADATA_ONLY' };
}
