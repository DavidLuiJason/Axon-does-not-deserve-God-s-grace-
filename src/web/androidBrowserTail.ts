import AxonBrowser from './axonBrowserPlugin.ts';
import type { BrowserTailPlugin } from './browserLongTail.ts';

/** The native Android plugin is one plugin (AxonBrowser); this is its long-tail half. */
export function androidBrowserTailPlugin(): BrowserTailPlugin { return AxonBrowser as unknown as BrowserTailPlugin; }
