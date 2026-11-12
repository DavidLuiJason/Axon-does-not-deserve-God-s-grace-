import { PackageManagerAdapter, PackageManagerProbe, PackageRequirement, sha256Hex } from './packageManager.js';

export interface NpmProcessResult { exitCode: number; stdout: string; stderr: string; }
export interface NpmEnvironmentTransaction {
  readonly root: string;
  readonly cacheDir: string;
  writeText(relativePath: string, value: string): Promise<void>;
  readText(relativePath: string): Promise<string | null>;
  runNpm(args: readonly string[], registryUrl: string, offline: boolean): Promise<NpmProcessResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
export interface NpmPackageManagerHost {
  probe(): Promise<{ available: boolean; stagingTransactions: boolean; fixedNpmExecutable: boolean; scriptsCanBeDisabled: boolean; notes: string[] }>;
  beginEnvironment(environmentId: string): Promise<NpmEnvironmentTransaction>;
  fetchBytes(url: string, maxBytes: number): Promise<Uint8Array>;
}
interface RegistryVersionMetadata {
  name?: string;
  version?: string;
  dist?: { tarball?: string; integrity?: string };
  versions?: Record<string, { name?: string; version?: string; dist?: { tarball?: string; integrity?: string } }>;
}

function validEnvironmentId(value: string): boolean { return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value); }
function safePackageName(value: string): boolean { return /^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/i.test(value) && !value.includes('..'); }
function originOf(value: string): string | null { try { const url = new URL(value); return url.origin; } catch { return null; } }

/** Real npm CLI adapter. The host supplies a fixed-executable runner and transactional filesystem staging. */
export class NpmPackageManagerAdapter implements PackageManagerAdapter {
  readonly id = 'npm-local-registry';
  private readonly registryOrigin: string;
  constructor(private readonly host: NpmPackageManagerHost, private readonly registryUrl: string) {
    const parsed = new URL(registryUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Npm registry URL is invalid.');
    this.registryOrigin = parsed.origin;
  }

  async probe(): Promise<PackageManagerProbe> {
    const result = await this.host.probe();
    return {
      available: result.available,
      isolatedEnvironment: false,
      verifiedSources: [this.registryUrl],
      lifecycleScriptsCanBeDisabled: result.scriptsCanBeDisabled,
      childProcessConfinement: false,
      notes: [...result.notes, 'The adapter uses transactional per-environment staging and a fixed npm executable, but npm still runs with the host OS user privileges. This is not process confinement or a hostile-code isolation grade; PackagePlanService must refuse managed execution until a confined host provider exists.']
    };
  }

  async install(input: { environmentId: string; requirements: readonly PackageRequirement[]; allowedSources: readonly string[]; lifecycleScripts: false; networkAllowed: boolean; unprivileged: true; maxInstallBytes: number }): Promise<{ success: boolean; installed: string[]; diagnostics: string[] }> {
    if (!validEnvironmentId(input.environmentId) || input.lifecycleScripts !== false || input.networkAllowed !== true || input.unprivileged !== true || !Number.isSafeInteger(input.maxInstallBytes) || input.maxInstallBytes < 1 || !input.requirements.length) return { success: false, installed: [], diagnostics: ['Invalid or unsafe npm installation request.'] };
    const requirements = [...input.requirements];
    const seen = new Set<string>();
    let totalBytes = 0;
    const verified: Array<{ requirement: PackageRequirement; integrity: string }> = [];
    try {
      for (const requirement of requirements) {
        const expectedSha256 = requirement.expectedSha256;
        if (requirement.ecosystem.toLowerCase() !== 'node' || !safePackageName(requirement.name) || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(requirement.version) || !expectedSha256 || !/^[a-f0-9]{64}$/i.test(expectedSha256) || originOf(requirement.source) !== this.registryOrigin || !input.allowedSources.includes(requirement.source)) return { success: false, installed: [], diagnostics: ['Npm requirements must use exact versions, SHA-256 pins and the approved local registry source.'] };
        const key = `${requirement.name.toLowerCase()}@${requirement.version}`;
        if (seen.has(key)) return { success: false, installed: [], diagnostics: ['Duplicate npm package requirement refused.'] };
        seen.add(key);
        const metadataUrl = new URL(encodeURIComponent(requirement.name), this.registryUrl.endsWith('/') ? this.registryUrl : `${this.registryUrl}/`).href;
        const metadataBytes = await this.host.fetchBytes(metadataUrl, 2 * 1024 * 1024);
        let metadata: RegistryVersionMetadata;
        try { metadata = JSON.parse(new TextDecoder().decode(metadataBytes)) as RegistryVersionMetadata; } catch { return { success: false, installed: [], diagnostics: ['Local npm registry returned malformed package metadata.'] }; }
        const versionMetadata = metadata.versions?.[requirement.version] ?? metadata;
        if (metadata.name !== requirement.name || versionMetadata.name !== requirement.name || versionMetadata.version !== requirement.version || !versionMetadata.dist?.tarball || !versionMetadata.dist.integrity || !versionMetadata.dist.integrity.startsWith('sha512-')) return { success: false, installed: [], diagnostics: ['Local npm registry metadata is missing the exact package version or SHA-512 integrity.'] };
        if (originOf(versionMetadata.dist.tarball) !== this.registryOrigin) return { success: false, installed: [], diagnostics: ['Npm registry tarball redirected outside the approved registry origin.'] };
        const tarball = await this.host.fetchBytes(versionMetadata.dist.tarball, input.maxInstallBytes);
        totalBytes += tarball.byteLength;
        if (totalBytes > input.maxInstallBytes) return { success: false, installed: [], diagnostics: ['Npm artifacts exceed the approved installation byte budget.'] };
        if ((await sha256Hex(tarball)).toLowerCase() !== expectedSha256.toLowerCase()) return { success: false, installed: [], diagnostics: [`Npm tarball SHA-256 mismatch for ${requirement.name}@${requirement.version}.`] };
        verified.push({ requirement, integrity: versionMetadata.dist.integrity });
      }
    } catch (error) { return { success: false, installed: [], diagnostics: [`Npm registry verification failed: ${String(error)}`] }; }

    let transaction: NpmEnvironmentTransaction | null = null;
    try {
      transaction = await this.host.beginEnvironment(input.environmentId);
      const dependencies: Record<string, string> = {};
      for (const row of verified) dependencies[row.requirement.name] = row.requirement.version;
      await transaction.writeText('package.json', `${JSON.stringify({ name: 'axon-managed-environment', private: true, version: '1.0.0', dependencies }, null, 2)}\n`);
      const result = await transaction.runNpm(['install', '--registry', this.registryUrl, '--ignore-scripts', '--no-audit', '--no-fund', '--no-progress', '--save-exact', '--package-lock=true'], this.registryUrl, false);
      if (result.exitCode !== 0) { await transaction.rollback(); return { success: false, installed: [], diagnostics: [`npm install failed (${result.exitCode}): ${result.stderr.slice(-4000)}`] }; }
      const lockText = await transaction.readText('package-lock.json');
      if (!lockText) { await transaction.rollback(); return { success: false, installed: [], diagnostics: ['npm did not create a package-lock.json.'] }; }
      const lock = JSON.parse(lockText) as { packages?: Record<string, { version?: string; resolved?: string; integrity?: string }> };
      for (const row of verified) {
        const entry = lock.packages?.[`node_modules/${row.requirement.name}`];
        if (entry?.version !== row.requirement.version || entry.integrity !== row.integrity || originOf(entry.resolved ?? '') !== this.registryOrigin) {
          await transaction.rollback();
          return { success: false, installed: [], diagnostics: [`npm lockfile integrity/source verification failed for ${row.requirement.name}@${row.requirement.version}.`] };
        }
      }
      await transaction.commit();
      return { success: true, installed: verified.map((row) => `${row.requirement.name}@${row.requirement.version}`), diagnostics: ['Real npm CLI install completed; lockfile SHA-512 and registry origin verified; lifecycle scripts disabled.'] };
    } catch (error) {
      if (transaction) await transaction.rollback().catch(() => undefined);
      return { success: false, installed: [], diagnostics: [`Npm transactional install failed: ${String(error)}`] };
    }
  }

  async reinstallOffline(environmentId: string): Promise<{ success: boolean; diagnostics: string[] }> {
    if (!validEnvironmentId(environmentId)) return { success: false, diagnostics: ['Invalid npm environment identity.'] };
    let transaction: NpmEnvironmentTransaction | null = null;
    try {
      transaction = await this.host.beginEnvironment(environmentId);
      const lock = await transaction.readText('package-lock.json');
      if (!lock) { await transaction.rollback(); return { success: false, diagnostics: ['Offline npm reinstall requires an existing lockfile.'] }; }
      const parsed = JSON.parse(lock) as { lockfileVersion?: number; packages?: Record<string, unknown> };
      if (!parsed.packages || !Number.isInteger(parsed.lockfileVersion)) { await transaction.rollback(); return { success: false, diagnostics: ['Offline npm lockfile is malformed.'] }; }
      const result = await transaction.runNpm(['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-progress'], this.registryUrl, true);
      if (result.exitCode !== 0) { await transaction.rollback(); return { success: false, diagnostics: [`npm ci --offline failed (${result.exitCode}): ${result.stderr.slice(-4000)}`] }; }
      await transaction.commit();
      return { success: true, diagnostics: ['Real npm ci --offline restored the locked environment from the local npm cache.'] };
    } catch (error) { if (transaction) await transaction.rollback().catch(() => undefined); return { success: false, diagnostics: [`Offline npm reinstall failed: ${String(error)}`] }; }
  }

  async remove(environmentId: string, packageName: string): Promise<{ success: boolean; diagnostics: string[] }> {
    if (!validEnvironmentId(environmentId) || !safePackageName(packageName)) return { success: false, diagnostics: ['Invalid npm removal request.'] };
    let transaction: NpmEnvironmentTransaction | null = null;
    try {
      transaction = await this.host.beginEnvironment(environmentId);
      const result = await transaction.runNpm(['uninstall', packageName, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-progress'], this.registryUrl, true);
      if (result.exitCode !== 0) { await transaction.rollback(); return { success: false, diagnostics: [`npm uninstall failed (${result.exitCode}): ${result.stderr.slice(-4000)}`] }; }
      await transaction.commit();
      return { success: true, diagnostics: [`Real npm uninstall removed ${packageName}.`] };
    } catch (error) { if (transaction) await transaction.rollback().catch(() => undefined); return { success: false, diagnostics: [`Npm removal failed: ${String(error)}`] }; }
  }
}
