import { AndroidAxonSessionEngine } from './androidAxonSession.ts';
import { androidBrowserTailPlugin } from './androidBrowserTail.ts';
import { AndroidWebViewAdapter } from './androidWebViewAdapter.ts';
import { createAxonWebHost, type AxonWebHost } from './axonWebHost.ts';
import type { AxonWebAgentOptions } from './axonWebAgent.ts';

/** The real thing on an Android phone: native WebView adapter, native long-tail host, AXON's own tab engine. */
export function createAndroidAxonWebHost(agentOptions?: Omit<AxonWebAgentOptions, 'engine'>): AxonWebHost {
  return createAxonWebHost({
    adapter: new AndroidWebViewAdapter(),
    tail: androidBrowserTailPlugin(),
    engine: new AndroidAxonSessionEngine(),
    ...(agentOptions === undefined ? {} : { agentOptions }),
  });
}
