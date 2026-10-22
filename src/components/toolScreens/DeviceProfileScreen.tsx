/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Device Profile Screen: What this phone and this app are.
 * Uses the pure device engine in src/tools/engines/device/deviceProfile.ts.
 * Collects values directly from the browser environment without guessing.
 */

import React, { useEffect, useState } from 'react';
import { Check, Copy, Gauge, RefreshCw } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import { copyToClipboard, ErrorLine, OptionsDisclosure } from '../tools/ToolParts';
import {
  deviceProfile,
  speedProbe,
  type DeviceEnvironment,
  type DeviceProfileReport,
  type SpeedProbeResult,
} from '../../tools/engines/device/deviceProfile';

export const toolScreen = { toolId: 'device-profile' };

export interface DeviceProfileScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

export const DeviceProfileScreen: React.FC<DeviceProfileScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [report, setReport] = useState<DeviceProfileReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [speedResult, setSpeedResult] = useState<SpeedProbeResult | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);

  // Gather environment values honestly from browser
  const gatherProfile = async () => {
    setErrorMessage(null);
    let storageEst: { usage?: number; quota?: number } | null = null;

    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.estimate === 'function'
    ) {
      try {
        const est = await navigator.storage.estimate();
        storageEst = { usage: est.usage, quota: est.quota };
      } catch {
        storageEst = null;
      }
    }

    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const win = typeof window !== 'undefined' ? window : undefined;

    const env: DeviceEnvironment = {
      appName: 'AXON — Intelligence in Motion',
      version: '0.0.0',
      build: 'web-production',
      userAgent: nav?.userAgent,
      screenWidth: win?.screen?.width,
      screenHeight: win?.screen?.height,
      pixelRatio: win?.devicePixelRatio,
      orientation:
        win?.screen?.orientation?.type ||
        (win && win.innerWidth > win.innerHeight ? 'landscape' : 'portrait'),
      touchPoints: nav?.maxTouchPoints,
      deviceMemory: (nav as unknown as { deviceMemory?: number })?.deviceMemory,
      hardwareConcurrency: nav?.hardwareConcurrency,
      languages: nav?.languages ? [...nav.languages] : [nav?.language ?? 'en'],
      timeZone:
        typeof Intl !== 'undefined' && Intl.DateTimeFormat
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : undefined,
      online: nav?.onLine,
      storageEstimate: storageEst,
    };

    const res = deviceProfile(env);
    if (res.ok) {
      setReport(res.report);
    } else {
      setErrorMessage(res.message);
    }
  };

  useEffect(() => {
    gatherProfile();
  }, []);

  const handleCopyReport = async () => {
    if (!report) return;
    const ok = await copyToClipboard(report.plainText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMeasureSpeed = () => {
    setIsMeasuring(true);
    // Use timeout to allow UI update before CPU burst
    setTimeout(() => {
      const probe = speedProbe(
        () => performance.now(),
        () => {
          let sum = 0;
          for (let i = 0; i < 200_000; i++) {
            sum += Math.sqrt(i) * Math.sin(i);
          }
          return sum;
        }
      );
      setSpeedResult(probe);
      setIsMeasuring(false);
    }, 50);
  };

  return (
    <ToolScreenShell
      toolName="Device Profile"
      tagline="What this phone and this app are"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-5">
        {errorMessage && <ErrorLine message={errorMessage} />}

        {/* Speed Probe Banner */}
        <div className="p-4 bg-[#18191C] border border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094] flex items-center gap-1.5">
              <Gauge size={14} className="text-[#E85A3C]" />
              <span>Speed Probe</span>
            </span>
            <div className="text-sm font-mono text-white">
              {speedResult && speedResult.milliseconds !== null ? (
                <span>
                  {Math.round(speedResult.milliseconds)} ms ({speedResult.label})
                </span>
              ) : (
                <span className="text-xs text-[#8E9094] font-sans">
                  Not measured yet
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleMeasureSpeed}
            disabled={isMeasuring}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-medium hover:bg-white/15 transition-colors cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto disabled:opacity-40"
          >
            <Gauge size={14} />
            <span>{isMeasuring ? 'Measuring...' : 'Measure speed'}</span>
          </button>
        </div>

        {/* Action Buttons: Copy report, Refresh */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleCopyReport}
            disabled={!report}
            className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied ? (
              <>
                <Check size={16} className="text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy report</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={gatherProfile}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-white/10 text-[#ECECEC] text-sm hover:bg-white/15 transition-colors cursor-pointer flex items-center justify-center gap-2"
            title="Refresh values"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Quiet line */}
        <p className="text-xs text-[#8E9094] text-center">
          Nothing leaves your phone.
        </p>

        {/* Plain Label and Value Rows */}
        {report && (
          <div className="bg-[#18191C] border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden">
            {report.rows.map((row) => (
              <div
                key={row.label}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 text-xs"
              >
                <span className="font-medium text-[#9A9B9F] shrink-0">
                  {row.label}
                </span>
                <span className="font-mono text-white select-text break-all text-left sm:text-right">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Options */}
        <OptionsDisclosure title="Options">
          <div className="space-y-2 pt-1 text-xs text-[#8E9094] leading-relaxed">
            <p>
              Values are queried directly from browser runtime APIs (such as
              navigator and window.screen) with no inference or guesswork.
            </p>
            <p>
              Absent or unsupported features strictly show as &ldquo;unknown&rdquo;.
            </p>
          </div>
        </OptionsDisclosure>
      </div>
    </ToolScreenShell>
  );
};

export default DeviceProfileScreen;
