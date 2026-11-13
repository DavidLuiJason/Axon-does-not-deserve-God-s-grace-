import { Capacitor, registerPlugin } from '@capacitor/core';

export type { NativeBrowserState, NativeBrowserTab, BrowserTabGroup, BrowserTabKind, BrowserSavedItem, AxonBrowserPlugin } from './browserPluginTypes.ts';
import type { AxonBrowserPlugin } from './browserPluginTypes.ts';

const AxonBrowser = registerPlugin<AxonBrowserPlugin>('AxonBrowser');
export const isNativeBrowserAvailable = (): boolean => Capacitor.isNativePlatform();
export default AxonBrowser;
