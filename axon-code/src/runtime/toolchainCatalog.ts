export type ToolchainId = 'node' | 'python' | 'clang' | 'gcc' | 'cmake' | 'ninja' | 'rustc' | 'cargo' | 'jdk' | 'gradle' | 'android-sdk' | 'android-ndk' | 'unity' | 'unreal' | 'wasm-runtime';
export interface ToolchainProfile {
  id: ToolchainId;
  label: string;
  ecosystems: readonly string[];
  executableCandidates: readonly string[];
  hostTargets: readonly string[];
  status: 'PROVIDER_REQUIRED' | 'OPTIONAL' | 'NOT_IMPLEMENTED';
  notes: readonly string[];
}
/** Declarative host toolchain catalogue. Presence in this list does not mean a compiler/runtime is installed or sandboxed. */
export const TOOLCHAIN_CATALOG: readonly ToolchainProfile[] = Object.freeze([
  { id: 'node', label: 'Node.js', ecosystems: ['NODE', 'TYPESCRIPT'], executableCandidates: ['node'], hostTargets: ['android', 'windows', 'linux', 'macos', 'server'], status: 'PROVIDER_REQUIRED', notes: ['Requires a verified host process provider and project-specific dependency environment.'] },
  { id: 'python', label: 'CPython', ecosystems: ['PYTHON'], executableCandidates: ['python3', 'python'], hostTargets: ['android', 'windows', 'linux', 'macos', 'server'], status: 'PROVIDER_REQUIRED', notes: ['No bundled interpreter; isolated host runtime and package environment required.'] },
  { id: 'clang', label: 'Clang C/C++', ecosystems: ['C', 'CPP'], executableCandidates: ['clang', 'clang++'], hostTargets: ['android', 'windows', 'linux', 'macos', 'server'], status: 'PROVIDER_REQUIRED', notes: ['Compiler, linker and isolated executable runtime required.'] },
  { id: 'gcc', label: 'GCC', ecosystems: ['C', 'CPP'], executableCandidates: ['gcc', 'g++'], hostTargets: ['linux', 'server', 'android'], status: 'PROVIDER_REQUIRED', notes: ['Host availability and libc/ABI compatibility must be verified.'] },
  { id: 'cmake', label: 'CMake', ecosystems: ['CPP', 'C'], executableCandidates: ['cmake'], hostTargets: ['android', 'windows', 'linux', 'macos', 'server'], status: 'PROVIDER_REQUIRED', notes: ['Requires a compatible generator and native build tool.'] },
  { id: 'ninja', label: 'Ninja', ecosystems: ['CPP', 'ANDROID'], executableCandidates: ['ninja'], hostTargets: ['android', 'windows', 'linux', 'macos', 'server'], status: 'OPTIONAL', notes: ['Used by supported CMake/NDK build profiles.'] },
  { id: 'rustc', label: 'Rust compiler', ecosystems: ['RUST'], executableCandidates: ['rustc'], hostTargets: ['android', 'windows', 'linux', 'macos', 'server'], status: 'PROVIDER_REQUIRED', notes: ['Target triples, linker and Cargo dependency source must match host.'] },
  { id: 'cargo', label: 'Cargo', ecosystems: ['RUST'], executableCandidates: ['cargo'], hostTargets: ['android', 'windows', 'linux', 'macos', 'server'], status: 'PROVIDER_REQUIRED', notes: ['Offline/locked dependency resolution should be preferred for reproducibility.'] },
  { id: 'jdk', label: 'JDK', ecosystems: ['JAVA', 'KOTLIN', 'ANDROID'], executableCandidates: ['java', 'javac'], hostTargets: ['android', 'windows', 'linux', 'macos', 'server'], status: 'PROVIDER_REQUIRED', notes: ['Toolchain version must match project and Gradle requirements.'] },
  { id: 'gradle', label: 'Gradle', ecosystems: ['JAVA', 'KOTLIN', 'ANDROID'], executableCandidates: ['gradle', 'gradlew'], hostTargets: ['android', 'windows', 'linux', 'macos', 'server'], status: 'PROVIDER_REQUIRED', notes: ['Wrapper distribution integrity and offline cache must be verified.'] },
  { id: 'android-sdk', label: 'Android SDK', ecosystems: ['ANDROID'], executableCandidates: ['sdkmanager', 'aapt2', 'apksigner'], hostTargets: ['windows', 'linux', 'macos', 'server'], status: 'PROVIDER_REQUIRED', notes: ['A proper host build environment is required; APK execution on Android is a separate capability.'] },
  { id: 'android-ndk', label: 'Android NDK', ecosystems: ['ANDROID', 'CPP'], executableCandidates: ['ndk-build', 'clang++'], hostTargets: ['windows', 'linux', 'macos', 'server'], status: 'PROVIDER_REQUIRED', notes: ['ABI, API level and native libraries must be checked.'] },
  { id: 'unity', label: 'Unity Editor', ecosystems: ['UNITY'], executableCandidates: ['Unity'], hostTargets: ['windows', 'linux', 'macos'], status: 'NOT_IMPLEMENTED', notes: ['Project inspection is distinct from an operational Unity build/runtime provider.'] },
  { id: 'unreal', label: 'Unreal Engine', ecosystems: ['UNREAL'], executableCandidates: ['UnrealEditor', 'UnrealBuildTool'], hostTargets: ['windows', 'linux', 'macos'], status: 'NOT_IMPLEMENTED', notes: ['Requires engine installation, platform SDKs and verified build/runtime adapters.'] },
  { id: 'wasm-runtime', label: 'WebAssembly Runtime', ecosystems: ['WASM'], executableCandidates: ['wasmtime', 'wasmer'], hostTargets: ['browser', 'windows', 'linux', 'macos', 'server'], status: 'PROVIDER_REQUIRED', notes: ['The prior browser worker profile is narrow; general WASI is a separate runtime.'] }
]);
export function getToolchainProfile(id: ToolchainId): ToolchainProfile { const profile = TOOLCHAIN_CATALOG.find((item) => item.id === id); if (!profile) throw new Error(`Unknown toolchain '${id}'.`); return { ...profile, ecosystems: [...profile.ecosystems], executableCandidates: [...profile.executableCandidates], hostTargets: [...profile.hostTargets], notes: [...profile.notes] }; }
