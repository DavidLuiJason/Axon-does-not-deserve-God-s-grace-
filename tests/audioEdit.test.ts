import { applyAudioOp, applyAudioOps, clampRange, durationSec, frameCount, peaks, type AudioData, type AudioOp } from '../src/tools/audioEdit/audio';
let checks = 0;
function assert(v: boolean, m: string): void { checks++; if (!v) { throw new Error('FAIL: ' + m); } }
const near = (a: number, b: number, e = 1e-6): boolean => Math.abs(a - b) <= e;
const SR = 8000;
function sine(frames: number, amp: number, freq: number): Float32Array {
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return out;
}
const mono: AudioData = { sampleRate: SR, channels: [sine(SR, 0.5, 440)] };
const stereo: AudioData = { sampleRate: SR, channels: [sine(SR, 0.5, 440), sine(SR, 0.25, 220)] };
const same = (a: AudioData, b: AudioData): boolean => a.sampleRate === b.sampleRate && a.channels.length === b.channels.length && a.channels.every((ch, c) => ch.length === b.channels[c].length && ch.every((v, i) => v === b.channels[c][i]));
const hasNaN = (a: AudioData): boolean => a.channels.some((ch) => ch.some((v) => Number.isNaN(v)));
const sigMono = JSON.stringify(Array.from(mono.channels[0])), sigSt = JSON.stringify(stereo.channels.map((c) => Array.from(c)));

assert(frameCount(mono) === SR && near(durationSec(mono), 1), 'frame count and duration');
assert(frameCount({ sampleRate: SR, channels: [] }) === 0 && durationSec({ sampleRate: 0, channels: [new Float32Array(5)] }) === 0, 'empty and zero rate');
// clampRange
assert(JSON.stringify(clampRange(0.2, 0.7, 1)) === '{"start":0.2,"end":0.7}', 'range normal');
assert(JSON.stringify(clampRange(0.9, 0.1, 1)) === '{"start":0.1,"end":0.9}', 'range swapped');
assert(JSON.stringify(clampRange(NaN, 5, 1)) === '{"start":0,"end":1}', 'range NaN and too large');
assert(JSON.stringify(clampRange(-3, -1, 1)) === '{"start":0,"end":0}', 'range negative');

// trim and cut
const tr = applyAudioOp(mono, { type: 'trim', start: 0.25, end: 0.75 });
assert(frameCount(tr) === SR / 2 && tr.channels[0][0] === mono.channels[0][SR / 4], 'trim keeps the right samples');
assert(frameCount(applyAudioOp(mono, { type: 'trim', start: 0.75, end: 0.25 })) === SR / 2, 'trim with start after end is reordered');
assert(frameCount(applyAudioOp(mono, { type: 'trim', start: NaN, end: NaN })) === 0, 'trim with NaN keeps nothing');
assert(frameCount(applyAudioOp(mono, { type: 'trim', start: 0, end: 99 })) === SR, 'trim beyond the end keeps all');
const cut = applyAudioOp(mono, { type: 'cut', start: 0.25, end: 0.5 });
assert(frameCount(cut) === SR - SR / 4 && cut.channels[0][SR / 4 - 1] === mono.channels[0][SR / 4 - 1] && cut.channels[0][SR / 4] === mono.channels[0][SR / 2], 'cut removes and joins');
assert(frameCount(applyAudioOp(mono, { type: 'cut', start: 0, end: 1 })) === 0, 'cut everything gives empty');
assert(same(applyAudioOp(mono, { type: 'cut', start: 0.5, end: 0.5 }), mono), 'cut of nothing changes nothing');
const trSt = applyAudioOp(stereo, { type: 'trim', start: 0, end: 0.5 });
assert(trSt.channels.length === 2 && frameCount(trSt) === SR / 2, 'stereo trim keeps both channels');

// fades
const full: AudioData = { sampleRate: SR, channels: [new Float32Array(SR).fill(1)] };
const fi = applyAudioOp(full, { type: 'fadeIn', seconds: 0.5 });
const len = SR / 2;
assert(fi.channels[0][0] === 0 && near(fi.channels[0][len / 2], 0.5) && fi.channels[0][len] === 1 && fi.channels[0][SR - 1] === 1, 'fade in: 0 at the start, half-way 0.5, full after');
const fo = applyAudioOp(full, { type: 'fadeOut', seconds: 0.5 });
assert(fo.channels[0][SR - 1] === 0 && near(fo.channels[0][SR - 1 - len / 2], 0.5) && fo.channels[0][SR - 1 - len] === 1 && fo.channels[0][0] === 1, 'fade out mirrors fade in');
const fl = applyAudioOp(full, { type: 'fadeIn', seconds: 99 });
assert(fl.channels[0][0] === 0 && fl.channels[0].length === SR && !hasNaN(fl), 'fade longer than the audio is limited');
assert(same(applyAudioOp(full, { type: 'fadeIn', seconds: 0 }), full) && same(applyAudioOp(full, { type: 'fadeOut', seconds: NaN }), full), 'zero or NaN fade changes nothing');
assert(applyAudioOp(stereo, { type: 'fadeIn', seconds: 0.1 }).channels.every((ch) => ch[0] === 0), 'fade applies to every channel');

// gain
assert(same(applyAudioOp(mono, { type: 'gain', db: 0 }), mono), 'gain 0 dB is identical');
const g6 = applyAudioOp(mono, { type: 'gain', db: 6 });
assert(Math.abs(g6.channels[0][SR / 8] / mono.channels[0][SR / 8] - 1.995) < 0.01, '+6 dB roughly doubles');
const gm = applyAudioOp(mono, { type: 'gain', db: -60 });
assert(gm.channels[0].every((v) => Math.abs(v) < 0.001), '-60 dB is almost silent');
const gc = applyAudioOp(mono, { type: 'gain', db: 24 });
assert(gc.channels[0].every((v) => v >= -1 && v <= 1) && gc.channels[0].some((v) => v === 1), 'gain clamps at +-1');
assert(same(applyAudioOp(mono, { type: 'gain', db: NaN }), mono), 'gain NaN is 0 dB');
assert(applyAudioOp(mono, { type: 'gain', db: 999 }).channels[0][SR / 8] === applyAudioOp(mono, { type: 'gain', db: 24 }).channels[0][SR / 8], 'gain over the limit equals the limit');

// normalize
const nm = applyAudioOp(stereo, { type: 'normalize' });
let pk = 0; for (const ch of nm.channels) for (const v of ch) pk = Math.max(pk, Math.abs(v));
assert(near(pk, 0.95), 'normalize peak is 0.95');
const silent: AudioData = { sampleRate: SR, channels: [new Float32Array(100)] };
assert(same(applyAudioOp(silent, { type: 'normalize' }), silent) && !hasNaN(applyAudioOp(silent, { type: 'normalize' })), 'silence stays silence');
const empty: AudioData = { sampleRate: SR, channels: [new Float32Array(0)] };
for (const op of [{ type: 'normalize' }, { type: 'gain', db: 3 }, { type: 'fadeIn', seconds: 1 }, { type: 'fadeOut', seconds: 1 }, { type: 'trim', start: 0, end: 1 }, { type: 'cut', start: 0, end: 1 }] as AudioOp[]) {
  const r = applyAudioOp(empty, op);
  assert(frameCount(r) === 0 && r.channels.length === 1, `empty audio survives ${op.type}`);
}
// results are new arrays and the input is never mutated
for (const op of [{ type: 'normalize' }, { type: 'gain', db: 6 }, { type: 'fadeIn', seconds: 0.2 }, { type: 'fadeOut', seconds: 0.2 }, { type: 'trim', start: 0, end: 0.5 }, { type: 'cut', start: 0.1, end: 0.2 }] as AudioOp[]) {
  const r = applyAudioOp(mono, op);
  assert(JSON.stringify(Array.from(mono.channels[0])) === sigMono, `${op.type} does not mutate its input`);
  assert(r.channels[0] !== mono.channels[0] && r.channels[0].buffer !== mono.channels[0].buffer, `${op.type} returns new arrays`);
}
const same2 = applyAudioOp(mono, { type: 'gain', db: 0 });
assert(same2.channels[0] !== mono.channels[0], 'even an unchanged result is a new array');
// ops chain
const chain: AudioOp[] = [{ type: 'trim', start: 0, end: 0.5 }, { type: 'fadeIn', seconds: 0.1 }, { type: 'gain', db: -3 }, { type: 'normalize' }];
let by = mono; for (const op of chain) by = applyAudioOp(by, op);
assert(same(applyAudioOps(mono, chain), by), 'applyAudioOps equals folding by hand');
assert(same(applyAudioOps(mono, []), mono) && applyAudioOps(mono, []).channels[0] !== mono.channels[0], 'no ops gives a copy');
assert(JSON.stringify(stereo.channels.map((c) => Array.from(c))) === sigSt, 'stereo input unchanged');

// peaks
const square: AudioData = { sampleRate: SR, channels: [new Float32Array([0.5, 0.5, -0.5, -0.5, 1, 1, -1, -1])] };
const p4 = peaks(square, 4);
assert(p4.min.length === 4 && p4.max.length === 4, 'peaks length equals buckets');
assert(p4.max[0] === 0.5 && p4.min[0] === 0.5 && p4.max[1] === -0.5 && p4.min[1] === -0.5 && p4.max[2] === 1 && p4.min[3] === -1, 'square wave peaks');
const p2 = peaks(square, 2);
assert(p2.min[0] === -0.5 && p2.max[0] === 0.5 && p2.min[1] === -1 && p2.max[1] === 1, 'two buckets combine frames');
const pm = peaks(mono, 100);
for (let k = 0; k < 100; k++) assert(pm.min[k] <= pm.max[k], 'min <= max everywhere');
const pb = peaks(square, 50);
assert(pb.min.length === 50 && pb.min.every((v, i) => v <= pb.max[i]) && !pb.min.some(Number.isNaN), 'more buckets than frames works');
assert(peaks(empty, 10).max.every((v) => v === 0) && peaks(empty, 10).min.length === 10, 'empty audio gives zeros');
assert(peaks(mono, 99999).min.length === 2000 && peaks(mono, 0).min.length === 1 && peaks(mono, NaN).min.length === 1, 'bucket count clamps');
const ps = peaks({ sampleRate: SR, channels: [new Float32Array([0.25, 0.25]), new Float32Array([-0.75, 0.75])] }, 1);
assert(ps.min[0] === -0.75 && ps.max[0] === 0.75, 'peaks combine all channels');
console.log(`=== all audioEdit tests passed (${checks} checks) ===`);
