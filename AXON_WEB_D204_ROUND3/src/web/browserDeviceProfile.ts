/**
 * Platform-neutral responsive policy for AXON Web.
 * It classifies the available window, not the physical product name or OS version.
 * The shared kernel Device Profile can supply a coarse browser-reported memory hint; the web shell measures the current viewport and input signals.
 */
export type BrowserWindowClass = 'COMPACT' | 'MEDIUM' | 'EXPANDED';
export type BrowserToolbarMode = 'COMPACT' | 'STANDARD' | 'WIDE';

export type BrowserDeviceSignals = Readonly<{
  /** CSS pixels reported by the current window, not a physical-device width. */
  viewportWidthCssPx: number;
  viewportHeightCssPx?: number;
  hasCoarsePointer?: boolean;
  hasFinePointer?: boolean;
  hasKeyboard?: boolean;
  lowMemory?: boolean;
  /** Coarse live estimate from the shared kernel Device Profile; absent means unknown. */
  memoryGb?: number;
}>;

export type BrowserDeviceProfile = Readonly<{
  windowClass: BrowserWindowClass;
  toolbarMode: BrowserToolbarMode;
  quickActionColumns: 2 | 3 | 4;
  useSidebar: boolean;
  compactLabels: boolean;
  maxContentWidthCssPx: number;
  memoryTier: 'LOW' | 'STANDARD' | 'HIGH' | 'UNKNOWN';
  liveRendererBudget: 1;
  touchFriendly: boolean;
}>;

const finitePositive = (value: number): number => Number.isFinite(value) && value > 0 ? value : 0;

export function resolveBrowserDeviceProfile(signals: BrowserDeviceSignals): BrowserDeviceProfile {
  const width = finitePositive(signals.viewportWidthCssPx);
  const windowClass: BrowserWindowClass = width < 600 ? 'COMPACT' : width < 840 ? 'MEDIUM' : 'EXPANDED';
  const memory = finitePositive(signals.memoryGb ?? 0);
  // These are conservative display labels based on the browser's coarse RAM hint,
  // not measured performance tiers or reserved-memory guarantees. Calibrate only from
  // multi-device benchmarks; unknown stays unknown.
  const memoryTier: BrowserDeviceProfile['memoryTier'] = signals.lowMemory
    ? 'LOW'
    : memory === 0 ? 'UNKNOWN'
      : memory < 2 ? 'LOW'
        : memory < 4 ? 'STANDARD' : 'HIGH';
  const hasFinePointer = Boolean(signals.hasFinePointer || signals.hasKeyboard);
  return Object.freeze({
    windowClass,
    toolbarMode: windowClass === 'COMPACT' ? 'COMPACT' : windowClass === 'MEDIUM' ? 'STANDARD' : 'WIDE',
    quickActionColumns: windowClass === 'EXPANDED' ? 4 : windowClass === 'MEDIUM' ? 3 : 2,
    useSidebar: windowClass === 'EXPANDED' && hasFinePointer,
    compactLabels: windowClass === 'COMPACT',
    maxContentWidthCssPx: windowClass === 'EXPANDED' ? 1200 : windowClass === 'MEDIUM' ? 840 : 600,
    memoryTier,
    // Conservative until measured renderer costs exist for each engine/device tier.
    liveRendererBudget: 1,
    touchFriendly: Boolean(signals.hasCoarsePointer) || !hasFinePointer,
  });
}

/** Safe web-shell signals. OS and model-name sniffing is intentionally avoided. */
export function readBrowserWindowSignals(win: Window = window): BrowserDeviceSignals {
  const query = (value: string) => win.matchMedia?.(value).matches ?? false;
  const root = win.document?.documentElement;
  const width = root?.clientWidth || win.innerWidth || 0;
  const height = root?.clientHeight || win.innerHeight || 0;
  return {
    viewportWidthCssPx: width,
    viewportHeightCssPx: height,
    hasCoarsePointer: query('(pointer: coarse)'),
    hasFinePointer: query('(any-pointer: fine)'),
    hasKeyboard: query('(hover: hover) and (pointer: fine)'),
  };
}


/** Bridges the shared kernel Device Profile into this browser-only responsive policy.
 * Unsupported or privacy-reduced browser readings remain UNKNOWN.
 */
export function withKernelDeviceProfile<T extends BrowserDeviceSignals>(
  signals: T,
  profile: { memoryGb: { known: true; value: number } | { known: false } },
): BrowserDeviceSignals {
  return { ...signals, memoryGb: profile.memoryGb.known ? profile.memoryGb.value : undefined };
}
