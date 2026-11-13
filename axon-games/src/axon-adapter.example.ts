/** Example integration seam only. Do not assume these interfaces exist in AXON. */
export interface AxonGamesHost {
  openForegroundSurface(options: { id: string; title: string; onClose: () => void }): void;
  registerCapability?(capability: { id: string; label: string; execute: (input: unknown) => Promise<unknown> }): void;
  getTheme?(): { mode: "light" | "dark" | "system"; accent?: string };
  persist?(key: string, value: unknown): Promise<void>;
}
export function createGamesIntegration(host: AxonGamesHost) {
  return { mount: (onClose: () => void) => host.openForegroundSurface({ id: "axon.games", title: "Games Lab", onClose }) };
}
