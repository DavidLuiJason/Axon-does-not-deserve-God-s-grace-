// AXON Apps source: wraps the native AxonApps plugin. Every call fails safe and returns {ok, ...}.
const wrap = async (fn) => { try { return await fn(); } catch (error) { return { ok: false, code: String(error?.message ?? error) }; } };

export function createAppsSource(plugin) {
  const missing = { ok: false, code: 'no-native-plugin' };
  return {
    listApps: () => (plugin?.listApps ? wrap(async () => { const r = await plugin.listApps(); return Array.isArray(r?.apps) ? { ok: true, apps: r.apps } : { ok: false, code: 'no-result' }; }) : Promise.resolve(missing)),
    openApp: (packageName) => (plugin?.openApp ? wrap(async () => { const r = await plugin.openApp({ packageName }); return { ok: r?.opened === true, code: r?.opened === true ? 'opened' : (r?.code ?? 'not-opened') }; }) : Promise.resolve(missing)),
    openAppSettings: (packageName) => (plugin?.openAppSettings ? wrap(async () => { const r = await plugin.openAppSettings({ packageName }); return { ok: r?.opened === true, code: r?.opened === true ? 'opened' : 'not-opened' }; }) : Promise.resolve(missing)),
    getAppIcon: (packageName, size = 96) => (plugin?.getAppIcon ? wrap(async () => { const r = await plugin.getAppIcon({ packageName, size }); return r?.png ? { ok: true, png: r.png, size: r.size ?? size } : { ok: false, code: 'no-icon' }; }) : Promise.resolve(missing)),
  };
}
