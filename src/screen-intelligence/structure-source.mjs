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
