/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure audio editing on sample arrays: trim, cut, fades, gain, normalize, waveform peaks.
 * Every operation returns brand-new arrays and never changes its input. No DOM, no React.
 */
export interface AudioData { sampleRate: number; channels: Float32Array[] }
export type AudioOp =
  | { type: 'trim'; start: number; end: number }
  | { type: 'cut'; start: number; end: number }
  | { type: 'fadeIn'; seconds: number }
  | { type: 'fadeOut'; seconds: number }
  | { type: 'gain'; db: number }
  | { type: 'normalize' };

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export function frameCount(a: AudioData): number { return a.channels.length > 0 ? a.channels[0].length : 0; }
export function durationSec(a: AudioData): number { return a.sampleRate > 0 ? frameCount(a) / a.sampleRate : 0; }

export function clampRange(start: number, end: number, duration: number): { start: number; end: number } {
  const d = Math.max(0, Number.isNaN(duration) ? 0 : duration);
  let s = Number.isNaN(start) ? 0 : start;
  let e = Number.isNaN(end) ? 0 : end;
  if (s > e) { const tmp = s; s = e; e = tmp; }
  return { start: clamp(s, 0, d), end: clamp(e, 0, d) };
}

const cloneAll = (a: AudioData): AudioData => ({ sampleRate: a.sampleRate, channels: a.channels.map((ch) => new Float32Array(ch)) });
const mapChannels = (a: AudioData, f: (ch: Float32Array) => Float32Array): AudioData => ({ sampleRate: a.sampleRate, channels: a.channels.map(f) });

export function applyAudioOp(a: AudioData, op: AudioOp): AudioData {
  const sr = a.sampleRate;
  const n = frameCount(a);
  switch (op.type) {
    case 'trim': {
      const r = clampRange(op.start, op.end, durationSec(a));
      const i0 = clamp(Math.round(r.start * sr), 0, n), i1 = clamp(Math.round(r.end * sr), 0, n);
      return mapChannels(a, (ch) => ch.slice(i0, Math.max(i0, i1)));
    }
    case 'cut': {
      const r = clampRange(op.start, op.end, durationSec(a));
      const i0 = clamp(Math.round(r.start * sr), 0, n), i1 = Math.max(i0, clamp(Math.round(r.end * sr), 0, n));
      return mapChannels(a, (ch) => {
        const out = new Float32Array(n - (i1 - i0));
        out.set(ch.subarray(0, i0), 0);
        out.set(ch.subarray(i1), i0);
        return out;
      });
    }
    case 'fadeIn': {
      const len = Math.min(n, Math.max(0, Math.round((Number.isNaN(op.seconds) ? 0 : op.seconds) * sr)));
      const out = cloneAll(a);
      if (len > 0) for (const ch of out.channels) for (let i = 0; i < len; i++) ch[i] = ch[i] * (i / len);
      return out;
    }
    case 'fadeOut': {
      const len = Math.min(n, Math.max(0, Math.round((Number.isNaN(op.seconds) ? 0 : op.seconds) * sr)));
      const out = cloneAll(a);
      if (len > 0) for (const ch of out.channels) for (let i = 0; i < len; i++) ch[n - 1 - i] = ch[n - 1 - i] * (i / len);
      return out;
    }
    case 'gain': {
      const db = clamp(Number.isNaN(op.db) ? 0 : op.db, -60, 24);
      const factor = Math.pow(10, db / 20);
      return mapChannels(a, (ch) => {
        const out = new Float32Array(ch.length);
        for (let i = 0; i < ch.length; i++) out[i] = clamp(ch[i] * factor, -1, 1);
        return out;
      });
    }
    case 'normalize': {
      let peak = 0;
      for (const ch of a.channels) for (let i = 0; i < ch.length; i++) { const v = Math.abs(ch[i]); if (v > peak) peak = v; }
      if (peak < 1e-9) return cloneAll(a);
      const factor = 0.95 / peak;
      return mapChannels(a, (ch) => {
        const out = new Float32Array(ch.length);
        for (let i = 0; i < ch.length; i++) out[i] = ch[i] * factor;
        return out;
      });
    }
  }
}

export function applyAudioOps(original: AudioData, ops: readonly AudioOp[]): AudioData {
  return ops.reduce<AudioData>((a, op) => applyAudioOp(a, op), cloneAll(original));
}

export function peaks(a: AudioData, buckets: number): { min: Float32Array; max: Float32Array } {
  const b = clamp(Math.round(Number.isNaN(buckets) ? 1 : buckets), 1, 2000);
  const min = new Float32Array(b), max = new Float32Array(b);
  const n = frameCount(a);
  if (n === 0) return { min, max };
  for (let k = 0; k < b; k++) {
    const s = Math.min(n - 1, Math.floor((k * n) / b));
    const e = Math.max(s + 1, Math.floor(((k + 1) * n) / b));
    let lo = Infinity, hi = -Infinity;
    for (const ch of a.channels) for (let i = s; i < e && i < ch.length; i++) { const v = ch[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    min[k] = Number.isFinite(lo) ? lo : 0;
    max[k] = Number.isFinite(hi) ? hi : 0;
  }
  return { min, max };
}
