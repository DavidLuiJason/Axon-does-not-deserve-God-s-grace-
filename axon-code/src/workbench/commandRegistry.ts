export type WorkbenchCommandGroup = 'PROJECT' | 'EDIT' | 'RUN' | 'DEBUG' | 'VIEW' | 'EXPORT';
export type WorkbenchCommandState = 'BOUND' | 'ADAPTER_REQUIRED' | 'NOT_IMPLEMENTED';
export interface WorkbenchCommandDescriptor {
  id: string;
  label: string;
  group: WorkbenchCommandGroup;
  state: WorkbenchCommandState;
  requiresSelection: boolean;
  destructive: boolean;
  description: string;
}
export type WorkbenchCommandHandler = (input: unknown) => Promise<unknown> | unknown;

/** Button/menu catalogue. It becomes visible UI only when a host Workbench renders these descriptors. */
export class WorkbenchCommandRegistry {
  private readonly descriptors = new Map<string, WorkbenchCommandDescriptor>();
  private readonly handlers = new Map<string, WorkbenchCommandHandler>();
  register(descriptor: WorkbenchCommandDescriptor, handler?: WorkbenchCommandHandler): void {
    if (!/^[a-z][a-z0-9.-]{1,79}$/.test(descriptor.id) || !descriptor.label.trim()) throw new Error('Invalid workbench command descriptor.');
    if (this.descriptors.has(descriptor.id)) throw new Error(`Command '${descriptor.id}' is already registered.`);
    this.descriptors.set(descriptor.id, { ...descriptor });
    if (handler) this.handlers.set(descriptor.id, handler);
  }
  bind(id: string, handler: WorkbenchCommandHandler): void {
    const descriptor = this.descriptors.get(id);
    if (!descriptor) throw new Error(`Unknown workbench command '${id}'.`);
    this.handlers.set(id, handler);
    this.descriptors.set(id, { ...descriptor, state: 'BOUND' });
  }
  list(group?: WorkbenchCommandGroup): WorkbenchCommandDescriptor[] {
    return [...this.descriptors.values()].filter((item) => !group || item.group === group).map((item) => ({ ...item }));
  }
  async dispatch(id: string, input?: unknown): Promise<unknown> {
    const descriptor = this.descriptors.get(id);
    if (!descriptor) throw new Error(`Unknown workbench command '${id}'.`);
    const handler = this.handlers.get(id);
    if (!handler || descriptor.state !== 'BOUND') throw new Error(`Command '${id}' is not bound to an operational host action (${descriptor.state}).`);
    return handler(input);
  }
}

export function createDefaultWorkbenchCommandCatalogue(): WorkbenchCommandRegistry {
  const registry = new WorkbenchCommandRegistry();
  const rows: WorkbenchCommandDescriptor[] = [
    { id: 'project.open', label: 'Open project', group: 'PROJECT', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Open a project through the host project picker.' },
    { id: 'project.save', label: 'Save project', group: 'PROJECT', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Commit the current user-approved working-copy changes.' },
    { id: 'project.select-all', label: 'Select all', group: 'EDIT', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Select all eligible project files.' },
    { id: 'project.auto-select', label: 'Auto select', group: 'EDIT', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Select source and configuration files using a documented preset.' },
    { id: 'project.clear-selection', label: 'Clear selection', group: 'EDIT', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Clear the selection without deleting project files.' },
    { id: 'project.copy', label: 'Copy selected', group: 'EDIT', state: 'ADAPTER_REQUIRED', requiresSelection: true, destructive: false, description: 'Copy selected project content.' },
    { id: 'project.share', label: 'Share project', group: 'PROJECT', state: 'ADAPTER_REQUIRED', requiresSelection: true, destructive: false, description: 'Prepare and share a selected project snapshot.' },
    { id: 'project.export', label: 'Export project', group: 'EXPORT', state: 'ADAPTER_REQUIRED', requiresSelection: true, destructive: false, description: 'Export TXT, Markdown, JSON, ZIP or PDF.' },
    { id: 'project.remove-preview', label: 'Preview removal', group: 'PROJECT', state: 'ADAPTER_REQUIRED', requiresSelection: true, destructive: false, description: 'Preview exactly which selected files would be moved to trash.' },
    { id: 'project.remove-confirm', label: 'Confirm removal', group: 'PROJECT', state: 'ADAPTER_REQUIRED', requiresSelection: true, destructive: true, description: 'Soft-remove only after explicit confirmation.' },
    { id: 'project.undo-remove', label: 'Undo removal', group: 'PROJECT', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Restore a previous soft removal.' },
    { id: 'run.project', label: 'Run', group: 'RUN', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Run through a verified runtime provider.' },
    { id: 'run.build', label: 'Build', group: 'RUN', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Build through an approved host toolchain.' },
    { id: 'run.tests', label: 'Run tests', group: 'RUN', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Execute project tests and retain evidence.' },
    { id: 'debug.start', label: 'Start debugging', group: 'DEBUG', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Start a verified debug adapter session.' },
    { id: 'terminal.open', label: 'Open terminal', group: 'VIEW', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Open a permission-bounded interactive PTY session.' },
    { id: 'view.problems', label: 'Problems', group: 'VIEW', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Show the unified diagnostics panel.' },
    { id: 'view.output', label: 'Output', group: 'VIEW', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Show captured build and task output.' },
    { id: 'view.preview', label: 'Preview', group: 'VIEW', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Open a host preview surface.' },
    { id: 'view.resources', label: 'Resources', group: 'VIEW', state: 'ADAPTER_REQUIRED', requiresSelection: false, destructive: false, description: 'Show resource governor measurements.' }
  ];
  for (const row of rows) registry.register(row, row.state === 'BOUND' ? (input) => ({ command: row.id, input, available: true }) : undefined);
  return registry;
}
