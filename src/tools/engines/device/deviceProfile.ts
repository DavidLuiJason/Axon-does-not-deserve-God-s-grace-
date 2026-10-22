/** Device report from injected values only; absent data is never inferred. */
export interface DeviceEnvironment {
  userAgent?: unknown; screenWidth?: unknown; screenHeight?: unknown; pixelRatio?: unknown; orientation?: unknown; touchPoints?: unknown;
  deviceMemory?: unknown; hardwareConcurrency?: unknown; languages?: unknown; timeZone?: unknown; online?: unknown;
  storageEstimate?: { usage?: unknown; quota?: unknown } | null; appName?: unknown; version?: unknown; build?: unknown;
}
export interface DeviceProfileRow { label: string; value: string }
export interface DeviceProfileReport { rows: DeviceProfileRow[]; plainText: string }
export type DeviceProfileResult = { ok: true; report: DeviceProfileReport } | { ok: false; error: 'invalid-environment'; message: string };
export const DEVICE_PROFILE_DESCRIPTOR = {
  toolId: 'device-profile', displayName: 'Device Profile', purpose: 'Report device and app details supplied by the environment, without guessing missing values.',
  examples: ['Copy the current device profile', 'Check the reported browser version', 'Review available storage estimates'],
  inputs: [{ name: 'environment', kind: 'text' as const, prompt: 'Device environment values are supplied by the app.' }],
};
const unknown = 'unknown';
function scalar(v: unknown): string { if (v === undefined || v === null || v === '') return unknown; if (typeof v === 'string') return v; if (typeof v === 'number' && Number.isFinite(v)) return String(v); if (typeof v === 'boolean') return String(v); return unknown; }
function number(v: unknown, decimals = 0): string { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return unknown; const p = 10 ** decimals; return String(Math.round(v * p) / p); }
function parsedVersions(ua: string): { android: string; browser: string } {
  const android = ua.match(/Android\s+([0-9]+(?:\.[0-9]+)*)/i)?.[1] ?? unknown;
  // Prefer an explicit WebView marker, then Chrome/Chromium. Do not infer from a generic Safari token.
  const webView = ua.match(/(?:;\s*wv\)|\bVersion\/([0-9.]+).*\bChrome\/([0-9.]+).*\bMobile\b)/i);
  const chrome = ua.match(/\b(?:Chrome|Chromium)\/([0-9]+(?:\.[0-9]+)*)/i);
  const version = /;\s*wv\)/i.test(ua) ? `WebView ${chrome?.[1] ?? webView?.[1] ?? 'unknown'}` : webView?.[1] ? `WebView ${webView[1]}` : chrome?.[1] ? `${/Chromium\//i.test(ua) && !/Chrome\//i.test(ua) ? 'Chromium' : 'Chrome'} ${chrome[1]}` : unknown;
  return { android, browser: version };
}
export function deviceProfile(environment: DeviceEnvironment): DeviceProfileResult {
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) return { ok: false, error: 'invalid-environment', message: 'Provide a device environment object.' };
  const ua = typeof environment.userAgent === 'string' ? environment.userAgent : '';
  const versions = parsedVersions(ua);
  const langs = Array.isArray(environment.languages) && environment.languages.every(x => typeof x === 'string') ? (environment.languages.length ? environment.languages.join(', ') : unknown) : unknown;
  const storage = environment.storageEstimate && typeof environment.storageEstimate === 'object' ? environment.storageEstimate : null;
  const memory = typeof environment.deviceMemory === 'number' && Number.isFinite(environment.deviceMemory) && environment.deviceMemory >= 0 ? `${number(environment.deviceMemory, 1)} GB (navigator.deviceMemory; rounded)` : unknown;
  const rows: DeviceProfileRow[] = [
    { label: 'App', value: scalar(environment.appName) }, { label: 'App version', value: scalar(environment.version) }, { label: 'Build', value: scalar(environment.build) },
    { label: 'User agent', value: ua || unknown }, { label: 'Android version', value: versions.android }, { label: 'Browser / WebView', value: versions.browser },
    { label: 'Screen width (CSS px)', value: number(environment.screenWidth) }, { label: 'Screen height (CSS px)', value: number(environment.screenHeight) },
    { label: 'Pixel ratio', value: number(environment.pixelRatio, 2) }, { label: 'Orientation', value: scalar(environment.orientation) }, { label: 'Touch points', value: number(environment.touchPoints) },
    { label: 'Device memory', value: memory }, { label: 'Hardware concurrency', value: number(environment.hardwareConcurrency) }, { label: 'Languages', value: langs },
    { label: 'Time zone', value: scalar(environment.timeZone) }, { label: 'Online', value: scalar(environment.online) },
    { label: 'Storage usage (bytes)', value: number(storage?.usage) }, { label: 'Storage quota (bytes)', value: number(storage?.quota) },
  ];
  return { ok: true, report: { rows, plainText: rows.map(row => `${row.label}: ${row.value}`).join('\n') } };
}
export type SpeedLabel = 'fast' | 'moderate' | 'slow' | 'unknown';
export interface SpeedProbeResult { milliseconds: number | null; label: SpeedLabel }
export function speedProbe(now: () => number, work: () => unknown): SpeedProbeResult {
  if (typeof now !== 'function' || typeof work !== 'function') return { milliseconds: null, label: 'unknown' };
  try {
    const start = now(); if (!Number.isFinite(start)) return { milliseconds: null, label: 'unknown' };
    work(); const end = now(); if (!Number.isFinite(end) || end < start) return { milliseconds: null, label: 'unknown' };
    const milliseconds = end - start;
    return { milliseconds, label: milliseconds < 10 ? 'fast' : milliseconds < 50 ? 'moderate' : 'slow' };
  } catch { return { milliseconds: null, label: 'unknown' }; }
}
