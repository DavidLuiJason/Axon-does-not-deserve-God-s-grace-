import { registerPlugin } from '@capacitor/core';
import { createAppsSource } from './apps-source.mjs';

/** Native installed-apps bridge (Android). Not called by any screen yet. */
export function createNativeAppsSource() {
  const plugin: any = registerPlugin('AxonApps');
  return createAppsSource(plugin);
}
