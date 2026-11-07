/** PROPOSED, the owner's yes is WAITING. */
import type { QrLevel } from '../engines/create/qrCode';

export const QR_LEVEL_WORDS: Readonly<Record<string, QrLevel>> = Object.freeze({
  low: 'L', medium: 'M', quartile: 'Q', high: 'H',
  l: 'L', m: 'M', q: 'Q', h: 'H'
});
export const QR_LEVEL_CHOICES: readonly string[] = Object.freeze(Object.keys(QR_LEVEL_WORDS));

export function foldQrLevel(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value === 'L' || value === 'M' || value === 'Q' || value === 'H') return value;
  const key = value.toLowerCase();
  return Object.prototype.hasOwnProperty.call(QR_LEVEL_WORDS, key) ? QR_LEVEL_WORDS[key] : value;
}
