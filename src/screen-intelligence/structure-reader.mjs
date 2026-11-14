// Screen structure reader (SI3a). Pure engine: no Android, no network, no storage.
// Turns a raw accessibility-tree snapshot into a safe, small, text-first screen description
// AXON Apps can read. Passwords and typed text are redacted; risky controls are flagged ASK.

const ROLE_BY_CLASS = [
  [/edittext|textfield|autocomplete/i, 'input'],
  [/button|imagebutton|chip/i, 'button'],
  [/switch|toggle/i, 'switch'],
  [/checkbox|checkedtextview/i, 'checkbox'],
  [/radiobutton/i, 'radio'],
  [/recyclerview|listview|scrollview|gridview|viewpager/i, 'list'],
  [/imageview|image/i, 'image'],
  [/textview|text/i, 'text'],
];
// 7R: reading is allowed; forms, sign-in, sending and money ask first.
const RISK_WORDS = /\b(pay|buy|purchase|order|checkout|send|transfer|confirm|delete|remove|sign\s?in|log\s?in|sign\s?up|submit|subscribe|install|uninstall|allow|grant)\b/i;

export function roleOf(node) {
  if (node.password) return 'input';
  for (const [re, role] of ROLE_BY_CLASS) if (re.test(node.className ?? '')) return role;
  if (node.editable) return 'input';
  if (node.clickable) return 'button';
  return 'other';
}

function flatten(raw) {
  const out = [];
  const walk = (node, parentId, depth, path) => {
    const id = node.id ?? path;
    out.push({ ...node, id, parentId, depth, path });
    (node.children ?? []).forEach((child, i) => walk(child, id, depth + 1, `${path}.${i}`));
  };
  if (Array.isArray(raw.nodes) && raw.nodes.some((n) => n.parentId !== undefined || n.children === undefined)) {
    const byParent = new Map();
    raw.nodes.forEach((n) => byParent.set(n.parentId ?? null, [...(byParent.get(n.parentId ?? null) ?? []), n]));
    const walkFlat = (n, depth, path) => { out.push({ ...n, depth, path }); (byParent.get(n.id) ?? []).forEach((c, i) => walkFlat(c, depth + 1, `${path}.${i}`)); };
    (byParent.get(null) ?? []).forEach((n, i) => walkFlat(n, 0, String(i)));
  } else (raw.nodes ?? []).forEach((n, i) => walk(n, null, 0, String(i)));
  return out;
}

const inside = (b, w) => b && w && b.r > 0 && b.b > 0 && b.l < w.width && b.t < w.height;

/**
 * @param {object} raw {packageName, windowTitle?, capturedAt?, screen?:{width,height}, nodes:[...]}
 * @param {object} [opts] {blockedPackages?:string[], keepTypedText?:boolean, maxNodes?:number}
 */
export function readScreenStructure(raw, opts = {}) {
  const { blockedPackages = [], keepTypedText = false, maxNodes = 400 } = opts;
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'no-snapshot' };
  const pkg = raw.packageName ?? 'unknown';
  if (blockedPackages.includes(pkg)) return { ok: true, blocked: true, packageName: pkg, reason: 'package-blocked', elements: [], outline: '' };
  const flat = flatten(raw);
  const elements = [];
  let dropped = 0;
  let capped = false;
  for (const n of flat) {
    if (n.visible === false) { dropped += 1; continue; }
    const role = roleOf(n);
    const label = String(n.text ?? n.contentDescription ?? n.hint ?? '').trim();
    const typed = role === 'input' && n.text ? String(n.text) : '';
    const redacted = Boolean(n.password) || (typed && !keepTypedText);
    const interactive = Boolean(n.clickable || n.longClickable || n.editable || n.checkable || n.scrollable);
    if (!label && !interactive && role === 'other') { dropped += 1; continue; }
    if (elements.length >= maxNodes) { capped = true; dropped += 1; continue; }
    const actions = [];
    if (n.clickable) actions.push('tap');
    if (n.longClickable) actions.push('long-press');
    if (n.editable) actions.push('type');
    if (n.scrollable) actions.push('scroll');
    if (n.checkable) actions.push('toggle');
    elements.push({
      ref: `e${elements.length + 1}`, role, depth: n.depth, path: n.path,
      label: redacted ? (n.password ? '[password field]' : (n.hint ?? n.contentDescription ?? '[input]')) : label,
      redacted: Boolean(redacted), hasValue: Boolean(typed || n.password),
      enabled: n.enabled !== false, focused: Boolean(n.focused), checked: n.checked ?? null,
      bounds: n.bounds ?? null, onScreen: raw.screen ? inside(n.bounds, raw.screen) : null,
      actions, risk: actions.some((a) => a !== 'scroll') && RISK_WORDS.test(label) ? 'ask' : 'read-ok',
    });
  }
  return {
    ok: true, blocked: false, packageName: pkg, windowTitle: raw.windowTitle ?? null,
    capturedAt: raw.capturedAt ?? null, screen: raw.screen ?? null, elements, dropped, truncated: capped,
    imageRegions: listImageRegions(elements, raw.screen),
    outline: describeScreen({ elements, packageName: pkg, windowTitle: raw.windowTitle }),
  };
}

export function describeScreen({ elements, packageName, windowTitle }, { maxChars = 4000 } = {}) {
  const lines = [`App: ${packageName}${windowTitle ? ` | Window: ${windowTitle}` : ''}`];
  for (const e of elements) {
    const flags = [e.actions.length ? e.actions.join('/') : null, e.checked === true ? 'on' : e.checked === false ? 'off' : null,
      e.enabled ? null : 'disabled', e.focused ? 'focused' : null, e.redacted ? 'hidden-value' : null, e.risk === 'ask' ? 'ASK-FIRST' : null].filter(Boolean);
    lines.push(`${'  '.repeat(Math.min(e.depth, 6))}[${e.ref}] ${e.role}${e.label ? ` "${e.label.slice(0, 80)}"` : ''}${flags.length ? ` (${flags.join(', ')})` : ''}`);
  }
  let text = lines.join('\n');
  if (text.length > maxChars) text = `${text.slice(0, maxChars)}\n[cut: ${text.length - maxChars} more characters]`;
  return text;
}

export function findElements(structure, { text, role } = {}) {
  const needle = text ? String(text).toLowerCase() : null;
  return (structure.elements ?? []).filter((e) => (!role || e.role === role) && (!needle || e.label.toLowerCase().includes(needle)));
}

const sig = (e) => `${e.role}|${e.label}|${e.checked}|${e.enabled}|${e.hasValue}`;
export function diffStructures(prev, next) {
  const key = (e) => `${e.path}`;
  const before = new Map((prev.elements ?? []).map((e) => [key(e), e]));
  const after = new Map((next.elements ?? []).map((e) => [key(e), e]));
  const added = [], removed = [], changed = [];
  for (const [k, e] of after) { if (!before.has(k)) added.push(e); else if (sig(before.get(k)) !== sig(e)) changed.push({ from: before.get(k), to: e }); }
  for (const [k, e] of before) if (!after.has(k)) removed.push(e);
  return { sameApp: prev.packageName === next.packageName, added, removed, changed, unchanged: !added.length && !removed.length && !changed.length };
}

// Pictures stay pictures: the reader never recognises an image. It records where each image is, how big,
// and the label the app itself gave it, so a later stage can cut that region out of a captured frame (SI5).
export function listImageRegions(elements, screen) {
  const total = screen ? screen.width * screen.height : 0;
  const out = [];
  for (const e of elements ?? []) {
    if (e.role !== 'image' || !e.bounds) continue;
    const width = e.bounds.r - e.bounds.l;
    const height = e.bounds.b - e.bounds.t;
    if (width <= 0 || height <= 0) continue;
    out.push({ ref: e.ref, label: e.label, hasLabel: Boolean(e.label), bounds: e.bounds, width, height,
      onScreen: e.onScreen, screenShare: total ? Math.round((width * height / total) * 1000) / 1000 : null,
      tappable: e.actions.includes('tap') });
  }
  return out;
}

// Turns image regions into crop rectangles for a captured frame that may be a different size than the screen.
export function planCrops(structure, { frameWidth, frameHeight, minSize = 48, maxCrops = 20 } = {}) {
  const screen = structure?.screen;
  if (!screen?.width || !screen?.height || !frameWidth || !frameHeight) return { crops: [], reason: 'no-screen-size' };
  const sx = frameWidth / screen.width;
  const sy = frameHeight / screen.height;
  const crops = [];
  for (const r of structure.imageRegions ?? []) {
    if (r.onScreen === false) continue;
    const l = Math.max(0, r.bounds.l); const t = Math.max(0, r.bounds.t);
    const rr = Math.min(screen.width, r.bounds.r); const bb = Math.min(screen.height, r.bounds.b);
    const x = Math.round(l * sx); const y = Math.round(t * sy);
    const width = Math.round((rr - l) * sx); const height = Math.round((bb - t) * sy);
    if (width < minSize || height < minSize) continue;
    crops.push({ ref: r.ref, x, y, width, height, label: r.label });
  }
  crops.sort((a, b) => b.width * b.height - a.width * a.height);
  return { crops: crops.slice(0, maxCrops), reason: null };
}
