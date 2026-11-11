import type { ProjectSelection, ProjectSelectionManager, CapturedProjectFile } from './projectSelection.js';
import { isSensitiveProjectPath } from './projectSelection.js';
import { normalizeProjectPath } from '../pathSafety.js';
import { redactSensitiveText } from '../security/secretRedactor.js';

export type ProjectExportFormat = 'txt' | 'md' | 'json' | 'zip' | 'pdf';
export interface ProjectExportPayload {
  filename: string;
  mimeType: string;
  format: ProjectExportFormat;
  bytes: Uint8Array;
  sizeBytes: number;
  sourceFingerprint: string;
  includedFiles: string[];
  warnings: string[];
}
export interface ProjectExportPolicy { maxOutputBytes: number; maxFiles: number; maxPathBytes: number; }
export const DEFAULT_PROJECT_EXPORT_POLICY: Readonly<ProjectExportPolicy> = Object.freeze({ maxOutputBytes: 96 * 1024 * 1024, maxFiles: 10_000, maxPathBytes: 1024 });

function safeBaseName(input: string): string {
  const cleaned = input.normalize('NFKC').replace(/[\\/\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '_').replace(/[^\p{L}\p{N}._ -]/gu, '_').replace(/^\.+|\.+$/g, '').trim().slice(0, 80);
  return cleaned || 'axon-project';
}
function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  if (!Number.isSafeInteger(total)) throw new Error('Export size exceeds safe integer limits.');
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.byteLength; }
  return result;
}
function encodeUtf8(value: string): Uint8Array { return new TextEncoder().encode(value); }
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zipStored(files: readonly CapturedProjectFile[], fingerprint: string, createdAt: number, maxBytes: number, maxPathBytes: number): Uint8Array {
  const manifestPath = '__AXON_EXPORT__/manifest.json';
  if (files.some((file) => file.path.toLocaleLowerCase('en-US') === manifestPath.toLocaleLowerCase('en-US'))) throw new Error(`Project already contains reserved export manifest path '${manifestPath}'.`);
  if (encodeUtf8(manifestPath).byteLength > maxPathBytes) throw new Error('Configured ZIP path limit is too small for the export manifest.');
  const exportFiles = [...files.map((file) => ({ path: file.path, bytes: encodeUtf8(file.content) })), {
    path: manifestPath,
    bytes: encodeUtf8(JSON.stringify({ schema: 'axon-code-export/v1', createdAt, sourceFingerprint: fingerprint, includedFiles: files.map((file) => file.path) }, null, 2) + '\n')
  }];
  if (exportFiles.length > 0xffff) throw new Error('ZIP export exceeds the non-Zip64 file-count limit.');
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  let runningSize = 22;
  for (const file of exportFiles) {
    const path = normalizeProjectPath(file.path);
    if (!path || path !== file.path) throw new Error(`Unsafe export path '${file.path}'.`);
    const name = encodeUtf8(path);
    if (name.byteLength > 0xffff || name.byteLength > maxPathBytes) throw new Error(`Export path '${path}' exceeds ZIP path limits.`);
    if (file.bytes.byteLength > 0xffffffff) throw new Error(`File '${path}' exceeds ZIP32 size limits.`);
    const crc = crc32(file.bytes);
    const local = new Uint8Array(30 + name.byteLength);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true); lv.setUint16(10, 0, true); lv.setUint16(12, 0x21, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, file.bytes.byteLength, true); lv.setUint32(22, file.bytes.byteLength, true);
    lv.setUint16(26, name.byteLength, true); lv.setUint16(28, 0, true); local.set(name, 30);
    localParts.push(local, file.bytes);
    const central = new Uint8Array(46 + name.byteLength);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, file.bytes.byteLength, true); cv.setUint32(24, file.bytes.byteLength, true);
    cv.setUint16(28, name.byteLength, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, localOffset, true);
    central.set(name, 46); centralParts.push(central);
    localOffset += local.byteLength + file.bytes.byteLength;
    runningSize += local.byteLength + file.bytes.byteLength + central.byteLength;
    if (localOffset > 0xffffffff || runningSize > maxBytes || runningSize > 0xffffffff) throw new Error('ZIP export exceeds configured output or ZIP32 offset limits.');
  }
  const centralDirectory = concat(centralParts);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, exportFiles.length, true); ev.setUint16(10, exportFiles.length, true);
  ev.setUint32(12, centralDirectory.byteLength, true); ev.setUint32(16, localOffset, true); ev.setUint16(20, 0, true);
  const output = concat([...localParts, centralDirectory, eocd]);
  if (output.byteLength > maxBytes) throw new Error('ZIP export exceeds configured output limit.');
  return output;
}

function pdfTextBytes(value: string): Uint8Array {
  const bytes: number[] = [];
  const cp1252 = new Map<number, number>([
    [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
    [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
    [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
    [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
    [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f]
  ]);
  for (const character of value) {
    const cp = character.codePointAt(0)!;
    if (cp === 9) { bytes.push(0x20, 0x20, 0x20, 0x20); }
    else if (cp === 10 || cp === 13) { /* each PDF line is already separated */ }
    else if (cp >= 0x20 && cp <= 0x7e) bytes.push(cp);
    else if (cp >= 0xa0 && cp <= 0xff) bytes.push(cp);
    else if (cp1252.has(cp)) bytes.push(cp1252.get(cp)!);
    else bytes.push(...new TextEncoder().encode(`\\u{${cp.toString(16).toUpperCase()}}`));
  }
  return new Uint8Array(bytes);
}
function toHex(bytes: Uint8Array): string { return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join(''); }
function wrapLine(line: string, width = 126): string[] {
  const points = [...line];
  if (points.length <= width) return [line];
  const rows: string[] = [];
  for (let offset = 0; offset < points.length; offset += width) rows.push(points.slice(offset, offset + width).join(''));
  return rows;
}
function makePdf(files: readonly CapturedProjectFile[], projectName: string, createdAt: number): Uint8Array {
  const lines: string[] = [
    `AXON CODE PROJECT EXPORT - ${projectName}`,
    `Files: ${files.length} | Created: ${new Date(createdAt).toISOString()}`,
    'Source-preserving companion formats: TXT, JSON and ZIP.',
    ''
  ];
  for (const file of files) {
    lines.push(`===== FILE: ${file.path} =====`);
    const contentLines = file.content.replace(/\r\n?/g, '\n').split('\n');
    for (const line of contentLines) lines.push(...wrapLine(line));
    lines.push('', '');
  }
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 54) pages.push(lines.slice(index, index + 54));
  if (!pages.length) pages.push(['AXON CODE PROJECT EXPORT']);
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';
  const kids: string[] = [];
  pages.forEach((pageLines, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    pageObjectIds.push(pageId); kids.push(`${pageId} 0 R`);
    const textCommands = ['BT', '/F1 7 Tf', '36 756 Td', '9 TL', ...pageLines.map((line) => `<${toHex(pdfTextBytes(line))}> Tj T*`), 'ET'].join('\n');
    objects[contentId] = `<< /Length ${encodeUtf8(textCommands).byteLength} >>\nstream\n${textCommands}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
  });
  objects[2] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${kids.join(' ')}] >>`;
  const objectCount = objects.length - 1;
  let output = '%PDF-1.4\n%AXON\n';
  const offsets = new Array<number>(objectCount + 1).fill(0);
  for (let id = 1; id <= objectCount; id += 1) {
    if (!objects[id]) throw new Error(`PDF object ${id} is missing.`);
    offsets[id] = encodeUtf8(output).byteLength;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = encodeUtf8(output).byteLength;
  output += `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objectCount; id += 1) output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return encodeUtf8(output);
}

export class ProjectExportService {
  private readonly policy: ProjectExportPolicy;
  constructor(private readonly selectionManager: ProjectSelectionManager, policy: Partial<ProjectExportPolicy> = {}) {
    this.policy = { ...DEFAULT_PROJECT_EXPORT_POLICY, ...policy };
    if (!Number.isSafeInteger(this.policy.maxOutputBytes) || this.policy.maxOutputBytes < 1 || !Number.isSafeInteger(this.policy.maxFiles) || this.policy.maxFiles < 1 || !Number.isSafeInteger(this.policy.maxPathBytes) || this.policy.maxPathBytes < 1) throw new Error('Invalid project export limits.');
  }

  async export(selection: ProjectSelection, format: ProjectExportFormat, options: { allowSensitiveFiles?: boolean; projectName?: string } = {}): Promise<ProjectExportPayload> {
    if (selection.paths.length > this.policy.maxFiles) throw new Error('Selection exceeds export file-count limit.');
    const capturedFiles = await this.selectionManager.capture(selection);
    // Exports retain project structure but redact credential-like literals from text payloads.
    const redactedPaths = new Set<string>();
    const files = capturedFiles.map((file) => {
      const content = redactSensitiveText(file.content, 'exports');
      if (content !== file.content) redactedPaths.add(file.path);
      return content === file.content ? file : { ...file, content, sizeBytes: new TextEncoder().encode(content).byteLength };
    });
    // Derive secret warnings from the captured paths, never from caller-editable selection metadata.
    const sensitiveFiles = files.filter((file) => isSensitiveProjectPath(file.path));
    if (sensitiveFiles.length && !options.allowSensitiveFiles) throw new Error(`Sensitive-looking files require explicit export confirmation: ${sensitiveFiles.map((file) => file.path).join(', ')}`);
    const projectName = safeBaseName(options.projectName ?? selection.workspaceId);
    let bytes: Uint8Array;
    let mimeType: string;
    const estimatedSourceBytes = files.reduce((sum, file) => sum + file.sizeBytes + new TextEncoder().encode(file.path).byteLength + 128, 0);
    if (!Number.isSafeInteger(estimatedSourceBytes) || estimatedSourceBytes > this.policy.maxOutputBytes) throw new Error(`Export exceeds ${this.policy.maxOutputBytes} bytes before format generation.`);
    if (format === 'pdf' && estimatedSourceBytes * 12 > this.policy.maxOutputBytes) throw new Error(`PDF export may exceed ${this.policy.maxOutputBytes} bytes; use TXT, JSON or ZIP for a source-preserving export.`);
    if (format === 'json' && estimatedSourceBytes * 6 > this.policy.maxOutputBytes) throw new Error(`JSON export may exceed ${this.policy.maxOutputBytes} bytes; split the selection or use ZIP.`);
    if (format === 'txt') {
      const text = files.map((file) => `===== FILE: ${file.path} =====\n${file.content}`).join('\n\n');
      bytes = encodeUtf8(text); mimeType = 'text/plain;charset=utf-8';
    } else if (format === 'md') {
      const markdown = files.map((file) => {
        const extension = (file.path.split('.').pop()?.toLowerCase() ?? '').replace(/[^a-z0-9_-]/g, '');
        const longestFence = Math.max(2, ...[...file.content.matchAll(/`+/g)].map((match) => match[0].length));
        const fence = '`'.repeat(longestFence + 1);
        const heading = file.path.replace(/[\\`*_{}\[\]<>#+.!|]/g, (character) => `\\${character}`);
        return `## ${heading}\n\n${fence}${extension}\n${file.content}\n${fence}`;
      }).join('\n\n');
      bytes = encodeUtf8(`# ${projectName} — source export\n\n${markdown}\n`); mimeType = 'text/markdown;charset=utf-8';
    } else if (format === 'json') {
      bytes = encodeUtf8(JSON.stringify({ schema: 'axon-code-project-export/v1', projectName, createdAt: selection.createdAt, sourceFingerprint: selection.fingerprint,
        files: files.map(({ path, content, sizeBytes }) => ({ path, content, sizeBytes })) }, null, 2) + '\n');
      mimeType = 'application/json;charset=utf-8';
    } else if (format === 'zip') {
      bytes = zipStored(files, selection.fingerprint, selection.createdAt, this.policy.maxOutputBytes, this.policy.maxPathBytes); mimeType = 'application/zip';
    } else if (format === 'pdf') {
      bytes = makePdf(files, projectName, selection.createdAt); mimeType = 'application/pdf';
    } else {
      throw new Error(`Unsupported project export format '${String(format)}'.`);
    }
    if (bytes.byteLength > this.policy.maxOutputBytes) throw new Error(`Export exceeds ${this.policy.maxOutputBytes} bytes.`);
    return { filename: `${projectName}.${format}`, mimeType, format, bytes, sizeBytes: bytes.byteLength,
      sourceFingerprint: selection.fingerprint, includedFiles: files.map((file) => file.path),
      warnings: [...(format === 'pdf' ? ['PDF is a presentation copy; use ZIP, JSON or TXT for source-preserving export.', 'Characters outside the PDF base-font repertoire are shown as explicit Unicode escape notation.'] : []), ...(redactedPaths.size ? [`Credential-like content was redacted in: ${[...redactedPaths].sort().join(', ')}.`] : [])] };
  }
}

export function verifyExportedTextFiles(payload: ProjectExportPayload, original: readonly CapturedProjectFile[]): boolean {
  if (payload.format === 'json') {
    try {
      const value = JSON.parse(new TextDecoder().decode(payload.bytes)) as { files?: Array<{ path?: string; content?: string }> };
      return Array.isArray(value.files) && value.files.length === original.length && original.every((file, index) => value.files![index]?.path === file.path && value.files![index]?.content === file.content);
    } catch { return false; }
  }
  if (payload.format === 'zip') return payload.bytes[0] === 0x50 && payload.bytes[1] === 0x4b && payload.bytes.byteLength > 22;
  return false;
}
