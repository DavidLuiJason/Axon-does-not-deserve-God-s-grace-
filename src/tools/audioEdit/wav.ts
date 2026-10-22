/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure WAV (RIFF, 16-bit PCM, interleaved, little-endian) writer and reader. No DOM, no React.
 */
import { frameCount, type AudioData } from './audio';

export const MAX_WAV_BYTES = 100 * 1024 * 1024;

export function wavSizeBytes(a: AudioData): number { return 44 + frameCount(a) * a.channels.length * 2; }

function writeText(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}
function readText(view: DataView, offset: number, length: number): string {
  let s = '';
  for (let i = 0; i < length; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

export function encodeWav(a: AudioData): Uint8Array | null {
  const channels = a.channels.length;
  if (channels < 1 || channels > 8) return null;
  if (!Number.isInteger(a.sampleRate) || a.sampleRate <= 0) return null;
  const total = wavSizeBytes(a);
  if (total > MAX_WAV_BYTES) return null;
  const frames = frameCount(a);
  const dataSize = frames * channels * 2;
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  writeText(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeText(view, 8, 'WAVE');
  writeText(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, a.sampleRate, true);
  view.setUint32(28, a.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeText(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  let pos = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const raw = a.channels[c][i];
      const v = Math.min(1, Math.max(-1, Number.isNaN(raw) ? 0 : raw));
      view.setInt16(pos, v < 0 ? Math.round(v * 32768) : Math.round(v * 32767), true);
      pos += 2;
    }
  }
  return bytes;
}

export function decodeWav(bytes: Uint8Array): AudioData | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (readText(view, 0, 4) !== 'RIFF' || readText(view, 8, 4) !== 'WAVE' || readText(view, 12, 4) !== 'fmt ' || readText(view, 36, 4) !== 'data') return null;
  if (view.getUint32(16, true) !== 16 || view.getUint16(20, true) !== 1 || view.getUint16(34, true) !== 16) return null;
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  if (channels < 1 || channels > 8 || sampleRate < 1) return null;
  const dataSize = view.getUint32(40, true);
  if (44 + dataSize > bytes.length || dataSize % (channels * 2) !== 0) return null;
  const frames = dataSize / (channels * 2);
  const out: Float32Array[] = [];
  for (let c = 0; c < channels; c++) out.push(new Float32Array(frames));
  let pos = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const v = view.getInt16(pos, true);
      out[c][i] = v < 0 ? v / 32768 : v / 32767;
      pos += 2;
    }
  }
  return { sampleRate, channels: out };
}
