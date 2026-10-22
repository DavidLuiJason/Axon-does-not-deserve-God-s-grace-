/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FL12 / Rule 12: the chat brain import boundary is a ratchet.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';

// Adding a file here is a deliberate decision: everything in the chat must go through the brain pipeline (FL12).
const ALLOWED_BRAIN_IMPORTERS = [
  'src/components/CreditsModal.tsx',
  // Dictionary screen: reads only the dictionary data layer (lookups, word book, headword picker), never the chat pipeline. Approved 2026-10-17.
  'src/components/DictionaryScreen.tsx',
  // My Dictionary screen: reads only the dictionary data layer (getDictionary) to ask whether a word is already in the core dictionary; never the chat pipeline. Proposed by the Director 2026-10-22 (same kind of access as the Dictionary screen); the owner approves by merging.
  'src/components/toolScreens/MyDictionaryScreen.tsx',
  // My Dictionary engine adapter: implements the brain's KnowledgeBackend contract (src/brain/knowledge/slot.ts) so the owner's own words can sit in a second knowledge slot; it reads and implements that contract only, it never touches the chat pipeline. Required by job C18; proposed by the Director 2026-10-22, the owner approves by merging.
  'src/tools/engines/dictionary/userDictionaryBackend.ts',
  'src/services/axonBrainInterface.ts',
] as const;

const SRC = resolve('src');
const BRAIN = resolve('src/brain');
const extensions = ['.ts', '.tsx'];

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (extensions.includes(extname(entry.name))) out.push(full);
  }
  return out;
}

function resolvesIntoBrain(fromFile: string, specifier: string): boolean {
  if (!specifier.startsWith('.')) return false;
  const target = resolve(dirname(fromFile), specifier);
  const rel = relative(BRAIN, target);
  const inside = rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  if (!inside) return false;
  const candidates = [target, `${target}.ts`, `${target}.tsx`, join(target, 'index.ts'), join(target, 'index.tsx')];
  return candidates.some((candidate) => existsSync(candidate));
}

function brainImports(file: string): boolean {
  const source = readFileSync(file, 'utf8');
  const importPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(source))) if (resolvesIntoBrain(file, match[1])) return true;
  return false;
}

function main(): void {
  const files = listSourceFiles(SRC).filter((file) => file !== BRAIN && !file.startsWith(`${BRAIN}/`));
  const found = files.filter(brainImports).map((file) => relative(process.cwd(), file).replace(/\\/g, '/')).sort();
  const allowed: string[] = [...ALLOWED_BRAIN_IMPORTERS].sort();
  for (const file of found) if (!allowed.includes(file)) throw new Error(`Unapproved file imports the brain: ${file}`);
  for (const file of allowed) if (!found.includes(file)) throw new Error(`Allowed brain importer no longer imports the brain: ${file}`);
  console.log(`B1 brain boundary passed: ${found.length} allowed importers (${found.join(', ')})`);
}

main();
