import { normalizeProjectPath } from '../pathSafety.js';

export type WorkbenchHostProfile = 'PHONE' | 'TABLET' | 'DESKTOP' | 'REMOTE';
export type WorkbenchPanel = 'EXPLORER' | 'TERMINAL' | 'PROBLEMS' | 'OUTPUT' | 'DEBUG' | 'PREVIEW' | 'TESTS' | 'RESOURCE_MONITOR';
export interface WorkbenchDocumentTab { path: string; dirty: boolean; openedAt: number; lastFocusedAt: number; }
export interface WorkbenchSnapshot {
  projectId: string | null;
  hostProfile: WorkbenchHostProfile;
  tabs: WorkbenchDocumentTab[];
  activePath: string | null;
  visiblePanels: WorkbenchPanel[];
  activePanel: WorkbenchPanel | null;
  previewTarget: string | null;
}

export interface WorkbenchPolicy { maxOpenTabs: number; now: () => number; }
const VALID_PANELS = new Set<WorkbenchPanel>(['EXPLORER', 'TERMINAL', 'PROBLEMS', 'OUTPUT', 'DEBUG', 'PREVIEW', 'TESTS', 'RESOURCE_MONITOR']);

/** UI-independent workbench state. It tracks documents and panels but does not generate or alter source code. */
export class WorkbenchStateManager {
  private state: WorkbenchSnapshot;
  private readonly maxOpenTabs: number;
  private readonly now: () => number;
  constructor(hostProfile: WorkbenchHostProfile, policy: Partial<WorkbenchPolicy> = {}) {
    if (!['PHONE', 'TABLET', 'DESKTOP', 'REMOTE'].includes(hostProfile)) throw new Error('Invalid workbench host profile.');
    this.maxOpenTabs = policy.maxOpenTabs ?? (hostProfile === 'PHONE' ? 8 : hostProfile === 'TABLET' ? 14 : 32);
    this.now = policy.now ?? Date.now;
    if (!Number.isSafeInteger(this.maxOpenTabs) || this.maxOpenTabs < 1 || this.maxOpenTabs > 256) throw new Error('Invalid workbench tab limit.');
    this.state = { projectId: null, hostProfile, tabs: [], activePath: null, visiblePanels: ['EXPLORER'], activePanel: 'EXPLORER', previewTarget: null };
  }
  snapshot(): WorkbenchSnapshot { return structuredClone(this.state); }
  openProject(projectId: string, allowDiscardDirty = false): void {
    if (!projectId.trim() || projectId.length > 200) throw new Error('Invalid project ID.');
    if (this.state.tabs.some((tab) => tab.dirty) && !allowDiscardDirty) throw new Error('The current project has unsaved tabs; save them or explicitly approve discarding before switching projects.')
    this.state = { ...this.state, projectId, tabs: [], activePath: null, previewTarget: null };
  }
  openDocument(path: string): WorkbenchDocumentTab {
    if (!this.state.projectId) throw new Error('Open a project before opening a document.');
    const canonical = normalizeProjectPath(path);
    if (!canonical || canonical !== path) throw new Error('Document path is unsafe or non-canonical.');
    const now = this.now();
    const existing = this.state.tabs.find((tab) => tab.path === canonical);
    if (existing) {
      const updated = { ...existing, lastFocusedAt: now };
      this.state = { ...this.state, activePath: canonical, tabs: this.state.tabs.map((tab) => tab.path === canonical ? updated : tab) };
      return { ...updated };
    }
    if (this.state.tabs.length >= this.maxOpenTabs) throw new Error(`Open-tab limit (${this.maxOpenTabs}) reached; close a tab first.`);
    const tab = { path: canonical, dirty: false, openedAt: now, lastFocusedAt: now };
    this.state = { ...this.state, tabs: [...this.state.tabs, tab], activePath: canonical };
    return { ...tab };
  }
  focusDocument(path: string): void {
    const tab = this.state.tabs.find((item) => item.path === path);
    if (!tab) throw new Error(`Document '${path}' is not open.`);
    const updated = { ...tab, lastFocusedAt: this.now() };
    this.state = { ...this.state, activePath: path, tabs: this.state.tabs.map((item) => item.path === path ? updated : item) };
  }
  markDirty(path: string, dirty: boolean): void {
    if (!this.state.tabs.some((tab) => tab.path === path)) throw new Error(`Document '${path}' is not open.`);
    this.state = { ...this.state, tabs: this.state.tabs.map((tab) => tab.path === path ? { ...tab, dirty } : tab) };
  }
  closeDocument(path: string, allowDiscard: boolean): void {
    const tab = this.state.tabs.find((item) => item.path === path);
    if (!tab) return;
    if (tab.dirty && !allowDiscard) throw new Error('Document has unsaved changes; explicit discard approval is required.');
    const tabs = this.state.tabs.filter((item) => item.path !== path);
    const activePath = this.state.activePath === path ? (tabs.at(-1)?.path ?? null) : this.state.activePath;
    this.state = { ...this.state, tabs, activePath };
  }
  showPanel(panel: WorkbenchPanel, visible = true): void {
    if (!VALID_PANELS.has(panel)) throw new Error('Unsupported workbench panel.');
    const panels = new Set(this.state.visiblePanels);
    if (visible) panels.add(panel); else panels.delete(panel);
    this.state = { ...this.state, visiblePanels: [...panels], activePanel: visible ? panel : (this.state.activePanel === panel ? (panels.values().next().value ?? null) : this.state.activePanel) };
  }
  setPreviewTarget(path: string | null): void {
    if (path !== null && (!normalizeProjectPath(path) || normalizeProjectPath(path) !== path)) throw new Error('Preview target is unsafe.');
    this.state = { ...this.state, previewTarget: path };
  }
}
