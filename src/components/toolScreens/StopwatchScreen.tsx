/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stopwatch Screen: Time anything.
 * Uses the pure stopwatch engine in src/tools/engines/time/stopwatch.ts.
 * Timestamps ensure time stays exact across backgrounding and screen switches.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Flag, Pause, Play, RotateCcw } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import { copyToClipboard, ErrorLine, OptionsDisclosure } from '../tools/ToolParts';
import {
  createStopwatch,
  lapStopwatch,
  pauseStopwatch,
  resetStopwatch,
  resumeStopwatch,
  startStopwatch,
  tickStopwatch,
  type StopwatchState,
} from '../../tools/engines/time/stopwatch';
import { createToolStore } from '../../tools/shared/toolStore';

export const toolScreen = { toolId: 'stopwatch' };

export interface StopwatchScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

const MAX_LAPS = 100;

function formatStopwatchTime(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSec = Math.floor(safe / 1000);
  const tenths = Math.floor((safe % 1000) / 100);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}.${tenths}`;
  }
  return `${pad(minutes)}:${pad(seconds)}.${tenths}`;
}

export const StopwatchScreen: React.FC<StopwatchScreenProps> = ({ onBack, onLogoClick }) => {
  const store = useMemo(
    () => createToolStore('stopwatch', typeof window !== 'undefined' ? window.localStorage : undefined),
    []
  );

  const [state, setState] = useState<StopwatchState>(() => createStopwatch());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLaps, setCopiedLaps] = useState<boolean>(false);

  // Restore saved state from toolStore on mount
  useEffect(() => {
    const res = store.get('active_stopwatch');
    if (res.ok && res.value && typeof res.value === 'object') {
      const restored = res.value as StopwatchState;
      if (restored.status === 'running') {
        const now = Date.now();
        const ticked = tickStopwatch(restored, now);
        if (ticked.ok) {
          setState(ticked.value);
        } else {
          setState(restored);
        }
      } else {
        setState(restored);
      }
    }
  }, [store]);

  // Persist state to toolStore
  const saveState = (next: StopwatchState) => {
    store.set('active_stopwatch', next);
  };

  // Live timer interval loop using engine timestamps
  useEffect(() => {
    if (state.status !== 'running') return;

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const ticked = tickStopwatch(state, now);
      if (ticked.ok) {
        setState(ticked.value);
        saveState(ticked.value);
      }
    }, 50);

    return () => window.clearInterval(intervalId);
  }, [state]);

  const handleStart = () => {
    setErrorMessage(null);
    const now = Date.now();
    const res = startStopwatch(now);
    if (!res.ok) {
      setErrorMessage(`Cannot start stopwatch: ${res.error}`);
      return;
    }
    setState(res.value);
    saveState(res.value);
  };

  const handlePause = () => {
    setErrorMessage(null);
    const now = Date.now();
    const res = pauseStopwatch(state, now);
    if (!res.ok) {
      setErrorMessage(`Cannot pause stopwatch: ${res.error}`);
      return;
    }
    setState(res.value);
    saveState(res.value);
  };

  const handleResume = () => {
    setErrorMessage(null);
    const now = Date.now();
    const res = resumeStopwatch(state, now);
    if (!res.ok) {
      setErrorMessage(`Cannot resume stopwatch: ${res.error}`);
      return;
    }
    setState(res.value);
    saveState(res.value);
  };

  const handleLap = () => {
    setErrorMessage(null);
    if (state.laps.length >= MAX_LAPS) {
      setErrorMessage('Maximum of 100 laps recorded.');
      return;
    }
    const now = Date.now();
    const res = lapStopwatch(state, now);
    if (!res.ok) {
      setErrorMessage(`Cannot record lap: ${res.error}`);
      return;
    }
    setState(res.value);
    saveState(res.value);
  };

  const handleReset = () => {
    setErrorMessage(null);
    const next = resetStopwatch();
    setState(next);
    saveState(next);
  };

  const handleCopyLaps = async () => {
    if (state.laps.length === 0) return;
    const lines = state.laps.map(
      (lap, index) =>
        `Lap ${index + 1}: Split ${formatStopwatchTime(lap.splitMs)}, Total ${formatStopwatchTime(lap.totalMs)}`
    );
    const text = lines.join('\n');
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedLaps(true);
      setTimeout(() => setCopiedLaps(false), 2000);
    }
  };

  // Laps listed newest first
  const reversedLaps = useMemo(() => {
    return state.laps
      .map((lap, index) => ({ ...lap, lapNumber: index + 1 }))
      .reverse();
  }, [state.laps]);

  return (
    <ToolScreenShell
      toolName="Stopwatch"
      tagline="Time anything"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-5">
        {/* Large Elapsed Time Display with Tenths */}
        <div className="p-6 bg-[#18191C] border border-white/10 rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
          <div className="font-mono text-5xl sm:text-6xl font-medium tracking-tight text-white select-text tabular-nums">
            {formatStopwatchTime(state.elapsedMs)}
          </div>

          <div className="text-xs uppercase tracking-wider font-medium">
            {state.status === 'running' && <span className="text-emerald-400">Running</span>}
            {state.status === 'paused' && <span className="text-amber-400">Paused</span>}
            {state.status === 'idle' && <span className="text-[#8E9094]">Ready</span>}
          </div>
        </div>

        {errorMessage && <ErrorLine message={errorMessage} />}

        {/* Action Controls */}
        <div className="flex items-center gap-3 pt-1">
          {state.status === 'idle' ? (
            <button
              type="button"
              onClick={handleStart}
              className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <Play size={16} fill="currentColor" />
              <span>Start</span>
            </button>
          ) : state.status === 'running' ? (
            <>
              <button
                type="button"
                onClick={handlePause}
                className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Pause size={16} fill="currentColor" />
                <span>Stop</span>
              </button>

              <button
                type="button"
                onClick={handleLap}
                disabled={state.laps.length >= MAX_LAPS}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-white/10 text-white font-medium text-sm hover:bg-white/15 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Flag size={15} />
                <span>Lap</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleResume}
                className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Play size={16} fill="currentColor" />
                <span>Resume</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-white/10 text-[#ECECEC] text-sm hover:bg-white/15 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                <span>Reset</span>
              </button>
            </>
          )}

          {state.status === 'idle' && (
            <button
              type="button"
              onClick={handleReset}
              disabled={state.elapsedMs === 0 && state.laps.length === 0}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-white/10 text-[#ECECEC] text-sm hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Laps List (Newest First) */}
        {reversedLaps.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#8E9094] px-1">
              <span>
                Laps ({state.laps.length} / {MAX_LAPS})
              </span>
              <button
                type="button"
                onClick={handleCopyLaps}
                className="flex items-center gap-1.5 text-xs text-[#9A9B9F] hover:text-white transition-colors cursor-pointer"
              >
                {copiedLaps ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy laps</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-[#18191C] border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden max-h-80 overflow-y-auto">
              {reversedLaps.map((lap) => (
                <div
                  key={lap.lapNumber}
                  className="px-4 py-3 flex items-center justify-between text-sm font-mono tabular-nums"
                >
                  <span className="text-xs font-sans text-[#8E9094]">
                    Lap {lap.lapNumber}
                  </span>
                  <div className="flex items-center gap-6">
                    <span className="text-[#8E9094] text-xs">
                      +{formatStopwatchTime(lap.splitMs)}
                    </span>
                    <span className="text-white font-medium">
                      {formatStopwatchTime(lap.totalMs)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.laps.length === 0 && (
          <div className="p-4 bg-[#18191C]/50 border border-white/5 rounded-2xl text-xs text-[#8E9094] italic text-center">
            Tap Lap while running to record lap times.
          </div>
        )}

        {/* Options */}
        <OptionsDisclosure title="Options">
          <div className="space-y-3 pt-1">
            <div className="text-xs text-[#8E9094] leading-relaxed">
              Timestamps are recorded from your device clock so timings stay exact even when you leave AXON or lock the phone.
            </div>

            {state.laps.length > 0 && (
              <button
                type="button"
                onClick={handleCopyLaps}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white transition-colors cursor-pointer flex items-center gap-2"
              >
                <Copy size={14} />
                <span>Copy all laps to clipboard</span>
              </button>
            )}
          </div>
        </OptionsDisclosure>
      </div>
    </ToolScreenShell>
  );
};

export default StopwatchScreen;
