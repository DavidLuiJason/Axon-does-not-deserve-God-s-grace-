import type { CodeDiagnostic, SourceLanguage, SourceLocation } from '../types.js';
import { normalizeProjectPath } from '../pathSafety.js';

export interface ToolchainDiagnosticInput {
  language: Extract<SourceLanguage, 'python' | 'cpp' | 'rust'>;
  requestedFile: string;
  output: string;
  maxOutputChars?: number;
}

function stableId(code: string, file: string, line: number | undefined, column: number | undefined, message: string): string {
  const value = `${code}|${file}|${line ?? 0}|${column ?? 0}|${message}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `TC-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function boundedLine(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 10_000_000 ? parsed : undefined;
}
function boundedColumn(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 1_000_000 ? parsed : undefined;
}

function mapReportedPath(reported: string | undefined, requestedFile: string): string | undefined {
  const requested = normalizeProjectPath(requestedFile);
  if (!requested) return undefined;
  if (!reported) return requested;
  const cleaned = reported.trim().replace(/^\.\//, '').replace(/\\/g, '/');
  const direct = normalizeProjectPath(cleaned);
  if (direct === requested) return requested;
  // Compilers often print absolute temporary paths. Only map a suffix that
  // exactly matches the known workspace-relative path; never expose host paths.
  if (cleaned.endsWith(`/${requested}`) || cleaned === requested) return requested;
  return undefined;
}

function createDiagnostic(
  code: string, language: ToolchainDiagnosticInput['language'], requestedFile: string,
  message: string, location: SourceLocation | undefined, severity: CodeDiagnostic['severity'],
  stage: CodeDiagnostic['stage'], confidence: CodeDiagnostic['confidence']
): CodeDiagnostic {
  const safeLocation = location && normalizeProjectPath(location.file) === location.file ? location : undefined;
  return {
    id: stableId(code, requestedFile, safeLocation?.line, safeLocation?.column, message),
    code,
    severity,
    stage,
    message: message.slice(0, 2000),
    ...(safeLocation ? { location: safeLocation } : {}),
    evidence: 'ADAPTER_REPORTED',
    confidence,
    explanation: `${language} toolchain output was parsed. The location is reported only when the compiler or interpreter supplied a safe source position.`,
    suggestedAction: 'Inspect the reported source location and rerun the relevant compiler or test after correction.'
  };
}

function parsePython(input: ToolchainDiagnosticInput, lines: string[]): CodeDiagnostic[] {
  const result: CodeDiagnostic[] = [];
  const frames: Array<{ line: number; rawPath: string }> = [];
  for (const line of lines) {
    const match = line.match(/^\s*File\s+["'](.+?)["'],\s+line\s+(\d+)(?:,|$)/);
    if (match) {
      const number = boundedLine(match[2] ?? "");
      if (number) frames.push({ line: number, rawPath: match[1] ?? "" });
    }
  }
  const syntaxIndex = lines.findIndex((line) => /^\s*(?:SyntaxError|IndentationError|TabError):/.test(line));
  const runtimeLine = [...lines].reverse().find((line) => /^\s*(?:NameError|TypeError|ValueError|ImportError|ModuleNotFoundError|IndexError|KeyError|AttributeError|ZeroDivisionError|RuntimeError|AssertionError|OSError|OverflowError|RecursionError):/.test(line));
  const lastFrame = frames.at(-1);
  const reportedPath = lastFrame ? mapReportedPath(lastFrame.rawPath, input.requestedFile) : normalizeProjectPath(input.requestedFile) ?? undefined;
  let location: SourceLocation | undefined = reportedPath && lastFrame ? { file: reportedPath, line: lastFrame.line } : undefined;
  let message = runtimeLine?.trim() ?? (syntaxIndex >= 0 ? (lines[syntaxIndex] ?? '').trim() : 'Python execution failed; no recognised traceback summary was found.');
  let code = runtimeLine ? `PYTHON_${(runtimeLine.trim().split(':', 1)[0] ?? 'PYTHON_ERROR').toUpperCase()}` : syntaxIndex >= 0 ? 'PYTHON_SYNTAX_ERROR' : 'PYTHON_TRACEBACK';
  let confidence: CodeDiagnostic['confidence'] = location ? 'high' : 'medium';
  if (syntaxIndex >= 0) {
    // CPython SyntaxError output usually contains a line declaration and a caret.
    const syntaxLine = lines[syntaxIndex] ?? '';
    const previous = lines.slice(0, syntaxIndex).reverse().find((line) => /^\s*line\s+\d+/.test(line));
    const lineMatch = syntaxLine.match(/line\s+(\d+)/i) ?? previous?.match(/line\s+(\d+)/i);
    const lineNumber = lineMatch ? boundedLine(lineMatch[1] ?? "") : lastFrame?.line;
    const caretLine = lines.slice(Math.max(0, syntaxIndex - 4), syntaxIndex).find((line) => line.includes('^'));
    const caretColumn = caretLine ? boundedColumn(String(caretLine.indexOf('^') + 1)) : undefined;
    const file = normalizeProjectPath(input.requestedFile);
    if (file && lineNumber) location = { file, line: lineNumber, ...(caretColumn ? { column: caretColumn } : {}) };
    message = syntaxLine.trim();
    code = 'PYTHON_SYNTAX_ERROR';
    confidence = location ? (location.column ? 'high' : 'medium') : 'low';
  }
  result.push(createDiagnostic(code, 'python', input.requestedFile, message, location, 'error', syntaxIndex >= 0 ? 'syntax' : 'runtime', confidence));
  return result;
}

function parseCpp(input: ToolchainDiagnosticInput, lines: string[]): CodeDiagnostic[] {
  const result: CodeDiagnostic[] = [];
  for (const line of lines) {
    const match = line.match(/^(.+?):(\d+):(\d+):\s*(fatal error|error|warning|note):\s*(.+)$/i);
    if (!match) continue;
    const reportedFile = mapReportedPath(match[1] ?? undefined, input.requestedFile);
    const lineNumber = boundedLine(match[2] ?? "");
    const column = boundedColumn(match[3] ?? "");
    const severityToken = (match[4] ?? "error").toLowerCase();
    const severity: CodeDiagnostic['severity'] = severityToken.includes('error') ? 'error' : severityToken === 'warning' ? 'warning' : 'info';
    const location = reportedFile && lineNumber ? { file: reportedFile, line: lineNumber, ...(column ? { column } : {}) } : undefined;
    result.push(createDiagnostic(severity === 'error' ? 'CPP_COMPILER_ERROR' : severity === 'warning' ? 'CPP_COMPILER_WARNING' : 'CPP_COMPILER_NOTE', 'cpp', input.requestedFile, (match[5] ?? "Compiler diagnostic").trim(), location, severity, 'syntax', location ? 'high' : 'medium'));
  }
  return result;
}

function parseRust(input: ToolchainDiagnosticInput, lines: string[]): CodeDiagnostic[] {
  const result: CodeDiagnostic[] = [];
  let severity: CodeDiagnostic['severity'] = 'error';
  let code = 'RUSTC_DIAGNOSTIC';
  let message = '';
  for (let index = 0; index < lines.length; index += 1) {
    const header = (lines[index] ?? '').trim().match(/^(error|warning|note)(?:\[([A-Z0-9_]+)\])?:\s*(.*)$/i);
    if (header) {
      severity = (header[1] ?? "error").toLowerCase() === 'warning' ? 'warning' : (header[1] ?? "error").toLowerCase() === 'note' ? 'info' : 'error';
      code = header[2] ? `RUSTC_${header[2]}` : `RUSTC_${(header[1] ?? "error").toUpperCase()}`;
      message = header[3] || header[1] || "Rust compiler diagnostic";
      const locationLine = lines.slice(index + 1, Math.min(lines.length, index + 8)).find((line) => line.trim().startsWith('-->'));
      const locationMatch = locationLine?.trim().match(/^-->\s+(.+?):(\d+):(\d+)$/);
      const reportedFile = locationMatch ? mapReportedPath(locationMatch[1] ?? undefined, input.requestedFile) : undefined;
      const lineNumber = locationMatch ? boundedLine(locationMatch[2] ?? "") : undefined;
      const column = locationMatch ? boundedColumn(locationMatch[3] ?? "") : undefined;
      const location = reportedFile && lineNumber ? { file: reportedFile, line: lineNumber, ...(column ? { column } : {}) } : undefined;
      result.push(createDiagnostic(code, 'rust', input.requestedFile, message, location, severity, 'syntax', location ? 'high' : 'medium'));
    }
  }
  return result;
}

/** Parse toolchain text; this is output interpretation, not a substitute for the compiler. */
export function parseToolchainDiagnostics(input: ToolchainDiagnosticInput): CodeDiagnostic[] {
  const max = input.maxOutputChars ?? 128 * 1024;
  if (!Number.isSafeInteger(max) || max < 1 || max > 2 * 1024 * 1024) throw new Error('Diagnostic output limit must be between 1 byte and 2 MiB.');
  if (!normalizeProjectPath(input.requestedFile)) throw new Error('Requested diagnostic file must be a safe project-relative path.');
  const output = typeof input.output === 'string' ? input.output.slice(0, max) : '';
  const lines = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const parsed = input.language === 'python' ? parsePython(input, lines) : input.language === 'cpp' ? parseCpp(input, lines) : parseRust(input, lines);
  const unique = new Map<string, CodeDiagnostic>();
  for (const item of parsed) if (!unique.has(item.id)) unique.set(item.id, item);
  return [...unique.values()];
}
