import type { ClipboardAdapter, DownloadAdapter, ShareAdapter, ShareOutcome } from './hostActions.js';
import { copyProjectPayload, shareProjectPayload } from './hostActions.js';
import type { ProjectSelection, ProjectSelectionManager, ProjectSelectionRequest } from './projectSelection.js';
import type { ProjectExportFormat, ProjectExportPayload, ProjectExportService } from './projectExport.js';
import type { RemoveApproval, RemovePreview, RemoveResult, WorkspaceLifecycleManager } from './projectLifecycle.js';

export interface CopyProjectResult { copied: true; fileCount: number; bytes: number; format: 'txt'; }
export interface ShareProjectResult { outcome: ShareOutcome; filename: string; fileCount: number; }

/** UI-independent facade. Future buttons/menu actions should call these typed operations. */
export class ProjectActionService {
  constructor(
    private readonly selections: ProjectSelectionManager,
    private readonly exports: ProjectExportService,
    private readonly lifecycle: WorkspaceLifecycleManager
  ) {}

  async select(request: ProjectSelectionRequest): Promise<ProjectSelection> { return this.selections.select(request); }
  clearSelection(): void { this.selections.clearSelection(); }
  getSelection(): ProjectSelection | null { return this.selections.getCurrent(); }

  async prepareExport(format: ProjectExportFormat, options: { allowSensitiveFiles?: boolean; projectName?: string } = {}): Promise<ProjectExportPayload> {
    const selection = this.requireSelection();
    return this.exports.export(selection, format, options);
  }

  async copy(adapter: ClipboardAdapter, options: { allowSensitiveFiles?: boolean; maxClipboardBytes?: number } = {}): Promise<CopyProjectResult> {
    const selection = this.requireSelection();
    const payload = await this.exports.export(selection, 'txt', { ...(options.allowSensitiveFiles !== undefined ? { allowSensitiveFiles: options.allowSensitiveFiles } : {}) });
    await copyProjectPayload(adapter, payload, options.maxClipboardBytes);
    return { copied: true, fileCount: selection.fileCount, bytes: payload.sizeBytes, format: 'txt' };
  }

  async share(adapter: ShareAdapter, options: { allowSensitiveFiles?: boolean; title?: string } = {}): Promise<ShareProjectResult> {
    const selection = this.requireSelection();
    const payload = await this.exports.export(selection, 'zip', { ...(options.allowSensitiveFiles !== undefined ? { allowSensitiveFiles: options.allowSensitiveFiles } : {}) });
    const outcome = await shareProjectPayload(adapter, payload, options.title ?? selection.workspaceId);
    return { outcome, filename: payload.filename, fileCount: selection.fileCount };
  }

  async download(adapter: DownloadAdapter, format: ProjectExportFormat, options: { allowSensitiveFiles?: boolean; projectName?: string } = {}): Promise<ProjectExportPayload> {
    const payload = await this.prepareExport(format, options);
    await adapter.download(payload);
    return payload;
  }

  async previewRemove(): Promise<RemovePreview> { return this.lifecycle.previewRemove(this.requireSelection()); }
  async confirmRemove(previewId: string, approval: RemoveApproval): Promise<RemoveResult> { return this.lifecycle.confirmRemove(previewId, approval); }
  async undoRemove(trashId: string): Promise<RemoveResult> { return this.lifecycle.undoRemove(trashId); }
  async recoverInterruptedRemovals(workspaceId?: string): Promise<RemoveResult[]> { return this.lifecycle.recoverInterruptedRemovals(workspaceId); }

  private requireSelection(): ProjectSelection {
    const selection = this.selections.getCurrent();
    if (!selection) throw new Error('No project files are selected. Select files or use auto-select first.');
    return selection;
  }
}
