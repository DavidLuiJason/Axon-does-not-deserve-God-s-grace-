import type { AxonBrowserPlugin } from './browserPluginTypes.ts';

export type BrowserEngineId = 'android-system-webview' | 'ios-wkwebview' | 'desktop-webview' | 'chromium' | 'geckoview' | 'simulated';

/**
 * Engine-neutral contract used by the BrowserController.
 * Each implementation must report only capabilities it has actually implemented and tested.
 */
export interface BrowserEngineAdapter extends AxonBrowserPlugin {
  readonly engineId: BrowserEngineId;
  isAvailable(): boolean;
}
