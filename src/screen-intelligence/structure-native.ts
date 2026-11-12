import { registerPlugin } from '@capacitor/core';
import { createStructureSource } from './structure-source.mjs';

/** Native read-only accessibility bridge (Android). Not called by any screen yet. */
export function createNativeStructureSource(defaults: Record<string, unknown> = {}) {
  const plugin: any = registerPlugin('ScreenStructure');
  return createStructureSource(plugin, defaults);
}
