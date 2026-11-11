import type { ClipboardAdapter, DownloadAdapter, ShareAdapter } from './hostActions.js';
import type { ProjectExportFormat } from './projectExport.js';
import { ProjectActionService } from './projectActions.js';
import { WorkbenchCommandRegistry } from '../workbench/commandRegistry.js';
import type { WorkbenchStateManager } from '../workbench/workbenchState.js';

/** Binds the Round 7 project-action APIs to future UI command IDs. It does not render buttons. */
export function bindProjectActions(registry: WorkbenchCommandRegistry, service: ProjectActionService, adapters: { clipboard: ClipboardAdapter; share: ShareAdapter; download: DownloadAdapter }): void {
  registry.bind('project.select-all', async (input) => service.select({ workspaceId: requireString(input, 'workspaceId'), mode: 'ALL' }));
  registry.bind('project.auto-select', async (input) => service.select({ workspaceId: requireString(input, 'workspaceId'), mode: 'AUTO', preset: 'SOURCE_AND_CONFIG' }));
  registry.bind('project.clear-selection', () => { service.clearSelection(); return { cleared: true }; });
  registry.bind('project.copy', () => service.copy(adapters.clipboard));
  registry.bind('project.share', () => service.share(adapters.share));
  registry.bind('project.export', async (input) => service.download(adapters.download, requireFormat(input)));
  registry.bind('project.remove-preview', () => service.previewRemove());
  registry.bind('project.remove-confirm', (input) => service.confirmRemove(requireString(input, 'previewId'), requireApproval(input)));
  registry.bind('project.undo-remove', (input) => service.undoRemove(requireString(input, 'trashId')));
}
function requireString(input: unknown, property: string): string {
  if (!input || typeof input !== 'object' || typeof (input as Record<string, unknown>)[property] !== 'string' || !(input as Record<string, string>)[property]!.trim()) throw new Error(`Command requires '${property}'.`);
  return (input as Record<string, string>)[property]!;
}
function requireFormat(input: unknown): ProjectExportFormat {
  const value = input && typeof input === 'object' ? (input as Record<string, unknown>)['format'] : undefined;
  if (!['txt', 'markdown', 'json', 'zip', 'pdf'].includes(String(value))) throw new Error('Export format must be TXT, Markdown, JSON, ZIP or PDF.');
  return value as ProjectExportFormat;
}
function requireApproval(input: unknown): { approvedByUser: boolean; approvalReference: string; confirmationText: string } {
  if (!input || typeof input !== 'object') throw new Error('Removal approval is required.');
  const value = (input as Record<string, unknown>)['approval'];
  if (!value || typeof value !== 'object') throw new Error('Removal approval is required.');
  const approval = value as Record<string, unknown>;
  if (approval['approvedByUser'] !== true || typeof approval['approvalReference'] !== 'string' || typeof approval['confirmationText'] !== 'string') throw new Error('Removal approval is incomplete.');
  return { approvedByUser: true, approvalReference: approval['approvalReference'], confirmationText: approval['confirmationText'] };
}


/** Connects common Workbench panels to the state manager; the host still renders the actual UI. */
export function bindWorkbenchPanels(registry: WorkbenchCommandRegistry, workbench: WorkbenchStateManager): void {
  registry.bind('view.problems', () => { workbench.showPanel('PROBLEMS'); return workbench.snapshot(); });
  registry.bind('view.output', () => { workbench.showPanel('OUTPUT'); return workbench.snapshot(); });
  registry.bind('view.resources', () => { workbench.showPanel('RESOURCE_MONITOR'); return workbench.snapshot(); });
}
