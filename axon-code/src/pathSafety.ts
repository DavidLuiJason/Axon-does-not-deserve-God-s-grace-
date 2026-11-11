/** Path handling for virtual project files and archive entries. */
export function normalizeProjectPath(input: string): string | null {
  if (typeof input !== 'string' || input.length === 0) return null;
  if (input.includes('\0') || input.includes('\\')) return null;
  if (input.startsWith('/') || /^[a-zA-Z]:/.test(input)) return null;
  const parts = input.split('/');
  const clean: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') return null;
    if (part.length > 255) return null;
    clean.push(part);
  }
  if (clean.length === 0) return null;
  return clean.join('/');
}


/** Cross-platform path policy used by project selection, persistent workspaces and exports. */
export function isPortableProjectPath(path: string): boolean {
  if (normalizeProjectPath(path) !== path) return false;
  if (path.normalize('NFC') !== path || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(path)) return false;
  return path.split('/').every((segment) => !segment.includes(':') && !/[ .]$/.test(segment) &&
    !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(segment));
}

export function isTextLikePath(path: string): boolean {
  return /\.(?:[cm]?js|jsx|[cm]?ts|tsx|json|jsonc|css|html|htm|xml|md|txt|yaml|yml|svg)$/i.test(path);
}

export function joinProjectPath(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = fromFile.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (base.length === 0) return null;
      base.pop();
    } else {
      base.push(part);
    }
  }
  return normalizeProjectPath(base.join('/'));
}
