import fs from 'node:fs';
import path from 'node:path';

/**
 * Small test-only ESM resolver for Node's built-in TypeScript stripping.
 * The normal project test runner uses tsx from npm; this file is a no-dependency
 * fallback used only when npm dependencies cannot be installed in the runner.
 */
export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier)) {
    const parent = context.parentURL?.startsWith('file:') ? new URL(context.parentURL) : null;
    if (parent) {
      for (const ext of ['.ts', '.mjs']) {
        const candidate = new URL(specifier + ext, parent);
        if (fs.existsSync(candidate)) return nextResolve(candidate.href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
