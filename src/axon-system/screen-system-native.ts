import { registerPlugin } from '@capacitor/core';
import { createScreenSystem } from './create-screen-system.mjs';

/** The whole screen system on a real phone. Not called by any screen or tool yet. */
export function createNativeScreenSystem(options: Record<string, unknown> = {}) {
  const screenPlugin: any = registerPlugin('ScreenStructure');
  const appsPlugin: any = registerPlugin('AxonApps');
  return createScreenSystem({ screenPlugin, appsPlugin, ...options });
}
