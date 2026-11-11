import React, { useEffect, useState } from 'react';
import { Globe, ExternalLink, ShieldCheck, Bookmark, History, Layers } from 'lucide-react';
import AxonBrowser, { isNativeBrowserAvailable } from '../../web/axonBrowserPlugin';
import { readBrowserWindowSignals, resolveBrowserDeviceProfile, withKernelDeviceProfile } from '../../web/browserDeviceProfile';
import { readDeviceProfile } from '../../kernel/deviceProfile';

export const BrowserHomeScreen: React.FC = () => {
  const initialProfile = () => typeof window === 'undefined'
    ? resolveBrowserDeviceProfile({ viewportWidthCssPx: 390 })
    : resolveBrowserDeviceProfile(readBrowserWindowSignals(window));
  const [profile, setProfile] = useState(initialProfile);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const native = isNativeBrowserAvailable();
  useEffect(() => {
    let active = true;
    const refresh = () => setProfile(resolveBrowserDeviceProfile(readBrowserWindowSignals(window)));
    const refreshWithDeviceProfile = async () => {
      const [signals, deviceProfile] = await Promise.all([
        Promise.resolve(readBrowserWindowSignals(window)),
        readDeviceProfile(),
      ]);
      if (active) setProfile(resolveBrowserDeviceProfile(withKernelDeviceProfile(signals, deviceProfile)));
    };
    refresh();
    void refreshWithDeviceProfile();
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    window.visualViewport?.addEventListener('resize', refresh);
    return () => {
      active = false;
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
      window.visualViewport?.removeEventListener('resize', refresh);
    };
  }, []);
  const widthClass = profile.windowClass === 'EXPANDED' ? 'max-w-[1200px]' : profile.windowClass === 'MEDIUM' ? 'max-w-[840px]' : 'max-w-[600px]';
  const gridClass = profile.quickActionColumns === 4 ? 'grid-cols-4' : profile.quickActionColumns === 3 ? 'grid-cols-3' : 'grid-cols-2';
  const open = async (url = 'https://www.google.com') => {
    if (!native || busy) return;
    setBusy(true); setNotice('Opening AXON Web…');
    try { await AxonBrowser.open({ url }); setNotice('AXON Web opened.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'AXON Web could not open.'); }
    finally { setBusy(false); }
  };
  return (
    <section className={`flex-1 w-full ${widthClass} mx-auto px-4 sm:px-6 py-6 sm:py-8 text-[#ECECEC]`}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-full bg-[#292B30] flex items-center justify-center"><Globe size={22} /></div>
        <div><h1 className="text-lg font-medium">AXON Web</h1><p className="text-xs text-[#96999F]">Your browser, connected to AXON.</p></div>
      </div>
      <button type="button" onClick={() => open()} disabled={!native || busy}
        className="w-full flex items-center justify-between rounded-xl bg-[#292B30] hover:bg-[#33353A] disabled:opacity-50 px-4 py-4 text-left">
        <span><span className="block text-sm font-medium">{busy ? 'Opening browser…' : 'Open browser'}</span><span className="block text-xs text-[#96999F] mt-1">Search the web or enter a website address.</span></span>
        <ExternalLink size={18} />
      </button>
      <div className={`grid ${gridClass} gap-3 mt-4`}>
        <div className="rounded-xl border border-white/10 p-3"><Layers size={17} className="mb-2 text-[#B7BAC0]"/><p className="text-sm">Tabs</p><p className="text-xs text-[#96999F] mt-1">Open and switch between normal tabs.</p></div>
        <div className="rounded-xl border border-white/10 p-3"><Bookmark size={17} className="mb-2 text-[#B7BAC0]"/><p className="text-sm">Bookmarks</p><p className="text-xs text-[#96999F] mt-1">Save pages for later.</p></div>
        <div className="rounded-xl border border-white/10 p-3"><History size={17} className="mb-2 text-[#B7BAC0]"/><p className="text-sm">History</p><p className="text-xs text-[#96999F] mt-1">Return to recently visited pages.</p></div>
        <div className="rounded-xl border border-white/10 p-3"><ShieldCheck size={17} className="mb-2 text-[#B7BAC0]"/><p className="text-sm">Safe defaults</p><p className="text-xs text-[#96999F] mt-1">HTTPS navigation and strict certificate handling.</p></div>
      </div>
      {!native && <p className="text-xs text-[#E0B36B] mt-5">The native browser host is not available in this web preview. The current native implementation is the Android host; other platform adapters are not built yet.</p>}
      {notice && <p role="status" className="text-xs text-[#AEB1B7] mt-4">{notice}</p>}
      <p className="text-[11px] text-[#777B82] mt-7">Current host: Android System WebView. Layout adapts to the available window; other native platform engines, Incognito and Stealth are not implemented.</p>
    </section>
  );
};
