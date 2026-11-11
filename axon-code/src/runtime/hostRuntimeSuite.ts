import type { ExecutionRequest, RuntimeDescriptor } from '../types.js';
import { normalizeProjectPath } from '../pathSafety.js';
import type { HostPlatform, RuntimeCapabilityReport } from './platformCapabilities.js';
import type { HostProcessRequest, HostProcessResult, SandboxedHostProcessBridge } from './hostBridgeContracts.js';
import { HostProcessRuntimeAdapter } from './hostBridgeContracts.js';

export interface StrictSandboxProbe {
  available: boolean;
  platform: HostPlatform;
  executable: string;
  isolationConfirmed: boolean;
  networkBlocked: boolean;
  filesystemIsolated: boolean;
  memoryLimitEnforced: boolean;
  timeLimitEnforced: boolean;
  unprivilegedIdentity: boolean;
  notes: string[];
}

export interface StrictSandboxHost {
  probe(): Promise<StrictSandboxProbe>;
  run(request: HostProcessRequest, signal?: AbortSignal): Promise<HostProcessResult>;
}

/** Fail-closed bridge: process runtimes are unavailable unless every mandatory host boundary is attested. */
export class StrictSandboxBridge implements SandboxedHostProcessBridge {
  private lastProbe: StrictSandboxProbe | null = null;
  constructor(private readonly host: StrictSandboxHost) {}

  async probe(): Promise<{ available: boolean; platform: HostPlatform; executable: string; isolationConfirmed: boolean; networkBlocked: boolean; filesystemIsolated: boolean; memoryLimitEnforced: boolean; timeLimitEnforced: boolean; unprivilegedIdentity: boolean; notes: string[] }> {
    this.lastProbe = await this.host.probe();
    const p = this.lastProbe;
    const strict = p.available && p.isolationConfirmed && p.networkBlocked && p.filesystemIsolated &&
      p.memoryLimitEnforced && p.timeLimitEnforced && p.unprivilegedIdentity;
    const missing = [
      ['OS isolation', p.isolationConfirmed], ['network denial', p.networkBlocked], ['filesystem isolation', p.filesystemIsolated],
      ['memory limits', p.memoryLimitEnforced], ['time limits', p.timeLimitEnforced], ['unprivileged identity', p.unprivilegedIdentity]
    ].filter(([, okay]) => !okay).map(([name]) => String(name));
    return { available: strict, platform: p.platform, executable: p.executable, isolationConfirmed: strict, networkBlocked: p.networkBlocked,
      filesystemIsolated: p.filesystemIsolated, memoryLimitEnforced: p.memoryLimitEnforced, timeLimitEnforced: p.timeLimitEnforced, unprivilegedIdentity: p.unprivilegedIdentity,
      notes: [...p.notes, ...(strict ? [] : [`Process execution blocked; host did not attest: ${missing.join(', ')}.`])] };
  }

  async run(request: HostProcessRequest, signal?: AbortSignal): Promise<HostProcessResult> {
    if (!this.lastProbe || !(await this.probe()).available) throw new Error('Strict host sandbox attestation is absent or has expired.');
    if (request.runAs !== 'UNPRIVILEGED_ONLY' || request.allowPrivilegeEscalation !== false || request.networkAllowed !== false ||
        !request.workingDirectoryToken.trim() || !Number.isSafeInteger(request.timeoutMs) || request.timeoutMs < 1 ||
        !Number.isSafeInteger(request.maxOutputBytes) || request.maxOutputBytes < 1 || request.environmentAllowList.length > 16 ||
        request.environmentAllowList.some((name) => !/^[A-Z_][A-Z0-9_]{0,63}$/.test(name)) ||
        !Array.isArray(request.args) || request.args.length > 256 || request.args.some((arg) => typeof arg !== 'string' || arg.length > 4096)) {
      throw new Error('Process request violates the strict execution policy.');
    }
    return this.host.run(request, signal);
  }
}

export interface ToolchainCommandProbe {
  find(command: string): Promise<{ found: boolean; version?: string; path?: string }>;
}

export interface HostToolchainInventory {
  host: HostPlatform;
  tools: Record<string, { available: boolean; version?: string; path?: string }>;
  inspectedAt: number;
}

export async function inspectHostToolchains(host: HostPlatform, probe: ToolchainCommandProbe): Promise<HostToolchainInventory> {
  const names = ['node', 'python3', 'python', 'g++', 'clang++', 'rustc', 'cargo', 'java', 'gradle', 'adb', 'sdkmanager', 'unity-editor', 'UnrealEditor', 'wasmtime', 'wasmer'];
  const results = await Promise.all(names.map(async (name) => [name, await probe.find(name)] as const));
  return { host, tools: Object.fromEntries(results.map(([name, result]) => [name, { available: result.found,
    ...(result.version ? { version: result.version } : {}), ...(result.path ? { path: result.path } : {}) }])), inspectedAt: Date.now() };
}

function buildHostRuntime(
  runtimeId: string, executable: string, language: RuntimeDescriptor['languages'][number],
  platform: string[], bridge: SandboxedHostProcessBridge, args: (request: ExecutionRequest) => string[],
  acceptsEntry: (request: ExecutionRequest) => boolean
): HostProcessRuntimeAdapter {
  return new HostProcessRuntimeAdapter(runtimeId, bridge, executable, [language], platform, 'process', args, acceptsEntry);
}

/** Creates language-specific adapters, but each remains unavailable until the OS bridge passes strict isolation attestation. */
export function createSandboxedLanguageRuntimes(bridge: StrictSandboxBridge, platforms: string[] = ['linux', 'windows', 'macos', 'android']): {
  python: HostProcessRuntimeAdapter;
  cpp: HostProcessRuntimeAdapter;
  rust: HostProcessRuntimeAdapter;
  desktopProcess: HostProcessRuntimeAdapter;
} {
  const python = buildHostRuntime('python-sandboxed', 'python3', 'python', platforms,
    bridge, (request) => ['-I', '-B', ...request.entryFiles], (request) => request.entryFiles.every((path) => /\.py$/i.test(path)));
  const cpp = buildHostRuntime('cpp-sandboxed', 'axon-cpp-launcher', 'cpp', platforms,
    bridge, (request) => ['--project', request.projectId, '--entry', ...request.entryFiles], (request) => request.entryFiles.every((path) => /\.(?:c|cc|cpp|cxx)$/i.test(path)));
  const rust = buildHostRuntime('rust-sandboxed', 'axon-rust-launcher', 'rust', platforms,
    bridge, (request) => ['--project', request.projectId, '--entry', ...request.entryFiles], (request) => request.entryFiles.every((path) => /\.rs$/i.test(path)));
  const desktopProcess = buildHostRuntime('desktop-process-sandboxed', 'axon-process-launcher', 'unknown',
    ['windows', 'linux', 'macos', 'server'], bridge, (request) => ['--project', request.projectId, '--entry', ...request.entryFiles], (request) => request.entryFiles.every((path) => /\.(?:js|mjs|cjs|py|exe|bin)$/i.test(path)));
  return { python, cpp, rust, desktopProcess };
}

export interface NativeBuildRequest {
  projectId: string;
  workingDirectoryToken: string;
  sourceFiles: string[];
  target: 'cpp' | 'rust';
  profile: 'debug' | 'release';
  timeoutMs: number;
  outputLimitBytes: number;
  networkAllowed: false;
  runAs: 'UNPRIVILEGED_ONLY';
  userApproved: true;
}

export interface NativeBuildBridge {
  probeToolchain(target: 'cpp' | 'rust'): Promise<{ available: boolean; compiler?: string; version?: string; isolated: boolean; networkBlocked: boolean; filesystemIsolated: boolean; memoryLimitEnforced: boolean; timeLimitEnforced: boolean; unprivilegedIdentity: boolean; notes: string[] }>;
  build(request: NativeBuildRequest, signal?: AbortSignal): Promise<{ success: boolean; artifactToken?: string; diagnostics: string[] }>;
  verify(artifactToken: string, target: 'cpp' | 'rust'): Promise<{ valid: boolean; sha256?: string; sizeBytes?: number; notes: string[] }>;
}

export class NativeProjectBuildService {
  constructor(private readonly bridge: NativeBuildBridge) {}
  async build(request: NativeBuildRequest, signal?: AbortSignal): Promise<{ status: 'BUILT_AND_VERIFIED' | 'BLOCKED' | 'BUILD_FAILED' | 'VERIFICATION_FAILED'; artifactToken?: string; notes: string[] }> {
    if (request.userApproved !== true || !request.projectId.trim() || !request.workingDirectoryToken.trim() || !request.sourceFiles.length ||
        request.sourceFiles.some((path) => normalizeProjectPath(path) !== path) || new Set(request.sourceFiles).size !== request.sourceFiles.length ||
        request.sourceFiles.some((path) => request.target === 'cpp' ? !/\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx)$/i.test(path) : !/\.(?:rs)$/i.test(path) && !/(?:^|\/)Cargo\.(?:toml|lock)$/i.test(path)) ||
        !Number.isSafeInteger(request.timeoutMs) || request.timeoutMs < 1 || !Number.isSafeInteger(request.outputLimitBytes) || request.outputLimitBytes < 1 ||
        request.networkAllowed !== false || request.runAs !== 'UNPRIVILEGED_ONLY') return { status: 'BLOCKED', notes: ['Native build request violates policy or has invalid paths/limits.'] };
    const probe = await this.bridge.probeToolchain(request.target);
    if (!probe.available || !probe.isolated || !probe.networkBlocked || !probe.filesystemIsolated || !probe.memoryLimitEnforced || !probe.timeLimitEnforced || !probe.unprivilegedIdentity)
      return { status: 'BLOCKED', notes: ['Required compiler or strict isolated build host is unavailable.', ...probe.notes] };
    let built: Awaited<ReturnType<NativeBuildBridge['build']>>;
    try { built = await this.bridge.build(request, signal); } catch (error) { return { status: 'BUILD_FAILED', notes: [String(error)] }; }
    if (!built.success || !built.artifactToken) return { status: 'BUILD_FAILED', notes: built.diagnostics };
    const verified = await this.bridge.verify(built.artifactToken, request.target);
    if (!verified.valid || !/^[a-f0-9]{64}$/i.test(verified.sha256 ?? '') || !Number.isSafeInteger(verified.sizeBytes) || Number(verified.sizeBytes) < 1) {
      return { status: 'VERIFICATION_FAILED', notes: ['Native artifact did not pass mandatory hash and size verification.', ...verified.notes] };
    }
    return { status: 'BUILT_AND_VERIFIED', artifactToken: built.artifactToken, notes: verified.notes };
  }
}

export interface RemoteExecutionEnvelope {
  requestId: string;
  nonce: string;
  projectSha256: string;
  requestedRuntime: string;
  createdAt: number;
  expiresAt: number;
  userApproved: true;
  payload: Uint8Array;
}

export interface RemoteExecutionAttestation {
  workerId: string;
  requestId: string;
  nonce: string;
  projectSha256: string;
  issuedAt: number;
  expiresAt: number;
  resultSha256: string;
  signature: Uint8Array;
}

export async function verifyRemoteExecutionAttestation(
  attestation: RemoteExecutionAttestation, expected: Pick<RemoteExecutionEnvelope, 'requestId' | 'nonce' | 'projectSha256' | 'createdAt' | 'expiresAt'>,
  publicKey: CryptoKey, now = Date.now()
): Promise<boolean> {
  if (attestation.requestId !== expected.requestId || attestation.nonce !== expected.nonce || attestation.projectSha256 !== expected.projectSha256 ||
      attestation.issuedAt < expected.createdAt || attestation.expiresAt > expected.expiresAt || attestation.expiresAt <= now ||
      !/^[a-f0-9]{64}$/i.test(attestation.resultSha256)) return false;
  const encoder = new TextEncoder();
  const payload = encoder.encode(JSON.stringify({ workerId: attestation.workerId, requestId: attestation.requestId, nonce: attestation.nonce,
    projectSha256: attestation.projectSha256, issuedAt: attestation.issuedAt, expiresAt: attestation.expiresAt, resultSha256: attestation.resultSha256 }));
  try { return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, new Uint8Array(attestation.signature), payload); }
  catch { return false; }
}

export function remoteExecutionPolicy(endpoint: string, userApproved: boolean): { allowed: boolean; reason: string } {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return { allowed: false, reason: 'Remote execution requires HTTPS.' };
    if (!userApproved) return { allowed: false, reason: 'Remote execution requires explicit user approval.' };
    if (url.username || url.password || url.hash || url.search) return { allowed: false, reason: 'Credentials, query parameters and fragments are not accepted in remote endpoints.' };
    return { allowed: true, reason: 'HTTPS and explicit approval are present; authenticated worker verification is still required.' };
  } catch { return { allowed: false, reason: 'Remote endpoint is invalid.' }; }
}

export function rootExecutionAllowed(_request: { requiresRoot?: boolean }): false {
  // Arbitrary project code is never run with root/administrator privileges.
  return false;
}

export function summarizeHostRuntimeProbe(report: RuntimeCapabilityReport): string {
  return `${report.runtimeId}: ${report.state} on ${report.host}; isolation=${report.isolation}. ${report.notes.join(' ')}`;
}

export interface AndroidDeviceBridge {
  probe(): Promise<{ available: boolean; deviceId?: string; apiLevel?: number; abi?: string; notes: string[] }>;
  install(input: { artifactToken: string; artifactSha256: string; packageId: string; userApproved: true }, signal?: AbortSignal): Promise<{ installed: boolean; packageId?: string; artifactSha256?: string; notes: string[] }>;
  launch(input: { packageId: string }, signal?: AbortSignal): Promise<{ launched: boolean; notes: string[] }>;
}

export class AndroidApplicationService {
  constructor(private readonly device: AndroidDeviceBridge) {}
  async installAndLaunch(input: { artifactToken: string; artifactSha256: string; packageId: string; userApproved: boolean }, signal?: AbortSignal): Promise<{
    status: 'LAUNCHED' | 'BLOCKED' | 'INSTALL_FAILED' | 'LAUNCH_FAILED'; notes: string[];
  }> {
    if (!input.userApproved || !input.artifactToken.trim() || !/^[a-f0-9]{64}$/i.test(input.artifactSha256) ||
        !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(input.packageId)) {
      return { status: 'BLOCKED', notes: ['Android installation requires explicit approval and a verified artifact identity/hash.'] };
    }
    const host = await this.device.probe();
    if (!host.available || !host.deviceId) return { status: 'BLOCKED', notes: ['No authorized Android device bridge is available.', ...host.notes] };
    const installed = await this.device.install({ artifactToken: input.artifactToken, artifactSha256: input.artifactSha256, packageId: input.packageId, userApproved: true }, signal);
    if (!installed.installed || installed.packageId !== input.packageId || installed.artifactSha256?.toLowerCase() !== input.artifactSha256.toLowerCase()) {
      return { status: 'INSTALL_FAILED', notes: ['Installed package identity or hash did not match the approved artifact.', ...installed.notes] };
    }
    const launched = await this.device.launch({ packageId: input.packageId }, signal);
    return launched.launched ? { status: 'LAUNCHED', notes: [...host.notes, ...installed.notes, ...launched.notes] } :
      { status: 'LAUNCH_FAILED', notes: [...installed.notes, ...launched.notes] };
  }
}

export interface GameEngineBuildBridge {
  probe(input: { engine: 'unity' | 'unreal'; projectId: string }): Promise<{ available: boolean; engineVersion?: string; targetPlatforms: string[]; isolated: boolean; networkBlocked: boolean; filesystemIsolated: boolean; memoryLimitEnforced: boolean; timeLimitEnforced: boolean; unprivilegedIdentity: boolean; notes: string[] }>;
  build(input: { engine: 'unity' | 'unreal'; projectId: string; workingDirectoryToken: string; targetPlatform: string; timeoutMs: number; outputLimitBytes: number; userApproved: true; networkAllowed: false; runAs: 'UNPRIVILEGED_ONLY' }, signal?: AbortSignal): Promise<{ success: boolean; artifactToken?: string; sha256?: string; diagnostics: string[] }>;
  verify(input: { engine: 'unity' | 'unreal'; artifactToken: string }): Promise<{ valid: boolean; sha256?: string; sizeBytes?: number; notes: string[] }>;
}

export class GameEngineBuildService {
  constructor(private readonly bridge: GameEngineBuildBridge) {}
  async build(input: { engine: 'unity' | 'unreal'; projectId: string; workingDirectoryToken: string; targetPlatform: string; timeoutMs: number; outputLimitBytes: number; userApproved: boolean }, signal?: AbortSignal): Promise<{
    status: 'BUILT_AND_VERIFIED' | 'BLOCKED' | 'BUILD_FAILED' | 'VERIFICATION_FAILED'; artifactToken?: string; notes: string[];
  }> {
    if (!input.userApproved || !input.projectId.trim() || !input.workingDirectoryToken.trim() || !input.targetPlatform.trim() ||
        !Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1 || !Number.isSafeInteger(input.outputLimitBytes) || input.outputLimitBytes < 1) {
      return { status: 'BLOCKED', notes: ['Engine build requires explicit approval and valid limits/project identity.'] };
    }
    const host = await this.bridge.probe({ engine: input.engine, projectId: input.projectId });
    if (!host.available || !host.isolated || !host.networkBlocked || !host.filesystemIsolated || !host.memoryLimitEnforced ||
        !host.timeLimitEnforced || !host.unprivilegedIdentity || !host.targetPlatforms.includes(input.targetPlatform)) {
      return { status: 'BLOCKED', notes: ['Requested game-engine toolchain/target is unavailable or not isolated.', ...host.notes] };
    }
    let built: Awaited<ReturnType<GameEngineBuildBridge['build']>>;
    try { built = await this.bridge.build({ ...input, userApproved: true, networkAllowed: false, runAs: 'UNPRIVILEGED_ONLY' }, signal); }
    catch (error) { return { status: 'BUILD_FAILED', notes: [String(error)] }; }
    if (!built.success || !built.artifactToken) return { status: 'BUILD_FAILED', notes: built.diagnostics };
    const verified = await this.bridge.verify({ engine: input.engine, artifactToken: built.artifactToken });
    if (!verified.valid || !/^[a-f0-9]{64}$/i.test(verified.sha256 ?? '') || verified.sha256?.toLowerCase() !== built.sha256?.toLowerCase() ||
        !Number.isSafeInteger(verified.sizeBytes) || Number(verified.sizeBytes) <= 0) {
      return { status: 'VERIFICATION_FAILED', notes: ['Engine artifact failed mandatory hash/size verification.', ...verified.notes] };
    }
    return { status: 'BUILT_AND_VERIFIED', artifactToken: built.artifactToken, notes: [...host.notes, ...verified.notes] };
  }
}
