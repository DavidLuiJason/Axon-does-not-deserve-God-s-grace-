/**
 * B03A static guards (FL13): under src/brain/mind there is no regular-expression literal, and no array of three or
 * more string literals outside closedSets.ts (closed grammar classes) and concepts.ts (dictionary synset ids only).
 * The scanner is proven on bad and good snippets first, so a guard that cannot see anything cannot pass silently.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let checks = 0;
function assert(condition: unknown, message: string): asserts condition { checks += 1; if (!condition) throw new Error(`FAIL: ${message}`); }

type Tok = { kind: 'str' | 'punct' | 'word' | 'regex'; text: string; line: number };

export function scan(source: string): { regexes: number[]; arrays: Array<{ line: number; strings: string[] }> } {
  const toks: Tok[] = [];
  let i = 0; let line = 1;
  const prevSignificant = () => toks[toks.length - 1];
  while (i < source.length) {
    const ch = source[i]!; const next = source[i + 1];
    if (ch === '\n') { line += 1; i += 1; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i += 1; continue; }
    if (ch === '/' && next === '/') { while (i < source.length && source[i] !== '\n') i += 1; continue; }
    if (ch === '/' && next === '*') { i += 2; while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) { if (source[i] === '\n') line += 1; i += 1; } i += 2; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      const start = i; const startLine = line; i += 1;
      while (i < source.length && source[i] !== ch) { if (source[i] === '\\') i += 1; if (source[i] === '\n') line += 1; i += 1; }
      i += 1; toks.push({ kind: 'str', text: source.slice(start, i), line: startLine }); continue;
    }
    if (ch === '/') {
      const prev = prevSignificant();
      const regexAllowed = !prev || (prev.kind === 'punct' && !')]}'.includes(prev.text)) || (prev.kind === 'word' && ['return', 'typeof', 'case', 'in', 'of'].includes(prev.text));
      if (regexAllowed) {
        const startLine = line; let inClass = false; i += 1;
        while (i < source.length && (source[i] !== '/' || inClass)) { if (source[i] === '\\') i += 1; else if (source[i] === '[') inClass = true; else if (source[i] === ']') inClass = false; i += 1; }
        i += 1; while (i < source.length && /[a-z]/.test(source[i]!)) i += 1;
        toks.push({ kind: 'regex', text: 'regex', line: startLine }); continue;
      }
    }
    if (/[A-Za-z0-9_$]/.test(ch)) { const start = i; while (i < source.length && /[A-Za-z0-9_$.]/.test(source[i]!)) i += 1; toks.push({ kind: 'word', text: source.slice(start, i), line }); continue; }
    toks.push({ kind: 'punct', text: ch, line }); i += 1;
  }
  const regexes = toks.filter((t) => t.kind === 'regex').map((t) => t.line);
  const arrays: Array<{ line: number; strings: string[] }> = [];
  const stack: Array<{ literal: boolean; line: number; strings: string[]; depth: number }> = [];
  let depth = 0;
  toks.forEach((tok, index) => {
    if (tok.kind === 'punct' && '([{'.includes(tok.text)) depth += 1;
    if (tok.kind === 'punct' && ')]}'.includes(tok.text)) depth -= 1;
    if (tok.kind === 'punct' && tok.text === '[') {
      const before = toks[index - 1];
      const indexing = before !== undefined && (before.kind === 'word' || (before.kind === 'punct' && (before.text === ')' || before.text === ']')));
      stack.push({ literal: !indexing, line: tok.line, strings: [], depth });
    } else if (tok.kind === 'punct' && tok.text === ']') {
      const top = stack.pop();
      if (top?.literal && top.strings.length >= 3) arrays.push({ line: top.line, strings: top.strings });
    } else if (tok.kind === 'str') {
      const top = stack[stack.length - 1];
      if (top && top.depth === depth) top.strings.push(tok.text);
    }
  });
  return { regexes, arrays };
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) { const full = join(dir, name); if (statSync(full).isDirectory()) out.push(...walk(full)); else if (name.endsWith('.ts')) out.push(full); }
  return out;
}

// The scanner sees what it must see.
const bad = scan("const a = ['x', 'y', 'z'];\nconst r = /ab+c/g;\nconst s = new Set(['p', 'q', 'r']);");
assert(bad.regexes.length === 1 && bad.arrays.length === 2, 'the scanner finds a regex literal and two arrays of three strings');
const good = scan("const a = 10 / 2; const b = ['x', 'y']; const c = list[0]; // /not/ ['a','b','c']\nconst d = \"/ not a regex\";");
assert(good.regexes.length === 0 && good.arrays.length === 0, 'division, short arrays, indexing, comments and strings are not flagged');

const ALLOWED_LISTS = new Set(['src/brain/mind/meaning/closedSets.ts', 'src/brain/mind/meaning/concepts.ts', 'src/brain/mind/meaning/valueWords.ts', 'src/brain/mind/meaning/language/english.ts']);
const files = walk('src/brain/mind');
assert(files.length >= 10, 'the scan covers the mind folder');
for (const file of files) {
  const key = file.split('\\').join('/');
  const found = scan(readFileSync(file, 'utf8'));
  assert(found.regexes.length === 0, `no regular-expression literal in ${key} (line ${found.regexes[0] ?? '-'})`);
  if (ALLOWED_LISTS.has(key)) continue;
  assert(found.arrays.length === 0, `no array of three or more string literals in ${key} (line ${found.arrays[0]?.line ?? '-'})`);
}
// concepts.ts may hold synset ids only.
const concepts = scan(readFileSync('src/brain/mind/meaning/concepts.ts', 'utf8'));
for (const array of concepts.arrays) for (const text of array.strings) assert(text.startsWith("'oewn-") && text.endsWith("-n'"), `concepts.ts holds only noun synset ids: ${text}`);
// Conversation words live outside the brain's folder, in the knowledge folder.
assert(!files.some((f) => f.includes('conversationWords')), 'the conversation-word file is knowledge data, not brain logic');
console.log(`B03A NO-PHRASES GUARD OK: ${files.length} files scanned, ${checks} checks`);
