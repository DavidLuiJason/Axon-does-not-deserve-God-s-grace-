import {
  emptyTimeline, applyTimelineOp, applyTimelineOps, clipDuration, totalDuration, timeToSource,
  cropForAspect, ASPECTS, MIN_CLIP_SECONDS, type Timeline, type TimelineOp,
} from '../src/tools/videoEdit/timeline';
let checks = 0;
function assert(v: boolean, m: string): void { checks++; if (!v) { throw new Error('FAIL: ' + m); } }
const near = (a: number, b: number, e = 1e-9): boolean => Math.abs(a - b) <= e;
const snap = (t: Timeline): string => JSON.stringify(t);

const e = emptyTimeline();
assert(e.clips.length === 0 && e.nextId === 1 && totalDuration(e) === 0, 'empty timeline');
const t1 = applyTimelineOp(e, { type: 'addClip', sourceId: 'a', duration: 10 });
const t2 = applyTimelineOp(t1, { type: 'addClip', sourceId: 'b', duration: 6 });
assert(t2.clips.map((c) => c.id).join() === 'c1,c2' && t2.nextId === 3, 'addClip ids');
assert(t2.clips[0].start === 0 && t2.clips[0].end === 10 && t2.clips[0].srcLength === 10 && t2.clips[0].speed === 1 && t2.clips[0].volume === 1, 'addClip defaults');
assert(near(totalDuration(t2), 16), 'total duration 16');
assert(applyTimelineOp(e, { type: 'addClip', sourceId: 'a', duration: NaN }).clips.length === 0, 'NaN duration ignored');
assert(applyTimelineOp(e, { type: 'addClip', sourceId: 'a', duration: 0 }).clips[0].end === MIN_CLIP_SECONDS, 'tiny duration raised to minimum');

// split
const s = applyTimelineOp(t2, { type: 'split', at: 4 });
assert(s.clips.length === 3 && s.clips[0].id === 'c1' && s.clips[1].id === 'c3' && s.clips[2].id === 'c2' && s.nextId === 4, 'split ids and order');
assert(near(clipDuration(s.clips[0]), 4) && near(clipDuration(s.clips[1]), 6) && near(totalDuration(s), 16), 'split durations add up');
assert(s.clips[0].end === 4 && s.clips[1].start === 4 && s.clips[1].end === 10, 'split source positions');
assert(snap(applyTimelineOp(t2, { type: 'split', at: 0.05 })) === snap(t2), 'split too close to start does nothing');
assert(snap(applyTimelineOp(t2, { type: 'split', at: 9.95 })) === snap(t2), 'split too close to end does nothing');
assert(snap(applyTimelineOp(t2, { type: 'split', at: 99 })) === snap(t2) && snap(applyTimelineOp(t2, { type: 'split', at: -1 })) === snap(t2) && snap(applyTimelineOp(t2, { type: 'split', at: NaN })) === snap(t2), 'split outside or NaN does nothing');
const fast = applyTimelineOp(applyTimelineOp(t1, { type: 'speed', clipId: 'c1', speed: 2 }), { type: 'split', at: 2 });
assert(near(fast.clips[0].end, 4) && near(fast.clips[1].start, 4) && near(clipDuration(fast.clips[0]), 2) && fast.clips[1].speed === 2, 'split at speed 2 cuts at source second 4');

// trim
const tr = applyTimelineOp(t2, { type: 'trim', clipId: 'c1', start: 2, end: 7 });
assert(tr.clips[0].start === 2 && tr.clips[0].end === 7 && near(totalDuration(tr), 11), 'trim');
const trc = applyTimelineOp(t2, { type: 'trim', clipId: 'c1', start: -5, end: 99 });
assert(trc.clips[0].start === 0 && trc.clips[0].end === 10, 'trim clamps to source');
const trm = applyTimelineOp(t2, { type: 'trim', clipId: 'c1', start: 5, end: 5.01 });
assert(near(trm.clips[0].end - trm.clips[0].start, MIN_CLIP_SECONDS) && trm.clips[0].start === 5, 'trim keeps the 0.1 s minimum');
const trend = applyTimelineOp(t2, { type: 'trim', clipId: 'c1', start: 10, end: 10 });
assert(near(trend.clips[0].end, 10) && near(trend.clips[0].start, 9.9), 'trim at the very end moves start back');
assert(snap(applyTimelineOp(t2, { type: 'trim', clipId: 'zz', start: 1, end: 2 })) === snap(t2) && snap(applyTimelineOp(t2, { type: 'trim', clipId: 'c1', start: NaN, end: 2 })) === snap(t2), 'trim unknown id or NaN');

// delete, move
assert(applyTimelineOp(t2, { type: 'delete', clipId: 'c1' }).clips.map((c) => c.id).join() === 'c2', 'delete');
assert(snap(applyTimelineOp(t2, { type: 'delete', clipId: 'nope' })) === snap(t2), 'delete unknown id');
const t3 = applyTimelineOp(t2, { type: 'addClip', sourceId: 'c', duration: 3 });
const ids = (t: Timeline): string => t.clips.map((c) => c.id).join();
assert(ids(applyTimelineOp(t3, { type: 'move', clipId: 'c3', toIndex: 0 })) === 'c3,c1,c2', 'move to start');
assert(ids(applyTimelineOp(t3, { type: 'move', clipId: 'c1', toIndex: 2 })) === 'c2,c3,c1', 'move to end');
assert(ids(applyTimelineOp(t3, { type: 'move', clipId: 'c1', toIndex: 99 })) === 'c2,c3,c1', 'move index too big');
assert(ids(applyTimelineOp(t3, { type: 'move', clipId: 'c3', toIndex: -5 })) === 'c3,c1,c2', 'move index too small');
assert(ids(applyTimelineOp(t3, { type: 'move', clipId: 'c3', toIndex: NaN })) === 'c1,c2,c3', 'move NaN index');

// speed, volume
const sp = (v: number): number => applyTimelineOp(t1, { type: 'speed', clipId: 'c1', speed: v }).clips[0].speed;
assert(sp(0.1) === 0.25 && sp(9) === 4 && sp(1.5) === 1.5 && sp(NaN) === 1, 'speed clamps');
const vo = (v: number): number => applyTimelineOp(t1, { type: 'volume', clipId: 'c1', volume: v }).clips[0].volume;
assert(vo(-1) === 0 && vo(5) === 2 && vo(0.5) === 0.5 && vo(NaN) === 1, 'volume clamps');

// duration and time mapping with speeds
const mixed = applyTimelineOp(applyTimelineOp(t2, { type: 'speed', clipId: 'c1', speed: 0.5 }), { type: 'speed', clipId: 'c2', speed: 2 });
assert(near(clipDuration(mixed.clips[0]), 20) && near(clipDuration(mixed.clips[1]), 3) && near(totalDuration(mixed), 23), 'duration with speeds 0.5 and 2');
const m1 = timeToSource(mixed, 10)!;
assert(m1.clipId === 'c1' && near(m1.sourceTime, 5), 'time maps into the first clip at half speed');
const m2 = timeToSource(mixed, 21)!;
assert(m2.clipId === 'c2' && near(m2.sourceTime, 2), 'time maps into the second clip at double speed');
assert(timeToSource(mixed, 23) === null && timeToSource(mixed, 99) === null && timeToSource(mixed, -1) === null && timeToSource(mixed, NaN) === null, 'time outside the timeline gives null');
assert(timeToSource(mixed, 0)!.sourceTime === 0, 'time zero');

// ops never mutate input
const before = snap(t3);
const all: TimelineOp[] = [
  { type: 'split', at: 3 }, { type: 'trim', clipId: 'c1', start: 1, end: 2 }, { type: 'delete', clipId: 'c1' },
  { type: 'move', clipId: 'c1', toIndex: 2 }, { type: 'speed', clipId: 'c1', speed: 2 }, { type: 'volume', clipId: 'c1', volume: 2 },
  { type: 'addClip', sourceId: 'z', duration: 1 },
];
for (const op of all) { applyTimelineOp(t3, op); assert(snap(t3) === before, `op ${op.type} does not mutate its input`); }
const ops: TimelineOp[] = [{ type: 'addClip', sourceId: 'a', duration: 10 }, { type: 'split', at: 5 }, { type: 'speed', clipId: 'c2', speed: 2 }];
let by = emptyTimeline(); for (const op of ops) by = applyTimelineOp(by, op);
assert(snap(applyTimelineOps(ops)) === snap(by), 'applyTimelineOps equals folding by hand');
assert(snap(applyTimelineOps([])) === snap(emptyTimeline()), 'no ops gives the empty timeline');

// crop for aspect
const sizes: [number, number][] = [[1920, 1080], [1080, 1920], [1000, 1000], [3, 3], [1921, 1081]];
for (const [w, h] of sizes) for (const a of ASPECTS) {
  const r = cropForAspect(w, h, a.id);
  const vw = Math.max(2, w), vh = Math.max(2, h);
  assert(r.x >= 0 && r.y >= 0 && r.x + r.w <= vw && r.y + r.h <= vh, `crop inside ${w}x${h} ${a.id}`);
  if (a.id !== 'original') {
    assert(r.w % 2 === 0 && r.h % 2 === 0 && r.x % 2 === 0 && r.y % 2 === 0, `crop even ${w}x${h} ${a.id}`);
    if (Math.min(w, h) >= 100) assert(Math.abs(r.w / r.h - a.ratio) / a.ratio < 0.02, `crop ratio ${w}x${h} ${a.id}`);
  } else assert(r.x === 0 && r.y === 0 && r.w === vw && r.h === vh, 'original is the full frame');
}
assert(cropForAspect(1920, 1080, 'nope').w === 1920, 'unknown aspect is the full frame');
assert(cropForAspect(NaN, NaN, '1:1').w === 2, 'NaN size');
{ const r = cropForAspect(1920, 1080, '9:16'); assert(r.h === 1080 && r.w === 606, '9:16 of 1920x1080 is 606 wide'); }
console.log(`=== all videoTimeline tests passed (${checks} checks) ===`);
