export interface RawSourceMap {
  version: 3;
  file?: string;
  sourceRoot?: string;
  sources: string[];
  sourcesContent?: Array<string | null>;
  names: string[];
  mappings: string;
}

export interface SourceMapLocation {
  source: string;
  line: number;
  column: number;
}

interface DecodedSegment { generatedColumn: number; source?: number; originalLine?: number; originalColumn?: number; }
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeVlq(input: string): number[] {
  const values: number[] = [];
  let value = 0, shift = 0;
  for (const character of input) {
    const digit = BASE64.indexOf(character);
    if (digit < 0) throw new Error('Invalid base64 VLQ source-map segment.');
    const continuation = (digit & 32) !== 0;
    value += (digit & 31) << shift;
    if (continuation) { shift += 5; continue; }
    const negative = (value & 1) === 1;
    values.push(negative ? -(value >>> 1) : value >>> 1);
    value = 0; shift = 0;
  }
  if (shift !== 0) throw new Error('Truncated base64 VLQ source-map segment.');
  return values;
}

function encodeVlq(value: number): string {
  let encoded = value < 0 ? ((-value) << 1) | 1 : value << 1;
  let output = '';
  do {
    let digit = encoded & 31;
    encoded >>>= 5;
    if (encoded > 0) digit |= 32;
    output += BASE64[digit];
  } while (encoded > 0);
  return output;
}

function decodeMappings(map: RawSourceMap): DecodedSegment[][] {
  let previousSource = 0, previousOriginalLine = 0, previousOriginalColumn = 0;
  return map.mappings.split(';').map((line) => {
    let previousGeneratedColumn = 0;
    if (!line) return [];
    return line.split(',').filter(Boolean).map((encoded) => {
      const values = decodeVlq(encoded);
      if (values.length !== 1 && values.length !== 4 && values.length !== 5) throw new Error('Invalid source-map segment width.');
      previousGeneratedColumn += values[0]!;
      if (values.length === 1) return { generatedColumn: previousGeneratedColumn };
      previousSource += values[1]!;
      previousOriginalLine += values[2]!;
      previousOriginalColumn += values[3]!;
      return { generatedColumn: previousGeneratedColumn, source: previousSource, originalLine: previousOriginalLine, originalColumn: previousOriginalColumn };
    });
  });
}

/** Combines single-source TypeScript maps into one map for a concatenated bundle. */
export function combineSourceMaps(input: Array<{ sourcePath: string; sourceContent: string; sourceMapText: string; generatedLineOffset: number }>, generatedFile = 'axon-bundle.js'): RawSourceMap {
  const sources: string[] = [];
  const sourcesContent: Array<string | null> = [];
  const lines: DecodedSegment[][] = [];
  for (const item of input) {
    const map = JSON.parse(item.sourceMapText) as RawSourceMap;
    if (map.version !== 3 || !Array.isArray(map.sources) || !map.sources.length || typeof map.mappings !== 'string') throw new Error(`Compiler returned an invalid source map for '${item.sourcePath}'.`);
    if (!sources.includes(item.sourcePath)) {
      sources.push(item.sourcePath);
      sourcesContent.push(item.sourceContent);
    }
    const sourceIndex = sources.indexOf(item.sourcePath);
    const decoded = decodeMappings(map);
    while (lines.length < item.generatedLineOffset) lines.push([]);
    for (let lineIndex = 0; lineIndex < decoded.length; lineIndex += 1) {
      const targetLine = item.generatedLineOffset + lineIndex;
      while (lines.length <= targetLine) lines.push([]);
      for (const segment of decoded[lineIndex] ?? []) {
        if (segment.source === undefined || segment.originalLine === undefined || segment.originalColumn === undefined) {
          lines[targetLine]!.push({ generatedColumn: segment.generatedColumn });
        } else {
          lines[targetLine]!.push({ generatedColumn: segment.generatedColumn, source: sourceIndex, originalLine: segment.originalLine, originalColumn: segment.originalColumn });
        }
      }
    }
  }
  let previousSource = 0, previousOriginalLine = 0, previousOriginalColumn = 0;
  const mappings = lines.map((line) => {
    let previousGeneratedColumn = 0;
    return line.map((segment) => {
      const fields = [encodeVlq(segment.generatedColumn - previousGeneratedColumn)];
      previousGeneratedColumn = segment.generatedColumn;
      if (segment.source !== undefined && segment.originalLine !== undefined && segment.originalColumn !== undefined) {
        fields.push(encodeVlq(segment.source - previousSource)); previousSource = segment.source;
        fields.push(encodeVlq(segment.originalLine - previousOriginalLine)); previousOriginalLine = segment.originalLine;
        fields.push(encodeVlq(segment.originalColumn - previousOriginalColumn)); previousOriginalColumn = segment.originalColumn;
      }
      return fields.join('');
    }).join(',');
  }).join(';');
  return { version: 3, file: generatedFile, sources, sourcesContent, names: [], mappings };
}

/** Maps a generated 1-based line/column to the closest preceding verified source-map segment. */
export function mapGeneratedPosition(map: RawSourceMap, generatedLine: number, generatedColumn: number): SourceMapLocation | null {
  if (!Number.isSafeInteger(generatedLine) || generatedLine < 1 || !Number.isSafeInteger(generatedColumn) || generatedColumn < 1) return null;
  let decoded: DecodedSegment[][];
  try { decoded = decodeMappings(map); } catch { return null; }
  const segments = decoded[generatedLine - 1];
  if (!segments?.length) return null;
  const targetColumn = generatedColumn - 1;
  let selected: DecodedSegment | undefined;
  for (const segment of segments) {
    if (segment.generatedColumn > targetColumn) break;
    if (segment.source !== undefined) selected = segment;
  }
  if (!selected || selected.source === undefined || selected.originalLine === undefined || selected.originalColumn === undefined) return null;
  const source = map.sources[selected.source];
  if (!source) return null;
  return { source, line: selected.originalLine + 1, column: selected.originalColumn + 1 };
}
