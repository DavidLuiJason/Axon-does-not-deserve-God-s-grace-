import { tokenize, JSON_LIMITS } from './jsonTokens';

export const JSON_VIEW_LIMITS = { maxBytes: Math.min(JSON_LIMITS.maxBytes, 512 * 1024), // viewer cap: measured about 130 bytes of heap per input byte (1.1 MB of numbers cost 150 MB), too heavy for a low-memory phone above this size
  maxDepth: JSON_LIMITS.maxDepth, defaultWindow: 500, maxWindow: 5000, maxPreview: 120 } as const;
export type JsonViewErrorCode = 'invalid-json' | 'too-large' | 'invalid-window' | 'path-not-found' | 'invalid-input';
export type JsonViewError = { ok: false; error: JsonViewErrorCode; message: string };
export type JsonValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
export type JsonViewNode = { type: JsonValueType; key: string | number | null; preview: string; size: number; path: string; valueLength?: number; childCount: number; hasChildren: boolean; tokenStart: number; tokenEnd: number };
export type JsonViewResult<T> = { ok: true; value: T } | JsonViewError;
type RecordNode = { node: JsonViewNode; children: JsonViewNode[] };
type Tree = { root: JsonViewNode; records: Map<JsonViewNode, RecordNode>; text: string };
export const JSON_VIEW_DESCRIPTOR = { toolId: 'json-viewer', displayName: 'JSON Viewer', purpose: 'Inspect valid JSON as a bounded, lazy tree with paths and structural statistics.', examples: ['Show the keys in this JSON object', 'Find data.items[3].name', 'Count the values in this JSON document'], inputs: [{ name: 'text', kind: 'text' as const }, { name: 'path', kind: 'text' as const }, { name: 'offset', kind: 'text' as const }, { name: 'limit', kind: 'text' as const }] } as const;

function quoteKey(k: string): string { return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? `.${k}` : `[${JSON.stringify(k)}]`; }
function preview(type: JsonValueType, raw: string, decoded?: unknown): { text: string; length?: number } {
 if (type === 'object') return { text: '{}' };
 if (type === 'array') return { text: '[]' };
 if (type === 'string') { let value = typeof decoded === 'string' ? decoded : raw.slice(1, -1); const length = value.length; if (value.length > JSON_VIEW_LIMITS.maxPreview) value = value.slice(0, JSON_VIEW_LIMITS.maxPreview) + '…'; return { text: JSON.stringify(value), length }; }
 return { text: raw.length > JSON_VIEW_LIMITS.maxPreview ? raw.slice(0, JSON_VIEW_LIMITS.maxPreview) + '…' : raw };
}
export function buildTree(text: string): JsonViewResult<JsonViewNode> {
 if (typeof text !== 'string') return { ok: false, error: 'invalid-input', message: 'JSON input must be text.' };
 if (new TextEncoder().encode(text).length > JSON_VIEW_LIMITS.maxBytes) return { ok: false, error: 'too-large', message: 'JSON input exceeds the viewer limit of 512 KB.' };
 const parsed = tokenize(text); if (!parsed.ok) return { ok: false, error: 'invalid-json', message: parsed.message };
 const tokens = parsed.value; let ti = 0; const records = new Map<JsonViewNode, RecordNode>();
 const make = (key: string | number | null, path: string, parentChildren?: number[]): JsonViewNode | JsonViewError => {
  const t = tokens[ti++]; if (!t) return { ok: false, error: 'invalid-json', message: 'Unexpected end of token stream.' };
  let type: JsonValueType; let raw = t.text;
  if (raw === '{' || raw === '[') type = raw === '{' ? 'object' : 'array'; else if (t.type === 'string') type = 'string'; else if (t.type === 'number') type = 'number'; else type = raw === 'null' ? 'null' : 'boolean';
  let decoded: unknown; if (type === 'string') { try { decoded = JSON.parse(raw); } catch { decoded = raw.slice(1, -1); } }
  const p = preview(type, raw, decoded); const node: JsonViewNode = { type, key, preview: p.text, size: 0, path, ...(p.length === undefined ? {} : { valueLength: p.length }), childCount: 0, hasChildren: type === 'object' || type === 'array', tokenStart: t.start, tokenEnd: t.end };
  const rec: RecordNode = { node, children: [] }; records.set(node, rec); if (parentChildren) parentChildren.push(0);
  if (type === 'array') {
   let index = 0; if (tokens[ti]?.text === ']') ti++; else { while (ti < tokens.length) { const childPath = path ? `${path}[${index}]` : `[${index}]`; const child = make(index, childPath); if ('error' in child) return child; rec.children.push(child); index++; if (tokens[ti]?.text === ',') { ti++; continue; } if (tokens[ti]?.text === ']') { ti++; break; } return { ok: false, error: 'invalid-json', message: 'Malformed array token sequence.' }; } } node.size = index; node.childCount = index; node.tokenEnd = tokens[ti - 1]?.end ?? t.end;
  } else if (type === 'object') {
   let count = 0; if (tokens[ti]?.text === '}') ti++; else { while (ti < tokens.length) { const kt = tokens[ti++]; if (!kt || kt.type !== 'string') return { ok: false, error: 'invalid-json', message: 'Malformed object key.' }; let k: string; try { k = JSON.parse(kt.text); } catch { return { ok: false, error: 'invalid-json', message: 'Invalid object key.' }; } if (tokens[ti++]?.text !== ':') return { ok: false, error: 'invalid-json', message: 'Missing colon after object key.' }; const childPath = path ? path + quoteKey(k) : quoteKey(k).replace(/^\./, ''); const child = make(k, childPath); if ('error' in child) return child; rec.children.push(child); count++; if (tokens[ti]?.text === ',') { ti++; continue; } if (tokens[ti]?.text === '}') { ti++; break; } return { ok: false, error: 'invalid-json', message: 'Malformed object token sequence.' }; } } node.size = count; node.childCount = count; node.tokenEnd = tokens[ti - 1]?.end ?? t.end;
  }
  return node;
 };
 const root = make(null, 'data'); if ('error' in root) return root;
 const tree: Tree = { root, records, text }; for (const node of records.keys()) TREES.set(node, tree); return { ok: true, value: root };
}
const TREES = new WeakMap<JsonViewNode, Tree>();
export function childrenOf(node: JsonViewNode, offset: number = 0, limit: number = JSON_VIEW_LIMITS.defaultWindow): JsonViewResult<{ children: JsonViewNode[]; offset: number; limit: number; total: number; remaining: number }> {
 if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 0 || limit > JSON_VIEW_LIMITS.maxWindow) return { ok: false, error: 'invalid-window', message: 'Offset must be non-negative and limit must be between 0 and 5000.' };
 const tree = TREES.get(node); const rec = tree?.records.get(node); if (!tree || !rec) return { ok: false, error: 'invalid-input', message: 'Node does not belong to a live JSON view tree.' };
 const children = rec.children.slice(offset, offset + limit); return { ok: true, value: { children, offset, limit, total: rec.children.length, remaining: Math.max(0, rec.children.length - offset - children.length) } };
}
export function stats(text: string): JsonViewResult<{ depth: number; values: number; keys: number; sizeBytes: number }> {
 const tree = buildTree(text); if (!tree.ok) return tree; let depth = 0, values = 0, keys = 0; const stack: { node: JsonViewNode; d: number }[] = [{ node: tree.value, d: 0 }];
 while (stack.length) { const { node, d } = stack.pop()!; values++; depth = Math.max(depth, d); if (node.type === 'object') keys += node.size; const rec = tree.value && TREES.get(tree.value)?.records.get(node); if (rec) for (const child of rec.children) stack.push({ node: child, d: d + 1 }); }
 return { ok: true, value: { depth, values, keys, sizeBytes: new TextEncoder().encode(text).length } };
}
export function findPath(root: JsonViewNode, path: string): JsonViewResult<JsonViewNode> {
 if (typeof path !== 'string') return { ok: false, error: 'invalid-input', message: 'Path must be text.' };
 const tree = TREES.get(root); if (!tree) return { ok: false, error: 'invalid-input', message: 'Root does not belong to a live JSON view tree.' };
 if (path === '' || path === '$') return { ok: true, value: root };
 let cur = root; let rest = path.startsWith('data') ? path.slice(4) : path;
 try {
  while (rest.length) { let key: string | number; if (rest[0] === '.') { const m = /^\.([A-Za-z_$][A-Za-z0-9_$]*)/.exec(rest); if (!m) throw new Error(); key = m[1]; rest = rest.slice(m[0].length); } else if (rest[0] === '[') { const end = rest.indexOf(']'); if (end < 0) throw new Error(); const inside = rest.slice(1, end); if (/^\d+$/.test(inside)) key = Number(inside); else { key = JSON.parse(inside); if (typeof key !== 'string') throw new Error(); } rest = rest.slice(end + 1); } else throw new Error(); const rec = tree.records.get(cur); const next = rec?.children.find(n => n.key === key); if (!next) return { ok: false, error: 'path-not-found', message: `No value exists at path ${path}.` }; cur = next; }
  return { ok: true, value: cur };
 } catch { return { ok: false, error: 'path-not-found', message: `Invalid or missing path ${path}.` }; }
}
