import { normalizeProjectPath } from '../pathSafety.js';
import type { HostPlatform } from '../runtime/platformCapabilities.js';

export type ProjectEcosystem = 'NODE' | 'PYTHON' | 'CPP' | 'RUST' | 'ANDROID' | 'JAVA' | 'KOTLIN' | 'UNITY' | 'UNREAL' | 'WEB' | 'MIXED' | 'UNKNOWN';
export interface DetectedPackage { name: string; requestedVersion: string; source: string; optional: boolean; }
export interface EnvironmentRequirement { component: string; version?: string; required: boolean; reason: string; }
export interface ProjectEnvironmentProfile {
  projectId: string;
  ecosystems: ProjectEcosystem[];
  entryPoints: string[];
  manifests: string[];
  lockfiles: string[];
  packages: DetectedPackage[];
  requirements: EnvironmentRequirement[];
  scripts: Array<{ name: string; command: string; source: string }>;
  warnings: string[];
  fingerprintInputs: string[];
}
export interface ProjectFileSnapshot { path: string; content: string; }

function lines(text: string): string[] { return text.replace(/\r\n?/g, '\n').split('\n'); }
function safeFiles(files: readonly ProjectFileSnapshot[], maxTotalBytes: number): Map<string, string> {
  if (!Array.isArray(files)) throw new Error('Project files must be an array.');
  const result = new Map<string, string>();
  const portablePaths = new Set<string>();
  const encoder = new TextEncoder();
  let totalBytes = 0;
  for (const file of files) {
    if (!file || typeof file !== 'object' || typeof file.path !== 'string' || typeof file.content !== 'string') throw new Error('Project file entries require string paths and contents.');
    const path = normalizeProjectPath(file.path);
    if (!path || path !== file.path) throw new Error(`Unsafe or invalid project file '${file.path}'.`);
    if (result.has(path)) throw new Error(`Duplicate project file '${path}'.`);
    const portable = path.toLocaleLowerCase('en-US');
    if (portablePaths.has(portable)) throw new Error(`Case-insensitive path collision at '${path}'.`);
    portablePaths.add(portable);
    const size = encoder.encode(file.content).byteLength;
    if (size > 16 * 1024 * 1024) throw new Error(`Project file '${path}' exceeds the analysis limit.`);
    totalBytes += size;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > maxTotalBytes) throw new Error('Project exceeds the environment-inspection byte limit.');
    result.set(path, file.content);
  }
  return result;
}
function addRequirement(target: EnvironmentRequirement[], component: string, version: string | undefined, reason: string): void {
  const existing = target.find((item) => item.component === component);
  if (!existing) target.push({ component, ...(version ? { version } : {}), required: true, reason });
  else if (!existing.version && version) { existing.version = version; existing.reason = reason; }
}

/** Deterministic project/environment inspection. It reads manifests; it never installs or executes their scripts. */
export class EnvironmentIntelligence {
  constructor(private readonly limits: { maxFiles: number; maxTotalBytes: number } = { maxFiles: 20_000, maxTotalBytes: 64 * 1024 * 1024 }) {
    if (!Number.isSafeInteger(limits.maxFiles) || limits.maxFiles < 1 || !Number.isSafeInteger(limits.maxTotalBytes) || limits.maxTotalBytes < 1) throw new Error('Invalid environment-inspection limits.');
  }
  inspect(projectId: string, inputFiles: readonly ProjectFileSnapshot[]): ProjectEnvironmentProfile {
    if (!projectId.trim() || projectId.length > 200) throw new Error('Invalid project ID.');
    if (!Array.isArray(inputFiles) || inputFiles.length > this.limits.maxFiles) throw new Error('Project exceeds the environment-inspection file limit or is not an array.');
    const files = safeFiles(inputFiles, this.limits.maxTotalBytes);
    const paths = [...files.keys()].sort();
    const ecosystems = new Set<ProjectEcosystem>();
    const manifests: string[] = [], lockfiles: string[] = [], packages: DetectedPackage[] = [], requirements: EnvironmentRequirement[] = [], scripts: ProjectEnvironmentProfile['scripts'] = [], warnings: string[] = [], entryPoints: string[] = [];

    const packageJson = files.get('package.json');
    if (packageJson !== undefined) {
      manifests.push('package.json'); ecosystems.add('NODE'); addRequirement(requirements, 'node', undefined, 'package.json project runtime');
      let parsed: Record<string, unknown>;
      try { const value: unknown = JSON.parse(packageJson); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('root must be an object'); parsed = value as Record<string, unknown>; }
      catch (error) { warnings.push(`package.json is invalid: ${error instanceof Error ? error.message : String(error)}`); parsed = {}; }
      const engines = parsed['engines'];
      if (engines && typeof engines === 'object' && !Array.isArray(engines)) {
        const node = (engines as Record<string, unknown>)['node']; if (typeof node === 'string') addRequirement(requirements, 'node', node, 'package.json engines.node');
      }
      const deps = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
      for (const field of deps) {
        const value = parsed[field]; if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        for (const [name, version] of Object.entries(value as Record<string, unknown>)) if (typeof version === 'string') packages.push({ name, requestedVersion: version, source: `package.json:${field}`, optional: field === 'optionalDependencies' });
      }
      const scriptObject = parsed['scripts'];
      if (scriptObject && typeof scriptObject === 'object' && !Array.isArray(scriptObject)) for (const [name, command] of Object.entries(scriptObject as Record<string, unknown>)) if (typeof command === 'string') scripts.push({ name, command, source: 'package.json' });
      const main = typeof parsed['main'] === 'string' ? parsed['main'] : undefined;
      if (main && files.has(main)) entryPoints.push(main);
      if (files.has('src/main.ts')) entryPoints.push('src/main.ts');
      if (files.has('src/index.ts')) entryPoints.push('src/index.ts');
      if (files.has('src/index.js')) entryPoints.push('src/index.js');
      for (const lock of ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']) if (files.has(lock)) lockfiles.push(lock);
      if (!lockfiles.length) warnings.push('Node dependencies have no recognised lockfile; reproducible installation is not established.');
    }

    for (const [path, content] of files) {
      if (path === 'requirements.txt' || path.endsWith('/requirements.txt')) {
        ecosystems.add('PYTHON'); manifests.push(path); addRequirement(requirements, 'python', undefined, `${path} Python requirements`);
        for (const raw of lines(content)) { const value = raw.trim(); if (!value || value.startsWith('#') || value.startsWith('-')) continue; const match = /^([A-Za-z0-9_.-]+)\s*(.*)$/.exec(value); if (match) packages.push({ name: match[1]!, requestedVersion: match[2]!.trim() || '*', source: path, optional: false }); }
      }
      if (path === 'pyproject.toml') {
        ecosystems.add('PYTHON'); manifests.push(path); addRequirement(requirements, 'python', undefined, `${path} Python requirements`);
        if (/\[build-system\]/.test(content)) addRequirement(requirements, 'python-build-backend', undefined, 'pyproject.toml build-system');
        const version = /requires-python\s*=\s*["']([^"']+)/.exec(content)?.[1]; addRequirement(requirements, 'python', version, 'pyproject.toml project.requires-python');
      }
      if (path === 'Cargo.toml' || path.endsWith('/Cargo.toml')) {
        ecosystems.add('RUST'); manifests.push(path); addRequirement(requirements, 'rustc', undefined, `${path} Cargo manifest`); addRequirement(requirements, 'cargo', undefined, `${path} Cargo manifest`);
        if (path === 'Cargo.toml') entryPoints.push('src/main.rs');
      }
      if (/^(?:CMakeLists\.txt|[^/]+\.cpp|[^/]+\.cc|[^/]+\.cxx)$/.test(path) || /\.(?:cpp|cc|cxx|hpp|h)$/.test(path)) {
        ecosystems.add('CPP'); if (path === 'CMakeLists.txt') { manifests.push(path); addRequirement(requirements, 'cmake', undefined, 'CMake project'); }
        if (/\.(?:cpp|cc|cxx)$/.test(path)) entryPoints.push(path);
        addRequirement(requirements, 'c++-compiler', undefined, 'C/C++ project source');
      }
      if (/\.(?:java)$/.test(path)) { ecosystems.add('JAVA'); addRequirement(requirements, 'jdk', undefined, 'Java source file'); }
      if (/\.(?:kt|kts)$/.test(path)) { ecosystems.add('KOTLIN'); addRequirement(requirements, 'jdk', undefined, 'Kotlin source file'); }
      if (/^build\.gradle(?:\.kts)?$/.test(path) || path === 'settings.gradle' || path === 'settings.gradle.kts' || path === 'gradlew') {
        if (!manifests.includes(path)) manifests.push(path); if (path.includes('gradle')) { addRequirement(requirements, 'gradle', undefined, 'Gradle build files'); addRequirement(requirements, 'jdk', undefined, 'Gradle build files'); }
      }
      if (path === 'gradlew') lockfiles.push(path);
      if (path === 'ProjectSettings/ProjectVersion.txt' && [...files.keys()].some((item) => item.startsWith('Assets/'))) { ecosystems.add('UNITY'); manifests.push(path); addRequirement(requirements, 'unity-editor', undefined, 'Unity project settings'); }
      if (path.endsWith('.uproject')) { ecosystems.add('UNREAL'); manifests.push(path); addRequirement(requirements, 'unreal-engine', undefined, 'Unreal project descriptor'); }
      if (path === 'index.html' || path.endsWith('.html')) ecosystems.add('WEB');
    }
    // Android is identified from project-level evidence, not merely because a Kotlin/Java file exists.
    const hasAndroidManifest = [...files.keys()].some((path) => /(?:^|\/)src\/main\/AndroidManifest\.xml$/.test(path) || path === 'AndroidManifest.xml');
    const hasAndroidGradlePlugin = [...files.entries()].some(([path, content]) =>
      /(?:^|\/)build\.gradle(?:\.kts)?$/.test(path) &&
      /com\.android\.(?:application|library)|id\s*\(?\s*["']com\.android\.(?:application|library)["']/.test(content));
    if (hasAndroidManifest && hasAndroidGradlePlugin) {
      ecosystems.add('ANDROID');
      addRequirement(requirements, 'android-sdk', undefined, 'Android manifest and Android Gradle plugin detected');
      addRequirement(requirements, 'gradle', undefined, 'Android Gradle project');
      addRequirement(requirements, 'jdk', undefined, 'Android Gradle project');
      const manifest = [...files.keys()].find((path) => path.endsWith('src/main/AndroidManifest.xml') || path === 'AndroidManifest.xml');
      if (manifest && !manifests.includes(manifest)) manifests.push(manifest);
    }
    if (ecosystems.size > 1) ecosystems.add('MIXED');
    if ([...files.keys()].some((path) => path.endsWith('.py'))) { ecosystems.add('PYTHON'); addRequirement(requirements, 'python', undefined, 'Python source files'); }
    if (!entryPoints.length) {
      for (const candidate of ['main.py', 'app.py', 'src/main.py', 'src/main.rs', 'src/main.cpp', 'main.cpp', 'index.html']) if (files.has(candidate)) entryPoints.push(candidate);
    }
    return { projectId, ecosystems: [...ecosystems].sort(), entryPoints: [...new Set(entryPoints)].sort(), manifests: [...new Set(manifests)].sort(), lockfiles: [...new Set(lockfiles)].sort(), packages: packages.sort((a, b) => a.name.localeCompare(b.name)), requirements, scripts: scripts.sort((a, b) => a.name.localeCompare(b.name)), warnings, fingerprintInputs: paths };
  }
}

export interface HostEnvironmentSnapshot {
  platform: HostPlatform;
  architecture: string;
  availableRuntimes: readonly string[];
  availableToolchains: readonly string[];
  availableStorageBytes: number;
  availableMemoryBytes: number;
  networkAvailable: boolean;
  offlineCacheAvailable: boolean;
}
export interface EnvironmentCompatibilityResult { compatible: boolean; missing: string[]; warnings: string[]; estimatedMinimumStorageBytes: number; estimatedMinimumMemoryBytes: number; }

export class EnvironmentCompatibilityService {
  evaluate(profile: ProjectEnvironmentProfile, host: HostEnvironmentSnapshot): EnvironmentCompatibilityResult {
    if (!Number.isSafeInteger(host.availableStorageBytes) || host.availableStorageBytes < 0 || !Number.isSafeInteger(host.availableMemoryBytes) || host.availableMemoryBytes < 0) throw new Error('Host resource measurements are invalid.');
    const available = new Set([...host.availableRuntimes, ...host.availableToolchains].map((item) => item.toLowerCase()));
    const missing = profile.requirements.map((requirement) => requirement.component).filter((component) => !available.has(component.toLowerCase()));
    const warnings = [...profile.warnings];
    if (profile.packages.length && !host.networkAvailable && !host.offlineCacheAvailable) warnings.push('Dependencies are required but neither network access nor an offline cache is available.');
    const estimatedMinimumStorageBytes = Math.max(32 * 1024 * 1024, profile.packages.length * 1024 * 1024);
    const estimatedMinimumMemoryBytes = profile.ecosystems.includes('UNREAL') || profile.ecosystems.includes('UNITY') ? 2 * 1024 * 1024 * 1024 : profile.ecosystems.includes('CPP') ? 256 * 1024 * 1024 : 64 * 1024 * 1024;
    if (host.availableStorageBytes < estimatedMinimumStorageBytes) warnings.push('Available storage is below the conservative preparation estimate.');
    if (host.availableMemoryBytes < estimatedMinimumMemoryBytes) warnings.push('Available RAM is below the conservative preparation estimate.');
    return { compatible: missing.length === 0 && host.availableStorageBytes >= estimatedMinimumStorageBytes && host.availableMemoryBytes >= estimatedMinimumMemoryBytes, missing: [...new Set(missing)], warnings, estimatedMinimumStorageBytes, estimatedMinimumMemoryBytes };
  }
}
