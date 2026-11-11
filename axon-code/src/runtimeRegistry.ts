import type { ExecutionRequest, RuntimeAdapter, RuntimeDescriptor } from './types.js';

/** Registry only: it does not invent runtime support or execute code by itself. */
export class RuntimeRegistry {
  private readonly adapters = new Map<string, RuntimeAdapter>();

  register(adapter: RuntimeAdapter): void {
    const id = adapter.descriptor.id.trim();
    if (!id) throw new Error('Runtime id is required.');
    if (this.adapters.has(id)) throw new Error(`Runtime '${id}' is already registered.`);
    this.adapters.set(id, adapter);
  }

  get(id: string): RuntimeAdapter | undefined { return this.adapters.get(id); }

  list(): RuntimeDescriptor[] {
    return [...this.adapters.values()].map((adapter) => {
      const descriptor = adapter.descriptor;
      return { ...descriptor, languages: [...descriptor.languages], platforms: [...descriptor.platforms], ...(descriptor.notes ? { notes: [...descriptor.notes] } : {}) };
    });
  }

  resolve(request: ExecutionRequest): RuntimeAdapter | undefined {
    const adapter = this.adapters.get(request.runtimeId);
    if (!adapter || !adapter.descriptor.available || !adapter.canHandle(request)) return undefined;
    return adapter;
  }
}
