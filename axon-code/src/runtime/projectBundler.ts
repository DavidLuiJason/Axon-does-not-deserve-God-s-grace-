import { joinProjectPath, normalizeProjectPath } from '../pathSafety.js';
import { combineSourceMaps, type RawSourceMap } from './sourceMaps.js';

export interface ProjectSourceProvider {
  listFiles(projectId: string): Promise<readonly string[]>;
  readText(projectId: string, path: string): Promise<string | null>;
}

export interface BundleDiagnostic {
  code: string;
  message: string;
  file: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
}

export interface BundledProject {
  entryFile: string;
  source: string;
  includedFiles: string[];
  diagnostics: BundleDiagnostic[];
  externalPackages: string[];
  complete: boolean;
  sourceMap?: RawSourceMap;
}

export interface ProjectBundlePolicy {
  maxFiles: number;
  maxTotalSourceBytes: number;
  maxSingleFileBytes: number;
  allowedExtensions: readonly string[];
  jsxFactory: string;
  maxPackageDepth: number;
}

const DEFAULT_POLICY: ProjectBundlePolicy = {
  maxFiles: 2_000,
  maxTotalSourceBytes: 8 * 1024 * 1024,
  maxSingleFileBytes: 2 * 1024 * 1024,
  allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
  jsxFactory: 'React.createElement',
  maxPackageDepth: 32
};

interface PackageJson {
  main?: unknown;
  module?: unknown;
  browser?: unknown;
  exports?: unknown;
}

interface ResolvedModule {
  path: string;
  source: string;
}

function extensionOf(path: string): string {
  const index = path.lastIndexOf('.');
  return index < 0 ? '' : path.slice(index).toLowerCase();
}

function chooseCondition(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = chooseCondition(item);
      if (resolved) return resolved;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const condition of ['browser', 'import', 'default', 'require']) {
    if (condition in record) {
      const resolved = chooseCondition(record[condition]);
      if (resolved) return resolved;
    }
  }
  return null;
}

export class MultiFileProjectBundler {
  private readonly policy: ProjectBundlePolicy;

  constructor(private readonly files: ProjectSourceProvider, policy: Partial<ProjectBundlePolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
    if (!Number.isSafeInteger(this.policy.maxFiles) || this.policy.maxFiles < 1 ||
        !Number.isSafeInteger(this.policy.maxTotalSourceBytes) || this.policy.maxTotalSourceBytes < 1 ||
        !Number.isSafeInteger(this.policy.maxSingleFileBytes) || this.policy.maxSingleFileBytes < 1 ||
        !Number.isSafeInteger(this.policy.maxPackageDepth) || this.policy.maxPackageDepth < 1) {
      throw new Error('Invalid project bundle limits.');
    }
  }

  async bundle(projectId: string, entryFile: string): Promise<BundledProject> {
    // Load the multi-megabyte compiler only when TS/JSX bundling is actually requested.
    const ts = await import('typescript');
    const normalizedEntry = normalizeProjectPath(entryFile);
    if (!normalizedEntry || normalizedEntry !== entryFile) throw new Error('Entry file path is not canonical.');
    const allPaths = await this.files.listFiles(projectId);
    if (allPaths.length > this.policy.maxFiles) throw new Error(`Project exceeds the ${this.policy.maxFiles}-file bundle limit.`);
    const canonical = new Set<string>();
    for (const path of allPaths) {
      const normalized = normalizeProjectPath(path);
      if (!normalized || normalized !== path || canonical.has(path)) throw new Error(`Project contains an unsafe or duplicate path: ${path}`);
      canonical.add(path);
    }
    if (!canonical.has(entryFile)) throw new Error(`Entry file '${entryFile}' does not exist in the project.`);

    const sourceCache = new Map<string, string>();
    let totalBytes = 0;
    const diagnostics: BundleDiagnostic[] = [];
    const packageCache = new Map<string, PackageJson | null>();
    const modules = new Map<string, { output: string; sourceMapText: string; originalSource: string; imports: Map<string, string> }>();
    const pending = [entryFile];
    const externalPackages = new Set<string>();

    const readText = async (path: string): Promise<string> => {
      if (sourceCache.has(path)) return sourceCache.get(path)!;
      const source = await this.files.readText(projectId, path);
      if (source === null) throw new Error(`Project file '${path}' is missing.`);
      const byteLength = new TextEncoder().encode(source).byteLength;
      if (byteLength > this.policy.maxSingleFileBytes) throw new Error(`Project file '${path}' exceeds its per-file bundle limit.`);
      totalBytes += byteLength;
      if (totalBytes > this.policy.maxTotalSourceBytes) throw new Error(`Project exceeds the ${this.policy.maxTotalSourceBytes}-byte bundle limit.`);
      sourceCache.set(path, source);
      return source;
    };

    const resolveAsFile = async (basePath: string, depth = 0, visited = new Set<string>()): Promise<ResolvedModule | null> => {
      if (depth > this.policy.maxPackageDepth || visited.has(basePath)) return null;
      const nextVisited = new Set(visited); nextVisited.add(basePath);
      const requestedExtension = extensionOf(basePath);
      const substitutions: Record<string, string[]> = { '.js': ['.ts', '.tsx', '.js'], '.jsx': ['.tsx', '.jsx'], '.mjs': ['.mts', '.mjs'], '.cjs': ['.cts', '.cjs'] };
      const candidates = [basePath];
      if (substitutions[requestedExtension]) {
        const stem = basePath.slice(0, -requestedExtension.length);
        candidates.push(...substitutions[requestedExtension]!.map((extension) => `${stem}${extension}`));
      } else {
        candidates.push(...this.policy.allowedExtensions.map((extension) => `${basePath}${extension}`));
      }
      for (const candidate of candidates) {
        const normalized = normalizeProjectPath(candidate);
        if (!normalized || !canonical.has(normalized)) continue;
        if (extensionOf(normalized) === '.json') return { path: normalized, source: await readText(normalized) };
        if (this.policy.allowedExtensions.includes(extensionOf(normalized))) return { path: normalized, source: await readText(normalized) };
      }
      const packagePath = `${basePath.replace(/\/$/, '')}/package.json`;
      if (canonical.has(packagePath)) {
        const pkg = await getPackage(packagePath);
        const main = chooseCondition(pkg.exports) ?? (typeof pkg.browser === 'string' ? pkg.browser : undefined) ??
          (typeof pkg.module === 'string' ? pkg.module : undefined) ?? (typeof pkg.main === 'string' ? pkg.main : undefined) ?? 'index.js';
        const mainPath = normalizeProjectPath(`${basePath}/${main}`);
        if (mainPath) return resolveAsFile(mainPath, depth + 1, nextVisited);
      }
      const indexPath = `${basePath.replace(/\/$/, '')}/index`;
      for (const extension of this.policy.allowedExtensions) {
        const candidate = `${indexPath}${extension}`;
        if (canonical.has(candidate)) return { path: candidate, source: await readText(candidate) };
      }
      return null;
    };

    const getPackage = async (packageJsonPath: string): Promise<PackageJson> => {
      if (packageCache.has(packageJsonPath)) return packageCache.get(packageJsonPath) ?? {};
      const text = await readText(packageJsonPath);
      try {
        const parsed = JSON.parse(text) as PackageJson;
        packageCache.set(packageJsonPath, parsed);
        return parsed;
      } catch {
        diagnostics.push({ code: 'INVALID_PACKAGE_JSON', message: `Package metadata '${packageJsonPath}' is not valid JSON.`, file: packageJsonPath, severity: 'error' });
        packageCache.set(packageJsonPath, null);
        return {};
      }
    };

    const resolveSpecifier = async (fromFile: string, specifier: string): Promise<ResolvedModule | null> => {
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        if (specifier.startsWith('/')) return null;
        const joined = joinProjectPath(fromFile, specifier);
        return joined ? resolveAsFile(joined) : null;
      }
      if (specifier.startsWith('node:') || specifier.startsWith('#')) return null;
      const parts = specifier.split('/');
      const packageName = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!;
      const subpath = parts.slice(packageName.startsWith('@') ? 2 : 1).join('/');
      const fromParts = fromFile.split('/').slice(0, -1);
      const searchDirs: string[] = [];
      for (let index = fromParts.length; index >= 0; index--) {
        searchDirs.push([...fromParts.slice(0, index), 'node_modules', packageName].join('/'));
      }
      for (const packageRoot of searchDirs) {
        const safeRoot = normalizeProjectPath(packageRoot);
        if (!safeRoot) continue;
        const pkgPath = `${safeRoot}/package.json`;
        let target: string | null = null;
        if (canonical.has(pkgPath)) {
          const pkg = await getPackage(pkgPath);
          if (pkg.exports !== undefined) {
            const exportKey = subpath ? `./${subpath}` : '.';
            const exportsRecord = pkg.exports as Record<string, unknown>;
            const exportValue = typeof pkg.exports === 'string' ? (subpath ? undefined : pkg.exports) :
              (exportsRecord && typeof exportsRecord === 'object' && exportKey in exportsRecord ? exportsRecord[exportKey] : undefined);
            target = chooseCondition(exportValue);
          } else {
            target = subpath || (typeof pkg.browser === 'string' ? pkg.browser : undefined) ||
              (typeof pkg.module === 'string' ? pkg.module : undefined) ||
              (typeof pkg.main === 'string' ? pkg.main : undefined) || 'index.js';
          }
        } else if (subpath) {
          target = subpath;
        } else {
          target = 'index.js';
        }
        if (!target) continue;
        const resolved = normalizeProjectPath(`${safeRoot}/${target}`);
        if (!resolved) continue;
        const result = await resolveAsFile(resolved);
        if (result) return result;
      }
      externalPackages.add(packageName);
      return null;
    };

    let scanned = 0;
    while (pending.length) {
      const path = pending.shift()!;
      if (modules.has(path)) continue;
      if (++scanned > this.policy.maxFiles) throw new Error('Bundle dependency traversal exceeded its file limit.');
      const source = await readText(path);
      if (extensionOf(path) === '.json') {
        modules.set(path, { output: `module.exports = JSON.parse(${JSON.stringify(source)});`, sourceMapText: JSON.stringify({ version: 3, sources: [path], names: [], mappings: 'AAAA' }), originalSource: source, imports: new Map() });
        continue;
      }
      const scriptKind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : path.endsWith('.jsx') ? ts.ScriptKind.JSX :
        path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS;
      const compiled = ts.transpileModule(source, {
        fileName: path,
        reportDiagnostics: true,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.React,
          jsxFactory: this.policy.jsxFactory,
          jsxFragmentFactory: 'React.Fragment',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
          sourceMap: true, inlineSources: true
        }
      });
      for (const item of compiled.diagnostics ?? []) {
        const loc = item.file && item.start !== undefined ? item.file.getLineAndCharacterOfPosition(item.start) : undefined;
        diagnostics.push({ code: `TS${item.code}`, message: ts.flattenDiagnosticMessageText(item.messageText, '\n'), file: path,
          ...(loc ? { line: loc.line + 1, column: loc.character + 1 } : {}), severity: item.category === ts.DiagnosticCategory.Error ? 'error' : 'warning' });
      }
      const outputWithoutMap = compiled.outputText.replace(/\r\n/g, '\n').replace(/\n?\/\/# sourceMappingURL=.*?(?:\n|$)/g, '\n');
      const emittedFile = ts.createSourceFile(`${path}.js`, outputWithoutMap, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
      const imports = new Map<string, string>();
      const importSpecs: string[] = [];
      const visit = (node: import('typescript').Node): void => {
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.Identifier && (node.expression as import('typescript').Identifier).text === 'require') {
          if (node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]!)) importSpecs.push(node.arguments[0]!.text);
          else diagnostics.push({ code: 'DYNAMIC_MODULE_SPECIFIER_UNRESOLVED', message: 'A dynamic or non-literal module request prevents a complete dependency bundle.', file: path,
            ...(() => { const location = emittedFile.getLineAndCharacterOfPosition(node.getStart(emittedFile)); return { line: location.line + 1, column: location.character + 1 }; })(), severity: 'error' });
        }
        ts.forEachChild(node, visit);
      };
      visit(emittedFile);
      for (const specifier of [...new Set(importSpecs)]) {
        const resolved = await resolveSpecifier(path, specifier);
        if (!resolved) {
          diagnostics.push({ code: 'PROJECT_MODULE_NOT_RESOLVED', message: `Module '${specifier}' imported by '${path}' is not present in the project workspace. Network package installation is disabled.`, file: path, severity: 'error' });
          continue;
        }
        imports.set(specifier, resolved.path);
        if (!modules.has(resolved.path)) pending.push(resolved.path);
      }
      if (!compiled.sourceMapText) { diagnostics.push({ code: 'SOURCE_MAP_GENERATION_FAILED', message: 'The compiler did not provide a source map for the transformed module.', file: path, severity: 'error' }); }
      modules.set(path, { output: outputWithoutMap, sourceMapText: compiled.sourceMapText ?? '', originalSource: source, imports });
    }

    if (diagnostics.some((item) => item.severity === 'error')) {
      return { entryFile, source: '', includedFiles: [...modules.keys()].sort(), diagnostics, externalPackages: [...externalPackages].sort(), complete: false };
    }

    const sourceParts: string[] = ['const __axonFactories = {'];
    const mapInputs: Array<{ sourcePath: string; sourceContent: string; sourceMapText: string; generatedLineOffset: number }> = [];
    let currentLineIndex = 1; // zero-based line index after the opening header line
    let moduleIndex = 0;
    for (const [path, module] of modules) {
      if (moduleIndex > 0) { sourceParts.push(','); currentLineIndex += 1; }
      sourceParts.push(`${JSON.stringify(path)}: async function(module, exports, require) {`);
      currentLineIndex += 1;
      mapInputs.push({ sourcePath: path, sourceContent: module.originalSource, sourceMapText: module.sourceMapText, generatedLineOffset: currentLineIndex });
      const codeLines = module.output.split('\n');
      sourceParts.push(module.output);
      currentLineIndex += codeLines.length;
      sourceParts.push('}');
      currentLineIndex += 1;
      moduleIndex += 1;
    }
    sourceParts.push('};');
    sourceParts.push('const __axonMaps = ' + JSON.stringify(Object.fromEntries([...modules].map(([path, module]) => [path, Object.fromEntries(module.imports)]))) + ';');
    sourceParts.push('const __axonCache = Object.create(null);');
    sourceParts.push('async function __axonLoad(id) {');
    sourceParts.push('  const prior = __axonCache[id];');
    sourceParts.push('  if (prior) return prior.state === "LOADING" ? Promise.resolve(prior.module.exports) : prior.promise;');
    sourceParts.push('  const factory = __axonFactories[id]; if (typeof factory !== "function") throw new Error("Missing bundled module: " + id);');
    sourceParts.push('  const module = { exports: {} };');
    sourceParts.push('  const record = { module, state: "LOADING", promise: null }; __axonCache[id] = record;');
    sourceParts.push('  const localRequire = (specifier) => { const target = __axonMaps[id] && __axonMaps[id][specifier]; if (!target || !__axonCache[target]) throw new Error("Blocked or unresolved module: " + specifier + " from " + id); return __axonCache[target].module.exports; };');
    sourceParts.push('  record.promise = (async () => {');
    sourceParts.push('    const dependencies = Object.values(__axonMaps[id] || {});');
    sourceParts.push('    for (const dependency of dependencies) await __axonLoad(dependency);');
    sourceParts.push('    await factory(module, module.exports, localRequire);');
    sourceParts.push('    record.state = "LOADED"; return module.exports;');
    sourceParts.push('  })();');
    sourceParts.push('  try { return await record.promise; } catch (error) { record.state = "FAILED"; throw error; }');
    sourceParts.push('}');
    sourceParts.push(`const __axonEntry = await __axonLoad(${JSON.stringify(entryFile)});`);
    sourceParts.push('if (__axonEntry !== undefined) console.log("AXON_ENTRY", __axonEntry && Object.prototype.hasOwnProperty.call(__axonEntry, "default") ? __axonEntry.default : __axonEntry);');
    const source = sourceParts.join('\n');
    let sourceMap: RawSourceMap | undefined;
    try { sourceMap = combineSourceMaps(mapInputs, 'axon-bundle.js'); }
    catch (error) { diagnostics.push({ code: 'SOURCE_MAP_COMPOSITION_FAILED', message: String(error), file: entryFile, severity: 'error' }); }
    if (diagnostics.some((item) => item.severity === 'error')) return { entryFile, source: '', includedFiles: [...modules.keys()].sort(), diagnostics, externalPackages: [...externalPackages].sort(), complete: false };
    return { entryFile, source, includedFiles: [...modules.keys()].sort(), diagnostics, externalPackages: [...externalPackages].sort(), complete: true, ...(sourceMap ? { sourceMap } : {}) };
  }
}

export interface TypeCheckResult {
  diagnostics: Array<{ code: string; message: string; file?: string; line?: number; column?: number; severity: 'error' | 'warning' }>;
  checkedFiles: number;
  success: boolean;
}

/** Type-checks in-memory project sources with the TypeScript compiler; package resolution stays workspace-local. */
export async function typeCheckTypeScriptProject(files: ProjectSourceProvider, projectId: string, limits: { maxFiles?: number; maxTotalSourceBytes?: number; maxSingleFileBytes?: number } = {}): Promise<TypeCheckResult> {
  // Semantic type-checking is an optional compiler operation, not part of core startup.
  const ts = await import('typescript');
  const maxFiles = limits.maxFiles ?? 2_000;
  const maxTotalSourceBytes = limits.maxTotalSourceBytes ?? 8 * 1024 * 1024;
  const maxSingleFileBytes = limits.maxSingleFileBytes ?? 2 * 1024 * 1024;
  if (![maxFiles, maxTotalSourceBytes, maxSingleFileBytes].every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error('Type-check limits must be positive safe integers.');
  const paths = await files.listFiles(projectId);
  const sourcePaths = paths.filter((path) => /\.(?:ts|tsx|js|jsx)$/i.test(path) && !/\.d\.ts$/i.test(path));
  if (sourcePaths.length > maxFiles) throw new Error(`Type-check input exceeds ${maxFiles} source files.`);
  const virtualRoot = '/axon-virtual-project';
  const virtual = new Map<string, string>();
  let totalBytes = 0;
  const canonicalPaths = new Set<string>();
  for (const path of sourcePaths) {
    const normalized = normalizeProjectPath(path);
    if (!normalized || normalized !== path || canonicalPaths.has(path)) throw new Error(`Unsafe or duplicate project source path: ${path}`);
    canonicalPaths.add(path);
    const source = await files.readText(projectId, path);
    if (source === null) throw new Error(`Project source '${path}' disappeared during type-check.`);
    const byteLength = new TextEncoder().encode(source).byteLength;
    if (byteLength > maxSingleFileBytes) throw new Error(`Project source '${path}' exceeds the per-file type-check limit.`);
    totalBytes += byteLength;
    if (totalBytes > maxTotalSourceBytes) throw new Error(`Project exceeds the total type-check source limit.`);
    virtual.set(`${virtualRoot}/${path}`, source);
  }
  const options: import('typescript').CompilerOptions = {
    noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.React, allowJs: true, checkJs: false, types: []
  };
  const host = ts.createCompilerHost(options, true);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const originalDirectoryExists = host.directoryExists?.bind(host);
  const originalGetDirectories = host.getDirectories?.bind(host) ?? (() => [] as string[]);
  const virtualDirectories = new Set<string>([virtualRoot, `${virtualRoot}/node_modules`, `${virtualRoot}/node_modules/typescript`]);
  // The TypeScript compiler is a trusted AXON Code toolchain dependency, not a
  // project dependency. Expose only that exact compiler package to the
  // virtual project so self-hosting checks can type-check imports from
  // 'typescript' without allowing arbitrary host node_modules resolution.
  const executingFile = ts.sys.getExecutingFilePath().replace(/\\/g, '/');
  const compilerPackageRoot = executingFile.replace(/\/lib\/typescript\.js$/i, '');
  const virtualCompilerRoot = `${virtualRoot}/node_modules/typescript`;
  const mapTrustedCompilerPath = (fileName: string): string | null => {
    const normalized = fileName.replace(/\\/g, '/');
    if (normalized === virtualCompilerRoot) return compilerPackageRoot;
    if (normalized.startsWith(`${virtualCompilerRoot}/`)) return `${compilerPackageRoot}${normalized.slice(virtualCompilerRoot.length)}`;
    return null;
  };
  for (const fileName of virtual.keys()) {
    let directory = fileName.slice(0, fileName.lastIndexOf('/'));
    while (directory.startsWith(`${virtualRoot}/`)) {
      virtualDirectories.add(directory);
      const parent = directory.slice(0, directory.lastIndexOf('/'));
      if (parent === directory) break;
      directory = parent;
    }
  }
  const normalizeVirtualDirectory = (path: string): string => path.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
  host.fileExists = (fileName) => {
    if (fileName.startsWith(`${virtualRoot}/`)) {
      if (virtual.has(fileName)) return true;
      const trustedPath = mapTrustedCompilerPath(fileName);
      return trustedPath !== null && ts.sys.fileExists(trustedPath);
    }
    return originalFileExists(fileName);
  };
  host.readFile = (fileName) => {
    if (fileName.startsWith(`${virtualRoot}/`)) {
      if (virtual.has(fileName)) return virtual.get(fileName);
      const trustedPath = mapTrustedCompilerPath(fileName);
      return trustedPath === null ? undefined : ts.sys.readFile(trustedPath);
    }
    return originalReadFile(fileName);
  };
  host.directoryExists = (directoryName) => {
    const normalized = normalizeVirtualDirectory(directoryName);
    if (virtualDirectories.has(normalized)) return true;
    const trustedPath = mapTrustedCompilerPath(normalized);
    if (trustedPath !== null) return Boolean(ts.sys.directoryExists?.(trustedPath));
    return Boolean(originalDirectoryExists?.(directoryName));
  };
  host.getDirectories = (directoryName) => {
    const normalized = normalizeVirtualDirectory(directoryName);
    const trustedPath = mapTrustedCompilerPath(normalized);
    const trustedChildren = trustedPath !== null ? (ts.sys.getDirectories?.(trustedPath) ?? []) : [];
    const virtualChildren = [...virtualDirectories]
      .filter((candidate) => candidate.startsWith(`${normalized}/`))
      .map((candidate) => candidate.slice(normalized.length + 1).split('/')[0]!)
      .filter(Boolean);
    return [...new Set([...originalGetDirectories(directoryName), ...trustedChildren, ...virtualChildren])].sort();
  };
  host.realpath = (path) => normalizeVirtualDirectory(path);
  host.getCurrentDirectory = () => virtualRoot;
  host.getSourceFile = (fileName, languageVersion, onError) => {
    const text = host.readFile(fileName);
    if (text === undefined) { onError?.(`Cannot read ${fileName}`); return undefined; }
    return ts.createSourceFile(fileName, text, languageVersion, true);
  };
  const rootNames = sourcePaths.map((path) => `${virtualRoot}/${path}`);
  const program = ts.createProgram({ rootNames, options, host });
  const diagnostics = ts.getPreEmitDiagnostics(program).map((item) => {
    const loc = item.file && item.start !== undefined ? item.file.getLineAndCharacterOfPosition(item.start) : undefined;
    const fileName = item.file?.fileName.startsWith(`${virtualRoot}/`) ? item.file.fileName.slice(virtualRoot.length + 1) : item.file?.fileName;
    return { code: `TS${item.code}`, message: ts.flattenDiagnosticMessageText(item.messageText, '\n'),
      ...(fileName ? { file: fileName } : {}), ...(loc ? { line: loc.line + 1, column: loc.character + 1 } : {}),
      severity: item.category === ts.DiagnosticCategory.Error ? 'error' as const : 'warning' as const };
  });
  return { diagnostics, checkedFiles: sourcePaths.length, success: !diagnostics.some((item) => item.severity === 'error') };
}

/** Converts a project root into one self-contained CommonJS-style bundle for the guarded JS Worker. */
export class BundledProjectEntrySourceProvider {
  readonly supportedExtensions = ['.ts', '.tsx', '.jsx', '.js', '.mjs', '.cjs'];
  /** Bundled/transpiled offsets are not original source offsets until a source-map mapper is added. */
  readonly requiresSourceMap = true;
  private readonly bundler: MultiFileProjectBundler;
  constructor(private readonly projects: ProjectSourceProvider, policy: Partial<ProjectBundlePolicy> = {}) {
    this.bundler = new MultiFileProjectBundler(projects, policy);
  }
  async readSingleEntry(request: { projectId: string; entryFiles: string[] }): Promise<{ path: string; source: string; sourceMap?: RawSourceMap } | null> {
    const entry = request.entryFiles[0];
    if (!entry) return null;
    const bundle = await this.bundler.bundle(request.projectId, entry);
    const errors = bundle.diagnostics.filter((item) => item.severity === 'error');
    if (errors.length) throw new Error(errors.map((item) => `${item.file}${item.line ? `:${item.line}:${item.column ?? 1}` : ''}: ${item.code}: ${item.message}`).join('\n'));
    return { path: entry, source: bundle.source, ...(bundle.sourceMap ? { sourceMap: bundle.sourceMap } : {}) };
  }
}
