import type { ExecutionRequest, ExecutionResult, RuntimeDescriptor } from '../types.js';
import type { HostPlatform, RuntimeCapabilityReport } from './platformCapabilities.js';
import { normalizeProjectPath } from '../pathSafety.js';

export interface HostProcessRequest {
  executable: string;
  args: string[];
  workingDirectoryToken: string;
  timeoutMs: number;
  maxOutputBytes: number;
  networkAllowed: false;
  filesystemScope: 'PROJECT_READ_ONLY' | 'WORKING_COPY_ONLY';
  environmentAllowList: string[];
  runAs: 'UNPRIVILEGED_ONLY';
  allowPrivilegeEscalation: false;
}

export interface HostProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  elapsedMs: number;
  peakRamBytes?: number;
  timedOut: boolean;
  cancelled: boolean;
  outputTruncated: boolean;
}

/** Native host bridge must enforce OS-level sandboxing; a TypeScript wrapper is not a security boundary. */
export interface SandboxedHostProbeReport {
  available: boolean;
  platform: HostPlatform;
  executable: string;
  isolationConfirmed: boolean;
  networkBlocked: boolean;
  filesystemIsolated: boolean;
  memoryLimitEnforced: boolean;
  timeLimitEnforced: boolean;
  unprivilegedIdentity: boolean;
  /** Required by R9 multi-process toolchains: child processes must inherit the same sandbox and limits. */
  childProcessConfinement?: boolean;
  notes: string[];
}

export interface SandboxedHostProcessBridge {
  probe(): Promise<SandboxedHostProbeReport>;
  /** Optional per-executable attestation; R9 managed build/runtime paths require it. */
  probeExecutable?(executable: string): Promise<{ available: boolean; approved: boolean; sha256: string; version: string }>;
  run(request: HostProcessRequest, signal?: AbortSignal): Promise<HostProcessResult>;
}

export interface HostBuildBridge {
  probeAndroidBuildTools(): Promise<{ available: boolean; isolated: boolean; networkBlocked: boolean; filesystemIsolated: boolean; timeLimitEnforced: boolean; outputLimitEnforced: boolean; unprivilegedIdentity: boolean; gradleVersion?: string; androidSdkVersion?: string; buildToolsVersion?: string; notes: string[] }>;
  buildApk(input: { projectId: string; workingDirectoryToken: string; timeoutMs: number; outputLimitBytes: number; userApproved: true; networkAllowed: false; runAs: 'UNPRIVILEGED_ONLY' }, signal?: AbortSignal): Promise<{ success: boolean; artifactToken?: string; packageId?: string; versionCode?: number; sha256?: string; diagnostics: string[] }>;
  verifyApk(artifactToken: string): Promise<{ valid: boolean; manifestParsed?: boolean; signatureValid?: boolean; packageId?: string; minSdk?: number; targetSdk?: number; sizeBytes?: number; sha256?: string; permissions?: string[]; notes: string[] }>;
}

/** Adapter shell for platform-provided process runtimes; unavailable until a real native bridge probes successfully. */
export class HostProcessRuntimeAdapter {
  descriptor: RuntimeDescriptor;
  private probeResult: Awaited<ReturnType<SandboxedHostProcessBridge['probe']>> | null = null;

  constructor(
    readonly runtimeId: string,
    readonly host: SandboxedHostProcessBridge,
    readonly executable: string,
    readonly languages: RuntimeDescriptor['languages'],
    readonly platforms: RuntimeDescriptor['platforms'],
    readonly isolation: RuntimeDescriptor['isolation'],
    private readonly buildArgs: (request: ExecutionRequest) => string[] = (request) => [...request.entryFiles],
    private readonly acceptsEntry: (request: ExecutionRequest) => boolean = () => true
  ) {
    this.descriptor = { id: runtimeId, label: runtimeId, languages, platforms, available: false,
      supportsStreaming: false, supportsCheckpoint: false, isolation, notes: ['Requires an OS-provided sandboxed process bridge.'] };
  }

  async initialize(): Promise<RuntimeCapabilityReport> {
    try {
      this.probeResult = await this.host.probe();
    } catch (error) {
      this.probeResult = null;
      this.descriptor = { ...this.descriptor, available: false, notes: [`Host sandbox probe failed: ${String(error)}`] };
      return { runtimeId: this.runtimeId, state: 'BLOCKED', host: 'unknown', requiredComponents: [this.executable],
        missingComponents: ['strict host sandbox attestation'], isolation: this.isolation, evidence: 'HOST_PROBE', notes: [...(this.descriptor.notes ?? [])] };
    }
    const report = this.probeResult;
    const checks: Array<[string, boolean]> = [
      ['host availability', report.available], ['OS isolation', report.isolationConfirmed], ['network denial', report.networkBlocked],
      ['filesystem isolation', report.filesystemIsolated], ['memory limits', report.memoryLimitEnforced],
      ['time limits', report.timeLimitEnforced], ['unprivileged identity', report.unprivilegedIdentity], ['process isolation mode', this.isolation !== 'none']
    ];
    const missing = checks.filter(([, okay]) => okay !== true).map(([name]) => name);
    this.descriptor = { ...this.descriptor, available: missing.length === 0,
      notes: [...(report.notes ?? []), ...(missing.length ? [`Execution blocked; missing strict host guarantees: ${missing.join(', ')}.`] : [])] };
    return {
      runtimeId: this.runtimeId, state: this.descriptor.available ? 'AVAILABLE' : 'BLOCKED', host: report.platform,
      requiredComponents: [this.executable], missingComponents: missing,
      isolation: this.isolation, evidence: 'HOST_PROBE', notes: [...(this.descriptor.notes ?? [])]
    };
  }

  canHandle(request: ExecutionRequest): boolean {
    return this.descriptor.available && request.runtimeId === this.runtimeId && request.mode === 'FULL_LOCAL' && request.networkAllowed === false &&
      request.fileAccess !== 'none' && this.acceptsEntry(request) && Number.isSafeInteger(request.timeoutMs) && request.timeoutMs > 0 &&
      Number.isSafeInteger(request.outputLimitBytes) && request.outputLimitBytes > 0 && request.entryFiles.length > 0 &&
      request.entryFiles.every((path) => normalizeProjectPath(path) === path);
  }

  async execute(request: ExecutionRequest, signal?: AbortSignal): Promise<ExecutionResult> {
    const started = Date.now();
    if (!this.canHandle(request)) return {
      requestId: request.requestId, status: 'blocked', stdout: '', stderr: '', diagnostics: [], elapsedMs: Date.now() - started,
      artifacts: [], evidence: 'ADAPTER_REPORTED', notes: ['Native process bridge is unavailable, not isolated, or request exceeds its declared access policy.']
    };
    try {
      const args = this.buildArgs(request);
      if (!Array.isArray(args) || args.length > 256 || args.some((arg) => typeof arg !== 'string' || arg.length > 4_096) ||
          args.reduce((sum, arg) => sum + new TextEncoder().encode(arg).byteLength, 0) > 64 * 1024) {
        throw new Error('Runtime produced invalid or oversized process arguments.');
      }
      const result = await this.host.run({ executable: this.executable, args, workingDirectoryToken: request.projectId,
        timeoutMs: request.timeoutMs, maxOutputBytes: request.outputLimitBytes, networkAllowed: false,
        filesystemScope: request.fileAccess === 'working-copy' ? 'WORKING_COPY_ONLY' : 'PROJECT_READ_ONLY', environmentAllowList: [], runAs: 'UNPRIVILEGED_ONLY', allowPrivilegeEscalation: false }, signal);
      if (typeof result.stdout !== 'string' || typeof result.stderr !== 'string' || !Number.isSafeInteger(result.exitCode) ||
          !Number.isFinite(result.elapsedMs) || result.elapsedMs < 0 || (result.peakRamBytes !== undefined && (!Number.isFinite(result.peakRamBytes) || result.peakRamBytes < 0))) {
        throw new Error('Host process bridge returned malformed execution metrics or output.');
      }
      const encoder = new TextEncoder();
      const stdoutBytes = encoder.encode(result.stdout);
      const stderrBytes = encoder.encode(result.stderr);
      let stdout = result.stdout;
      let stderr = result.stderr;
      let outputExceeded = stdoutBytes.byteLength + stderrBytes.byteLength > request.outputLimitBytes;
      if (outputExceeded) {
        const combined = new Uint8Array(request.outputLimitBytes);
        const joined = new Uint8Array(stdoutBytes.byteLength + stderrBytes.byteLength);
        joined.set(stdoutBytes); joined.set(stderrBytes, stdoutBytes.byteLength);
        combined.set(joined.subarray(0, request.outputLimitBytes));
        stdout = new TextDecoder().decode(combined); stderr = '';
      }
      return {
        requestId: request.requestId,
        status: result.cancelled ? 'cancelled' : result.timedOut ? 'timed-out' : outputExceeded ? 'failed' : result.exitCode === 0 ? 'completed' : 'failed',
        exitCode: result.exitCode, stdout, stderr, diagnostics: [], elapsedMs: result.elapsedMs,
        ...(result.peakRamBytes !== undefined ? { peakRamBytes: result.peakRamBytes } : {}), artifacts: [], evidence: 'ADAPTER_REPORTED',
        notes: [ ...(result.outputTruncated || outputExceeded ? ['Output was truncated at the configured limit.'] : []), 'Execution occurred through the host-provided process bridge; see native host evidence.' ]
      };
    } catch (error) {
      return { requestId: request.requestId, status: 'failed', stdout: '', stderr: '', diagnostics: [], elapsedMs: Date.now() - started,
        artifacts: [], evidence: 'ADAPTER_REPORTED', notes: [`Host process execution failed: ${String(error)}`] };
    }
  }
}

/** An Android Gradle build bridge with mandatory APK post-build verification. */
export class AndroidApkBuildService {
  constructor(private readonly bridge: HostBuildBridge) {}

  async build(input: { projectId: string; workingDirectoryToken: string; timeoutMs: number; outputLimitBytes: number; userApproved: boolean }, signal?: AbortSignal): Promise<{
    status: 'BUILT_AND_VERIFIED' | 'BLOCKED' | 'BUILD_FAILED' | 'VERIFICATION_FAILED';
    artifactToken?: string; verification?: Awaited<ReturnType<HostBuildBridge['verifyApk']>>; notes: string[];
  }> {
    if (!input.userApproved || !input.projectId.trim() || !input.workingDirectoryToken.trim() || !Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1 || !Number.isSafeInteger(input.outputLimitBytes) || input.outputLimitBytes < 1) {
      return { status: 'BLOCKED', notes: ['Android build request identity or limits are invalid.'] };
    }
    const tools = await this.bridge.probeAndroidBuildTools();
    const hostSafe = tools.available && tools.isolated && tools.networkBlocked && tools.filesystemIsolated && tools.timeLimitEnforced && tools.outputLimitEnforced && tools.unprivilegedIdentity;
    if (!hostSafe) return { status: 'BLOCKED', notes: ['Android SDK/Gradle toolchain or its required isolated build safeguards are unavailable.', ...tools.notes] };
    let built: Awaited<ReturnType<HostBuildBridge['buildApk']>>;
    try { built = await this.bridge.buildApk({ ...input, userApproved: true, networkAllowed: false, runAs: 'UNPRIVILEGED_ONLY' }, signal); }
    catch (error) { return { status: 'BUILD_FAILED', notes: [`Android build bridge failed: ${String(error)}`] }; }
    if (!built.success || !built.artifactToken) return { status: 'BUILD_FAILED', notes: built.diagnostics };
    const verification = await this.bridge.verifyApk(built.artifactToken);
    if (!verification.valid || verification.manifestParsed !== true || verification.signatureValid !== true || !verification.packageId ||
        (built.packageId !== undefined && built.packageId !== verification.packageId) ||
        !/^[a-f0-9]{64}$/i.test(verification.sha256 ?? '') ||
        (built.sha256 !== undefined && built.sha256.toLowerCase() !== (verification.sha256 ?? '').toLowerCase()) ||
        !Number.isSafeInteger(verification.sizeBytes) || Number(verification.sizeBytes) <= 0) {
      return { status: 'VERIFICATION_FAILED', verification, notes: ['APK was produced but identity/hash verification did not pass.', ...verification.notes] };
    }
    return { status: 'BUILT_AND_VERIFIED', artifactToken: built.artifactToken, verification, notes: ['APK build and post-build artifact checks were reported by the native host bridge.', ...verification.notes] };
  }
}
