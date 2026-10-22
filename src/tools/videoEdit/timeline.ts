/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure video timeline: the list of pieces (clips) and the steps that change it.
 * Seconds are plain numbers. The video file itself is never touched. No DOM, no React.
 */
export interface Clip { id: string; sourceId: string; start: number; end: number; speed: number; volume: number; srcLength: number }
export interface Timeline { clips: Clip[]; nextId: number }
export type TimelineOp =
  | { type: 'addClip'; sourceId: string; duration: number }
  | { type: 'split'; at: number }
  | { type: 'trim'; clipId: string; start: number; end: number }
  | { type: 'delete'; clipId: string }
  | { type: 'move'; clipId: string; toIndex: number }
  | { type: 'speed'; clipId: string; speed: number }
  | { type: 'volume'; clipId: string; volume: number };

export const MIN_CLIP_SECONDS = 0.1;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export function emptyTimeline(): Timeline { return { clips: [], nextId: 1 }; }
export function clipDuration(c: Clip): number { return (c.end - c.start) / c.speed; }
export function totalDuration(t: Timeline): number { return t.clips.reduce((s, c) => s + clipDuration(c), 0); }

/** The clip that holds timeline time "time", with the timeline second where that clip starts. */
function locate(t: Timeline, time: number): { index: number; startsAt: number } | null {
  if (Number.isNaN(time) || time < 0) return null;
  let s = 0;
  for (let i = 0; i < t.clips.length; i++) {
    const d = clipDuration(t.clips[i]);
    if (time >= s && time < s + d) return { index: i, startsAt: s };
    s += d;
  }
  return null;
}

export function timeToSource(t: Timeline, time: number): { clipId: string; sourceTime: number } | null {
  const hit = locate(t, time);
  if (!hit) return null;
  const clip = t.clips[hit.index];
  return { clipId: clip.id, sourceTime: clip.start + (time - hit.startsAt) * clip.speed };
}

const copy = (t: Timeline): Timeline => ({ clips: t.clips.map((c) => ({ ...c })), nextId: t.nextId });

export function applyTimelineOp(t: Timeline, op: TimelineOp): Timeline {
  const out = copy(t);
  switch (op.type) {
    case 'addClip': {
      if (Number.isNaN(op.duration)) return out;
      const duration = Math.max(MIN_CLIP_SECONDS, op.duration);
      out.clips.push({ id: 'c' + out.nextId, sourceId: op.sourceId, start: 0, end: duration, speed: 1, volume: 1, srcLength: duration });
      out.nextId += 1;
      return out;
    }
    case 'split': {
      const hit = locate(out, op.at);
      if (!hit) return out;
      const clip = out.clips[hit.index];
      const localT = op.at - hit.startsAt;
      if (localT < MIN_CLIP_SECONDS || clipDuration(clip) - localT < MIN_CLIP_SECONDS) return out;
      const cutSource = clip.start + localT * clip.speed;
      const second: Clip = { ...clip, id: 'c' + out.nextId, start: cutSource };
      out.nextId += 1;
      clip.end = cutSource;
      out.clips.splice(hit.index + 1, 0, second);
      return out;
    }
    case 'trim': {
      const clip = out.clips.find((c) => c.id === op.clipId);
      if (!clip || Number.isNaN(op.start) || Number.isNaN(op.end)) return out;
      if (clip.srcLength < MIN_CLIP_SECONDS) return out;
      let s = clamp(op.start, 0, clip.srcLength);
      let e = clamp(op.end, 0, clip.srcLength);
      if (e - s < MIN_CLIP_SECONDS) {
        e = s + MIN_CLIP_SECONDS;
        if (e > clip.srcLength) { e = clip.srcLength; s = clip.srcLength - MIN_CLIP_SECONDS; }
      }
      clip.start = s;
      clip.end = e;
      return out;
    }
    case 'delete':
      out.clips = out.clips.filter((c) => c.id !== op.clipId);
      return out;
    case 'move': {
      const from = out.clips.findIndex((c) => c.id === op.clipId);
      if (from < 0 || Number.isNaN(op.toIndex)) return out;
      const to = clamp(Math.floor(op.toIndex), 0, out.clips.length - 1);
      const [clip] = out.clips.splice(from, 1);
      out.clips.splice(to, 0, clip);
      return out;
    }
    case 'speed': {
      const clip = out.clips.find((c) => c.id === op.clipId);
      if (clip && !Number.isNaN(op.speed)) clip.speed = clamp(op.speed, 0.25, 4);
      return out;
    }
    case 'volume': {
      const clip = out.clips.find((c) => c.id === op.clipId);
      if (clip && !Number.isNaN(op.volume)) clip.volume = clamp(op.volume, 0, 2);
      return out;
    }
  }
}

export function applyTimelineOps(ops: readonly TimelineOp[]): Timeline {
  return ops.reduce<Timeline>((t, op) => applyTimelineOp(t, op), emptyTimeline());
}

export const ASPECTS: readonly { id: string; label: string; ratio: number }[] = [
  { id: 'original', label: 'Original', ratio: 0 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
];

const even = (n: number): number => n - (n % 2);

export function cropForAspect(videoW: number, videoH: number, aspectId: string): { x: number; y: number; w: number; h: number } {
  const vw = Math.max(2, Math.round(Number.isNaN(videoW) ? 2 : videoW));
  const vh = Math.max(2, Math.round(Number.isNaN(videoH) ? 2 : videoH));
  const aspect = ASPECTS.find((a) => a.id === aspectId);
  if (!aspect || aspect.id === 'original') return { x: 0, y: 0, w: vw, h: vh };
  const r = aspect.ratio;
  let w: number, h: number;
  if (vw / vh > r) { h = vh; w = h * r; } else { w = vw; h = w / r; }
  w = Math.max(2, Math.min(even(vw), even(Math.floor(w))));
  h = Math.max(2, Math.min(even(vh), even(Math.floor(h))));
  return { x: even(Math.floor((vw - w) / 2)), y: even(Math.floor((vh - h) / 2)), w, h };
}
