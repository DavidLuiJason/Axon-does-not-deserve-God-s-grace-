import { normalizeProjectPath } from '../pathSafety.js';

export interface VirtualProjectReader {
  listFiles(projectId: string): Promise<readonly string[]>;
  readText(projectId: string, path: string): Promise<string | null>;
}

export interface ProjectRequirement {
  id: string;
  present: boolean;
  detail: string;
}

export interface AndroidProjectInspection {
  detected: boolean;
  buildableByInspection: boolean;
  modules: string[];
  packageId?: string;
  minSdk?: number;
  targetSdk?: number;
  gradleWrapperPresent: boolean;
  manifestPresent: boolean;
  requirements: ProjectRequirement[];
  blockers: string[];
  notes: string[];
}

function safePaths(paths: readonly string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const raw of paths) {
    const path = normalizeProjectPath(raw);
    if (!path || path !== raw || seen.has(path)) continue;
    seen.add(path);
    output.push(path);
  }
  return output;
}

export async function inspectAndroidProject(reader: VirtualProjectReader, projectId: string): Promise<AndroidProjectInspection> {
  const paths = safePaths(await reader.listFiles(projectId));
  const hasSettings = paths.some((path) => /(^|\/)settings\.gradle(?:\.kts)?$/i.test(path));
  const buildFiles = paths.filter((path) => /(^|\/)build\.gradle(?:\.kts)?$/i.test(path));
  const wrapper = paths.some((path) => /(^|\/)gradlew(?:\.bat)?$/i.test(path));
  const manifestPath = paths.find((path) => /(^|\/)src\/main\/AndroidManifest\.xml$/i.test(path)) ??
    paths.find((path) => /(^|\/)AndroidManifest\.xml$/i.test(path));
  const androidDetected = hasSettings && buildFiles.length > 0 && Boolean(manifestPath);
  const blockers: string[] = [];
  const requirements: ProjectRequirement[] = [
    { id: 'settings-gradle', present: hasSettings, detail: 'Gradle settings file identifies the project and modules.' },
    { id: 'build-gradle', present: buildFiles.length > 0, detail: 'At least one Gradle build file is present.' },
    { id: 'gradle-wrapper', present: wrapper, detail: 'Gradle wrapper should be included and independently verified before use.' },
    { id: 'android-manifest', present: Boolean(manifestPath), detail: 'Android application manifest is present.' },
    { id: 'source-or-resource-tree', present: paths.some((path) => /(^|\/)(java|kotlin|res)\//i.test(path)), detail: 'Android source or resources are present.' }
  ];
  if (!hasSettings) blockers.push('Gradle settings file is missing.');
  if (!buildFiles.length) blockers.push('Gradle build file is missing.');
  if (!wrapper) blockers.push('Gradle wrapper is missing; a host-installed Gradle may be used only by explicit policy.');
  if (!manifestPath) blockers.push('AndroidManifest.xml is missing.');
  let manifest = '';
  if (manifestPath) manifest = (await reader.readText(projectId, manifestPath)) ?? '';
  const packageId = manifest.match(/\bpackage\s*=\s*["']([^"']+)["']/i)?.[1];
  const minSdk = Number(manifest.match(/android:minSdkVersion\s*=\s*["'](\d+)["']/i)?.[1]) || undefined;
  const targetSdk = Number(manifest.match(/android:targetSdkVersion\s*=\s*["'](\d+)["']/i)?.[1]) || undefined;
  if (manifest && !packageId) blockers.push('Manifest package identity was not found; namespace/applicationId must be resolved from Gradle configuration.');
  if (packageId && !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageId)) blockers.push('Manifest package identity is malformed.');
  const wrapperProperties = paths.find((path) => /(^|\/)gradle\/wrapper\/gradle-wrapper\.properties$/i.test(path));
  if (wrapper && !wrapperProperties) blockers.push('Gradle wrapper properties are missing.');
  const buildableByInspection = androidDetected && blockers.length === 0;
  return { detected: androidDetected, buildableByInspection, modules: buildFiles.map((path) => path.replace(/\/build\.gradle(?:\.kts)?$/i, '')),
    ...(packageId ? { packageId } : {}), ...(minSdk ? { minSdk } : {}), ...(targetSdk ? { targetSdk } : {}),
    gradleWrapperPresent: wrapper, manifestPresent: Boolean(manifestPath), requirements, blockers,
    notes: ['Inspection does not execute Gradle scripts.', 'A build still requires a compatible Android SDK, build-tools, Java, an isolated native build bridge, signing policy and APK verification.'] };
}

export interface GameEngineProjectInspection {
  engine: 'unity' | 'unreal' | 'unknown';
  detected: boolean;
  projectFiles: string[];
  requirements: ProjectRequirement[];
  blockers: string[];
  executionReady: false;
  notes: string[];
}

export async function inspectGameEngineProject(reader: VirtualProjectReader, projectId: string): Promise<GameEngineProjectInspection> {
  const paths = safePaths(await reader.listFiles(projectId));
  const unityProjectFile = paths.includes('ProjectSettings/ProjectVersion.txt');
  const unityManifest = paths.includes('Packages/manifest.json');
  const unrealProject = paths.filter((path) => path.toLowerCase().endsWith('.uproject'));
  const unityScore = Number(unityProjectFile) + Number(unityManifest) + Number(paths.some((path) => path.startsWith('Assets/')));
  const engine: GameEngineProjectInspection['engine'] = unrealProject.length && unityScore < 2 ? 'unreal' : unityScore >= 2 ? 'unity' : 'unknown';
  const projectFiles = engine === 'unity' ? paths.filter((path) => path.startsWith('Assets/') || path.startsWith('ProjectSettings/') || path.startsWith('Packages/')) :
    engine === 'unreal' ? paths.filter((path) => path.endsWith('.uproject') || path.startsWith('Source/') || path.startsWith('Content/') || path.startsWith('Config/')) : [];
  const blockers = engine === 'unknown' ? ['No reliable Unity or Unreal project markers were found.'] :
    engine === 'unity' ? ['Unity Editor/toolchain and project version compatibility have not been verified.', 'GPU, graphics API, assets and plugins require engine-side checks.'] :
      ['Unreal Engine installation/version and target platform toolchains have not been verified.', 'Plugins, native modules, assets and GPU capabilities require engine-side checks.'];
  return {
    engine, detected: engine !== 'unknown', projectFiles,
    requirements: engine === 'unity' ? [
      { id: 'project-version', present: unityProjectFile, detail: 'Unity ProjectSettings/ProjectVersion.txt is present.' },
      { id: 'package-manifest', present: unityManifest, detail: 'Unity package manifest is present.' },
      { id: 'assets', present: paths.some((path) => path.startsWith('Assets/')), detail: 'Unity Assets directory is present.' }
    ] : engine === 'unreal' ? [
      { id: 'uproject', present: unrealProject.length > 0, detail: 'Unreal .uproject descriptor is present.' },
      { id: 'source-or-content', present: paths.some((path) => path.startsWith('Source/') || path.startsWith('Content/')), detail: 'Unreal source or content directory is present.' },
      { id: 'config', present: paths.some((path) => path.startsWith('Config/')), detail: 'Unreal Config directory is present.' }
    ] : [],
    blockers, executionReady: false,
    notes: ['Recognition is not execution support.', 'No engine scripts, project code or build steps are run during inspection.']
  };
}
