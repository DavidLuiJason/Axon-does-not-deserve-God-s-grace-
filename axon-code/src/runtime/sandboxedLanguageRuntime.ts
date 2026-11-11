import type { ExecutionRequest, ExecutionResult, RuntimeAdapter, RuntimeDescriptor, SourceLanguage } from '../types.js';
import type { HostProcessRequest, HostProcessResult, SandboxedHostProcessBridge, SandboxedHostProbeReport } from './hostBridgeContracts.js';
import { normalizeProjectPath } from '../pathSafety.js';
import { redactSensitiveText } from '../security/secretRedactor.js';

export type SandboxedLanguageProfileId = 'python-cpython' | 'cpp-clang' | 'rust-cargo';
export interface RuntimeWorkspaceMount { workingDirectoryToken: string; cleanup(): Promise<void>; }
export interface RuntimeWorkspaceProvider { createIsolatedOverlay(projectId: string, executionId: string): Promise<RuntimeWorkspaceMount>; }

export interface SandboxedLanguageProfile {
  id: SandboxedLanguageProfileId;
  label: string;
  language: SourceLanguage;
  platforms: readonly string[];
  executable: string;
  prepare?: (request: ExecutionRequest, outputName: string) => { executable: string; args: string[] };
  run: (request: ExecutionRequest, outputName: string) => { executable: string; args: string[] };
  outputExtension: string;
  notes: readonly string[];
}
export const SANDBOXED_LANGUAGE_PROFILES: readonly SandboxedLanguageProfile[] = Object.freeze([
  { id: 'python-cpython', label: 'CPython isolated interpreter', language: 'python', platforms: ['android', 'windows', 'linux', 'macos', 'server'], executable: 'python3', run: (request) => ({ executable: 'python3', args: ['-I', '-B', request.entryFiles[0]!] }), outputExtension: '', notes: ['Uses CPython isolated mode; requires the host provider to expose a verified interpreter and isolated environment.'] },
  { id: 'cpp-clang', label: 'Clang C++ compile and run', language: 'cpp', platforms: ['android', 'windows', 'linux', 'macos', 'server'], executable: 'clang++', prepare: (request, output) => ({ executable: 'clang++', args: ['-std=c++20', '-O2', '-Wall', '-Wextra', '-o', output, ...request.entryFiles] }), run: (_request, output) => ({ executable: `./${output}`, args: [] }), outputExtension: '', notes: ['Compiles source in the working copy before executing the generated binary; temporary output remains host-managed.'] },
  { id: 'rust-cargo', label: 'Rust Cargo offline run', language: 'rust', platforms: ['android', 'windows', 'linux', 'macos', 'server'], executable: 'cargo', run: (_request) => ({ executable: 'cargo', args: ['run', '--offline', '--locked'] }), outputExtension: '', notes: ['Requires a Cargo project with lockfile and a pre-populated offline dependency cache.'] }
]);
/** Real host-process runtime adapter for language profiles; unavailable until a strict OS sandbox attests. */
export class SandboxedLanguageRuntimeAdapter implements RuntimeAdapter {
  descriptor: RuntimeDescriptor;
  private probe: SandboxedHostProbeReport | null = null;
  private runSequence = 0;
  constructor(readonly profile: SandboxedLanguageProfile, private readonly host: SandboxedHostProcessBridge, private readonly workspaces: RuntimeWorkspaceProvider) {
    this.descriptor = { id: profile.id, label: profile.label, languages: [profile.language], platforms: [...profile.platforms], available: false,
      supportsStreaming: false, supportsCheckpoint: false, isolation: 'process', notes: [...profile.notes, 'Provider must pass the full OS sandbox probe before execution is enabled.'] };
  }
  async initialize(): Promise<boolean> {
    try { this.probe = await this.host.probe(); } catch (error) { this.probe = null; this.descriptor = { ...this.descriptor, available: false, notes: [...(this.descriptor.notes ?? []), `Host probe failed: ${String(error)}`] }; return false; }
    const p = this.probe;
    const executable = this.profile.executable;
    const executableReport = this.host.probeExecutable ? await this.host.probeExecutable(executable).catch(() => null) : null;
    const executableOkay = Boolean(executableReport?.available && executableReport.approved && /^[a-f0-9]{64}$/i.test(executableReport.sha256) && executableReport.version.trim());
    const okay = executableOkay && p.available && p.isolationConfirmed && p.networkBlocked && p.filesystemIsolated && p.memoryLimitEnforced && p.timeLimitEnforced && p.unprivilegedIdentity && p.childProcessConfinement === true;
    this.descriptor = { ...this.descriptor, available: okay, notes: [...(this.profile.notes), ...(okay ? ['Strict OS sandbox and exact executable attestation passed.'] : [`Execution remains blocked; missing: ${[...sandboxGaps(p), ...(!executableOkay ? ['exact host executable attestation'] : [])].join(', ')}.`])] };
    return okay;
  }
  canHandle(request: ExecutionRequest): boolean {
    return this.descriptor.available && request.runtimeId === this.profile.id && request.mode === 'FULL_LOCAL' && request.networkAllowed === false && request.fileAccess === 'working-copy' &&
      request.entryFiles.length >= 1 && request.entryFiles.length <= 64 && request.entryFiles.every((path) => normalizeProjectPath(path) === path && allowedExtension(path, this.profile.language)) &&
      Number.isSafeInteger(request.timeoutMs) && request.timeoutMs >= 1 && Number.isSafeInteger(request.outputLimitBytes) && request.outputLimitBytes >= 1;
  }
  async execute(request: ExecutionRequest, signal?: AbortSignal): Promise<ExecutionResult> {
    const started = Date.now();
    if (!this.canHandle(request)) return blocked(request, 'Runtime is unavailable or request exceeds the profile security and input policy.');
    if (signal?.aborted) return { requestId: request.requestId, status: 'cancelled', stdout: '', stderr: '', diagnostics: [], elapsedMs: Date.now() - started, artifacts: [], evidence: 'CHECKED', notes: ['Execution was cancelled before process start.'] };
    const executionId = `${this.profile.id}-${request.requestId.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 48)}-${++this.runSequence}`;
    let mount: RuntimeWorkspaceMount | null = null;
    let result: ExecutionResult;
    let outputUsed = 0;
    try {
      mount = await this.workspaces.createIsolatedOverlay(request.projectId, executionId);
      if (!mount || typeof mount.workingDirectoryToken !== 'string' || !mount.workingDirectoryToken.trim() || typeof mount.cleanup !== 'function') throw new Error('Workspace provider returned an invalid isolated overlay.');
      if (this.profile.prepare) {
        const prepare = this.profile.prepare(request, `.axon-build-${executionId}`);
        const compileBudget = request.outputLimitBytes;
        const compiled = await this.runCommand(request, mount.workingDirectoryToken, prepare.executable, prepare.args, signal, compileBudget);
        outputUsed = outputBytes(compiled.stdout, compiled.stderr);
        if (compiled.exitCode !== 0 || compiled.timedOut || compiled.cancelled || compiled.outputTruncated || outputUsed > compileBudget) {
          result = { requestId: request.requestId, status: compiled.timedOut ? 'timed-out' : compiled.cancelled ? 'cancelled' : 'failed', stdout: safeText(compiled.stdout), stderr: safeText(compiled.stderr), diagnostics: [], elapsedMs: Date.now() - started, artifacts: [], evidence: 'ADAPTER_REPORTED', notes: ['Compile stage did not pass or exceeded its output budget; execution was not attempted.'] };
        } else {
          const remaining = request.timeoutMs - (Date.now() - started);
          const remainingOutput = request.outputLimitBytes - outputUsed;
          if (remaining <= 0 || remainingOutput <= 0) {
            result = { requestId: request.requestId, status: remaining <= 0 ? 'timed-out' : 'failed', stdout: safeText(compiled.stdout), stderr: safeText(compiled.stderr), diagnostics: [], elapsedMs: Date.now() - started, artifacts: [], evidence: 'CHECKED', notes: ['Total execution time or output budget expired during preparation.'] };
          } else {
            const command = this.profile.run(request, `.axon-build-${executionId}`);
            const executionRequest = { ...request, timeoutMs: remaining, outputLimitBytes: remainingOutput };
            const executed = await this.runCommand(executionRequest, mount.workingDirectoryToken, command.executable, command.args, signal, remainingOutput);
            const used = outputBytes(executed.stdout, executed.stderr);
            result = { requestId: request.requestId, status: executed.cancelled ? 'cancelled' : executed.timedOut ? 'timed-out' : executed.outputTruncated || used > remainingOutput ? 'failed' : executed.exitCode === 0 ? 'completed' : 'failed', exitCode: executed.exitCode,
              stdout: combineText(compiled.stdout, executed.stdout, request.outputLimitBytes), stderr: combineText(compiled.stderr, executed.stderr, request.outputLimitBytes, true), diagnostics: [], elapsedMs: Date.now() - started, ...(executed.peakRamBytes !== undefined ? { peakRamBytes: executed.peakRamBytes } : {}), artifacts: [], evidence: 'ADAPTER_REPORTED',
              notes: ['Execution was performed by the attested host sandbox adapter in a per-run isolated overlay.', ...(executed.outputTruncated || used > remainingOutput ? ['Execution output reached its configured byte limit.'] : [])] };
          }
        }
      } else {
        const command = this.profile.run(request, `.axon-build-${executionId}`);
        const executed = await this.runCommand(request, mount.workingDirectoryToken, command.executable, command.args, signal, request.outputLimitBytes);
        const used = outputBytes(executed.stdout, executed.stderr);
        result = { requestId: request.requestId, status: executed.cancelled ? 'cancelled' : executed.timedOut ? 'timed-out' : executed.outputTruncated || used > request.outputLimitBytes ? 'failed' : executed.exitCode === 0 ? 'completed' : 'failed', exitCode: executed.exitCode,
          stdout: safeText(executed.stdout), stderr: safeText(executed.stderr), diagnostics: [], elapsedMs: Date.now() - started, ...(executed.peakRamBytes !== undefined ? { peakRamBytes: executed.peakRamBytes } : {}), artifacts: [], evidence: 'ADAPTER_REPORTED',
          notes: ['Execution was performed by the attested host sandbox adapter in a per-run isolated overlay.', ...(executed.outputTruncated || used > request.outputLimitBytes ? ['Execution output reached its configured byte limit.'] : [])] };
      }
    } catch (error) {
      result = { requestId: request.requestId, status: 'failed', stdout: '', stderr: safeText(String(error)), diagnostics: [], elapsedMs: Date.now() - started, artifacts: [], evidence: 'ADAPTER_REPORTED', notes: ['Host runtime bridge or workspace overlay failed.'] };
    }
    if (mount) {
      try { await mount.cleanup(); }
      catch (error) { return { ...result, status: 'failed', notes: [...result.notes, `Isolated workspace cleanup failed and requires host recovery: ${safeText(String(error))}`] }; }
    }
    return result;
  }

  private async runCommand(request: ExecutionRequest, workingDirectoryToken: string, executable: string, args: string[], signal?: AbortSignal, maxOutputBytes = request.outputLimitBytes): Promise<HostProcessResult> {
    if (typeof executable !== 'string' || !executable.trim() || /[\u0000\r\n]/.test(executable) || !Array.isArray(args) || args.length > 256 || args.some((arg) => typeof arg !== 'string' || arg.length > 8192 || /[\u0000\r\n]/.test(arg)) || args.reduce((sum, arg) => sum + new TextEncoder().encode(arg).byteLength, 0) > 64 * 1024) throw new Error('Generated toolchain arguments violate bounds.');
    const hostRequest: HostProcessRequest = { executable, args, workingDirectoryToken, timeoutMs: request.timeoutMs, maxOutputBytes,
      networkAllowed: false, filesystemScope: 'WORKING_COPY_ONLY', environmentAllowList: ['PATH', 'HOME', 'TMPDIR', 'LANG'], runAs: 'UNPRIVILEGED_ONLY', allowPrivilegeEscalation: false };
    const result = await this.host.run(hostRequest, signal);
    if (!result || !Number.isSafeInteger(result.exitCode) || typeof result.stdout !== 'string' || typeof result.stderr !== 'string' || !Number.isFinite(result.elapsedMs) || result.elapsedMs < 0 || (result.peakRamBytes !== undefined && (!Number.isFinite(result.peakRamBytes) || result.peakRamBytes < 0))) throw new Error('Host runtime returned invalid process results or resource metrics.');
    return result;
  }
}
function outputBytes(stdout: string, stderr: string): number { return new TextEncoder().encode(stdout).byteLength + new TextEncoder().encode(stderr).byteLength; }
function safeText(value: string): string { return typeof value === 'string' ? redactSensitiveText(value, 'logs') : ''; }
function combineText(first: string, second: string, maxBytes: number, stderr = false): string {
  const joined = redactSensitiveText(`${first}${second}`, 'logs');
  const bytes = new TextEncoder().encode(joined);
  if (bytes.byteLength <= maxBytes) return joined;
  return new TextDecoder().decode(bytes.subarray(0, maxBytes));
}
function sandboxGaps(probe: SandboxedHostProbeReport): string[] {
  return [['host availability', probe.available], ['OS isolation', probe.isolationConfirmed], ['network denial', probe.networkBlocked], ['filesystem isolation', probe.filesystemIsolated], ['memory limit', probe.memoryLimitEnforced], ['time limit', probe.timeLimitEnforced], ['unprivileged identity', probe.unprivilegedIdentity], ['child-process confinement', probe.childProcessConfinement === true]].filter(([, value]) => value !== true).map(([label]) => String(label));
}
function allowedExtension(path: string, language: SourceLanguage): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return language === 'python' ? ext === 'py' : language === 'cpp' ? ['cpp', 'cc', 'cxx'].includes(ext) : language === 'rust' ? ext === 'rs' || path.endsWith('Cargo.toml') : false;
}
function blocked(request: ExecutionRequest, note: string): ExecutionResult { return { requestId: request.requestId, status: 'blocked', stdout: '', stderr: '', diagnostics: [], elapsedMs: 0, artifacts: [], evidence: 'CHECKED', notes: [note] }; }
