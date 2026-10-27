// Resolver for run.mjs: lets Node load extension-less TypeScript imports ('./notesTypes' -> './notesTypes.ts').
// Director file, no install needed (Node 22 strips types itself). Builders never change it.
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const base = new URL(specifier, context.parentURL);
    const path = fileURLToPath(base);
    const tries = [path + '.ts', path + '/index.ts'];
    if (!/\.[a-z]+$/.test(specifier) || existsSync(path) === false) {
      for (const t of tries) { if (existsSync(t) && statSync(t).isFile()) return nextResolve(pathToFileURL(t).href, context); }
    }
  }
  return nextResolve(specifier, context);
}
