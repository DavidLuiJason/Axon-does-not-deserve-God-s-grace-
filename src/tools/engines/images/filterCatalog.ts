/**
 * AXON pure filter catalog — deterministic RGBA presets.
 * Designed to cover the main commercial categories (film, cinematic, vintage,
 * B&W, mood, color grade) that InShot / Canva / CapCut style editors expose.
 * Strength 0–100 blends linearly with the original.
 *
 * Pure TypeScript, no DOM, no assets, no network.
 */

export type FilterCategory =
  | 'basic'
  | 'film'
  | 'cinematic'
  | 'vintage'
  | 'bw'
  | 'mood'
  | 'grade'
  | 'vivid';

export interface FilterDef {
  id: string;
  label: string;
  category: FilterCategory;
  /** Short description for registry / help. */
  description: string;
}

/** Master list — ids are stable. */
export const FILTER_CATALOG: readonly FilterDef[] = Object.freeze([
  // Basic (kept for compatibility with existing 7)
  { id: 'mono', label: 'Mono', category: 'bw', description: 'Clean greyscale' },
  { id: 'sepia', label: 'Sepia', category: 'vintage', description: 'Classic warm brown' },
  { id: 'vivid', label: 'Vivid', category: 'vivid', description: 'Boosted saturation' },
  { id: 'fade', label: 'Fade', category: 'basic', description: 'Soft lifted blacks' },
  { id: 'cool', label: 'Cool', category: 'mood', description: 'Blue shift' },
  { id: 'warm', label: 'Warm', category: 'mood', description: 'Orange shift' },
  { id: 'noir', label: 'Noir', category: 'bw', description: 'High-contrast black & white' },

  // Film
  { id: 'portra', label: 'Portra', category: 'film', description: 'Soft skin-friendly film look' },
  { id: 'kodachrome', label: 'Kodachrome', category: 'film', description: 'Rich reds and greens' },
  { id: 'tri-x', label: 'Tri-X', category: 'bw', description: 'Classic grainy B&W film' },
  { id: 'velvia', label: 'Velvia', category: 'film', description: 'High-saturation landscape film' },
  { id: 'cinestill', label: 'CineStill', category: 'film', description: 'Halation-style warm film' },
  { id: 'fuji-400h', label: 'Fuji 400H', category: 'film', description: 'Cool pastel film' },

  // Cinematic
  { id: 'teal-orange', label: 'Teal & Orange', category: 'cinematic', description: 'Blockbuster grade' },
  { id: 'bleach', label: 'Bleach Bypass', category: 'cinematic', description: 'Desaturated high-contrast' },
  { id: 'moonlight', label: 'Moonlight', category: 'cinematic', description: 'Cool night grade' },
  { id: 'golden-hour', label: 'Golden Hour', category: 'cinematic', description: 'Warm low-sun light' },
  { id: 'cyberpunk', label: 'Cyberpunk', category: 'cinematic', description: 'Neon magenta/cyan' },
  { id: 'matrix', label: 'Matrix', category: 'cinematic', description: 'Green digital cast' },

  // Vintage
  { id: 'polaroid', label: 'Polaroid', category: 'vintage', description: 'Instant film fade' },
  { id: '70s', label: '70s', category: 'vintage', description: 'Warm muted decade look' },
  { id: 'faded-glory', label: 'Faded Glory', category: 'vintage', description: 'Desaturated nostalgic' },
  { id: 'cross-process', label: 'Cross Process', category: 'vintage', description: 'Shifted color process' },
  { id: 'lomo', label: 'Lomo', category: 'vintage', description: 'Vivid with strong falloff feel' },

  // B&W variants
  { id: 'high-key', label: 'High Key', category: 'bw', description: 'Bright airy B&W' },
  { id: 'low-key', label: 'Low Key', category: 'bw', description: 'Dark moody B&W' },
  { id: 'infrared', label: 'Infrared', category: 'bw', description: 'False infrared feel' },
  { id: 'newspaper', label: 'Newspaper', category: 'bw', description: 'Harsh high-contrast print' },

  // Mood
  { id: 'pastel', label: 'Pastel', category: 'mood', description: 'Soft desaturated pastels' },
  { id: 'dramatic', label: 'Dramatic', category: 'mood', description: 'Deep contrast and cool' },
  { id: 'soft-glow', label: 'Soft Glow', category: 'mood', description: 'Gentle lifted highlights' },
  { id: 'autumn', label: 'Autumn', category: 'mood', description: 'Warm orange-brown leaves' },
  { id: 'winter', label: 'Winter', category: 'mood', description: 'Cool blue-grey' },
  { id: 'spring', label: 'Spring', category: 'mood', description: 'Fresh green lift' },

  // Color grade / creative
  { id: 'emerald', label: 'Emerald', category: 'grade', description: 'Deep green grade' },
  { id: 'crimson', label: 'Crimson', category: 'grade', description: 'Rich red emphasis' },
  { id: 'amber', label: 'Amber', category: 'grade', description: 'Golden amber cast' },
  { id: 'steel', label: 'Steel', category: 'grade', description: 'Cool metallic' },
  { id: 'rose', label: 'Rose', category: 'grade', description: 'Soft pink-magenta' },
  { id: 'mint', label: 'Mint', category: 'grade', description: 'Fresh mint green' },
  { id: 'sunset', label: 'Sunset', category: 'grade', description: 'Orange-pink sky' },
  { id: 'ocean', label: 'Ocean', category: 'grade', description: 'Deep blue-teal water' },
]);

const ID_SET = new Set(FILTER_CATALOG.map((f) => f.id));

export function isKnownFilterId(id: string): boolean {
  return ID_SET.has(id);
}

export function getFilterDef(id: string): FilterDef | undefined {
  return FILTER_CATALOG.find((f) => f.id === id);
}

export function filtersByCategory(cat: FilterCategory): readonly FilterDef[] {
  return FILTER_CATALOG.filter((f) => f.category === cat);
}

/** Core transform for each id. Returns target RGB; strength blend is done outside. */
function targetRgb(id: string, r: number, g: number, b: number): [number, number, number] {
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  switch (id) {
    // Basic / legacy
    case 'mono':
      return [L, L, L];
    case 'noir': {
      const v = Math.max(0, Math.min(255, 128 + (L - 128) * 1.6));
      return [v, v, v];
    }
    case 'sepia':
      return [0.393 * r + 0.769 * g + 0.189 * b, 0.349 * r + 0.686 * g + 0.168 * b, 0.272 * r + 0.534 * g + 0.131 * b];
    case 'vivid':
      return [L + (r - L) * 1.55, L + (g - L) * 1.55, L + (b - L) * 1.55];
    case 'fade':
      return [r * 0.72 + 255 * 0.14, g * 0.72 + 255 * 0.14, b * 0.72 + 255 * 0.14];
    case 'cool':
      return [r - 18, g + 2, b + 22];
    case 'warm':
      return [r + 22, g + 4, b - 18];

    // Film
    case 'portra':
      return [r * 1.05 + 8, g * 1.02 + 4, b * 0.95 + 2];
    case 'kodachrome':
      return [r * 1.12 + 6, g * 0.98, b * 0.88 - 4];
    case 'tri-x': {
      const v = Math.max(0, Math.min(255, L * 1.15 - 12));
      return [v, v, v];
    }
    case 'velvia':
      return [L + (r - L) * 1.7 + 4, L + (g - L) * 1.55, L + (b - L) * 1.45 - 2];
    case 'cinestill':
      return [r * 1.08 + 12, g * 0.97 + 2, b * 0.85 - 6];
    case 'fuji-400h':
      return [r * 0.96 + 4, g * 1.02 + 6, b * 1.08 + 10];

    // Cinematic
    case 'teal-orange': {
      // Push orange into midtones, teal into shadows
      const orange: [number, number, number] = [r * 1.15 + 10, g * 0.95 + 2, b * 0.75 - 8];
      const teal: [number, number, number] = [r * 0.85 - 4, g * 1.05 + 4, b * 1.2 + 12];
      const t = L / 255;
      return [
        orange[0] * t + teal[0] * (1 - t),
        orange[1] * t + teal[1] * (1 - t),
        orange[2] * t + teal[2] * (1 - t),
      ];
    }
    case 'bleach': {
      const desat = L + (r - L) * 0.35;
      const desatG = L + (g - L) * 0.35;
      const desatB = L + (b - L) * 0.35;
      return [desat * 1.25 - 20, desatG * 1.25 - 20, desatB * 1.25 - 20];
    }
    case 'moonlight':
      return [r * 0.75 - 10, g * 0.85 + 2, b * 1.25 + 18];
    case 'golden-hour':
      return [r * 1.18 + 18, g * 1.05 + 8, b * 0.7 - 12];
    case 'cyberpunk':
      return [r * 1.1 + 20, g * 0.7 - 10, b * 1.25 + 25];
    case 'matrix':
      return [r * 0.7 - 8, g * 1.25 + 15, b * 0.75 - 5];

    // Vintage
    case 'polaroid':
      return [r * 0.9 + 25, g * 0.88 + 18, b * 0.82 + 12];
    case '70s':
      return [r * 1.05 + 15, g * 0.95 + 5, b * 0.8 - 8];
    case 'faded-glory':
      return [r * 0.85 + 20, g * 0.85 + 15, b * 0.85 + 10];
    case 'cross-process':
      return [r * 1.1 - 5, g * 0.9 + 10, b * 1.15 + 5];
    case 'lomo':
      return [L + (r - L) * 1.4 + 8, L + (g - L) * 1.25, L + (b - L) * 1.1 - 4];

    // B&W
    case 'high-key': {
      const v = Math.min(255, L * 1.2 + 40);
      return [v, v, v];
    }
    case 'low-key': {
      const v = Math.max(0, L * 0.85 - 30);
      return [v, v, v];
    }
    case 'infrared': {
      // Approximate false IR: red becomes bright
      const v = Math.min(255, r * 0.6 + g * 0.3 + 40);
      return [v, v, v];
    }
    case 'newspaper': {
      const v = L > 140 ? 230 : L < 90 ? 30 : 140;
      return [v, v, v];
    }

    // Mood
    case 'pastel':
      return [r * 0.7 + 60, g * 0.75 + 50, b * 0.8 + 55];
    case 'dramatic':
      return [r * 0.9 - 10, g * 0.85 - 5, b * 1.05 + 5];
    case 'soft-glow':
      return [r * 0.95 + 20, g * 0.95 + 18, b * 0.95 + 15];
    case 'autumn':
      return [r * 1.15 + 12, g * 0.95 + 4, b * 0.7 - 10];
    case 'winter':
      return [r * 0.85 - 5, g * 0.9 + 2, b * 1.15 + 15];
    case 'spring':
      return [r * 0.95 + 5, g * 1.15 + 12, b * 0.95 + 5];

    // Grade
    case 'emerald':
      return [r * 0.85 - 5, g * 1.2 + 10, b * 0.9];
    case 'crimson':
      return [r * 1.25 + 15, g * 0.8 - 5, b * 0.85];
    case 'amber':
      return [r * 1.15 + 20, g * 1.05 + 10, b * 0.7 - 8];
    case 'steel':
      return [r * 0.9 - 5, g * 0.95, b * 1.15 + 12];
    case 'rose':
      return [r * 1.1 + 15, g * 0.9 + 5, b * 1.05 + 12];
    case 'mint':
      return [r * 0.9, g * 1.15 + 12, b * 1.05 + 8];
    case 'sunset':
      return [r * 1.2 + 25, g * 0.95 + 8, b * 0.75 - 5];
    case 'ocean':
      return [r * 0.75 - 8, g * 1.05 + 5, b * 1.3 + 18];

    default:
      return [r, g, b];
  }
}

/**
 * Apply a named filter at the given strength (0–100).
 * Unknown ids return a copy of the input.
 */
export function applyFilter(
  pixels: Uint8ClampedArray,
  id: string,
  strength: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels);
  if (!isKnownFilterId(id)) return out;
  const t = Number.isFinite(strength) ? Math.max(0, Math.min(100, strength)) / 100 : 0;
  if (t === 0) return out;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    const [tr, tg, tb] = targetRgb(id, r, g, b);
    out[i] = r + (tr - r) * t;
    out[i + 1] = g + (tg - g) * t;
    out[i + 2] = b + (tb - b) * t;
  }
  return out;
}
