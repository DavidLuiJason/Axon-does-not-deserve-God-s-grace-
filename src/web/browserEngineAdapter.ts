import type { AxonBrowserPlugin } from './browserPluginTypes.ts';

export type BrowserEngineId = 'android-system-webview' | 'ios-wkwebview' | 'desktop-webview' | 'chromium' | 'geckoview' | 'simulated';

/**
 * Engine-neutral contract used by the BrowserController. The inherited plugin contract
 * includes tab-group operations and the reserved tab-kind field on tab state.
 * Each implementation must report only capabilities it has actually implemented and tested.
 */
export interface BrowserEngineAdapter extends AxonBrowserPlugin {
  readonly engineId: BrowserEngineId;
  isAvailable(): boolean;
}
