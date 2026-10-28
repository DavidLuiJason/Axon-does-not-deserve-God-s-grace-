// Collage geometry engine (C25, Director-hardened). Pure: plans rectangles from picture sizes; never reads or draws pixels.
// Every plan is validated before it is returned: all cells inside the canvas margins, none overlapping, none empty.
export const COLLAGE_LIMITS = Object.freeze({ minImages: 1, maxImages: 100, maxCanvasPixels: 24_000_000, maxSide: 16_384, maxGap: 200, maxMargin: 500 });
export const COLLAGE_STYLES = 'full grid tiles columns hero strip stack mosaic';
export type CollageStyle = 'full' | 'grid' | 'tiles' | 'columns' | 'hero' | 'strip' | 'stack' | 'mosaic';
export const DEFAULT_COLLAGE_STYLE: CollageStyle = 'full';
export type CollageImage = { id: string; width: number; height: number };
export type CollageRequest = { canvasWidth: number; canvasHeight?: number; images: CollageImage[]; style?: CollageStyle; gap?: number; margin?: number; background?: string; columns?: number };
export type Point = { x: number; y: number };
export type CollageCell = { id: string; x: number; y: number; w: number; h: number; crop: { sx: number; sy: number; sw: number; sh: number } };
export type CollageErrorCode = 'invalid-input' | 'too-large' | 'too-many-images' | 'bad-colour' | 'bad-shape' | 'shape-too-small';
export type CollageError = { ok: false; error: CollageErrorCode; message: string };
export type CollagePlan = { ok: true; canvasWidth: number; canvasHeight: number; background: string; style: CollageStyle; cells: CollageCell[]; cropsAnything: boolean; usedFraction: number; warnings: string[] };
export const STYLE_INFO: Record<CollageStyle, { style: CollageStyle; crops: boolean; needsCanvasHeight: boolean }> = {
  full: { style: 'full', crops: false, needsCanvasHeight: false }, grid: { style: 'grid', crops: false, needsCanvasHeight: true }, tiles: { style: 'tiles', crops: true, needsCanvasHeight: false }, columns: { style: 'columns', crops: false, needsCanvasHeight: false },
  hero: { style: 'hero', crops: false, needsCanvasHeight: false }, strip: { style: 'strip', crops: false, needsCanvasHeight: false }, stack: { style: 'stack', crops: false, needsCanvasHeight: false }, mosaic: { style: 'mosaic', crops: false, needsCanvasHeight: true },
};
export const COLLAGE_DESCRIPTOR = { toolId: 'collage-maker', displayName: 'Collage Maker', purpose: 'Plan picture collage geometry from picture dimensions without reading or drawing image pixels.', examples: ['Arrange 12 pictures in a full collage without cropping them.', 'Fill a grid with cropped tiles and warn about major losses.', 'Plan a tall stack of pictures with even gaps.'], inputs: [{ name: 'images', kind: 'file' as const, prompt: 'Picture ids and dimensions' }, { name: 'style', kind: 'choice' as const, choices: COLLAGE_STYLES.split(' ') }, { name: 'canvasWidth', kind: 'text' as const }, { name: 'canvasHeight', kind: 'text' as const }] };

const fail = (error: CollageErrorCode, message: string): CollageError => ({ ok: false, error, message });
const integer = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
const colour = (v: unknown): string | undefined => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : undefined);
const MIN_COMFORT = 24; // smallest picture side (pixels) before the plan warns that pictures are tiny

type Item = { i: number; x: number; y: number; w: number; h: number }; // i = index of the picture; coordinates local to the layout
type Layout = { items: Item[]; w: number; h: number };
type LayoutFn = (width: number) => Layout | null;
const extent = (items: Item[]): Layout => ({ items, w: Math.max(...items.map(t => t.x + t.w)), h: Math.max(...items.map(t => t.y + t.h)) });

// Largest whole-picture rectangle of the picture's own shape that fits inside the box, centred. Never stretches.
function fitInBox(im: CollageImage, x: number, y: number, w: number, h: number): Omit<Item, 'i'> {
  const s = Math.min(w / im.width, h / im.height);
  const dw = Math.min(w, Math.max(1, Math.floor(im.width * s))), dh = Math.min(h, Math.max(1, Math.floor(im.height * s)));
  return { x: x + Math.floor((w - dw) / 2), y: y + Math.floor((h - dh) / 2), w: dw, h: dh };
}

// Split pictures (in order) into r rows so each row's summed aspect ratio is as close as possible to total/r.
function partitionRows(ar: number[], r: number): number[][] {
  const n = ar.length, pre = [0]; for (const a of ar) pre.push(pre[pre.length - 1] + a);
  const target = pre[n] / r, dp = Array.from({ length: r + 1 }, () => Array<number>(n + 1).fill(Infinity)), from = Array.from({ length: r + 1 }, () => Array<number>(n + 1).fill(-1));
  dp[0][0] = 0;
  for (let k = 1; k <= r; k++) for (let j = k; j <= n - (r - k); j++) for (let i = k - 1; i < j; i++) { const v = dp[k - 1][i] + (pre[j] - pre[i] - target) ** 2; if (v < dp[k][j] - 1e-12) { dp[k][j] = v; from[k][j] = i; } }
  const groups: number[][] = []; let j = n; for (let k = r; k > 0; k--) { const i = from[k][j]; groups.unshift(Array.from({ length: j - i }, (_, q) => i + q)); j = i; }
  return groups;
}

// Rows of whole pictures, each row one height, centred. Returns null if the width cannot hold the row.
function rowsLayout(groups: number[][], images: CollageImage[], gap: number, width: number): Layout | null {
  const items: Item[] = []; let y = 0;
  for (const g of groups) {
    const ar = g.map(i => images[i].width / images[i].height), avail = width - gap * (g.length - 1);
    if (avail < g.length) return null;
    const rh = Math.max(1, Math.floor(avail / ar.reduce((a, b) => a + b, 0)));
    const ws = ar.map(a => Math.max(1, Math.floor(a * rh))), rowW = ws.reduce((a, b) => a + b, 0) + gap * (g.length - 1);
    if (rowW > width) return null;
    let x = Math.floor((width - rowW) / 2); g.forEach((i, k) => { items.push({ i, x, y, w: ws[k], h: rh }); x += ws[k] + gap; }); y += rh + gap;
  }
  return extent(items);
}

// Waterfall columns: each picture goes under the currently shortest column, at the column's width.
function columnsLayout(images: CollageImage[], gap: number, c: number, width: number): Layout | null {
  const cw = Math.floor((width - gap * (c - 1)) / c); if (cw < 1) return null;
  const bottoms = Array<number>(c).fill(0), items: Item[] = [];
  images.forEach((im, i) => { let col = 0; for (let j = 1; j < c; j++) if (bottoms[j] < bottoms[col]) col = j; const h = Math.max(1, Math.round(cw * im.height / im.width)); items.push({ i, x: col * (cw + gap), y: bottoms[col], w: cw, h }); bottoms[col] += h + gap; });
  return extent(items);
}

// Balanced ordered binary tree; each node is side-by-side or stacked, whichever makes the block closest to the wanted shape.
type Node = { a: number; leaf?: number; l?: Node; r?: Node; side?: boolean };
function buildTree(ar: number[], lo: number, hi: number, want: number): Node {
  if (hi - lo === 1) return { a: ar[lo], leaf: lo };
  const mid = lo + Math.ceil((hi - lo) / 2), l = buildTree(ar, lo, mid, want), r = buildTree(ar, mid, hi, want);
  const sideA = l.a + r.a, stackA = 1 / (1 / l.a + 1 / r.a), side = Math.abs(Math.log(sideA / want)) <= Math.abs(Math.log(stackA / want));
  return { a: side ? sideA : stackA, l, r, side };
}
function nodeLayout(nd: Node, images: CollageImage[], gap: number, width: number): Layout | null {
  if (nd.leaf !== undefined) { if (width < 1) return null; return { items: [{ i: nd.leaf, x: 0, y: 0, w: width, h: Math.max(1, Math.floor(width / nd.a)) }], w: width, h: Math.max(1, Math.floor(width / nd.a)) }; }
  const l = nd.l!, r = nd.r!;
  if (nd.side) {
    const avail = width - gap; if (avail < 2) return null; const w1 = Math.min(avail - 1, Math.max(1, Math.floor(avail * l.a / (l.a + r.a))));
    const A = nodeLayout(l, images, gap, w1), B = nodeLayout(r, images, gap, avail - w1); if (!A || !B) return null; const h = Math.max(A.h, B.h);
    return { items: [...A.items.map(t => ({ ...t, y: t.y + Math.floor((h - A.h) / 2) })), ...B.items.map(t => ({ ...t, x: t.x + w1 + gap, y: t.y + Math.floor((h - B.h) / 2) }))], w: width, h };
  }
  const A = nodeLayout(l, images, gap, width), B = nodeLayout(r, images, gap, width); if (!A || !B) return null;
  return { items: [...A.items, ...B.items.map(t => ({ ...t, y: t.y + A.h + gap }))], w: width, h: A.h + gap + B.h };
}

type Placed = { layout: Layout; dx: number; dy: number; canvasH: number };
// Place a layout inside the inner rectangle. Fixed height: shrink the layout width until it fits, then centre it. Free height: canvas grows.
function place(fn: LayoutFn, iw: number, ih: number | undefined): Placed | null {
  let w = iw, L = fn(w);
  if (ih !== undefined) {
    for (let k = 0; L && L.h > ih && k < 60; k++) { const next = Math.max(1, Math.min(w - 1, Math.floor(w * ih / L.h))); if (next === w && w === 1) return null; w = next; L = fn(w); }
    if (!L || L.h > ih) return null;
    return { layout: L, dx: Math.floor((iw - L.w) / 2), dy: Math.floor((ih - L.h) / 2), canvasH: ih };
  }
  return L ? { layout: L, dx: Math.floor((iw - L.w) / 2), dy: 0, canvasH: L.h } : null;
}
// Pick the best candidate layout: fixed height = largest covered area; free height = canvas closest to square.
function pickBest(cands: LayoutFn[], iw: number, ih: number | undefined): Placed | null {
  let best: Placed | null = null, bestScore = Infinity;
  for (const fn of cands) { const p = place(fn, iw, ih); if (!p) continue; const s = ih !== undefined ? -(p.layout.w * p.layout.h) : Math.abs(Math.log(iw / p.layout.h)); if (s < bestScore - 1e-12) { best = p; bestScore = s; } }
  return best;
}

function build(request: CollageRequest): CollagePlan | CollageError {
  if (!request || typeof request !== 'object') return fail('invalid-input', 'Provide a collage request.');
  const { canvasWidth, canvasHeight, images } = request; const style = request.style ?? DEFAULT_COLLAGE_STYLE; const gap = request.gap ?? 8, margin = request.margin ?? 8, bg = request.background ?? '#FFFFFF';
  if (!integer(canvasWidth, 1, COLLAGE_LIMITS.maxSide) || !Array.isArray(images) || typeof style !== 'string' || !(COLLAGE_STYLES.split(' ') as string[]).includes(style) || !integer(gap, 0, COLLAGE_LIMITS.maxGap) || !integer(margin, 0, COLLAGE_LIMITS.maxMargin) || (canvasHeight !== undefined && !integer(canvasHeight, 1, COLLAGE_LIMITS.maxSide))) return fail('invalid-input', 'Dimensions, style, gap, margin, or image list is invalid.');
  if (images.length === 0) return fail('invalid-input', 'Add at least one picture.');
  if (images.length > COLLAGE_LIMITS.maxImages) return fail('too-many-images', 'A collage can contain at most 100 pictures.');
  const ids = new Set<string>(); for (const im of images) { if (!im || typeof im !== 'object' || typeof im.id !== 'string' || !im.id.trim() || ids.has(im.id) || !integer(im.width, 1, 1_000_000) || !integer(im.height, 1, 1_000_000)) return fail('invalid-input', 'Picture ids must be unique and non-empty; dimensions must be positive integers.'); ids.add(im.id); }
  const background = colour(bg); if (!background) return fail('bad-colour', 'Background must be # followed by six hexadecimal digits.');
  const iw = canvasWidth - 2 * margin, ih = canvasHeight === undefined ? undefined : canvasHeight - 2 * margin;
  if (iw < 1 || (ih !== undefined && ih < 1) || canvasWidth * (canvasHeight ?? canvasWidth) > COLLAGE_LIMITS.maxCanvasPixels) return fail('too-large', 'Canvas exceeds the size limits or the margins leave no room; use a smaller margin or width.');
  const n = images.length, ar = images.map(im => im.width / im.height), warnings: string[] = [];
  const want = ih === undefined ? 1 : iw / ih;
  let placed: Placed | null = null; const cropList: CollageCell['crop'][] = [];

  if (style === 'full' || style === 'strip' || style === 'hero') {
    const first = style === 'hero' ? 1 : 0, rest = images.slice(first), restAr = ar.slice(first);
    const rs = style === 'strip' ? [1] : Array.from({ length: Math.min(rest.length, 40) }, (_, k) => k + 1);
    const cands: LayoutFn[] = (rest.length === 0 ? [0] : rs).map(r => {
      const groups = rest.length === 0 ? [] : partitionRows(restAr, r).map(g => g.map(i => i + first));
      return (width: number): Layout | null => {
        const items: Item[] = []; let top = 0;
        if (first === 1) { const f = fitInBox(images[0], 0, 0, width, Math.max(1, Math.floor(width / ar[0]))); items.push({ i: 0, ...f }); top = f.h + gap; if (groups.length === 0) return extent(items); }
        const R = rowsLayout(groups, images, gap, width); if (!R) return null;
        return extent([...items, ...R.items.map(t => ({ ...t, y: t.y + top }))]);
      };
    });
    placed = pickBest(cands, iw, ih);
  } else if (style === 'columns' || style === 'stack') {
    let counts: number[];
    if (style === 'stack') counts = [1];
    else if (request.columns !== undefined) { if (!integer(request.columns, 1, 12) || request.columns > n) return fail('invalid-input', 'Columns must be an integer from 1 to 12 and no greater than the picture count.'); counts = [request.columns]; }
    else counts = Array.from({ length: Math.min(n, 12) }, (_, k) => k + 1);
    placed = pickBest(counts.map(c => (width: number) => columnsLayout(images, gap, c, width)), iw, ih);
  } else if (style === 'mosaic') {
    const tree = buildTree(ar, 0, n, want);
    placed = place(width => nodeLayout(tree, images, gap, width), iw, ih);
    if (placed) placed = { ...placed, layout: { ...placed.layout, items: placed.layout.items.map(t => ({ ...t, ...fitInBox(images[t.i], t.x, t.y, t.w, t.h) })) } };
  } else {
    // grid / tiles: equal cells. Fixed height: cells fill the canvas. Free height: square cells, canvas closest to square.
    let bestScore = -Infinity, bestC = 1;
    for (let c = 1; c <= n; c++) {
      const r = Math.ceil(n / c), cw = Math.floor((iw - gap * (c - 1)) / c), ch = ih !== undefined ? Math.floor((ih - gap * (r - 1)) / r) : cw; if (cw < 1 || ch < 1) continue;
      let shown = 0; for (const im of images) { const s = style === 'tiles' ? Math.max(cw / im.width, ch / im.height) : Math.min(cw / im.width, ch / im.height); shown += style === 'tiles' ? (cw * ch) / (s * s * im.width * im.height) : (s * s * im.width * im.height) / (cw * ch); }
      const score = ih !== undefined ? shown / n : -Math.abs(Math.log(iw / (r * ch + gap * (r - 1)))) + shown * 1e-6;
      if (score > bestScore + 1e-12) { bestScore = score; bestC = c; }
    }
    const c = bestC, r = Math.ceil(n / c), cw = Math.floor((iw - gap * (c - 1)) / c), ch = ih !== undefined ? Math.floor((ih - gap * (r - 1)) / r) : cw;
    if (cw < 1 || ch < 1) return fail('too-large', 'The canvas is too small for this many pictures; use a larger canvas.');
    const blockW = c * cw + gap * (c - 1), blockH = r * ch + gap * (r - 1), items: Item[] = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / c), inRow = row === r - 1 ? n - row * c : c, x0 = Math.floor((blockW - (inRow * cw + gap * (inRow - 1))) / 2), col = i % c;
      const x = x0 + col * (cw + gap), y = row * (ch + gap), im = images[i];
      if (style === 'tiles') {
        const ratio = Math.max(cw / im.width, ch / im.height), sw = Math.min(im.width, cw / ratio), sh = Math.min(im.height, ch / ratio), sx = (im.width - sw) / 2, sy = (im.height - sh) / 2;
        items.push({ i, x, y, w: cw, h: ch }); cropList[i] = { sx, sy, sw, sh };
        if (sw * sh < im.width * im.height * 0.6) warnings.push(`${im.id} loses more than 40% of its picture.`);
      } else items.push({ i, ...fitInBox(im, x, y, cw, ch) });
    }
    placed = { layout: { items, w: blockW, h: blockH }, dx: Math.floor((iw - blockW) / 2), dy: ih !== undefined ? Math.floor((ih - blockH) / 2) : 0, canvasH: ih ?? blockH };
  }

  if (!placed) return fail('too-large', 'These pictures cannot fit on that canvas with the requested gap; use a larger canvas, a smaller gap or fewer pictures.');
  const finalH = canvasHeight ?? placed.canvasH + 2 * margin;
  if (finalH > COLLAGE_LIMITS.maxSide || canvasWidth * finalH > COLLAGE_LIMITS.maxCanvasPixels) return fail('too-large', 'The collage needs a canvas larger than the supported limit; use a smaller width or fewer pictures.');

  const cells: CollageCell[] = placed.layout.items.slice().sort((a, b) => a.i - b.i).map(t => ({ id: images[t.i].id, x: margin + placed!.dx + t.x, y: margin + placed!.dy + t.y, w: t.w, h: t.h, crop: cropList[t.i] ?? { sx: 0, sy: 0, sw: images[t.i].width, sh: images[t.i].height } }));

  // Safety net: never hand back geometry that is wrong.
  for (let a = 0; a < cells.length; a++) {
    const c = cells[a]; if (![c.x, c.y, c.w, c.h].every(Number.isInteger) || c.w < 1 || c.h < 1 || c.x < margin || c.y < margin || c.x + c.w > canvasWidth - margin || c.y + c.h > finalH - margin) return fail('invalid-input', 'The planner could not place the pictures inside the canvas; try a larger canvas.');
    for (let b = a + 1; b < cells.length; b++) { const d = cells[b]; if (c.x < d.x + d.w && d.x < c.x + c.w && c.y < d.y + d.h && d.y < c.y + c.h) return fail('invalid-input', 'The planner could not place the pictures without overlap; try a larger canvas.'); }
  }
  if (cells.some(c => Math.min(c.w, c.h) < MIN_COMFORT)) warnings.push('Some pictures come out very small; use a larger canvas or fewer pictures.');
  const used = cells.reduce((s, c) => s + c.w * c.h, 0) / (canvasWidth * finalH);
  return { ok: true, canvasWidth, canvasHeight: finalH, background, style, cells, cropsAnything: style === 'tiles', usedFraction: Math.round(Math.max(0, Math.min(1, used)) * 10000) / 10000, warnings };
}

export function planCollage(request: CollageRequest): CollagePlan | CollageError {
  try { return build(request); } catch { return fail('invalid-input', 'The collage request contains unsupported or malformed values.'); }
}
