// SI3b source: asks the native accessibility plugin for a screen snapshot and runs it through the reader.
// The plugin is injected, so this file is testable without Android.
import { readScreenStructure } from './structure-reader.mjs';

const OFF_HELP = 'Turn on "AXON screen reader" in Android Settings > Accessibility, then try again.';

export function createStructureSource(plugin, defaults = {}) {
  return {
    async getStatus() {
      if (!plugin?.getStatus) return { platform: 'unavailable', serviceEnabled: false, reason: 'no-native-plugin' };
      try { return await plugin.getStatus(); }
      catch (error) { return { platform: 'unavailable', serviceEnabled: false, reason: String(error?.message ?? error) }; }
    },
    async openSettings() {
      if (!plugin?.openSettings) return { opened: false, reason: 'no-native-plugin' };
      try { return await plugin.openSettings(); }
      catch (error) { return { opened: false, reason: String(error?.message ?? error) }; }
    },
    async performAction(payload) {
      if (!plugin?.performAction) return { ok: false, code: 'no-native-plugin' };
      try {
        const response = await plugin.performAction({ action: payload });
        return response?.result ?? { ok: false, code: 'no-result' };
      } catch (error) { return { ok: false, code: String(error?.message ?? error) }; }
    },
    async recognizeRegions(regions) {
      if (!plugin?.recognizeRegions) return { ok: false, code: 'no-native-plugin' };
      try {
        const response = await plugin.recognizeRegions({ regions });
        return response?.result ?? { ok: false, code: 'no-result' };
      } catch (error) { return { ok: false, code: String(error?.message ?? error) }; }
    },
    async performGesture(payload) {
      if (!plugin?.performGesture) return { ok: false, code: 'no-native-plugin' };
      try {
        const response = await plugin.performGesture({ action: payload });
        return response?.result ?? { ok: false, code: 'no-result' };
      } catch (error) { return { ok: false, code: String(error?.message ?? error) }; }
    },
    // Native kill switch: the owner's STOP button sets it on the phone itself, so it works even if JavaScript stalls.
    async getKillState() {
      if (!plugin?.getKillState) return { stopRequested: false, available: false };
      try { const r = await plugin.getKillState(); return { stopRequested: r?.stopRequested === true, available: true }; }
      catch (error) { return { stopRequested: true, available: false, code: String(error?.message ?? error) }; }
    },
    async requestStop() { return plugin?.requestStop ? plugin.requestStop().then(() => ({ ok: true })).catch(() => ({ ok: false })) : { ok: false }; },
    async clearStop() { return plugin?.clearStop ? plugin.clearStop().then(() => ({ ok: true })).catch(() => ({ ok: false })) : { ok: false }; },
    async showStopControl(text = 'STOP AXON') {
      if (!plugin?.showStopControl) return { ok: false, code: 'no-native-plugin' };
      try { const r = await plugin.showStopControl({ text }); return { ok: r?.shown === true, code: r?.code ?? (r?.shown ? 'shown' : 'not-shown') }; }
      catch (error) { return { ok: false, code: String(error?.message ?? error) }; }
    },
    async hideStopControl() { return plugin?.hideStopControl ? plugin.hideStopControl().then(() => ({ ok: true })).catch(() => ({ ok: false })) : { ok: false }; },
    async startRecording(options = {}) {
      if (!plugin?.startRecording) return { ok: false, code: 'no-native-plugin' };
      try { const r = await plugin.startRecording({ blockedPackages: options.blockedPackages ?? [] }); return { ok: r?.recording === true, code: r?.code ?? 'started' }; }
      catch (error) { return { ok: false, code: String(error?.message ?? error) }; }
    },
    async stopRecording() {
      if (!plugin?.stopRecording) return { ok: false, code: 'no-native-plugin', events: [] };
      try { const r = await plugin.stopRecording(); return { ok: true, events: Array.isArray(r?.events) ? r.events : [] }; }
      catch (error) { return { ok: false, code: String(error?.message ?? error), events: [] }; }
    },
    async readScreen(options = {}) {
      const status = await this.getStatus();
      if (!status.serviceEnabled) return { ok: false, reason: status.reason ?? 'accessibility-service-off', help: OFF_HELP };
      try {
        const result = await plugin.readScreen({ maxNodes: options.maxNodes ?? defaults.maxNodes ?? 600 });
        if (!result?.snapshot) return { ok: false, reason: 'no-snapshot' };
        return readScreenStructure(result.snapshot, { ...defaults, ...options });
      } catch (error) {
        const reason = String(error?.message ?? error);
        return { ok: false, reason, help: reason.includes('accessibility-service-off') ? OFF_HELP : undefined };
      }
    },
  };
}
