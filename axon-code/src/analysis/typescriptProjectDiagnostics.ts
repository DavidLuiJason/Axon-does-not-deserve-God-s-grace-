import * as ts from 'typescript';
import { isPortableProjectPath } from '../pathSafety.js';

export interface TypeScriptProjectInput {
  projectId: string;
  files: Readonly<Record<string, string>>;
  /** Raw tsconfig.json text. Omit to use AXON Code's strict, bounded defaults. */
  tsconfig?: string;
}
export interface TypeScriptProjectDiagnostic {
  file: string;
  code: number;
  category: 'error' | 'warning' | 'suggestion' | 'message';
  message: string;
  line: number | null;
  column: number | null;
  related: Array<{ file: string; line: number | null; column: number | null; message: string }>;
}
export interface TypeScriptProjectDiagnosticResult {
  projectId: string;
  success: boolean;
  checkedFiles: number;
  diagnostics: TypeScriptProjectDiagnostic[];
  compilerVersion: string;
}

const MAX_FILES = 256;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const ROOT = '/axon-workspace';

function normalizeAbsolute(fileName: string): string {
  const input = fileName.replaceAll('\\', '/');
  const parts: string[] = [];
  for (const part of input.split('/')) { if (!part || part === '.') continue; if (part === '..') parts.pop(); else parts.push(part); }
  return `${input.startsWith('/') ? '/' : ''}${parts.join('/')}`;
}
function joinProjectPath(file: string): string { return `${ROOT}/${file}`; }
function diagnosticPath(file: ts.SourceFile | undefined): string {
  if (!file) return 'tsconfig.json';
  const absolute = normalizeAbsolute(file.fileName);
  return absolute.startsWith(`${ROOT}/`) ? absolute.slice(ROOT.length + 1) : 'tsconfig.json';
}
function mapDiagnostic(item: ts.Diagnostic): TypeScriptProjectDiagnostic {
  const position = item.file && item.start !== undefined ? item.file.getLineAndCharacterOfPosition(item.start) : null;
  const related = (item.relatedInformation ?? []).map((entry) => {
    const at = entry.file && entry.start !== undefined ? entry.file.getLineAndCharacterOfPosition(entry.start) : null;
    return { file: diagnosticPath(entry.file), line: at ? at.line + 1 : null, column: at ? at.character + 1 : null, message: ts.flattenDiagnosticMessageText(entry.messageText, '\n') };
  });
  const category = item.category === ts.DiagnosticCategory.Error ? 'error' : item.category === ts.DiagnosticCategory.Warning ? 'warning' : item.category === ts.DiagnosticCategory.Suggestion ? 'suggestion' : 'message';
  return { file: diagnosticPath(item.file), code: item.code, category, message: ts.flattenDiagnosticMessageText(item.messageText, '\n'), line: position ? position.line + 1 : null, column: position ? position.character + 1 : null, related };
}

/** Runs the actual pinned TypeScript compiler API against a bounded, virtual project. */
export class TypeScriptProjectDiagnostics {
  analyzeProject(input: TypeScriptProjectInput): TypeScriptProjectDiagnosticResult {
    if (!input || typeof input.projectId !== 'string' || !input.projectId.trim() || !input.files || typeof input.files !== 'object' || Array.isArray(input.files)) {
      throw new Error('TypeScript project input is invalid.');
    }
    const entries = Object.entries(input.files);
    if (entries.length > MAX_FILES) throw new Error(`TypeScript project exceeds the ${MAX_FILES}-file limit.`);
    const virtualFiles = new Map<string, string>();
    let totalBytes = 0;
    for (const [file, content] of entries) {
      if (!isPortableProjectPath(file) || typeof content !== 'string') throw new Error(`TypeScript project file '${file}' has an unsafe path or non-text content.`);
      const size = new TextEncoder().encode(content).byteLength;
      if (size > MAX_FILE_BYTES || (totalBytes += size) > MAX_TOTAL_BYTES) throw new Error('TypeScript project exceeds the 8 MiB source limit.');
      const absolute = joinProjectPath(file);
      if (virtualFiles.has(absolute)) throw new Error(`Duplicate TypeScript project file '${file}'.`);
      virtualFiles.set(absolute, content);
    }

    const defaultOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
      jsx: ts.JsxEmit.React
    };
    const libPath = normalizeAbsolute(ts.getDefaultLibFilePath(defaultOptions));
    const libDirectory = libPath.slice(0, libPath.lastIndexOf('/'));
    const isCompilerLib = (fileName: string) => {
      const absolute = normalizeAbsolute(fileName);
      return absolute === libDirectory || absolute.startsWith(`${libDirectory}/`);
    };
    const readVirtualOrLib = (fileName: string): string | undefined => {
      const absolute = normalizeAbsolute(fileName);
      const virtual = virtualFiles.get(absolute);
      if (virtual !== undefined) return virtual;
      return isCompilerLib(absolute) ? ts.sys.readFile(absolute) : undefined;
    };
    const fileExistsVirtualOrLib = (fileName: string): boolean => {
      const absolute = normalizeAbsolute(fileName);
      return virtualFiles.has(absolute) || (isCompilerLib(absolute) && ts.sys.fileExists(absolute));
    };

    const compilerHost = ts.createCompilerHost(defaultOptions, true);
    compilerHost.getCurrentDirectory = () => ROOT;
    compilerHost.fileExists = fileExistsVirtualOrLib;
    compilerHost.readFile = readVirtualOrLib;
    compilerHost.directoryExists = (directoryName) => {
      const absolute = normalizeAbsolute(directoryName);
      if (absolute === ROOT || [...virtualFiles.keys()].some((file) => file.startsWith(`${absolute}/`))) return true;
      return isCompilerLib(absolute) && ts.sys.directoryExists?.(absolute) === true;
    };
    compilerHost.getSourceFile = (fileName, languageVersion, onError) => {
      const source = readVirtualOrLib(fileName);
      if (source === undefined) { onError?.(`File not found in the virtual TypeScript project: ${fileName}`); return undefined; }
      return ts.createSourceFile(fileName, source, languageVersion, true);
    };
    compilerHost.readDirectory = (_rootDir, extensions, _excludes, includes) => {
      const selected = [...virtualFiles.keys()].filter((file) => !extensions?.length || extensions.some((extension) => file.endsWith(extension)));
      return selected.filter((file) => !includes?.length || includes.some((pattern) => pattern === '**/*' || pattern === '**/*.*' || file.includes(pattern.replaceAll('*', ''))));
    };

    let options = defaultOptions;
    let rootNames = [...virtualFiles.keys()].filter((file) => /\.[cm]?tsx?$/i.test(file));
    const configDiagnostics: ts.Diagnostic[] = [];
    if (input.tsconfig !== undefined) {
      if (typeof input.tsconfig !== 'string' || new TextEncoder().encode(input.tsconfig).byteLength > 64 * 1024) throw new Error('tsconfig.json exceeds the 64 KiB limit.');
      const configPath = `${ROOT}/tsconfig.json`;
      const parsedText = ts.parseConfigFileTextToJson(configPath, input.tsconfig);
      if (parsedText.error) configDiagnostics.push(parsedText.error);
      else {
        const parsedConfig = ts.parseJsonConfigFileContent(parsedText.config, {
          useCaseSensitiveFileNames: true,
          readDirectory: compilerHost.readDirectory,
          fileExists: compilerHost.fileExists,
          readFile: compilerHost.readFile,
          getCurrentDirectory: compilerHost.getCurrentDirectory
        }, ROOT, defaultOptions, configPath);
        configDiagnostics.push(...parsedConfig.errors);
        options = { ...defaultOptions, ...parsedConfig.options, noEmit: true, types: [] };
        rootNames = parsedConfig.fileNames;
      }
    }

    const program = ts.createProgram({ rootNames, options, host: compilerHost });
    const diagnostics = [...configDiagnostics, ...program.getOptionsDiagnostics(), ...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics()]
      .map(mapDiagnostic)
      .sort((a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || a.code - b.code || a.message.localeCompare(b.message));
    return { projectId: input.projectId, success: !diagnostics.some((item) => item.category === 'error'), checkedFiles: rootNames.length, diagnostics, compilerVersion: ts.version };
  }
}
