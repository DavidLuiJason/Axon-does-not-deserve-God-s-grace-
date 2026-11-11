import { Capacitor } from '@capacitor/core';
import { CaptureCoordinator } from './capture-coordinator.mjs';
import { createCaptureConsentReceipt, SCREEN_CAPTURE_DISCLOSURE } from './contracts.mjs';
import { IndexedDbPreservationStore } from './indexeddb-store.mjs';
import { MemoryPreservationStore } from './memory-store.mjs';
import { createBrowserDomAdapter } from './browser-dom-adapter.mjs';
import { createAndroidMediaProjectionAdapter } from './android-media-projection-adapter.mjs';
import { createCompositeCaptureAdapter } from './composite-adapter.mjs';
import { NativeScreenCapture } from './native-plugin';

/**
 * Creates the shared runtime. Android uses an explicit MediaProjection session;
 * web runtimes can observe only the document AXON owns. No outside-app DOM access.
 */
export function createScreenIntelligenceRuntime(options: { maxStoreBytes?: number; maxStoreRecords?: number } = {}) {
  const store = typeof indexedDB !== 'undefined'
    ? new IndexedDbPreservationStore({ maxBytes: options.maxStoreBytes, maxRecords: options.maxStoreRecords })
    : new MemoryPreservationStore({ maxBytes: options.maxStoreBytes ?? 4 * 1024 * 1024, maxRecords: options.maxStoreRecords ?? 2000 });
  const coordinator = new CaptureCoordinator({ store });
  const platform = Capacitor.getPlatform();
  const browserAdapter = createBrowserDomAdapter();
  const nativeAdapter = platform === 'android' ? createAndroidMediaProjectionAdapter(NativeScreenCapture) : null;
  const adapter = nativeAdapter
    ? createCompositeCaptureAdapter([{ adapter: nativeAdapter, required: true }, { adapter: browserAdapter, required: false }])
    : browserAdapter;
  return Object.freeze({
    coordinator,
    adapter,
    browserAdapter,
    nativeAdapter,
    async getCapabilities() { return adapter.getCapabilities(); },
    disclosure: SCREEN_CAPTURE_DISCLOSURE,
    createConsentReceipt(accepted: boolean) {
      return createCaptureConsentReceipt({ accepted, scope: 'screen-capture' });
    },
    async startFromUserAction(consentReceipt: Record<string, unknown>, options: Record<string, unknown> = {}) {
      return coordinator.startSession({ adapter, userInitiated: true, consent: consentReceipt, options });
    },
    async stop(reason = 'user-stop') { return coordinator.stopSession(reason); },
    async getStatus() {
      const native = await nativeAdapter?.getStatus?.() ?? null;
      if (native?.state === 'interrupted') await coordinator.handleSourceStopped(native.reason ?? 'native-capture-interrupted', 'capture-interrupted');
      else if (native?.state === 'stopped' && coordinator.getStatus().state === 'active') await coordinator.handleSourceStopped(native.reason ?? 'native-capture-stopped', 'source-stopped');
      return { ...coordinator.getStatus(), native };
    },
    async listObservations(sessionId?: string) { return store.list(sessionId); },
    async pinObservation(id: string, pinned = true) { return store.pin?.(id, pinned) ?? false; },
    async getLocalStorageStats() { return store.stats?.() ?? null; },
    async deleteLocalSession(sessionId: string) { return store.deleteSession?.(sessionId) ?? { removed: 0 }; },
    async getNativeStorageStats() { return nativeAdapter?.getStorageStats?.() ?? null; },
    async listNativeSessions() { return nativeAdapter?.listSessions?.() ?? { sessions: [] }; },
    async listNativeSegments() { return nativeAdapter?.listSegments?.() ?? { segments: [] }; },
    async deleteNativeSession(sessionId: string) { return nativeAdapter?.deleteSession?.(sessionId) ?? { deleted: false, sessionId }; },
    async close() { await coordinator.stopSession('runtime-close'); await store.close?.(); },
  });
}
