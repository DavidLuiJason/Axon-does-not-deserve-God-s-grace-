/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Timer Screen: Count down to zero.
 * Uses the pure time engine in src/tools/engines/time/timer.ts.
 * Timestamps ensure time stays exact across backgrounding and screen switches.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Pause, Play, RotateCcw } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import { ErrorLine, OptionsDisclosure } from '../tools/ToolParts';
import {
  createTimer,
  formatTimerHms,
  pauseTimer,
  resetTimer,
  resumeTimer,
  startTimer,
  tickTimer,
  type TimerState,
} from '../../tools/engines/time/timer';
import { createToolStore } from '../../tools/shared/toolStore';

export const toolScreen = { toolId: 'timer' };

export interface TimerScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

interface SavedTimerPayload {
  timer: TimerState;
  hours: number;
  minutes: number;
  seconds: number;
}

export const TimerScreen: React.FC<TimerScreenProps> = ({ onBack, onLogoClick }) => {
  const store = useMemo(
    () => createToolStore('timer', typeof window !== 'undefined' ? window.localStorage : undefined),
    []
  );

  const [timer, setTimer] = useState<TimerState>(() => createTimer());
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(5);
  const [seconds, setSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasVibratedRef = useRef<boolean>(false);

  // Restore saved state from toolStore on mount
  useEffect(() => {
    const res = store.get('active_timer');
    if (res.ok && res.value && typeof res.value === 'object') {
      const payload = res.value as Partial<SavedTimerPayload>;
      if (typeof payload.hours === 'number') setHours(Math.max(0, Math.min(99, payload.hours)));
      if (typeof payload.minutes === 'number') setMinutes(Math.max(0, Math.min(59, payload.minutes)));
      if (typeof payload.seconds === 'number') setSeconds(Math.max(0, Math.min(59, payload.seconds)));

      if (payload.timer && typeof payload.timer === 'object') {
        const restored = payload.timer as TimerState;
        if (restored.status === 'running') {
          const now = Date.now();
          const ticked = tickTimer(restored, now);
          if (ticked.ok) {
            setTimer(ticked.value.state);
            if (ticked.value.state.status === 'finished') {
              triggerVibration();
            }
          }
        } else {
          setTimer(restored);
        }
      }
    }
  }, [store]);

  // Save current timer state to toolStore
  const saveState = (nextTimer: TimerState, h = hours, m = minutes, s = seconds) => {
    store.set('active_timer', {
      timer: nextTimer,
      hours: h,
      minutes: m,
      seconds: s,
    });
  };

  // Vibration handler
  const triggerVibration = () => {
    if (hasVibratedRef.current) return;
    hasVibratedRef.current = true;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([300, 150, 300, 150, 300]);
      } catch {
        // Safe fallback on platforms where vibrate is blocked
      }
    }
  };

  // Live timer interval loop using engine timestamps
  useEffect(() => {
    if (timer.status !== 'running') return;

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const ticked = tickTimer(timer, now);
      if (ticked.ok) {
        setTimer(ticked.value.state);
        saveState(ticked.value.state);
        if (ticked.value.state.status === 'finished') {
          triggerVibration();
        }
      }
    }, 200);

    return () => window.clearInterval(intervalId);
  }, [timer]);

  const handleStart = () => {
    setErrorMessage(null);
    hasVibratedRef.current = false;
    const durationMs = (hours * 3600 + minutes * 60 + seconds) * 1000;

    if (durationMs <= 0) {
      setErrorMessage('Set a time greater than zero.');
      return;
    }

    const now = Date.now();
    const res = startTimer(durationMs, now);
    if (!res.ok) {
      setErrorMessage(`Cannot start timer: ${res.error}`);
      return;
    }

    setTimer(res.value);
    saveState(res.value);
  };

  const handlePause = () => {
    setErrorMessage(null);
    const now = Date.now();
    const res = pauseTimer(timer, now);
    if (!res.ok) {
      setErrorMessage(`Cannot pause timer: ${res.error}`);
      return;
    }
    setTimer(res.value);
    saveState(res.value);
  };

  const handleResume = () => {
    setErrorMessage(null);
    const now = Date.now();
    const res = resumeTimer(timer, now);
    if (!res.ok) {
      setErrorMessage(`Cannot resume timer: ${res.error}`);
      return;
    }
    setTimer(res.value);
    saveState(res.value);
  };

  const handleReset = () => {
    setErrorMessage(null);
    hasVibratedRef.current = false;
    const next = resetTimer();
    setTimer(next);
    saveState(next);
  };

  const setPreset = (h: number, m: number, s: number) => {
    setHours(h);
    setMinutes(m);
    setSeconds(s);
    setErrorMessage(null);
  };

  // Display computation
  const displayMs = timer.status === 'idle'
    ? (hours * 3600 + minutes * 60 + seconds) * 1000
    : timer.remainingMs;

  const isConfigurable = timer.status === 'idle' || timer.status === 'finished';

  return (
    <ToolScreenShell
      toolName="Timer"
      tagline="Count down to zero"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-5">
        {/* Large Countdown Display */}
        <div className="p-6 bg-[#18191C] border border-white/10 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
          <div className="font-mono text-5xl sm:text-6xl font-medium tracking-tight text-white select-text tabular-nums">
            {formatTimerHms(displayMs)}
          </div>

          {timer.status === 'finished' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E85A3C]/20 border border-[#E85A3C]/40 text-[#E85A3C] text-sm font-medium animate-pulse">
              <Bell size={15} />
              <span>Time is up</span>
            </div>
          )}

          {timer.status === 'running' && (
            <div className="text-xs uppercase tracking-wider text-emerald-400 font-medium">
              Running
            </div>
          )}

          {timer.status === 'paused' && (
            <div className="text-xs uppercase tracking-wider text-amber-400 font-medium">
              Paused
            </div>
          )}
        </div>

        {/* Input Controls (available when idle or finished) */}
        {isConfigurable && (
          <div className="p-4 bg-[#18191C]/70 border border-white/5 rounded-2xl space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
              Set Duration
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="timer-hours" className="block text-xs text-[#8E9094] mb-1">
                  Hours
                </label>
                <input
                  id="timer-hours"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  max={99}
                  value={hours === 0 ? '' : hours}
                  placeholder="0"
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setHours(isNaN(v) ? 0 : Math.max(0, Math.min(99, v)));
                  }}
                  className="w-full min-h-[44px] bg-[#121315] border border-white/10 rounded-xl px-3 py-2 text-center font-mono text-base text-white focus:outline-none focus:border-[#E85A3C] transition-colors"
                />
              </div>

              <div>
                <label htmlFor="timer-minutes" className="block text-xs text-[#8E9094] mb-1">
                  Minutes
                </label>
                <input
                  id="timer-minutes"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  max={59}
                  value={minutes === 0 ? '' : minutes}
                  placeholder="0"
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setMinutes(isNaN(v) ? 0 : Math.max(0, Math.min(59, v)));
                  }}
                  className="w-full min-h-[44px] bg-[#121315] border border-white/10 rounded-xl px-3 py-2 text-center font-mono text-base text-white focus:outline-none focus:border-[#E85A3C] transition-colors"
                />
              </div>

              <div>
                <label htmlFor="timer-seconds" className="block text-xs text-[#8E9094] mb-1">
                  Seconds
                </label>
                <input
                  id="timer-seconds"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  max={59}
                  value={seconds === 0 ? '' : seconds}
                  placeholder="0"
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setSeconds(isNaN(v) ? 0 : Math.max(0, Math.min(59, v)));
                  }}
                  className="w-full min-h-[44px] bg-[#121315] border border-white/10 rounded-xl px-3 py-2 text-center font-mono text-base text-white focus:outline-none focus:border-[#E85A3C] transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {errorMessage && <ErrorLine message={errorMessage} />}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          {timer.status === 'idle' || timer.status === 'finished' ? (
            <button
              type="button"
              onClick={handleStart}
              className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <Play size={16} fill="currentColor" />
              <span>Start</span>
            </button>
          ) : timer.status === 'running' ? (
            <button
              type="button"
              onClick={handlePause}
              className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <Pause size={16} fill="currentColor" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResume}
              className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <Play size={16} fill="currentColor" />
              <span>Resume</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            disabled={timer.status === 'idle' && hours === 0 && minutes === 0 && seconds === 0}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-white/10 text-[#ECECEC] text-sm hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>
        </div>

        {/* Quiet disclaimer line */}
        <p className="text-xs text-[#8E9094] text-center">
          Alerts only while AXON is open.
        </p>

        {/* Presets and Options */}
        <OptionsDisclosure title="Options">
          <div className="space-y-2 pt-1">
            <span className="text-xs text-[#8E9094] block">Presets</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreset(0, 1, 0)}
                disabled={!isConfigurable}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#ECECEC] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                1 min
              </button>
              <button
                type="button"
                onClick={() => setPreset(0, 5, 0)}
                disabled={!isConfigurable}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#ECECEC] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                5 min
              </button>
              <button
                type="button"
                onClick={() => setPreset(0, 10, 0)}
                disabled={!isConfigurable}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#ECECEC] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                10 min
              </button>
              <button
                type="button"
                onClick={() => setPreset(0, 15, 0)}
                disabled={!isConfigurable}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#ECECEC] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                15 min
              </button>
              <button
                type="button"
                onClick={() => setPreset(0, 25, 0)}
                disabled={!isConfigurable}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#ECECEC] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                25 min
              </button>
              <button
                type="button"
                onClick={() => setPreset(0, 30, 0)}
                disabled={!isConfigurable}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#ECECEC] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                30 min
              </button>
              <button
                type="button"
                onClick={() => setPreset(1, 0, 0)}
                disabled={!isConfigurable}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#ECECEC] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                1 hour
              </button>
            </div>
          </div>
        </OptionsDisclosure>
      </div>
    </ToolScreenShell>
  );
};

export default TimerScreen;
