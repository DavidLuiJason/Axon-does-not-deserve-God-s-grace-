/** Shared, language-neutral contracts. AXON Brain may send requests using these types;
 * AXON Code returns technical evidence and never chooses the user's goal. */

export type EvidenceLevel = 'CHECKED' | 'ADAPTER_REPORTED' | 'ESTIMATED' | 'UNKNOWN';
export type Severity = 'error' | 'warning' | 'info';
export type DiagnosticStage = 'project' | 'lexical' | 'syntax' | 'dependency' | 'runtime' | 'security' | 'verification' | 'resource';
export type AutoFixMode = 'OFF' | 'SUGGEST' | 'SAFE_AUTO_FIX';

export interface SourceLocation {
  file: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  startOffset?: number;
  endOffset?: number;
}

export interface CodeDiagnostic {
  id: string;
  code: string;
  severity: Severity;
  stage: DiagnosticStage;
  message: string;
  location?: SourceLocation;
  evidence: EvidenceLevel;
  confidence: 'high' | 'medium' | 'low';
  explanation?: string;
  suggestedAction?: string;
  related?: SourceLocation[];
}

export type SourceLanguage = 'javascript' | 'typescript' | 'json' | 'css' | 'html' | 'python' | 'cpp' | 'rust' | 'webassembly' | 'java' | 'csharp' | 'unknown';

export interface ProjectFileEntry {
  path: string;
  sizeBytes: number;
  kind: 'text' | 'binary';
  modifiedAt?: number;
}

/** A provider reads one file at a time. The analyser does not request the whole project as one blob. */
export interface ProjectSource {
  listFiles(): Promise<readonly ProjectFileEntry[]>;
  readTextFile(path: string, maxBytes: number): Promise<string | null>;
}

export interface AnalyzerLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalReadBytes: number;
}

export interface ImportReference {
  fromFile: string;
  specifier: string;
  resolvedFile?: string;
  kind: 'static' | 'dynamic-literal' | 'dynamic-nonliteral' | 'require';
  resolved: boolean;
}

export interface ProjectFileSummary {
  path: string;
  language: SourceLanguage;
  sizeBytes: number;
  inspected: boolean;
  reason?: string;
  imports: ImportReference[];
  declarations: Array<{ kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'export'; name: string; line: number }>;
  isLikelyEntryPoint: boolean;
}

export interface ProjectOutline {
  files: number;
  inspectedFiles: number;
  skippedFiles: number;
  languages: Partial<Record<SourceLanguage, number>>;
  entryPoints: string[];
  declarations: number;
  localDependencies: number;
  externalDependencies: string[];
  dynamicImportPresent: boolean;
  dependencyGraphComplete: boolean;
}

export interface ProjectAnalysis {
  projectName: string;
  files: ProjectFileSummary[];
  diagnostics: CodeDiagnostic[];
  outline: ProjectOutline;
  scannedBytes: number;
  truncated: boolean;
}

/** Optional deep language checker. A language-specific compiler can be plugged in later. */
export interface LanguageDiagnosticAdapter {
  id: string;
  supports(language: SourceLanguage): boolean;
  analyze(filePath: string, source: string): Promise<readonly CodeDiagnostic[]> | readonly CodeDiagnostic[];
}

export interface RuntimeDescriptor {
  id: string;
  label: string;
  languages: readonly SourceLanguage[];
  platforms: readonly string[];
  available: boolean;
  supportsStreaming: boolean;
  supportsCheckpoint: boolean;
  isolation: 'worker' | 'process' | 'container' | 'remote' | 'none';
  notes?: string[];
}

export interface DeviceResources {
  availableRamBytes: number;
  availableStorageBytes: number;
  cpuCores?: number;
  gpuAvailable?: boolean;
  networkAllowed: boolean;
  thermalState?: 'normal' | 'warm' | 'hot' | 'critical' | 'unknown';
  batteryPercent?: number;
}

export interface WorkloadRequirements {
  runtimeId: string;
  estimatedPeakRamBytes: number;
  requiredStorageBytes: number;
  gpuRequired?: boolean;
  canStreamAssets?: boolean;
  streamingWorkingSetBytes?: number;
  canChunkIndependentWork?: boolean;
  chunkWorkingSetBytes?: number;
  reducedQuality?: {
    label: string;
    estimatedPeakRamBytes: number;
    qualityChanges: string[];
  };
  remoteRuntimeId?: string;
}

export type ExecutionMode =
  | 'FULL_LOCAL'
  | 'STREAMED_LOCAL'
  | 'CHUNKED_LOCAL'
  | 'REDUCED_QUALITY_LOCAL'
  | 'REMOTE_REQUIRED'
  | 'WAIT_FOR_RESOURCES'
  | 'UNSUPPORTED';

export interface ExecutionPlan {
  mode: ExecutionMode;
  runtimeId: string;
  canStart: boolean;
  estimated: true;
  reasons: string[];
  qualityChanges: string[];
  requiredRamBytes: number;
  availableRamBytes: number;
  requiredStorageBytes: number;
  availableStorageBytes: number;
  confidence: 'low' | 'medium';
}

export interface ComponentBoundary {
  /** A named, owner/project-declared independently testable component. */
  id: string;
  entryFiles: string[];
  /** Must be explicitly true; import closure alone does not prove isolation safety. */
  sideEffectFree: boolean;
  /** Declares that all dynamic dependencies for this component are enumerated. */
  dynamicDependenciesDeclared: boolean;
}

export interface SelectiveExecutionPlan {
  componentId: string;
  selectedFiles: string[];
  omittedFiles: string[];
  canRunInIsolation: boolean;
  status: 'ISOLATED_COMPONENT' | 'FULL_PROJECT_REQUIRED' | 'INCOMPLETE_ANALYSIS' | 'INVALID_COMPONENT';
  reasons: string[];
}

export interface CodePatch {
  file: string;
  startOffset: number;
  endOffset: number;
  oldText: string;
  /** Exact source snapshot used to create this patch; prevents stale zero-width insertions. */
  baseText: string;
  newText: string;
  reason: string;
  safety: 'mechanical' | 'logic-changing' | 'unknown';
}

export interface AutoFixResult {
  mode: AutoFixMode;
  patches: CodePatch[];
  applied: boolean;
  notes: string[];
}

export interface ExecutionRequest {
  requestId: string;
  projectId: string;
  entryFiles: string[];
  runtimeId: string;
  mode: ExecutionMode;
  timeoutMs: number;
  outputLimitBytes: number;
  networkAllowed: boolean;
  fileAccess: 'none' | 'project-read-only' | 'working-copy';
}

export interface ExecutionResult {
  requestId: string;
  status: 'completed' | 'failed' | 'timed-out' | 'cancelled' | 'blocked' | 'not-implemented';
  exitCode?: number;
  stdout: string;
  stderr: string;
  diagnostics: CodeDiagnostic[];
  elapsedMs: number;
  peakRamBytes?: number;
  artifacts: Array<{ path: string; sizeBytes: number; sha256?: string }>;
  evidence: EvidenceLevel;
  notes: string[];
}

export interface RuntimeAdapter {
  descriptor: RuntimeDescriptor;
  canHandle(request: ExecutionRequest): boolean;
  execute(request: ExecutionRequest, signal?: AbortSignal): Promise<ExecutionResult>;
}

export interface CheckpointRecord {
  id: string;
  projectId: string;
  projectFingerprint: string;
  runtimeId: string;
  createdAt: number;
  completedUnits: string[];
  stateFormat: string;
  stateBytes: number;
  resumable: boolean;
  notes: string[];
}

export interface CheckpointStore {
  save(record: CheckpointRecord, state: Uint8Array): Promise<void>;
  load(id: string): Promise<{ record: CheckpointRecord; state: Uint8Array } | null>;
  delete(id: string): Promise<void>;
}
