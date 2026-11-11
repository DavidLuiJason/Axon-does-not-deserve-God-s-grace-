/** Capacitor MediaProjection adapter. The native OS consent dialog is always required. */
export function createAndroidMediaProjectionAdapter(plugin, { startTimeoutMs = 12000, stopTimeoutMs = 6000 } = {}) {
  if (!plugin) throw new TypeError('The native ScreenCapture plugin is required.');
  let listenerHandles = [];
  let active = false;
  let stopWaiter = null;
  return {
    source: 'android-media-projection',
    async getCapabilities() { return plugin.getCapabilities(); },
    async start({ sessionId, options = {}, onEvent }) {
      if (active) throw new Error('Native screen capture is already active.');
      let resolveStarted;
      let rejectStarted;
      const started = new Promise((resolve, reject) => { resolveStarted = resolve; rejectStarted = reject; });
      const timeout = setTimeout(() => rejectStarted(new Error('Timed out waiting for the Android capture service to become active.')), startTimeoutMs);
      const bind = async (name, handler) => {
        const handle = await plugin.addListener(name, async (event) => {
          try { await onEvent?.(mapNativeEvent(name, event)); } catch (error) { rejectStarted(error); }
          if (name === 'captureStatus' && event?.state === 'active') resolveStarted(event);
          if (name === 'captureStatus' && event?.state === 'stopped') {
            active = false;
            stopWaiter?.(event);
            stopWaiter = null;
            void cleanupListeners();
          }
          if (name === 'captureGap' && event?.type === 'capture-start-failed') rejectStarted(new Error(event.reason || 'Android capture failed to start.'));
        });
        listenerHandles.push(handle);
      };
      try {
        await bind('segmentSaved');
        await bind('captureStatus');
        await bind('captureGap');
        const permission = await plugin.startSession({ options: { ...options, sessionId } });
        if (permission?.granted !== true) throw new Error('Android screen-capture permission was not granted.');
        const activeEvent = await started;
        active = true;
        return { granted: true, state: 'active', native: activeEvent };
      } catch (error) {
        try { await plugin.stopSession({ reason: 'adapter-start-failed' }); } catch { /* service may not have started */ }
        await cleanupListeners();
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
    async stop({ reason = 'user-stop' } = {}) {
      if (!active) { await cleanupListeners(); return { stopped: true, alreadyStopped: true }; }
      const stopped = new Promise((resolve) => { stopWaiter = resolve; });
      let stopTimeout;
      let confirmed = false;
      try {
        await plugin.stopSession({ reason });
        const outcome = await Promise.race([stopped.then(() => 'confirmed'), new Promise((resolve) => { stopTimeout = setTimeout(() => resolve('timeout'), Math.max(1, stopTimeoutMs)); })]);
        confirmed = outcome === 'confirmed';
      } finally { clearTimeout(stopTimeout); active = false; stopWaiter = null; await cleanupListeners(); }
      return confirmed ? { stopped: true, confirmed: true } : { stopped: false, confirmed: false, reason: 'native-stop-event-timeout' };
    },
    async getStatus() { return plugin.getStatus(); },
    async listSegments() { return plugin.listSegments(); },
    async getStorageStats() { return plugin.getStorageStats(); },
    async listSessions() { return plugin.listSessions(); },
    async deleteSession(sessionId) { return plugin.deleteSession({ sessionId }); },
  };
  async function cleanupListeners() {
    const handles = listenerHandles;
    listenerHandles = [];
    await Promise.all(handles.map(async (handle) => { try { await handle?.remove?.(); } catch { /* listener may already be removed */ } }));
  }
}

function mapNativeEvent(name, event = {}) {
  if (name === 'segmentSaved') {
    const capturedAt = event.startedAtUtc && Number.isFinite(event.startedElapsedMs)
      ? { utc: event.startedAtUtc, local: event.startedAtLocal, timeZone: event.timeZoneId, utcOffset: event.utcOffset, monotonicMs: event.startedElapsedMs, monotonicClock: 'android-elapsed-realtime' }
      : null;
    return { source: 'android-media-projection', kind: 'video-segment', sourceSequence: event.sequence, ...(capturedAt ? { capturedAt } : {}), payload: { ...event } };
  }
  if (name === 'captureGap') return { source: 'android-media-projection', kind: 'gap', completeness: 'partial', payload: { ...event } };
  return { source: 'android-media-projection', kind: 'status', payload: { ...event } };
}
