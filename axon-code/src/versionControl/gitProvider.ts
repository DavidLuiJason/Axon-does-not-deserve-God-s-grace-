export interface GitCommandResult { exitCode: number; stdout: string; stderr: string; }
export interface GitCommandHost {
  isWithinWorkspace(workspaceRoot: string, candidatePath: string): Promise<boolean>;
  fileSize(absolutePath: string): Promise<number | null>;
  runGit(cwd: string, args: readonly string[], policy: { disableHooks: true; credentialsDisabled: true; maxOutputBytes: number }): Promise<GitCommandResult>;
}
export interface GitOperationResult { status: 'OK' | 'CONFLICT' | 'FAILED' | 'BLOCKED'; stdout: string; stderr: string; exitCode: number; }

function safeBranchName(value: string): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.startsWith('-') && !value.startsWith('/') && !value.endsWith('/') && !value.includes('..') && !value.includes('@{') && !/[\s~^:?*\[\\]/.test(value) && !value.endsWith('.lock');
}
function safeRelativePath(value: string): boolean {
  if (typeof value !== 'string' || value.length < 1 || value.length > 1024 || value.startsWith('/') || value.startsWith('\\') || value.includes('\0')) return false;
  const parts = value.replace(/\\/g, '/').split('/');
  return parts.every(part => part.length > 0 && part !== '.' && part !== '..');
}
/**
 * Director fix (Round 14 verification): a project can ship its own .git/config. Git runs programs named in some settings
 * (core.fsmonitor on status, filter drivers on add and commit, ssh and editor commands, submodule update commands, included files),
 * and hooks and credential helpers being disabled does not stop those. So the repository's own configuration is audited before
 * every command and ONLY settings on this allow-list are accepted; anything else blocks the operation.
 */
const SAFE_CORE_SETTINGS: Readonly<Record<string, true>> = Object.freeze({ repositoryformatversion: true, filemode: true, bare: true, logallrefupdates: true, ignorecase: true, precomposeunicode: true, symlinks: true, autocrlf: true, safecrlf: true, eol: true, quotepath: true, longpaths: true, untrackedcache: true, trustctime: true, checkstat: true, abbrev: true, commentchar: true });
const SAFE_PLAIN_SETTINGS: Readonly<Record<string, Readonly<Record<string, true>>>> = Object.freeze({
  user: { name: true, email: true },
  init: { defaultbranch: true },
  status: { showuntrackedfiles: true, branch: true, short: true },
  diff: { renames: true, algorithm: true, context: true, mnemonicprefix: true },
  merge: { ff: true, conflictstyle: true, renormalize: true },
  fetch: { prune: true },
  push: { default: true, followtags: true },
  pull: { rebase: true, ff: true },
  rerere: { enabled: true }
});
const SAFE_SUBSECTION_SETTINGS: Readonly<Record<string, Readonly<Record<string, true>>>> = Object.freeze({
  branch: { remote: true, merge: true, rebase: true, description: true },
  remote: { url: true, fetch: true, pushurl: true, tagopt: true, prune: true }
});
/** Keys of the repository's own configuration that are NOT on the allow-list. */
function unsafeConfigKeys(listing: string): string[] {
  const unsafe: string[] = [];
  for (const entry of listing.split('\0')) {
    if (entry.length === 0) continue;
    const key = entry.split('\n')[0] ?? '';
    const firstDot = key.indexOf('.');
    const lastDot = key.lastIndexOf('.');
    if (firstDot < 1) { unsafe.push(key); continue; }
    const section = key.slice(0, firstDot).toLowerCase();
    const name = key.slice(lastDot + 1).toLowerCase();
    const hasSubsection = lastDot > firstDot;
    const allowed = hasSubsection
      ? SAFE_SUBSECTION_SETTINGS[section]?.[name] === true
      : section === 'core' ? SAFE_CORE_SETTINGS[name] === true
        : section === 'color' || section === 'advice' || section === 'gc' || section === 'pack' ? true
          : SAFE_PLAIN_SETTINGS[section]?.[name] === true;
    if (!allowed) unsafe.push(key);
  }
  return unsafe;
}

function operation(result: GitCommandResult, conflict = false): GitOperationResult {
  if (result.exitCode === 126 && result.stderr.startsWith('BLOCKED:')) return { status: 'BLOCKED', stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
  return { status: result.exitCode === 0 ? 'OK' : conflict ? 'CONFLICT' : 'FAILED', stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
}

/** Local-only Git adapter. All operations are rooted in one approved workspace and run with hooks/credentials disabled. */
export class GitProvider {
  constructor(private readonly host: GitCommandHost, private readonly workspaceRoot: string, private readonly maxFileBytes = 10 * 1024 * 1024, private readonly maxOutputBytes = 2 * 1024 * 1024) {
    if (!workspaceRoot || !Number.isSafeInteger(maxFileBytes) || maxFileBytes < 1 || !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1024) throw new Error('Invalid Git provider configuration.');
  }

  private async run(workspacePath: string, args: readonly string[]): Promise<GitCommandResult> {
    if (workspacePath !== this.workspaceRoot || !(await this.host.isWithinWorkspace(this.workspaceRoot, workspacePath))) throw new Error('Git repository is outside the approved workspace.');
    const policy = { disableHooks: true, credentialsDisabled: true, maxOutputBytes: this.maxOutputBytes } as const;
    const audit = await this.host.runGit(workspacePath, ['config', '--local', '--list', '-z'], policy);
    if (audit.exitCode === 0) {
      const unsafeKeys = unsafeConfigKeys(audit.stdout);
      if (unsafeKeys.length > 0) return { exitCode: 126, stdout: '', stderr: `BLOCKED: this repository's own configuration can make Git run programs (${unsafeKeys.slice(0, 5).join(', ')}). Open it only in a trusted workspace after removing those settings.` };
    }
    return this.host.runGit(workspacePath, args, policy);
  }

  async status(workspacePath = this.workspaceRoot): Promise<GitOperationResult> {
    return operation(await this.run(workspacePath, ['status', '--porcelain=v1', '--branch', '--untracked-files=all']));
  }
  async diff(workspacePath = this.workspaceRoot, staged = false): Promise<GitOperationResult> {
    return operation(await this.run(workspacePath, ['--no-pager', 'diff', ...(staged ? ['--cached'] : []), '--no-ext-diff', '--no-color', '--binary']));
  }
  async log(workspacePath = this.workspaceRoot, limit = 20): Promise<GitOperationResult> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) return { status: 'BLOCKED', stdout: '', stderr: 'Git log limit must be between 1 and 100.', exitCode: 2 };
    return operation(await this.run(workspacePath, ['--no-pager', 'log', `-n${limit}`, '--format=%H%x09%an%x09%ad%x09%s', '--date=iso-strict']));
  }
  async currentBranch(workspacePath = this.workspaceRoot): Promise<GitOperationResult> {
    return operation(await this.run(workspacePath, ['branch', '--show-current']));
  }
  async branches(workspacePath = this.workspaceRoot): Promise<GitOperationResult> {
    return operation(await this.run(workspacePath, ['branch', '--list', '--format=%(refname:short)']));
  }
  async createBranch(workspacePath: string, branchName: string): Promise<GitOperationResult> {
    if (!safeBranchName(branchName)) return { status: 'BLOCKED', stdout: '', stderr: 'Invalid Git branch name.', exitCode: 2 };
    return operation(await this.run(workspacePath, ['branch', '--', branchName]));
  }
  async commit(workspacePath: string, message: string, paths: readonly string[]): Promise<GitOperationResult> {
    if (typeof message !== 'string' || !message.trim() || message.length > 2000 || !Array.isArray(paths) || paths.length < 1 || paths.length > 128 || paths.some(path => !safeRelativePath(path))) return { status: 'BLOCKED', stdout: '', stderr: 'Commit requires a bounded message and explicit safe relative paths.', exitCode: 2 };
    for (const relative of paths) {
      const size = await this.host.fileSize(`${workspacePath}/${relative}`);
      if (size === null) return { status: 'BLOCKED', stdout: '', stderr: `Commit path is missing: ${relative}`, exitCode: 2 };
      if (size > this.maxFileBytes) return { status: 'BLOCKED', stdout: '', stderr: `Commit path exceeds the ${this.maxFileBytes}-byte file limit: ${relative}`, exitCode: 2 };
    }
    const add = await this.run(workspacePath, ['add', '--', ...paths]);
    if (add.exitCode !== 0) return operation(add);
    return operation(await this.run(workspacePath, ['-c', 'core.hooksPath=/dev/null', '-c', 'credential.helper=', 'commit', '-m', message]));
  }
  async checkout(workspacePath: string, branchName: string): Promise<GitOperationResult> {
    if (!safeBranchName(branchName)) return { status: 'BLOCKED', stdout: '', stderr: 'Invalid Git branch name.', exitCode: 2 };
    const dirty = await this.run(workspacePath, ['status', '--porcelain=v1', '--untracked-files=all']);
    if (dirty.exitCode !== 0) return operation(dirty);
    if (dirty.stdout.trim()) return { status: 'BLOCKED', stdout: dirty.stdout, stderr: 'Checkout refused while the workspace has staged, modified or untracked files.', exitCode: 2 };
    return operation(await this.run(workspacePath, ['checkout', '--no-guess', branchName]));
  }
  async merge(workspacePath: string, branchName: string): Promise<GitOperationResult> {
    if (!safeBranchName(branchName)) return { status: 'BLOCKED', stdout: '', stderr: 'Invalid Git branch name.', exitCode: 2 };
    const result = await this.run(workspacePath, ['-c', 'core.hooksPath=/dev/null', '-c', 'credential.helper=', 'merge', '--no-edit', '--no-ff', branchName]);
    if (result.exitCode === 0) return operation(result);
    const state = await this.run(workspacePath, ['status', '--porcelain=v1', '--untracked-files=all']);
    const hasConflict = /^(?:UU|AA|DD|AU|UA|DU|UD)\s/m.test(state.stdout);
    return operation(result, hasConflict);
  }
  async isIgnored(workspacePath: string, relativePath: string): Promise<{ ignored: boolean; detail: string }> {
    if (!safeRelativePath(relativePath)) return { ignored: false, detail: 'Unsafe relative path refused.' };
    const result = await this.run(workspacePath, ['check-ignore', '-v', '--no-index', '--', relativePath]);
    if (result.exitCode === 0) return { ignored: true, detail: result.stdout.trim() };
    if (result.exitCode === 1) return { ignored: false, detail: '' };
    return { ignored: false, detail: result.stderr.trim() || 'git check-ignore failed.' };
  }
}
