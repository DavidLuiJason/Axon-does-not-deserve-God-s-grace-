import { encodeWav, decodeWav, wavSizeBytes, MAX_WAV_BYTES } from '../src/tools/audioEdit/wav';
import type { AudioData } from '../src/tools/audioEdit/audio';
let checks = 0;
function assert(v: boolean, m: string): void { checks++; if (!v) { throw new Error('FAIL: ' + m); } }
const text = (b: Uint8Array, o: number, n: number): string => String.fromCharCode(...Array.from(b.subarray(o, o + n)));
const SR = 8000;
const sine = new Float32Array(SR); for (let i = 0; i < SR; i++) sine[i] = 0.8 * Math.sin((2 * Math.PI * 440 * i) / SR);
const mono: AudioData = { sampleRate: SR, channels: [sine] };

const w = encodeWav(mono)!;
const v = new DataView(w.buffer, w.byteOffset, w.byteLength);
assert(w.length === wavSizeBytes(mono) && w.length === 44 + SR * 2, 'size equals wavSizeBytes');
assert(text(w, 0, 4) === 'RIFF' && text(w, 8, 4) === 'WAVE' && text(w, 12, 4) === 'fmt ' && text(w, 36, 4) === 'data', 'chunk names');
assert(v.getUint32(4, true) === 36 + SR * 2, 'RIFF size field');
assert(v.getUint32(16, true) === 16 && v.getUint16(20, true) === 1 && v.getUint16(22, true) === 1, 'fmt size, PCM, mono');
assert(v.getUint32(24, true) === SR && v.getUint32(28, true) === SR * 2 && v.getUint16(32, true) === 2 && v.getUint16(34, true) === 16, 'rate, byte rate, block align, bits');
assert(v.getUint32(40, true) === SR * 2, 'data size field');
// round trip
const back = decodeWav(w)!;
assert(back !== null && back.sampleRate === SR && back.channels.length === 1 && back.channels[0].length === SR, 'round trip shape');
let worst = 0; for (let i = 0; i < SR; i++) worst = Math.max(worst, Math.abs(back.channels[0][i] - sine[i]));
assert(worst <= 1 / 16384, `round trip within 1/16384 (worst ${worst})`);
// stereo order
const st: AudioData = { sampleRate: 44100, channels: [new Float32Array([0.5, -0.5]), new Float32Array([1, -1])] };
const ws = encodeWav(st)!;
const vs = new DataView(ws.buffer, ws.byteOffset, ws.byteLength);
assert(vs.getUint16(22, true) === 2 && vs.getUint32(28, true) === 44100 * 4 && vs.getUint16(32, true) === 4, 'stereo header');
assert(vs.getInt16(44, true) === Math.round(0.5 * 32767) && vs.getInt16(46, true) === 32767 && vs.getInt16(48, true) === -16384 && vs.getInt16(50, true) === -32768, 'stereo samples interleaved frame by frame');
const bs = decodeWav(ws)!;
assert(bs.channels.length === 2 && Math.abs(bs.channels[0][1] + 0.5) < 1e-4 && bs.channels[1][0] === 1 && bs.channels[1][1] === -1, 'stereo round trip');
// clipping
const loud = encodeWav({ sampleRate: SR, channels: [new Float32Array([2, -2, NaN])] })!;
const vl = new DataView(loud.buffer, loud.byteOffset, loud.byteLength);
assert(vl.getInt16(44, true) === 32767 && vl.getInt16(46, true) === -32768 && vl.getInt16(48, true) === 0, 'values beyond +-1 are clipped and NaN becomes silence');
// empty
const emptyWav = encodeWav({ sampleRate: SR, channels: [new Float32Array(0)] })!;
assert(emptyWav.length === 44 && new DataView(emptyWav.buffer).getUint32(40, true) === 0, 'empty audio is a valid 44-byte file');
const eb = decodeWav(emptyWav)!;
assert(eb !== null && eb.channels[0].length === 0, 'empty file decodes');
// refusals
assert(encodeWav({ sampleRate: SR, channels: [] }) === null, 'no channels gives null');
assert(encodeWav({ sampleRate: 0, channels: [new Float32Array(1)] }) === null && encodeWav({ sampleRate: 44100.5, channels: [new Float32Array(1)] }) === null && encodeWav({ sampleRate: -1, channels: [new Float32Array(1)] }) === null, 'bad sample rate gives null');
assert(encodeWav({ sampleRate: SR, channels: Array.from({ length: 9 }, () => new Float32Array(1)) }) === null, 'nine channels gives null');
const huge = { sampleRate: SR, channels: [{ length: MAX_WAV_BYTES } as unknown as Float32Array] } as AudioData;
assert(wavSizeBytes(huge) === 44 + MAX_WAV_BYTES * 2 && wavSizeBytes(huge) > MAX_WAV_BYTES && encodeWav(huge) === null, 'oversize is refused by the size rule without allocating');
// decode rejections
assert(decodeWav(new Uint8Array(10)) === null, 'too short');
const bad = new Uint8Array(w); bad[0] = 0x58; assert(decodeWav(bad) === null, 'wrong magic');
const eight = new Uint8Array(w); new DataView(eight.buffer).setUint16(34, 8, true); assert(decodeWav(eight) === null, '8-bit rejected');
assert(decodeWav(w.subarray(0, 100)) === null, 'truncated data rejected');
const notPcm = new Uint8Array(w); new DataView(notPcm.buffer).setUint16(20, 3, true); assert(decodeWav(notPcm) === null, 'non-PCM rejected');
const zeroCh = new Uint8Array(w); new DataView(zeroCh.buffer).setUint16(22, 0, true); assert(decodeWav(zeroCh) === null, 'zero channels rejected');
console.log(`=== all audioWav tests passed (${checks} checks) ===`);
