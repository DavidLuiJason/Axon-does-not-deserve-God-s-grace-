import { buildTree, childrenOf, stats, findPath, JSON_VIEW_LIMITS } from '../src/tools/engines/data/jsonView';
let checks = 0; function ok(v: unknown, m: string) { checks++; if (!v) throw new Error(`FAIL ${m}`); }
const source = '{"items":[{"name":"first"},{"the key":"🙂"},{"name":"' + 'x'.repeat(180) + '"}],"n":1.2300e+04,"zero":0,"flag":false,"nil":null}';
const built = buildTree(source); ok(built.ok, 'builds valid JSON tree'); if (!built.ok) throw new Error(built.message);
const root = built.value; ok(root.type === 'object' && root.path === 'data', 'root is object with data path');
const items = findPath(root, 'data.items'); ok(items.ok && items.value.type === 'array', 'finds object member path'); if (!items.ok) throw new Error(items.message);
const window = childrenOf(items.value, 1, 1); ok(window.ok && window.value.children.length === 1 && window.value.remaining === 1, 'children are windowed and remaining count reported');
const odd = findPath(root, 'data.items[1]["the key"]'); ok(odd.ok && odd.value.preview.includes('🙂'), 'supports quoted non-identifier keys and emoji');
const long = findPath(root, 'data.items[2].name'); ok(long.ok && long.value.valueLength === 180 && long.value.preview.length < 140, 'clips long strings while retaining full length');
const number = findPath(root, 'data.n'); ok(number.ok && number.value.preview === '1.2300e+04', 'preserves exact JSON number text');
const st = stats(source); ok(st.ok && st.value.depth === 3 && st.value.values === 12 && st.value.keys === 8 && st.value.sizeBytes === new TextEncoder().encode(source).length, 'reports independently counted depth, values, keys and bytes');
const many = '[' + Array.from({ length: 10000 }, (_, i) => String(i)).join(',') + ']'; const large = buildTree(many); ok(large.ok, 'builds a 10,000-value array'); if (large.ok) { const w = childrenOf(large.value); ok(w.ok && w.value.children.length === JSON_VIEW_LIMITS.defaultWindow && w.value.remaining === 9500, 'large arrays expose only requested default window'); }
ok(!buildTree('{bad}').ok, 'rejects malformed JSON'); ok(!buildTree(' ').ok, 'rejects empty JSON'); ok(!childrenOf(root, -1, 1).ok, 'rejects negative window offset'); ok(!findPath(root, 'data.missing').ok, 'missing path returns typed error');
{ const over = buildTree('[' + '1,'.repeat(JSON_VIEW_LIMITS.maxBytes) + '1]'); ok(!over.ok, 'input above the viewer cap is refused with a typed error'); const under = buildTree('[' + Array.from({ length: 50000 }, (_, i) => String(i % 10)).join(',') + ']'); ok(under.ok, 'a 100 KB array builds'); }
console.log(`jsonView.test.ts: ${checks} checks passed`);
