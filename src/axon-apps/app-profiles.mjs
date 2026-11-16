// AXON Apps profiles: the owner's own names for apps ("my bank" = a package) and short notes. Storage is injected later; this is the logic.
const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export function createAppProfiles(initial = {}) {
  const aliases = new Map(Object.entries(initial.aliases ?? {}).map(([k, v]) => [norm(k), String(v)]));
  const notes = new Map(Object.entries(initial.notes ?? {}).map(([k, v]) => [String(k), String(v).slice(0, 500)]));
  return {
    setAlias(name, packageName) { const n = norm(name); if (!n || !packageName) return false; aliases.set(n, String(packageName)); return true; },
    removeAlias(name) { return aliases.delete(norm(name)); },
    lookup(query) { return aliases.get(norm(query)) ?? null; },
    setNote(packageName, text) { if (!packageName) return false; notes.set(String(packageName), String(text ?? '').slice(0, 500)); return true; },
    getNote(packageName) { return notes.get(String(packageName)) ?? null; },
    toJSON() { return { aliases: Object.fromEntries(aliases), notes: Object.fromEntries(notes) }; },
  };
}
