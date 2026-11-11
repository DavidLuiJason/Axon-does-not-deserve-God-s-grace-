import type { ComponentBoundary, ProjectAnalysis, SelectiveExecutionPlan } from './types.js';

/** Builds an import-closure plan. It never labels a component safe merely because it looks unused. */
export function planSelectiveExecution(analysis: ProjectAnalysis, component: ComponentBoundary): SelectiveExecutionPlan {
  const allFiles = new Set(analysis.files.map((file) => file.path));
  const reasons: string[] = [];
  if (!component.id || component.entryFiles.length === 0 || component.entryFiles.some((path) => !allFiles.has(path))) {
    return { componentId: component.id, selectedFiles: [], omittedFiles: [...allFiles].sort(), canRunInIsolation: false, status: 'INVALID_COMPONENT', reasons: ['Component entry file is missing from the analysed project.'] };
  }
  const byPath = new Map(analysis.files.map((file) => [file.path, file]));
  const selected = new Set<string>();
  const queue = [...component.entryFiles];
  let unresolved = false;
  while (queue.length > 0) {
    const path = queue.shift();
    if (!path || selected.has(path)) continue;
    selected.add(path);
    const file = byPath.get(path);
    if (!file || !file.inspected) { unresolved = true; continue; }
    for (const ref of file.imports) {
      if (ref.kind === 'dynamic-nonliteral') unresolved = true;
      if (ref.specifier.startsWith('.') && ref.resolvedFile) queue.push(ref.resolvedFile);
      else if (ref.specifier.startsWith('.') && !ref.resolved) unresolved = true;
    }
  }
  if (!component.sideEffectFree) reasons.push('The project has not declared this component side-effect-free.');
  if (!component.dynamicDependenciesDeclared || analysis.outline.dynamicImportPresent) reasons.push('Dynamic dependencies are not fully declared.');
  if (!analysis.outline.dependencyGraphComplete || unresolved) reasons.push('The dependency graph is incomplete; omitted code may still be required.');
  const canRun = reasons.length === 0;
  if (!canRun) reasons.push('No source files were deleted or rewritten; use a full-project run unless a runtime-specific isolation proof is supplied.');
  return {
    componentId: component.id,
    selectedFiles: [...selected].sort(),
    omittedFiles: [...allFiles].filter((path) => !selected.has(path)).sort(),
    canRunInIsolation: canRun,
    status: canRun ? 'ISOLATED_COMPONENT' : (unresolved || !analysis.outline.dependencyGraphComplete ? 'INCOMPLETE_ANALYSIS' : 'FULL_PROJECT_REQUIRED'),
    reasons
  };
}

export interface DiagnosticRenderProfile {
  id: 'FULL' | 'GEOMETRY_ONLY' | 'SILHOUETTE' | 'LOW_TEXTURE' | 'NO_SHADOWS' | 'LOW_RESOLUTION';
  label: string;
  diagnosticOnly: true;
  changes: string[];
}

/** Visual inspection profiles are explicit render variants, not proof of full-quality performance. */
export const DIAGNOSTIC_RENDER_PROFILES: readonly DiagnosticRenderProfile[] = [
  { id: 'FULL', label: 'Full visual output', diagnosticOnly: true, changes: [] },
  { id: 'GEOMETRY_ONLY', label: 'Geometry only', diagnosticOnly: true, changes: ['Materials, textures, lighting and post-processing are disabled where the renderer supports it.'] },
  { id: 'SILHOUETTE', label: 'Silhouette', diagnosticOnly: true, changes: ['Objects are represented as flat silhouettes; colour and material detail are not evaluated.'] },
  { id: 'LOW_TEXTURE', label: 'Reduced texture detail', diagnosticOnly: true, changes: ['Texture resolution or mip level is reduced by the host renderer.'] },
  { id: 'NO_SHADOWS', label: 'No shadows', diagnosticOnly: true, changes: ['Shadow maps and shadow rendering are disabled by the host renderer.'] },
  { id: 'LOW_RESOLUTION', label: 'Reduced render resolution', diagnosticOnly: true, changes: ['The host renderer renders at a lower resolution and scales the output.'] }
] as const;
