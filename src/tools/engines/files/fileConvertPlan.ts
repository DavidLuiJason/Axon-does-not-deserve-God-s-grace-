import { CONVERTER_KINDS } from '../../converter/kinds';
import { inspectBytes, FILE_INSPECT_LIMITS } from './inspect';
import { IMAGE_CONVERT_LIMITS } from '../images/convertPlan';
import { CSV_LIMITS } from '../data/csv';
import { MARKDOWN_LIMITS } from '../text/markdown';
import { HTML_TEXT_LIMITS } from '../text/htmlText';
import { TEXT_FORMAT_LIMITS } from '../text/textFormats';
import { JSON_LIMITS } from '../data/jsonTokens';
import { YAML_LIMITS } from '../data/yaml';
import { XML_LIMITS } from '../data/xml';

export const FILE_CONVERTER_LIMITS = Object.freeze({ maxHeadBytes: FILE_INSPECT_LIMITS.maxHeadBytes, maxNameCodePoints: IMAGE_CONVERT_LIMITS.maxNameCodePoints });
export type FileFamily = 'data' | 'text' | 'image' | 'unsupported';
export type FilePlanErrorCode = 'invalid-input' | 'unsupported-format' | 'unsupported-conversion' | 'too-large';
export type FilePlanError = { ok: false; error: FilePlanErrorCode; message: string };
export type ConvertibleFile = { name: string; size: number; head: Uint8Array };
export type Detection = { ok: true; family: FileFamily; kindId: string; formatId: string; reason: string; warnings: string[] };
export type FileConversionPlan = { ok: true; kindId: string; from: string; to: string; outputName: string; outputMime: string; mode: 'text' | 'image'; losses: string[]; limitsOk: true };
export const FILE_CONVERTER_DESCRIPTOR = { toolId: 'file-converter', displayName: 'File Converter Planner', purpose: 'Identify supported files, offer valid output formats, and explain conversion changes before conversion.', examples: ['Check what a JSON file can become.', 'Plan a PNG to WebP conversion.', 'Explain what is lost when converting Markdown to HTML.'], inputs: [{ name: 'file', kind: 'file' as const }, { name: 'to', kind: 'choice' as const }, { name: 'options', kind: 'text' as const }] };
const err = (error: FilePlanErrorCode, message: string): FilePlanError => ({ ok: false, error, message });
const kindFor = (id: string) => CONVERTER_KINDS.find(k => k.id === id);
const familyForKind = (id: string): FileFamily => id === 'data-formats' ? 'data' : id === 'text-formats' ? 'text' : id === 'image' ? 'image' : 'unsupported';
const formatAliases: Record<string, string> = { jpeg: 'jpg', yml: 'yaml', markdown: 'md', htm: 'html', dib: 'bmp' };
const extOf = (name: string): string => { const base = name.split(/[\\/]/).pop() ?? ''; const i = base.lastIndexOf('.'); return i > 0 && i < base.length - 1 ? base.slice(i + 1).toLowerCase() : ''; };
function imageType(type: string): string | null { return ({ png: 'png', jpeg: 'jpg', webp: 'webp', gif: 'gif', bmp: 'bmp' } as Record<string,string>)[type] ?? null; }
function detectedFormat(file: ConvertibleFile): { family: FileFamily; formatId: string; reason: string; known?: string } {
 const ext = formatAliases[extOf(file.name)] ?? extOf(file.name);
 const earlyInspection = inspectBytes({ name: file.name, size: file.size, head: file.head });
 if (earlyInspection.ok) { const image = imageType(earlyInspection.type); if (image && kindFor('image')?.units.some(u => u.id === image)) return { family: 'image', formatId: image, reason: `The file header identifies an image (${earlyInspection.type.toUpperCase()}); image content takes priority.`, known: earlyInspection.type }; }
 const kinds = CONVERTER_KINDS.filter(k => ['data-formats','text-formats','image'].includes(k.id));
 for (const k of kinds) { const unit = k.units.find(u => u.id === ext); if (unit && !(k.id === 'image' && ext === 'svg')) return { family: familyForKind(k.id), formatId: unit.id, reason: `The .${ext} extension identifies ${unit.name}.` }; }
 const inspection = inspectBytes({ name: file.name, size: file.size, head: file.head });
 if (inspection.ok) {
  const img = imageType(inspection.type);
  if (img && kindFor('image')?.units.some(u => u.id === img)) return { family: 'image', formatId: img, reason: `The file header identifies an image (${inspection.type.toUpperCase()}); image content takes priority.`, known: inspection.type };
  if (inspection.type === 'pdf') return { family: 'unsupported', formatId: 'pdf', reason: 'This is a PDF. AXON cannot convert PDFs yet.', known: 'PDF' };
  if (inspection.type !== 'unknown' && inspection.type !== 'text') return { family: 'unsupported', formatId: inspection.type, reason: `This is a ${inspection.type.toUpperCase()} file. AXON cannot convert it yet.`, known: inspection.type.toUpperCase() };
  if (inspection.type === 'text' || inspection.textDetection.isText) {
   const textExt = ext === 'txt' || ext === 'md' || ext === 'html' ? ext : null;
   if (textExt) return { family: 'text', formatId: textExt, reason: `The file header contains readable text and the .${textExt} extension identifies its format.` };
   if (ext === 'csv' || ext === 'tsv' || ext === 'json' || ext === 'yaml' || ext === 'xml') return { family: 'data', formatId: ext, reason: `The file header contains readable text and the .${ext} extension identifies its format.` };
   return { family: 'unsupported', formatId: 'text', reason: 'This is readable text, but its format is not identified as a supported Converter input.', known: 'text' };
  }
 }
 return { family: 'unsupported', formatId: 'unknown', reason: 'AXON cannot identify a supported conversion format for this file.' };
}
export function detectConvertible(file: ConvertibleFile): Detection | FilePlanError {
 if (!file || typeof file.name !== 'string' || !file.name.trim() || file.name.length > 4096 || !Number.isSafeInteger(file.size) || file.size < 0 || !(file.head instanceof Uint8Array)) return err('invalid-input', 'Provide a filename, non-negative integer size, and header bytes.');
 if (file.head.length > FILE_CONVERTER_LIMITS.maxHeadBytes) return err('invalid-input', 'The file header must contain at most 4096 bytes.');
 const detected = detectedFormat(file); const ext = formatAliases[extOf(file.name)] ?? extOf(file.name); const warnings: string[] = [];
 const k = kindFor(detected.family === 'data' ? 'data-formats' : detected.family === 'text' ? 'text-formats' : 'image');
 if (k && ext && !k.units.some(u => u.id === ext) && detected.family !== 'unsupported') warnings.push(`The .${ext} extension disagrees with the detected ${detected.formatId.toUpperCase()} content; content was used.`);
 if (detected.family === 'image' && ext && ext !== detected.formatId && !(ext === 'jpeg' && detected.formatId === 'jpg')) warnings.push(`The .${ext} extension disagrees with the image header; image content was used.`);
 return { ok: true, family: detected.family, kindId: detected.family === 'unsupported' ? '' : detected.family === 'data' ? 'data-formats' : detected.family === 'text' ? 'text-formats' : 'image', formatId: detected.formatId, reason: detected.reason, warnings };
}
export function targetsFor(kindId: string, formatId: string): string[] {
 const kind = kindFor(kindId); if (!kind || !kind.units.some(u => u.id === formatId)) return [];
 return kind.units.filter(u => u.id !== formatId && !(kindId === 'image' && u.id === 'svg')).map(u => u.id);
}
function cleanOutputName(name: string, to: string): string {
 let base = (name.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
 if (!base) base = 'file';
 const dot = base.lastIndexOf('.');
 if (dot > 0) base = base.slice(0, dot);
 if (!base || base === '.' || base === '..') base = 'file';
 let out = `${base}.${to}`;
 if (out === name || out.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US')) out = `${base}-converted.${to}`;
 const points = Array.from(out); if (points.length > FILE_CONVERTER_LIMITS.maxNameCodePoints) { const suffix = `.${to}`; out = Array.from(points.slice(0, FILE_CONVERTER_LIMITS.maxNameCodePoints - Array.from(suffix).length)).join('') + suffix; }
 if (out === name) out = `converted.${to}`;
 return out;
}
function limitFor(kindId: string, from: string, to: string): { bytes: number; label: string } {
 if (kindId === 'image') return { bytes: IMAGE_CONVERT_LIMITS.maxPixels * 4, label: `${IMAGE_CONVERT_LIMITS.maxPixels.toLocaleString()} pixels` };
 if (kindId === 'data-formats') {
  if (from === 'csv' || from === 'tsv' || to === 'csv' || to === 'tsv') return { bytes: CSV_LIMITS.maxBytes, label: '1 MiB CSV/TSV input/output' };
  if (from === 'json' || to === 'json') return { bytes: Math.min(JSON_LIMITS.maxBytes, 1_000_000), label: '1,000,000-byte JSON conversion limit' };
  if (from === 'yaml' || to === 'yaml') return { bytes: Math.min(YAML_LIMITS.maxInputCharacters, 1_000_000), label: '1,000,000-byte YAML conversion limit' };
  return { bytes: Math.min(XML_LIMITS.maxInputCharacters, 1_000_000), label: '1,000,000-byte XML conversion limit' };
 }
 return { bytes: Math.min(MARKDOWN_LIMITS.maxInputBytes, HTML_TEXT_LIMITS.maxInputBytes, TEXT_FORMAT_LIMITS.maxInputBytes), label: '1 MiB text input/output' };
}
function mimeFor(kindId: string, to: string): string { if (kindId === 'image') return to === 'jpg' ? 'image/jpeg' : `image/${to}`; if (kindId === 'data-formats') return ({ json:'application/json', csv:'text/csv', tsv:'text/tab-separated-values', yaml:'application/yaml', xml:'application/xml' } as Record<string,string>)[to] ?? 'application/octet-stream'; return ({ txt:'text/plain;charset=utf-8', md:'text/markdown;charset=utf-8', html:'text/html;charset=utf-8' } as Record<string,string>)[to] ?? 'text/plain;charset=utf-8'; }
function lossesFor(kindId: string, from: string, to: string): string[] {
 if (kindId === 'image') return ['Picture details such as location, EXIF data, and comments are removed.', ...(to === 'jpg' || to === 'webp' ? ['JPG and WebP lose a little quality each time they are re-encoded.'] : []), ...(to === 'jpg' ? ['Transparent pixels are placed on a white background.'] : [])];
 if (kindId === 'data-formats') {
  const losses: string[] = [];
  if (from === 'csv' || from === 'tsv' || to === 'csv' || to === 'tsv') losses.push('Tabular conversion can flatten nested values and cannot preserve all data types.');
  if (from === 'yaml' || to === 'yaml') losses.push('YAML comments and formatting are not preserved.');
  if (from === 'xml' || to === 'xml') losses.push('XML attributes and mixed-content structure may be represented differently.');
  if (from === 'json' || to === 'json') losses.push('JSON formatting and whitespace may change.');
  return losses;
 }
 return from === to ? [] : ['Text formatting and document structure not supported by the target format are removed or changed.', ...(from === 'md' || to === 'md' ? ['Markdown syntax may be rendered as plain text or HTML rather than preserved literally.'] : [])];
}
export function planFileConversion(file: ConvertibleFile, to: string, options?: { width?: number; height?: number; mime?: string; hasAlpha?: boolean }): FileConversionPlan | FilePlanError {
 const detected = detectConvertible(file); if (!detected.ok) return detected;
 if (detected.family === 'unsupported') return err('unsupported-format', detected.reason);
 if (!targetsFor(detected.kindId, detected.formatId).includes(to)) return err('unsupported-conversion', `A ${detected.formatId.toUpperCase()} file cannot become ${String(to).toUpperCase()}.`);
 const lim = limitFor(detected.kindId, detected.formatId, to);
 if (detected.family !== 'image' && file.size > lim.bytes) return err('too-large', `File exceeds the ${lim.label} limit (${lim.bytes} bytes).`);
 if (detected.family === 'image' && file.size > 100 * 1024 * 1024) return err('too-large', 'Image file exceeds the 100 MiB planning safety limit.');
 const inspected = inspectBytes({ name: file.name, size: file.size, head: file.head });
 const width = options?.width ?? (inspected.ok ? inspected.dimensions?.width : undefined); const height = options?.height ?? (inspected.ok ? inspected.dimensions?.height : undefined);
 if (detected.family === 'image' && (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || (width ?? 0) <= 0 || (height ?? 0) <= 0)) return err('invalid-input', 'Image width and height are required to verify the 24-megapixel conversion limit; provide image metadata if the header does not contain dimensions.');
 if (detected.family === 'image' && ((width ?? 0) * (height ?? 0) > IMAGE_CONVERT_LIMITS.maxPixels || (width ?? 0) > IMAGE_CONVERT_LIMITS.maxSide || (height ?? 0) > IMAGE_CONVERT_LIMITS.maxSide)) return err('too-large', `Image dimensions must fit within ${IMAGE_CONVERT_LIMITS.maxPixels.toLocaleString()} pixels and ${IMAGE_CONVERT_LIMITS.maxSide.toLocaleString()} pixels per side.`);
 const outputName = cleanOutputName(file.name, to);
 return { ok: true, kindId: detected.kindId, from: detected.formatId, to, outputName, outputMime: mimeFor(detected.kindId, to), mode: detected.family === 'image' ? 'image' : 'text', losses: lossesFor(detected.kindId, detected.formatId, to), limitsOk: true };
}
