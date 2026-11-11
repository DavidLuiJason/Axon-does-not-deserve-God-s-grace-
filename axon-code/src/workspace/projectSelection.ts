import type { WorkspaceFileStore } from './workingCopy.js';
import { isPortableProjectPath, normalizeProjectPath } from '../pathSafety.js';

export type ProjectSelectionMode = 'ALL' | 'EXPLICIT' | 'AUTO';
export type AutoSelectionPreset = 'SOURCE_AND_CONFIG' | 'ALL_TEXT';

export interface ProjectSelectionPolicy {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  caseInsensitiveCollisionCheck: boolean;
}

export const DEFAULT_PROJECT_SELECTION_POLICY: Readonly<ProjectSelectionPolicy> = Object.freeze({
  maxFiles: 10_000,
  maxFileBytes: 16 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
  caseInsensitiveCollisionCheck: true
});

export interface ProjectSelectionRequest {
  workspaceId: string;
  mode: ProjectSelectionMode;
  paths?: readonly string[];
  preset?: AutoSelectionPreset;
  includeExtensions?: readonly string[];
  excludePaths?: readonly string[];
  includeTests?: boolean;
  includeSensitiveFiles?: boolean;
}

export interface ProjectSelection {
  id: string;
  workspaceId: string;
  mode: ProjectSelectionMode;
  paths: string[];
  fileCount: number;
  totalBytes: number;
  fingerprint: string;
  createdAt: number;
  sensitiveFiles: string[];
  warnings: string[];
}

export interface CapturedProjectFile { path: string; content: string; sizeBytes: number; }

const DEFAULT_SOURCE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.json', '.jsonc', '.css', '.scss', '.html', '.htm',
  '.xml', '.svg', '.md', '.txt', '.yaml', '.yml', '.toml', '.py', '.c', '.h', '.cc', '.cpp', '.cxx', '.hpp', '.hxx',
  '.rs', '.java', '.kt', '.kts', '.swift', '.go', '.cs', '.sh', '.bash', '.gradle', '.properties', '.cmake', '.mk'
]);
const DEFAULT_EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.nuxt', '.output', 'target', '.gradle', '.idea', 'vendor', 'pods', '.expo']);
const SENSITIVE_PATTERNS = [
  /(?:^|\/)\.env(?:\..+)?$/i,
  /(?:^|\/)(?:id_rsa|id_ed25519|known_hosts|credentials?\.json|secrets?\.json|\.npmrc|\.pypirc|\.netrc|\.git-credentials|\.dockerconfigjson)$/i,
  /(?:^|\/)\.aws\/(?:credentials|config)$/i,
  /(?:^|\/)\.ssh\/(?:id_[^/]+|config)$/i,
  /\.(?:pem|key|p12|pfx|keystore|secret|token)$/i,
  /(?:^|\/)(?:service-account|firebase-adminsdk)[^/]*\.json$/i
];
const AUTO_SECRET_ALLOW = /^\.env\.example$/i;

function extensionOf(path: string): string {
  const name = path.split('/').pop() ?? path;
  const index = name.lastIndexOf('.');
  return index <= 0 ? '' : name.slice(index).toLowerCase();
}
function isTestPath(path: string): boolean { return /(^|\/)(?:tests?|__tests__|fixtures?)(?:\/|$)|\.(?:test|spec)\.[^.]+$/i.test(path); }
function isGeneratedPath(path: string): boolean { return path.split('/').some((segment) => DEFAULT_EXCLUDED_DIRS.has(segment.toLowerCase())); }
function isSensitivePath(path: string): boolean { return !AUTO_SECRET_ALLOW.test(path.split('/').pop() ?? path) && SENSITIVE_PATTERNS.some((pattern) => pattern.test(path)); }
function makeId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID) return randomUUID.call(globalThis.crypto);
  return `sel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function digestFiles(files: readonly CapturedProjectFile[], workspaceId: string): Promise<string> {
  const encoder = new TextEncoder();
  const workspace = encoder.encode(workspaceId);
  const encoded = files.map((file) => ({ path: encoder.encode(file.path), content: encoder.encode(file.content) }));
  const total = 4 + workspace.byteLength + encoded.reduce((sum, item) => sum + 8 + item.path.byteLength + item.content.byteLength, 0);
  if (!Number.isSafeInteger(total)) throw new Error('Selection fingerprint input exceeds safe size limits.');
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  view.setUint32(offset, workspace.byteLength, true); offset += 4;
  bytes.set(workspace, offset); offset += workspace.byteLength;
  for (const item of encoded) {
    view.setUint32(offset, item.path.byteLength, true); offset += 4;
    bytes.set(item.path, offset); offset += item.path.byteLength;
    view.setUint32(offset, item.content.byteLength, true); offset += 4;
    bytes.set(item.content, offset); offset += item.content.byteLength;
  }
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 is unavailable; refusing an unbound selection snapshot.');
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

/** Deterministic project file selection. It never mutates the workspace. */
export class ProjectSelectionManager {
  private current: ProjectSelection | null = null;
  private readonly policy: ProjectSelectionPolicy;
  constructor(private readonly source: WorkspaceFileStore, policy: Partial<ProjectSelectionPolicy> = {}, private readonly now: () => number = Date.now) {
    this.policy = { ...DEFAULT_PROJECT_SELECTION_POLICY, ...policy };
    if (!Number.isSafeInteger(this.policy.maxFiles) || this.policy.maxFiles < 1 ||
        !Number.isSafeInteger(this.policy.maxFileBytes) || this.policy.maxFileBytes < 1 ||
        !Number.isSafeInteger(this.policy.maxTotalBytes) || this.policy.maxTotalBytes < 1) throw new Error('Invalid project-selection limits.');
  }

  getCurrent(): ProjectSelection | null { return this.current ? structuredClone(this.current) : null; }
  clearSelection(): void { this.current = null; }

  async select(request: ProjectSelectionRequest): Promise<ProjectSelection> {
    if (!request.workspaceId.trim() || request.workspaceId.length > 200 || /[\u0000-\u001f\u007f]/.test(request.workspaceId)) throw new Error('Workspace ID must be non-empty, bounded and free of control characters.');
    const available = await this.source.list(request.workspaceId);
    if (available.length > this.policy.maxFiles) throw new Error(`Workspace has ${available.length} files; selection limit is ${this.policy.maxFiles}.`);
    const canonical = new Map<string, string>();
    const folded = new Map<string, string>();
    for (const path of available) {
      const normalized = normalizeProjectPath(path);
      if (!normalized || normalized !== path || !isPortableProjectPath(path)) throw new Error(`Workspace contains a non-canonical, non-portable or unsafe path: ${path}`);
      const key = normalized.toLocaleLowerCase('en-US');
      if (canonical.has(normalized)) throw new Error(`Workspace contains a duplicate path: ${normalized}`);
      if (this.policy.caseInsensitiveCollisionCheck && folded.has(key) && folded.get(key) !== normalized) throw new Error(`Workspace contains a case-insensitive path collision: '${folded.get(key)}' and '${normalized}'.`);
      canonical.set(normalized, normalized);
      folded.set(key, normalized);
    }

    const excluded = new Set((request.excludePaths ?? []).map((path) => {
      const normalized = normalizeProjectPath(path);
      if (!normalized) throw new Error(`Unsafe exclusion path '${path}'.`);
      return normalized;
    }));
    let paths: string[];
    if (request.mode === 'ALL') {
      paths = [...canonical.keys()];
    } else if (request.mode === 'EXPLICIT') {
      if (!request.paths?.length) throw new Error('Explicit selection requires at least one file path.');
      const seen = new Set<string>();
      paths = [];
      for (const rawPath of request.paths) {
        const path = normalizeProjectPath(rawPath);
        if (!path || path !== rawPath || !isPortableProjectPath(path)) throw new Error(`Explicit selection contains an unsafe or non-portable path: ${rawPath}`);
        if (seen.has(path)) throw new Error(`Explicit selection contains a duplicate path: ${path}`);
        if (!canonical.has(path)) throw new Error(`Selected file '${path}' does not exist.`);
        seen.add(path); paths.push(path);
      }
    } else if (request.mode === 'AUTO') {
      const extensions = request.preset === 'ALL_TEXT' ? null : new Set((request.includeExtensions ?? [...DEFAULT_SOURCE_EXTENSIONS]).map((ext) => ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`));
      paths = [...canonical.keys()].filter((path) => {
        if (excluded.has(path) || isGeneratedPath(path)) return false;
        if (!request.includeTests && isTestPath(path)) return false;
        const sensitive = isSensitivePath(path);
        if (sensitive) return request.includeSensitiveFiles === true;
        return extensions === null || extensions.has(extensionOf(path));
      });
    } else {
      throw new Error('Unknown project selection mode.');
    }
    paths = paths.filter((path) => !excluded.has(path)).sort((a, b) => a.localeCompare(b));
    if (!paths.length) throw new Error('Selection contains no files.');
    if (paths.length > this.policy.maxFiles) throw new Error(`Selection exceeds the ${this.policy.maxFiles}-file limit.`);

    const files: CapturedProjectFile[] = [];
    let totalBytes = 0;
    for (const path of paths) {
      const content = await this.source.read(request.workspaceId, path);
      if (content === null) throw new Error(`Selected file '${path}' disappeared during selection.`);
      const sizeBytes = new TextEncoder().encode(content).byteLength;
      if (sizeBytes > this.policy.maxFileBytes) throw new Error(`File '${path}' exceeds the ${this.policy.maxFileBytes}-byte selection limit.`);
      totalBytes += sizeBytes;
      if (!Number.isSafeInteger(totalBytes) || totalBytes > this.policy.maxTotalBytes) throw new Error(`Selection exceeds the ${this.policy.maxTotalBytes}-byte total limit.`);
      files.push({ path, content, sizeBytes });
    }
    const sensitiveFiles = paths.filter(isSensitivePath);
    const warnings = sensitiveFiles.map((path) => `Sensitive-looking file selected: ${path}. Review it before copying, sharing or exporting.`);
    const result: ProjectSelection = {
      id: makeId(), workspaceId: request.workspaceId, mode: request.mode, paths,
      fileCount: paths.length, totalBytes, fingerprint: await digestFiles(files, request.workspaceId), createdAt: this.now(), sensitiveFiles, warnings
    };
    this.current = structuredClone(result);
    return result;
  }

  async capture(selection: ProjectSelection): Promise<CapturedProjectFile[]> {
    if (!selection.workspaceId || !Array.isArray(selection.paths) || selection.paths.length === 0 || selection.paths.length > this.policy.maxFiles) throw new Error('Selection record is invalid.');
    const files: CapturedProjectFile[] = [];
    let totalBytes = 0;
    for (const path of selection.paths) {
      const normalized = normalizeProjectPath(path);
      if (!normalized || normalized !== path || !isPortableProjectPath(path)) throw new Error(`Selection contains unsafe path '${path}'.`);
      const content = await this.source.read(selection.workspaceId, path);
      if (content === null) throw new Error(`Selected file '${path}' no longer exists.`);
      const sizeBytes = new TextEncoder().encode(content).byteLength;
      if (sizeBytes > this.policy.maxFileBytes) throw new Error(`Selected file '${path}' now exceeds its size limit.`);
      totalBytes += sizeBytes;
      if (!Number.isSafeInteger(totalBytes) || totalBytes > this.policy.maxTotalBytes) throw new Error('Selected project now exceeds its total size limit.');
      files.push({ path, content, sizeBytes });
    }
    const fingerprint = await digestFiles(files, selection.workspaceId);
    if (fingerprint !== selection.fingerprint || totalBytes !== selection.totalBytes || files.length !== selection.fileCount) throw new Error('Project changed after selection; refresh the selection before continuing.');
    return files;
  }
}

/** UI-neutral selection state helper. Clearing it never deletes workspace files. */
export class ProjectSelectionController {
  private selected = new Set<string>();
  set(paths: readonly string[]): void {
    const next = new Set<string>();
    for (const path of paths) {
      const normalized = normalizeProjectPath(path);
      if (!normalized || normalized !== path) throw new Error(`Unsafe selection path '${path}'.`);
      next.add(path);
    }
    this.selected = next;
  }
  toggle(path: string): void {
    const normalized = normalizeProjectPath(path);
    if (!normalized || normalized !== path) throw new Error(`Unsafe selection path '${path}'.`);
    if (this.selected.has(path)) this.selected.delete(path); else this.selected.add(path);
  }
  selectAll(paths: readonly string[]): void { this.set(paths); }
  clear(): void { this.selected.clear(); }
  list(): string[] { return [...this.selected].sort((a, b) => a.localeCompare(b)); }
}

export function isSensitiveProjectPath(path: string): boolean { return isSensitivePath(path); }
