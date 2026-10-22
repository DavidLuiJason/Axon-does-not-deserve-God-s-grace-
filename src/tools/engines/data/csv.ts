export const CSV_LIMITS = { maxBytes: 1024 * 1024, maxRows: 100000, maxColumns: 1000 } as const;
export type CsvErrorCode = 'invalid-input' | 'too-large' | 'too-many-rows' | 'too-many-columns' | 'invalid-delimiter' | 'malformed-quote' | 'invalid-options';
export type CsvError = { ok: false; error: CsvErrorCode; message: string; row?: number; column?: number };
export type CsvWarning = { row: number; expectedColumns: number; actualColumns: number; message: string };
export type CsvParseResult = { ok: true; rows: unknown[][]; warnings: CsvWarning[] } | CsvError;
export type CsvOptions = { delimiter: ',' | '\t' | ';'; header: boolean; detectTypes?: boolean };
export type CsvWriteOptions = { delimiter: ',' | '\t' | ';'; header: boolean };
export const CSV_DESCRIPTOR = { toolId: 'converter', displayName: 'CSV and TSV', purpose: 'Read and write bounded delimited tables with quoted fields and explicit row-shape warnings.', examples: ['Read this CSV table', 'Convert these rows to TSV', 'Use the first row as column names'], inputs: [{ name: 'text', kind: 'text' as const }, { name: 'delimiter', kind: 'choice' as const, choices: [',', 'tab', ';'] }, { name: 'header', kind: 'yes-no' as const }, { name: 'detectTypes', kind: 'yes-no' as const }] } as const;
function fail(error: CsvErrorCode, message: string, row?: number, column?: number): CsvError { return { ok: false, error, message, ...(row === undefined ? {} : { row }), ...(column === undefined ? {} : { column }) }; }
function detect(v: string): unknown { if (v === 'true') return true; if (v === 'false') return false; if (v === 'null') return null; if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(v)) { const n = Number(v); if (Number.isFinite(n)) return n; } return v; }
export function parseCsv(text: string, options: CsvOptions): CsvParseResult {
 if (typeof text !== 'string') return fail('invalid-input', 'CSV input must be text.');
 if (new TextEncoder().encode(text).length > CSV_LIMITS.maxBytes) return fail('too-large', 'CSV input exceeds 1 MB.');
 if (!options || ![',', '\t', ';'].includes(options.delimiter) || typeof options.header !== 'boolean' || (options.detectTypes !== undefined && typeof options.detectTypes !== 'boolean')) return fail('invalid-options', 'Choose a supported delimiter and boolean header/type options.');
 if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
 const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, afterQuote = false, i = 0;
 const delimiter = options.delimiter; const pushField = () => { row.push(field); field = ''; afterQuote = false; if (row.length > CSV_LIMITS.maxColumns) throw fail('too-many-columns', 'CSV row exceeds 1,000 columns.', rows.length + 1, row.length); };
 const pushRow = () => { pushField(); rows.push(row); row = []; if (rows.length > CSV_LIMITS.maxRows) throw fail('too-many-rows', 'CSV exceeds 100,000 rows.', rows.length); };
 try {
  while (i < text.length) { const c = text[i];
   if (quoted) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } quoted = false; afterQuote = true; i++; continue; } field += c; i++; continue; }
   if (afterQuote && c !== delimiter && c !== '\r' && c !== '\n') return fail('malformed-quote', 'Unexpected character after a closing quote.', rows.length + 1, row.length + 1);
   if (c === '"') { if (field.length !== 0 || afterQuote) return fail('malformed-quote', 'Quote inside an unquoted field.', rows.length + 1, row.length + 1); quoted = true; i++; continue; }
   if (c === delimiter) { pushField(); i++; continue; }
   if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i += 2; else i++; pushRow(); continue; }
   field += c; i++;
  }
  if (quoted) return fail('malformed-quote', 'Unterminated quoted field.', rows.length + 1, row.length + 1);
  if (field.length || row.length || afterQuote || (text.length > 0 && !/[\r\n]$/.test(text))) pushRow();
 } catch (e) { if (e && typeof e === 'object' && 'ok' in e && (e as CsvError).ok === false) return e as CsvError; return fail('invalid-input', 'CSV parsing failed safely.'); }
 const warnings: CsvWarning[] = []; if (rows.length) { const expected = rows[0].length; rows.forEach((r, idx) => { if (r.length !== expected) warnings.push({ row: idx + 1, expectedColumns: expected, actualColumns: r.length, message: `Row ${idx + 1} has ${r.length} columns; expected ${expected}.` }); }); }
 let output: unknown[][] = rows; if (options.detectTypes) output = rows.map(r => r.map(detect));
 return { ok: true, rows: output, warnings };
}
function fieldText(v: unknown): string { if (v === null) return 'null'; if (typeof v === 'string') return v; if (typeof v === 'number' || typeof v === 'boolean') return String(v); return JSON.stringify(v); }
export function writeCsv(rows: readonly (readonly unknown[])[], options: CsvWriteOptions): { ok: true; text: string } | CsvError {
 if (!Array.isArray(rows) || !options || ![',', '\t', ';'].includes(options.delimiter) || typeof options.header !== 'boolean') return fail('invalid-options', 'Rows and supported delimiter/header options are required.');
 if (rows.length > CSV_LIMITS.maxRows) return fail('too-many-rows', 'Table exceeds 100,000 rows.'); let out = '';
 for (let ri = 0; ri < rows.length; ri++) { const row = rows[ri]; if (!Array.isArray(row)) return fail('invalid-input', 'Every table row must be an array.', ri + 1); if (row.length > CSV_LIMITS.maxColumns) return fail('too-many-columns', 'A row exceeds 1,000 columns.', ri + 1); if (ri) out += '\r\n'; out += row.map(v => { const s = fieldText(v); return s.includes(options.delimiter) || /["\r\n]/.test(s) || s.startsWith(' ') || s.endsWith(' ') || (row.length === 1 && s === '') ? `"${s.replace(/"/g, '""')}"` : s; }).join(options.delimiter); if (new TextEncoder().encode(out).length > CSV_LIMITS.maxBytes) return fail('too-large', 'Written CSV exceeds 1 MB.'); }
 return { ok: true, text: out };
}
export function rowsToObjects(rows: readonly (readonly unknown[])[], header = true): { ok: true; rows: Record<string, unknown>[] } | CsvError {
 if (!Array.isArray(rows)) return fail('invalid-input', 'Rows must be an array.'); if (!rows.length) return { ok: true, rows: [] };
 const first: readonly unknown[] = rows[0] as readonly unknown[]; const keys: string[] = header ? first.map((v: unknown, i: number) => String(v ?? `column${i + 1}`)) : first.map((_: unknown, i: number) => `column${i + 1}`); const data = header ? rows.slice(1) : rows;
 return { ok: true, rows: data.map(r => { const obj: Record<string, unknown> = {}; keys.forEach((k: string, i: number) => { obj[k] = r[i] ?? ''; }); return obj; }) };
}
export function objectsToRows(objects: readonly Record<string, unknown>[], header = true): { ok: true; rows: unknown[][] } | CsvError {
 if (!Array.isArray(objects) || objects.some(o => !o || typeof o !== 'object' || Array.isArray(o))) return fail('invalid-input', 'Expected an array of plain objects.'); const keys: string[] = []; for (const obj of objects) for (const k of Object.keys(obj)) if (!keys.includes(k)) keys.push(k);
 const rows: unknown[][] = objects.map(o => keys.map(k => Object.prototype.hasOwnProperty.call(o, k) ? o[k] : '')); if (header) rows.unshift(keys); return { ok: true, rows };
}
