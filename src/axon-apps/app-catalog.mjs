// AXON Apps: the list of installed apps, searching it, and deciding which apps need a question first.
// Pure data logic. The native side only supplies the raw list.

export const CATEGORY_NAMES = Object.freeze({ 0: 'game', 1: 'audio', 2: 'video', 3: 'image', 4: 'social', 5: 'news', 6: 'maps', 7: 'productivity', 8: 'accessibility' });

// Apps where AXON asks before opening or acting: money, wallets, passwords, one-time codes (roadmap 7R). Over-matching only
// means an extra question, which is the safe direction. Owner can edit this list.
export const SENSITIVE_PATTERNS = Object.freeze([
  'bank', 'wallet', 'pay', 'money', 'cash', 'finance', 'crypto', 'bitcoin', 'binance', 'invest', 'loan', 'credit',
  'authenticator', 'password', 'vault', 'keepass', 'bitwarden', 'lastpass', '1password',
  'opay', 'palmpay', 'kuda', 'moniepoint', 'paga', 'piggyvest', 'cowrywise', 'gtworld', 'gtbank', 'zenith', 'ubamobile',
]);

const fold = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const bigrams = (s) => { const out = new Map(); for (let i = 0; i < s.length - 1; i += 1) { const g = s.slice(i, i + 2); out.set(g, (out.get(g) ?? 0) + 1); } return out; };
function dice(a, b) {
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a); const B = bigrams(b); let hit = 0;
  for (const [g, n] of A) hit += Math.min(n, B.get(g) ?? 0);
  return (2 * hit) / (a.length - 1 + b.length - 1);
}

/** Raw native list -> clean, de-duplicated, sorted catalog. */
export function normalizeApps(raw) {
  const seen = new Map();
  for (const r of Array.isArray(raw) ? raw : []) {
    const packageName = String(r?.packageName ?? '').trim();
    const label = String(r?.label ?? '').trim();
    if (!packageName || !label || seen.has(packageName)) continue;
    seen.set(packageName, {
      packageName, label, system: Boolean(r.system), self: Boolean(r.self),
      category: CATEGORY_NAMES[r.category] ?? null, versionName: r.versionName ?? null,
      firstInstalled: r.firstInstalled ?? null, lastUpdated: r.lastUpdated ?? null,
    });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Ranked search: exact name, starts with, contains, package contains, then similar spelling. */
export function searchApps(apps, query, { limit = 20 } = {}) {
  const q = String(query ?? '').trim();
  const nq = fold(q);
  if (!nq) return [];
  const ranked = [];
  for (const app of apps ?? []) {
    const nl = fold(app.label); const np = fold(app.packageName);
    let tier = null; let why = '';
    if (app.packageName === q) { tier = 0; why = 'exact package'; }
    else if (nl === nq) { tier = 0; why = 'exact name'; }
    else if (nl.startsWith(nq)) { tier = 1; why = 'name starts with it'; }
    else if (nl.includes(nq)) { tier = 2; why = 'name contains it'; }
    else if (np.includes(nq)) { tier = 3; why = 'package contains it'; }
    else if (nq.length >= 5 && dice(nq, nl) >= 0.66) { tier = 4; why = 'similar name'; }
    if (tier != null) ranked.push({ app, tier, why });
  }
  ranked.sort((a, b) => a.tier - b.tier || a.app.label.length - b.app.label.length || a.app.label.localeCompare(b.app.label));
  return ranked.slice(0, limit);
}

/** Never guesses: one clear best match is "found"; several equally good matches are "ambiguous". */
export function resolveApp(apps, query) {
  const ranked = searchApps(apps, query, { limit: 50 });
  if (!ranked.length) return { status: 'none', candidates: [] };
  const best = ranked.filter((r) => r.tier === ranked[0].tier);
  if (best.length === 1) return { status: 'found', app: best[0].app, why: best[0].why, candidates: [] };
  return { status: 'ambiguous', candidates: best.slice(0, 5).map((r) => r.app) };
}

export function sensitiveApps(apps, patterns = SENSITIVE_PATTERNS) {
  return (apps ?? []).filter((a) => { const hay = `${a.packageName} ${a.label}`.toLowerCase(); return patterns.some((p) => hay.includes(p)); });
}
