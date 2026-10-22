/** Deterministic RGBA filter presets. Full-strength looks blend linearly with the original. */
export type FilterId = 'mono' | 'sepia' | 'vivid' | 'fade' | 'cool' | 'warm' | 'noir';
export const FILTERS: readonly { id: FilterId; label: string }[] = Object.freeze([
  { id: 'mono', label: 'Mono' }, { id: 'sepia', label: 'Sepia' },
  { id: 'vivid', label: 'Vivid' }, { id: 'fade', label: 'Fade' },
  { id: 'cool', label: 'Cool' }, { id: 'warm', label: 'Warm' },
  { id: 'noir', label: 'Noir' },
]);
export function isKnownFilterId(id: string): id is FilterId {
  return FILTERS.some(f => f.id === id);
}
export function applyFilter(pixels: Uint8ClampedArray, id: FilterId, strength: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels);
  const t = Number.isNaN(strength) ? 0 : Math.max(0, Math.min(100, strength)) / 100;
  if (t === 0 || !isKnownFilterId(id)) return out;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const l = .2126 * r + .7152 * g + .0722 * b;
    let target: [number, number, number];
    switch (id) {
      case 'mono': target = [l, l, l]; break;
      case 'noir': { const v = Math.max(0, Math.min(255, 128 + (l - 128) * 1.5)); target = [v, v, v]; break; }
      case 'sepia': target = [.393*r+.769*g+.189*b, .349*r+.686*g+.168*b, .272*r+.534*g+.131*b]; break;
      case 'vivid': target = [l + (r-l)*1.5, l + (g-l)*1.5, l + (b-l)*1.5]; break;
      case 'fade': target = [r*.7+255*.15, g*.7+255*.15, b*.7+255*.15]; break;
      case 'cool': target = [r-20, g+3, b+20]; break;
      case 'warm': target = [r+20, g+3, b-20]; break;
    }
    for (let j = 0; j < 3; j++) out[i+j] = pixels[i+j] + (target[j] - pixels[i+j]) * t;
  }
  return out;
}
