import type {
  AnalyzerLimits, CodeDiagnostic, ImportReference, ProjectAnalysis, ProjectFileEntry,
  ProjectFileSummary, ProjectSource, SourceLanguage, LanguageDiagnosticAdapter
} from './types.js';
import { analyzeSourceFile } from './diagnostics.js';
import { tokenize } from './lexer.js';
import { isTextLikePath, joinProjectPath, normalizeProjectPath } from './pathSafety.js';

const DEFAULT_LIMITS: AnalyzerLimits = { maxFiles: 10_000, maxFileBytes: 1_048_576, maxTotalReadBytes: 16_777_216 };

export function detectLanguage(path: string): SourceLanguage {
  const lower = path.toLowerCase();
  if (/\.(?:mjs|cjs|js|jsx)$/.test(lower)) return 'javascript';
  if (/\.(?:ts|tsx|mts|cts)$/.test(lower)) return 'typescript';
  if (/\.json$/.test(lower)) return 'json';
  if (/\.css$/.test(lower)) return 'css';
  if (/\.(?:html|htm)$/.test(lower)) return 'html';
  return 'unknown';
}

function makeProjectDiagnostic(file: string, code: string, message: string, severity: CodeDiagnostic['severity'] = 'warning'): CodeDiagnostic {
  return { id: `${file}:${code}`, code, severity, stage: code.startsWith('UNSAFE') ? 'security' : 'project', message, location: { file, line: 1, column: 1 }, evidence: 'CHECKED', confidence: 'high' };
}

function extractImports(file: string, source: string): ImportReference[] {
  const { tokens } = tokenize(source);
  const found: ImportReference[] = [];
  const add = (specifier: string, kind: ImportReference['kind']): void => {
    found.push({ fromFile: file, specifier, kind, resolved: false });
  };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) continue;
    if (token.value === 'import') {
      const next = tokens[i + 1];
      if (next?.value === '(') {
        const arg = tokens[i + 2];
        if (arg?.kind === 'string' && tokens[i + 3]?.value === ')') add(unquote(arg.value), 'dynamic-literal');
        else add('*dynamic*', 'dynamic-nonliteral');
        continue;
      }
      if (next?.kind === 'string') { add(unquote(next.value), 'static'); continue; }
      for (let j = i + 1; j < tokens.length && tokens[j]?.line === token.line; j += 1) {
        if (tokens[j]?.value === 'from' && tokens[j + 1]?.kind === 'string') {
          add(unquote(tokens[j + 1]?.value ?? ''), 'static'); break;
        }
      }
    }
    if (token.value === 'require' && tokens[i + 1]?.value === '(') {
      const arg = tokens[i + 2];
      if (arg?.kind === 'string' && tokens[i + 3]?.value === ')') add(unquote(arg.value), 'require');
      else add('*dynamic*', 'dynamic-nonliteral');
    }
    if (token.value === 'export') {
      for (let j = i + 1; j < tokens.length && tokens[j]?.line === token.line; j += 1) {
        if (tokens[j]?.value === 'from' && tokens[j + 1]?.kind === 'string') {
          add(unquote(tokens[j + 1]?.value ?? ''), 'static'); break;
        }
      }
    }
  }
  return found;
}

function unquote(value: string): string {
  if (value.length < 2) return value;
  return value.slice(1, -1).replace(/\\([\\'"`])/g, '$1');
}

function collectDeclarations(source: string): ProjectFileSummary['declarations'] {
  const { tokens } = tokenize(source);
  const result: ProjectFileSummary['declarations'] = [];
  const seen = new Set<string>();
  const kinds: Record<string, ProjectFileSummary['declarations'][number]['kind']> = {
    function: 'function', class: 'class', interface: 'interface', type: 'type', const: 'variable', let: 'variable', var: 'variable'
  };
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const token = tokens[i]; const next = tokens[i + 1];
    if (!token || !next || next.kind !== 'identifier') continue;
    const declarationKind = kinds[token.value];
    if (!declarationKind) continue;
    const key = `${declarationKind}:${next.value}:${next.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ kind: declarationKind, name: next.value, line: next.line });
  }
  return result;
}

function resolveLocalImport(fromFile: string, specifier: string, known: Set<string>): string | undefined {
  const base = joinProjectPath(fromFile, specifier);
  if (!base) return undefined;
  const extension = base.slice(base.lastIndexOf('.')).toLowerCase();
  const substitutions: Record<string, string[]> = {
    '.js': ['.ts', '.tsx', '.d.ts', '.js'],
    '.jsx': ['.tsx', '.jsx'],
    '.mjs': ['.mts', '.mjs'],
    '.cjs': ['.cts', '.cjs']
  };
  const candidates = [base];
  if (substitutions[extension]) {
    const stem = base.slice(0, -extension.length);
    candidates.push(...substitutions[extension]!.map((item) => `${stem}${item}`));
  } else if (!/\.[A-Za-z0-9]+$/.test(base)) {
    candidates.push(...['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.mjs', '.cjs', '.json'].map((ext) => `${base}${ext}`));
  }
  candidates.push(...['index.ts', 'index.tsx', 'index.d.ts', 'index.js', 'index.jsx', 'index.mjs', 'index.cjs'].map((name) => `${base}/${name}`));
  return candidates.find((candidate) => known.has(candidate));
}

type TypeScriptApi = typeof import('typescript');

function ecmaScriptKind(ts: TypeScriptApi, path: string): import('typescript').ScriptKind {
  const lower = path.toLowerCase();
  if (lower.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (lower.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function extractCompilerImports(ts: TypeScriptApi, file: string, sourceFile: import('typescript').SourceFile): ImportReference[] {
  const found: ImportReference[] = [];
  const seen = new Set<string>();
  const add = (specifier: string, kind: ImportReference['kind']): void => {
    const key = `${kind}\0${specifier}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ fromFile: file, specifier, kind, resolved: false });
  };
  const visit = (node: import('typescript').Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) add(node.moduleSpecifier.text, 'static');
    else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) add(node.moduleSpecifier.text, 'static');
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
      add(node.moduleReference.expression.text, 'static');
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = node.arguments[0];
        if (node.arguments.length === 1 && arg && ts.isStringLiteralLike(arg)) add(arg.text, 'dynamic-literal');
        else add('*dynamic*', 'dynamic-nonliteral');
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const arg = node.arguments[0];
        if (node.arguments.length === 1 && arg && ts.isStringLiteralLike(arg)) add(arg.text, 'require');
        else add('*dynamic*', 'dynamic-nonliteral');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function collectCompilerDeclarations(ts: TypeScriptApi, sourceFile: import('typescript').SourceFile): ProjectFileSummary['declarations'] {
  const declarations: ProjectFileSummary['declarations'] = [];
  const add = (kind: ProjectFileSummary['declarations'][number]['kind'], node: import('typescript').NamedDeclaration): void => {
    if (!node.name || !ts.isIdentifier(node.name)) return;
    const location = sourceFile.getLineAndCharacterOfPosition(node.name.getStart(sourceFile));
    declarations.push({ kind, name: node.name.text, line: location.line + 1 });
  };
  const visit = (node: import('typescript').Node): void => {
    if (ts.isFunctionDeclaration(node)) add('function', node);
    else if (ts.isClassDeclaration(node)) add('class', node);
    else if (ts.isInterfaceDeclaration(node)) add('interface', node);
    else if (ts.isTypeAliasDeclaration(node)) add('type', node);
    else if (ts.isVariableDeclaration(node)) add('variable', node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  const seen = new Set<string>();
  return declarations.filter((row) => {
    const key = `${row.kind}:${row.name}:${row.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compilerSyntaxDiagnostics(ts: TypeScriptApi, file: string, sourceFile: import('typescript').SourceFile): CodeDiagnostic[] {
  const parseDiagnostics = (sourceFile as import('typescript').SourceFile & { parseDiagnostics: readonly import('typescript').Diagnostic[] }).parseDiagnostics;
  return parseDiagnostics.map((item) => {
    const location = sourceFile.getLineAndCharacterOfPosition(item.start ?? 0);
    return {
      id: `${file}:TS${item.code}:${location.line + 1}:${location.character + 1}`,
      code: `TS${item.code}`,
      severity: 'error' as const,
      stage: 'syntax' as const,
      message: ts.flattenDiagnosticMessageText(item.messageText, '\n'),
      location: { file, line: location.line + 1, column: location.character + 1 },
      evidence: 'CHECKED' as const,
      confidence: 'high' as const,
      explanation: 'Reported by the TypeScript compiler parser; this is a syntax finding, not a heuristic delimiter guess.'
    };
  });
}

function isLikelyEntryPoint(path: string): boolean {
  return /(^|\/)(main|index|app|server|client|entry|bootstrap)\.(?:[cm]?[jt]sx?)$/i.test(path) || /(^|\/)package\.json$/i.test(path);
}

export async function analyzeProject(
  projectName: string,
  source: ProjectSource,
  options: { limits?: Partial<AnalyzerLimits>; adapters?: readonly LanguageDiagnosticAdapter[] } = {}
): Promise<ProjectAnalysis> {
  const limits: AnalyzerLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const rawEntries = await source.listFiles();
  const diagnostics: CodeDiagnostic[] = [];
  const entries: ProjectFileEntry[] = [];
  const seenPaths = new Set<string>();
  for (const entry of rawEntries.slice(0, limits.maxFiles)) {
    const normalized = normalizeProjectPath(entry.path);
    if (!normalized) {
      diagnostics.push(makeProjectDiagnostic(entry.path || '<empty>', 'UNSAFE_PROJECT_PATH', 'Path is absolute, traverses outside the project, or contains unsafe characters.', 'error'));
      continue;
    }
    if (seenPaths.has(normalized)) {
      diagnostics.push(makeProjectDiagnostic(normalized, 'DUPLICATE_NORMALIZED_PATH', 'Multiple project entries resolve to the same normalized path; the duplicate was excluded from analysis.', 'error'));
      continue;
    }
    seenPaths.add(normalized);
    entries.push({ ...entry, path: normalized });
  }
  if (rawEntries.length > limits.maxFiles) diagnostics.push(makeProjectDiagnostic('<project>', 'FILE_LIMIT_REACHED', `Project contains ${rawEntries.length} entries; only the first ${limits.maxFiles} were considered.`));

  const known = new Set(entries.map((entry) => entry.path));
  const hasEcmaScript = entries.some((entry) => /\.(?:[cm]?[jt]sx?)$/i.test(entry.path));
  const ts = hasEcmaScript ? await import('typescript') : null;
  const files: ProjectFileSummary[] = [];
  const external = new Set<string>();
  let scannedBytes = 0;
  let truncated = rawEntries.length > limits.maxFiles;
  let dynamicImportPresent = false;
  let localDependencies = 0;

  for (const entry of entries) {
    const language = detectLanguage(entry.path);
    const shouldRead = entry.kind === 'text' && isTextLikePath(entry.path) && language !== 'unknown';
    if (!shouldRead) {
      files.push({ path: entry.path, language, sizeBytes: entry.sizeBytes, inspected: false, reason: entry.kind === 'binary' ? 'binary asset; metadata only' : 'language not analysed in this first version', imports: [], declarations: [], isLikelyEntryPoint: isLikelyEntryPoint(entry.path) });
      continue;
    }
    if (entry.sizeBytes > limits.maxFileBytes) {
      truncated = true;
      files.push({ path: entry.path, language, sizeBytes: entry.sizeBytes, inspected: false, reason: `file exceeds ${limits.maxFileBytes} byte inspection limit`, imports: [], declarations: [], isLikelyEntryPoint: isLikelyEntryPoint(entry.path) });
      diagnostics.push(makeProjectDiagnostic(entry.path, 'FILE_TOO_LARGE_TO_INSPECT', `File is ${entry.sizeBytes} bytes; this pass inspects at most ${limits.maxFileBytes} bytes per file.`));
      continue;
    }
    if (scannedBytes + entry.sizeBytes > limits.maxTotalReadBytes) {
      truncated = true;
      files.push({ path: entry.path, language, sizeBytes: entry.sizeBytes, inspected: false, reason: 'project inspection byte budget reached', imports: [], declarations: [], isLikelyEntryPoint: isLikelyEntryPoint(entry.path) });
      diagnostics.push(makeProjectDiagnostic(entry.path, 'PROJECT_READ_BUDGET_REACHED', 'The bounded project inspection budget was reached; this file was not loaded.'));
      continue;
    }
    const text = await source.readTextFile(entry.path, limits.maxFileBytes);
    if (text === null) {
      files.push({ path: entry.path, language, sizeBytes: entry.sizeBytes, inspected: false, reason: 'source provider could not read this file', imports: [], declarations: [], isLikelyEntryPoint: isLikelyEntryPoint(entry.path) });
      diagnostics.push(makeProjectDiagnostic(entry.path, 'FILE_READ_FAILED', 'The project source could not provide this file.'));
      continue;
    }
    const actualBytes = new TextEncoder().encode(text).byteLength;
    if (actualBytes > limits.maxFileBytes) {
      truncated = true;
      files.push({ path: entry.path, language, sizeBytes: entry.sizeBytes, inspected: false, reason: 'provider returned more than the requested limit', imports: [], declarations: [], isLikelyEntryPoint: isLikelyEntryPoint(entry.path) });
      diagnostics.push(makeProjectDiagnostic(entry.path, 'SOURCE_LIMIT_VIOLATION', 'The source provider returned more data than the requested per-file limit.', 'error'));
      continue;
    }
    scannedBytes += actualBytes;
    let imports: ImportReference[];
    let declarations: ProjectFileSummary['declarations'];
    if ((language === 'javascript' || language === 'typescript') && ts) {
      const sourceFile = ts.createSourceFile(entry.path, text, ts.ScriptTarget.Latest, true, ecmaScriptKind(ts, entry.path));
      imports = extractCompilerImports(ts, entry.path, sourceFile);
      declarations = collectCompilerDeclarations(ts, sourceFile);
      diagnostics.push(...compilerSyntaxDiagnostics(ts, entry.path, sourceFile));
    } else {
      imports = extractImports(entry.path, text);
      declarations = collectDeclarations(text);
      diagnostics.push(...await analyzeSourceFile(entry.path, text, language, options.adapters ?? []));
    }
    for (const ref of imports) {
      if (ref.kind === 'dynamic-nonliteral') { dynamicImportPresent = true; continue; }
      if (ref.specifier.startsWith('.')) {
        const resolved = resolveLocalImport(entry.path, ref.specifier, known);
        if (resolved) { ref.resolved = true; ref.resolvedFile = resolved; localDependencies += 1; }
        else diagnostics.push(makeProjectDiagnostic(entry.path, 'LOCAL_IMPORT_NOT_RESOLVED', `Cannot resolve local import '${ref.specifier}' using TypeScript/JavaScript extension rules.`, 'warning'));
      } else if (ref.specifier !== '*dynamic*' && !/^(?:node:|bun:|deno:)/.test(ref.specifier)) {
        const packageName = ref.specifier.startsWith('@') ? ref.specifier.split('/').slice(0, 2).join('/') : ref.specifier.split('/')[0];
        external.add(packageName ?? ref.specifier);
      }
    }
    files.push({ path: entry.path, language, sizeBytes: entry.sizeBytes, inspected: true, imports, declarations, isLikelyEntryPoint: isLikelyEntryPoint(entry.path) });
  }

  const languages: ProjectAnalysis['outline']['languages'] = {};
  for (const file of files) languages[file.language] = (languages[file.language] ?? 0) + 1;
  const inspectedFiles = files.filter((file) => file.inspected).length;
  const skippedFiles = files.length - inspectedFiles;
  return {
    projectName,
    files,
    diagnostics,
    scannedBytes,
    truncated,
    outline: {
      files: files.length,
      inspectedFiles,
      skippedFiles,
      languages,
      entryPoints: files.filter((file) => file.isLikelyEntryPoint).map((file) => file.path),
      declarations: files.reduce((sum, file) => sum + file.declarations.length, 0),
      localDependencies,
      externalDependencies: [...external].sort(),
      dynamicImportPresent,
      dependencyGraphComplete: !dynamicImportPresent && !truncated && !diagnostics.some((item) => item.code === 'LOCAL_IMPORT_NOT_RESOLVED' || item.code === 'FILE_READ_FAILED')
    }
  };
}
