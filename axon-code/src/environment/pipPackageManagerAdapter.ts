import { PackageManagerAdapter, PackageManagerProbe, PackageRequirement, sha256Hex } from './packageManager.js';

export interface PipProcessResult { exitCode: number; stdout: string; stderr: string; }
export interface PipEnvironmentTransaction {
  readonly root: string;
  writeText(relativePath: string, value: string): Promise<void>;
  runPip(args: readonly string[], indexUrl: string): Promise<PipProcessResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
export interface PipPackageManagerHost {
  probe(): Promise<{ available: boolean; wheelOnly: boolean; notes: string[] }>;
  beginEnvironment(environmentId: string): Promise<PipEnvironmentTransaction>;
}
function validEnvironmentId(value: string): boolean { return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value); }
function validName(value: string): boolean { return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value); }

/** Real pip adapter. It accepts only exact, hash-pinned wheel requirements from an explicitly approved local index. */
export class PipPackageManagerAdapter implements PackageManagerAdapter {
  readonly id = 'pip-local-index';
  constructor(private readonly host: PipPackageManagerHost) {}
  async probe(): Promise<PackageManagerProbe> {
    const result = await this.host.probe();
    return {
      available: result.available,
      isolatedEnvironment: false,
      verifiedSources: [],
      lifecycleScriptsCanBeDisabled: result.wheelOnly,
      childProcessConfinement: false,
      notes: [...result.notes, 'T2 host result only: pip runs as the host OS user. No OS process confinement or hostile-code isolation is claimed; PackagePlanService execution remains blocked until a confined host provider exists.']
    };
  }
  async install(input: { environmentId: string; requirements: readonly PackageRequirement[]; allowedSources: readonly string[]; lifecycleScripts: false; networkAllowed: boolean; unprivileged: true; maxInstallBytes: number }): Promise<{ success: boolean; installed: string[]; diagnostics: string[] }> {
    if (!validEnvironmentId(input.environmentId) || input.lifecycleScripts !== false || input.networkAllowed !== true || input.unprivileged !== true || !Number.isSafeInteger(input.maxInstallBytes) || input.maxInstallBytes < 1 || !input.requirements.length) return { success: false, installed: [], diagnostics: ['Invalid or unsafe pip installation request.'] };
    const lines: string[] = [];
    for (const requirement of input.requirements) {
      const expectedSha256 = requirement.expectedSha256;
      if (requirement.ecosystem.toLowerCase() !== 'python' || !validName(requirement.name) || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:[A-Za-z0-9.+!-]*)$/.test(requirement.version) || !expectedSha256 || !/^[a-f0-9]{64}$/i.test(expectedSha256) || !input.allowedSources.includes(requirement.source)) return { success: false, installed: [], diagnostics: ['Pip requirements must use exact versions, SHA-256 pins and an explicitly approved index URL.'] };
      let source: URL;
      try { source = new URL(requirement.source); } catch { return { success: false, installed: [], diagnostics: ['Pip index URL is malformed.'] }; }
      if (!['http:', 'https:'].includes(source.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(source.hostname)) return { success: false, installed: [], diagnostics: ['Pip T2 proof accepts only a loopback local package index.'] };
      lines.push(`${requirement.name}==${requirement.version} --hash=sha256:${expectedSha256.toLowerCase()}`);
    }
    let transaction: PipEnvironmentTransaction | null = null;
    try {
      transaction = await this.host.beginEnvironment(input.environmentId);
      await transaction.writeText('requirements.txt', `${lines.join('\n')}\n`);
      const source = new URL(input.requirements[0]!.source);
      const result = await transaction.runPip(['install', '--require-hashes', '--no-deps', '--no-input', '--disable-pip-version-check', '--no-warn-script-location', '--index-url', source.href, '--target', `${transaction.root}/site-packages`, '-r', `${transaction.root}/requirements.txt`], source.href);
      if (result.exitCode !== 0) { await transaction.rollback(); return { success: false, installed: [], diagnostics: [`pip install failed (${result.exitCode}): ${result.stderr.slice(-4000)}`] }; }
      await transaction.commit();
      return { success: true, installed: input.requirements.map(row => `${row.name}==${row.version}`), diagnostics: ['Real pip installed hash-pinned wheel(s) from the local PEP 503 index. T2 host proof only; no OS process confinement is claimed.'] };
    } catch (error) { if (transaction) await transaction.rollback().catch(() => undefined); return { success: false, installed: [], diagnostics: [`Pip transactional install failed: ${String(error)}`] }; }
  }
  async verifyArtifact(bytes: Uint8Array, expectedSha256: string): Promise<boolean> {
    if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) return false;
    return (await sha256Hex(bytes)).toLowerCase() === expectedSha256.toLowerCase();
  }
}
