import AxonBrowser, { isNativeBrowserAvailable } from './axonBrowserPlugin.ts';
import type { AxonAction, AxonSessionEngine, AxonSessionPlugin } from './axonSessionTypes.ts';

/** The native Android plugin is one plugin (AxonBrowser); this is its AXON-session half. */
export class AndroidAxonSessionEngine implements AxonSessionEngine {
  private readonly plugin: AxonSessionPlugin;
  constructor(plugin: AxonSessionPlugin = AxonBrowser as unknown as AxonSessionPlugin) { this.plugin = plugin; }
  isAvailable(): boolean { return isNativeBrowserAvailable(); }
  axonOpen(options: { url: string }) { return this.plugin.axonOpen(options); }
  axonState() { return this.plugin.axonState(); }
  axonSnapshot() { return this.plugin.axonSnapshot(); }
  axonAct(options: { action: AxonAction }) { return this.plugin.axonAct(options); }
  axonRelease() { return this.plugin.axonRelease(); }
}
