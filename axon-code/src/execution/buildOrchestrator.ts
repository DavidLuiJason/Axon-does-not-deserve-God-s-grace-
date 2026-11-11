import type { SandboxedHostProcessBridge, HostProcessResult } from '../runtime/hostBridgeContracts.js';
export interface ApprovedToolchainCommand { id: string; executable: string; host: string; purpose: 'BUILD' | 'TEST' | 'PACKAGE' | 'INSPECT'; languages: readonly string[]; available: boolean; hostApproved: boolean; version: string; executableSha256: string; }
export interface BuildTask { id: string; toolchainId: string; args: readonly string[]; dependsOn: readonly string[]; timeoutMs: number; maxOutputBytes: number; expectedArtifactIds?: readonly string[]; }
export interface BuildProfile { id: string; projectId: string; workingDirectoryToken: string; tasks: readonly BuildTask[]; networkAllowed: false; fileAccess: 'WORKING_COPY_ONLY'; }
export interface ArtifactVerificationProvider { verify(artifactId: string, workingDirectoryToken: string): Promise<{ valid: boolean; sizeBytes: number; sha256: string; notes: string[] }>; }
export interface BuildTaskResult { taskId: string; status: 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED'; process?: HostProcessResult; diagnostics: string[]; }
export interface BuildRunResult { buildId: string; status: 'BUILT_AND_VERIFIED' | 'BUILD_FAILED' | 'VERIFICATION_FAILED' | 'BLOCKED'; tasks: BuildTaskResult[]; verifiedArtifacts: Array<{ id: string; sizeBytes: number; sha256: string }>; }

/** DAG-based build/test runner. Shell interpolation is prohibited; only registered executable IDs are accepted. */
export class BuildOrchestrator {
  private readonly tools = new Map<string, ApprovedToolchainCommand>();
  private sequence = 0;
  constructor(private readonly host: SandboxedHostProcessBridge, private readonly artifacts: ArtifactVerificationProvider) {}
  registerToolchain(command: ApprovedToolchainCommand): void {
    if (!/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(command.id) || !command.executable.trim() || /[\u0000\r\n]/.test(command.executable) || !command.host.trim() || !command.hostApproved || !command.version.trim() || !/^[a-f0-9]{64}$/i.test(command.executableSha256) || !Array.isArray(command.languages) || command.languages.length < 1 || command.languages.some((item) => typeof item !== 'string' || !item.trim()) || this.tools.has(command.id)) throw new Error('Invalid or duplicate toolchain command.')
    this.tools.set(command.id, { ...command });
  }
  async run(profile: BuildProfile, approved: boolean, signal?: AbortSignal): Promise<BuildRunResult> {
    const buildId = `build-${++this.sequence}`;
    if (!approved || !profile.projectId.trim() || !profile.workingDirectoryToken.trim() || profile.networkAllowed !== false || profile.fileAccess !== 'WORKING_COPY_ONLY') return { buildId, status: 'BLOCKED', tasks: [], verifiedArtifacts: [] };
    let ordered: BuildTask[];
    try { ordered = topological(profile.tasks); } catch (error) { return { buildId, status: 'BLOCKED', tasks: [], verifiedArtifacts: [] }; }
    let probe: Awaited<ReturnType<SandboxedHostProcessBridge['probe']>>;
    try { probe = await this.host.probe(); } catch { return { buildId, status: 'BLOCKED', tasks: [], verifiedArtifacts: [] }; }
    if (!probe.available || !probe.isolationConfirmed || !probe.filesystemIsolated || !probe.networkBlocked || !probe.memoryLimitEnforced || !probe.timeLimitEnforced || !probe.unprivilegedIdentity || probe.childProcessConfinement !== true) return { buildId, status: 'BLOCKED', tasks: [], verifiedArtifacts: [] };
    const results: BuildTaskResult[] = [], passed = new Set<string>();
    for (const task of ordered) {
      if (signal?.aborted) { results.push({ taskId: task.id, status: 'BLOCKED', diagnostics: ['Build run was cancelled.'] }); break; }
      if (task.dependsOn.some((dependency) => !passed.has(dependency))) { results.push({ taskId: task.id, status: 'SKIPPED', diagnostics: ['A prerequisite task did not pass.'] }); continue; }
      const tool = this.tools.get(task.toolchainId);
      if (!tool || !tool.available) { results.push({ taskId: task.id, status: 'BLOCKED', diagnostics: [`Toolchain '${task.toolchainId}' is unavailable.`] }); continue; }
      const executableProbe = this.host.probeExecutable ? await this.host.probeExecutable(tool.executable) : { available: false, approved: false, sha256: '', version: '' };
      if (!executableProbe.available || !executableProbe.approved || executableProbe.sha256.toLowerCase() !== tool.executableSha256.toLowerCase() || executableProbe.version !== tool.version || tool.host !== probe.platform) { results.push({ taskId: task.id, status: 'BLOCKED', diagnostics: ['Host executable identity, hash or version is not attested against the registered toolchain.'] }); continue; }
      if ((tool.purpose === 'BUILD' || tool.purpose === 'PACKAGE') && !(task.expectedArtifactIds?.length)) { results.push({ taskId: task.id, status: 'BLOCKED', diagnostics: ['Build/package tasks must declare output artifacts for post-build verification.'] }); continue; }
      if (!Number.isSafeInteger(task.timeoutMs) || task.timeoutMs < 1 || task.timeoutMs > 24 * 60 * 60 * 1000 || !Number.isSafeInteger(task.maxOutputBytes) || task.maxOutputBytes < 1 || task.maxOutputBytes > 64 * 1024 * 1024 || !Array.isArray(task.args) || task.args.length > 256 || task.args.some((arg) => typeof arg !== 'string' || arg.length > 8192 || /[\u0000\r\n]/.test(arg)) || (task.expectedArtifactIds ?? []).some((id) => typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) || new Set(task.expectedArtifactIds ?? []).size !== (task.expectedArtifactIds ?? []).length) { results.push({ taskId: task.id, status: 'BLOCKED', diagnostics: ['Task arguments, artifact identifiers or execution limits are invalid.'] }); continue; }
      try {
        const process = await this.host.run({ executable: tool.executable, args: [...task.args], workingDirectoryToken: profile.workingDirectoryToken, timeoutMs: task.timeoutMs, maxOutputBytes: task.maxOutputBytes,
          networkAllowed: false, filesystemScope: 'WORKING_COPY_ONLY', environmentAllowList: ['PATH', 'HOME', 'TMPDIR', 'LANG'], runAs: 'UNPRIVILEGED_ONLY', allowPrivilegeEscalation: false }, signal);
        const outputBytes = typeof process.stdout === 'string' && typeof process.stderr === 'string' ? new TextEncoder().encode(process.stdout).byteLength + new TextEncoder().encode(process.stderr).byteLength : Number.POSITIVE_INFINITY;
        const validMetrics = Number.isSafeInteger(process.exitCode) && Number.isFinite(process.elapsedMs) && process.elapsedMs >= 0 && (process.peakRamBytes === undefined || (Number.isFinite(process.peakRamBytes) && process.peakRamBytes >= 0));
        const outputValid = typeof process.stdout === 'string' && typeof process.stderr === 'string' && outputBytes <= task.maxOutputBytes && process.outputTruncated !== true;
        const okay = validMetrics && outputValid && process.outputTruncated !== true && process.exitCode === 0 && !process.timedOut && !process.cancelled && process.elapsedMs <= task.timeoutMs;
        results.push({ taskId: task.id, status: okay ? 'PASSED' : 'FAILED', process, diagnostics: okay ? [] : [`Process exit=${process.exitCode}, timeout=${process.timedOut}, cancelled=${process.cancelled}, elapsedMs=${process.elapsedMs}, outputBytes=${outputBytes}, outputTruncated=${process.outputTruncated}, metricsValid=${validMetrics}.`, process.stderr].filter(Boolean) });
        if (okay) passed.add(task.id);
      } catch (error) { results.push({ taskId: task.id, status: 'FAILED', diagnostics: [error instanceof Error ? error.message : String(error)] }); }
    }
    if (results.some((item) => item.status === 'FAILED' || item.status === 'BLOCKED' || item.status === 'SKIPPED') || passed.size !== ordered.length) return { buildId, status: results.some((item) => item.status === 'BLOCKED') ? 'BLOCKED' : 'BUILD_FAILED', tasks: results, verifiedArtifacts: [] };
    const verifiedArtifacts: BuildRunResult['verifiedArtifacts'] = [];
    if (signal?.aborted) return { buildId, status: 'BUILD_FAILED', tasks: results, verifiedArtifacts };
    for (const id of [...new Set(ordered.flatMap((task) => task.expectedArtifactIds ?? []))]) {
      let verification: Awaited<ReturnType<ArtifactVerificationProvider['verify']>>;
      try { verification = await this.artifacts.verify(id, profile.workingDirectoryToken); }
      catch (error) { return { buildId, status: 'VERIFICATION_FAILED', tasks: results, verifiedArtifacts }; }
      if (!verification.valid || !Number.isSafeInteger(verification.sizeBytes) || verification.sizeBytes < 1 || !/^[a-f0-9]{64}$/i.test(verification.sha256)) return { buildId, status: 'VERIFICATION_FAILED', tasks: results, verifiedArtifacts };
      verifiedArtifacts.push({ id, sizeBytes: verification.sizeBytes, sha256: verification.sha256.toLowerCase() });
    }
    return { buildId, status: 'BUILT_AND_VERIFIED', tasks: results, verifiedArtifacts };
  }
}
function topological(tasks: readonly BuildTask[]): BuildTask[] {
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 256) throw new Error('Build profile must contain between 1 and 256 tasks.');
  const map = new Map<string, BuildTask>();
  for (const task of tasks) { if (!task || !/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(task.id) || map.has(task.id) || typeof task.toolchainId !== 'string' || !task.toolchainId.trim() || !Array.isArray(task.dependsOn) || task.dependsOn.some((dep: string) => typeof dep !== 'string' || !dep.trim()) || new Set(task.dependsOn).size !== task.dependsOn.length) throw new Error('Build task identity or dependencies are invalid or duplicated.'); map.set(task.id, task); }
  const visiting = new Set<string>(), visited = new Set<string>(), result: BuildTask[] = [];
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`Build dependency cycle detected at '${id}'.`);
    if (visited.has(id)) return;
    const task = map.get(id); if (!task) throw new Error(`Build task dependency '${id}' does not exist.`);
    visiting.add(id); for (const dep of task.dependsOn) visit(dep); visiting.delete(id); visited.add(id); result.push(task);
  };
  for (const task of tasks) visit(task.id);
  return result;
}
