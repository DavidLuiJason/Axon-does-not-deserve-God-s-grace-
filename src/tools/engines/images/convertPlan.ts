export const IMAGE_CONVERT_LIMITS = Object.freeze({ maxPixels: 24_000_000, maxSide: 16_384, maxNameCodePoints: 240 });
export type ImageOutputFormat = 'png' | 'jpg' | 'webp';
export type ConvertPlanErrorCode = 'invalid-input' | 'too-large' | 'unsupported-format';
export type ConvertPlanError = { ok: false; error: ConvertPlanErrorCode; message: string };
export type ImageConversionRequest = { name: string; width: number; height: number; mime: string; hasAlpha?: boolean; toFormat: ImageOutputFormat; quality?: number; maxSide?: number; svgWidth?: number };
export type ImageConversionPlan = { ok: true; inputName: string; outputName: string; outputMime: string; width: number; height: number; background: 'white' | 'transparent'; quality: number | null; warnings: string[] };
export const supportedInputs = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/avif', 'image/svg+xml'] as const;
export const supportedOutputs = ['png', 'jpg', 'webp'] as const;
export const IMAGE_CONVERT_DESCRIPTOR = { toolId: 'converter', displayName: 'Image Conversion Planner', purpose: 'Plan image output names, dimensions, transparency handling, and quality without decoding or converting pixels.', examples: ['Plan a PNG to JPG conversion with a white background.', 'Resize a picture to fit within 1,200 pixels.', 'Create unique output names for a batch of images.'], inputs: [{ name: 'image', kind: 'file' as const }, { name: 'toFormat', kind: 'choice' as const, choices: ['png', 'jpg', 'webp'] }, { name: 'maxSide', kind: 'text' as const }] };
function error(code: ConvertPlanErrorCode, message: string): ConvertPlanError { return { ok: false, error: code, message }; }
function validDimension(n: number): boolean { return Number.isSafeInteger(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER; }
function cleanName(name: string): string {
  const points = Array.from(name); if (points.length <= IMAGE_CONVERT_LIMITS.maxNameCodePoints) return name;
  const ext = extension(name), suffix = ext ? `.${ext}` : ''; const base = ext ? name.slice(0, -(ext.length + 1)) : name;
  const keep = Math.max(1, IMAGE_CONVERT_LIMITS.maxNameCodePoints - Array.from(suffix).length); return Array.from(base).slice(0, keep).join('') + suffix;
}
function extension(name: string): string { const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')); const base = name.slice(slash + 1); const dot = base.lastIndexOf('.'); return dot > 0 && dot < base.length - 1 ? base.slice(dot + 1) : ''; }
function baseName(name: string): string { const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')); const base = name.slice(slash + 1); const dot = base.lastIndexOf('.'); return dot > 0 ? base.slice(0, dot) : base; }
function outputName(inputName: string, format: ImageOutputFormat): string {
  const ext = format === 'jpg' ? 'jpg' : format; let base = baseName(inputName).trim(); if (!base) base = 'image';
  const currentExt = extension(inputName).toLowerCase(); if (currentExt === ext || (format === 'jpg' && currentExt === 'jpeg')) base += '-converted';
  const maxBase = IMAGE_CONVERT_LIMITS.maxNameCodePoints - ext.length - 1; base = Array.from(base).slice(0, maxBase).join('') || 'image'; return cleanName(`${base}.${ext}`);
}
export function planImageConversion(request: ImageConversionRequest): ImageConversionPlan | ConvertPlanError {
  if (!request || typeof request !== 'object' || typeof request.name !== 'string' || !request.name.trim() || request.name.length > 4096 || typeof request.mime !== 'string' || typeof request.toFormat !== 'string') return error('invalid-input', 'Provide a valid image name, MIME type, and output format.');
  if (!validDimension(request.width) || !validDimension(request.height)) return error('invalid-input', 'Image width and height must be positive safe integers.');
  if (request.width > IMAGE_CONVERT_LIMITS.maxPixels || request.height > IMAGE_CONVERT_LIMITS.maxPixels || request.width * request.height > IMAGE_CONVERT_LIMITS.maxPixels) return error('too-large', 'Images are limited to 24 megapixels.');
  if (!(supportedOutputs as readonly string[]).includes(request.toFormat)) return error('unsupported-format', 'Only PNG, JPG, and WebP output is supported.');
  const inputMime = request.mime.toLowerCase().split(';')[0].trim(); if (!(supportedInputs as readonly string[]).includes(inputMime)) return error('unsupported-format', 'This input image format is not supported by the planner.');
  if (request.hasAlpha !== undefined && typeof request.hasAlpha !== 'boolean') return error('invalid-input', 'hasAlpha must be true or false.');
  if (request.quality !== undefined && (!Number.isFinite(request.quality) || typeof request.quality !== 'number')) return error('invalid-input', 'Quality must be a finite number.');
  if (request.maxSide !== undefined && (!Number.isSafeInteger(request.maxSide) || request.maxSide < 1 || request.maxSide > IMAGE_CONVERT_LIMITS.maxSide)) return error('invalid-input', 'Maximum side must be an integer from 1 to 16,384 pixels.');
  if (request.svgWidth !== undefined && (!Number.isFinite(request.svgWidth) || request.svgWidth <= 0)) return error('invalid-input', 'SVG width, when supplied, must be a positive finite number.');
  let width = request.width, height = request.height;
  if (inputMime === 'image/svg+xml' && request.svgWidth !== undefined) { const w = Math.max(1, Math.round(request.svgWidth)); height = Math.max(1, Math.round(request.height * w / request.width)); width = w; if (width * height > IMAGE_CONVERT_LIMITS.maxPixels) return error('too-large', 'The SVG at that width would exceed 24 megapixels.'); }
  if (request.maxSide !== undefined) { const scale = Math.min(1, request.maxSide / Math.max(width, height)); width = Math.max(1, Math.round(width * scale)); height = Math.max(1, Math.round(height * scale)); }
  if (width > IMAGE_CONVERT_LIMITS.maxSide || height > IMAGE_CONVERT_LIMITS.maxSide) return error('too-large', 'Output sides are limited to 16,384 pixels; set a smaller maximum side.');
  const outputMime = request.toFormat === 'jpg' ? 'image/jpeg' : `image/${request.toFormat}`;
  const quality = request.toFormat === 'png' ? null : Math.max(0.05, Math.min(1, request.quality ?? 0.92));
  const warnings = ['Image metadata such as EXIF, GPS, and comments will be dropped.'];
  if (request.toFormat === 'jpg' || request.toFormat === 'webp') warnings.push('JPG and WebP may lose image quality each time they are re-encoded.');
  if (inputMime === 'image/svg+xml') warnings.push('SVG output is not offered; the selected output will be a raster image.');
  return { ok: true, inputName: request.name, outputName: outputName(request.name, request.toFormat).replace(/[\u0000-\u001f\u007f-\u009f]/g, '_'), outputMime, width, height, background: request.toFormat === 'jpg' && request.hasAlpha !== false ? 'white' : 'transparent', quality, warnings };
}
export function planBatchNames(names: string[]): { ok: true; names: string[] } | ConvertPlanError {
  if (!Array.isArray(names) || names.some((name) => typeof name !== 'string' || !name.trim() || name.length > 4096)) return error('invalid-input', 'Batch names must be non-empty strings of at most 4,096 characters.');
  const used = new Set<string>(), result: string[] = [];
  for (const name of names) { const ext = extension(name), format = (ext.toLowerCase() === 'jpeg' ? 'jpg' : ext.toLowerCase()) as ImageOutputFormat; const supported = (supportedOutputs as readonly string[]).includes(format); let candidate = supported ? outputName(name, format) : cleanName(name); const original = candidate; let n = 2; while (used.has(candidate.normalize('NFC').toLocaleLowerCase('en-US'))) { const e = extension(original), base = e ? original.slice(0, -(e.length + 1)) : original; candidate = cleanName(`${base}-${n}.${e || 'png'}`); n++; if (n > names.length + 2) return error('invalid-input', 'Could not make batch output names unique.'); } used.add(candidate.normalize('NFC').toLocaleLowerCase('en-US')); result.push(candidate); }
  return { ok: true, names: result };
}
