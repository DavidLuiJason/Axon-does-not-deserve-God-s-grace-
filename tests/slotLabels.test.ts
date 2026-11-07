// SLB1 slot label table check (Director). Proof: every required pair has a plain label, no code name, no stale key.
declare const console: { log: (v: string) => void };
import { SLOT_LABELS } from '../src/decision/slotLabels';
import { ACTION_SCHEMAS } from '../src/brain/mind/schema/actionSchemas';
import { GENERATED_SCHEMA_ROWS } from '../src/generated/wiredSchemaRows';
let n = 0;
const ok = (c: boolean, l: string) => { if (!c) throw new Error('FAIL ' + l); n++; };
const generated = new Set(GENERATED_SCHEMA_ROWS.map((r) => r.split('|')[0].trim()));
const real = new Map<string, boolean>();
const required: string[] = [];
for (const a of ACTION_SCHEMAS) for (const s of a.slots) { real.set(a.tool + '.' + s.name, s.required); if (s.required && !generated.has(a.tool)) required.push(a.tool + '.' + s.name); }
const keys = Object.keys(SLOT_LABELS);
ok(Object.isFrozen(SLOT_LABELS), 'table is frozen');
ok(required.length >= 70, 'at least 70 required pairs exist (found ' + required.length + ')');
for (const k of required) ok(typeof SLOT_LABELS[k] === 'string', 'required pair has a label: ' + k);
for (const k of keys) ok(real.has(k), 'no stale or misspelled key: ' + k);
const allowed = 'abcdefghijklmnopqrstuvwxyz ';
for (const k of keys) {
  const v = SLOT_LABELS[k];
  ok(typeof v === 'string' && v.length >= 3 && v.length <= 40, 'length 3 to 40: ' + k);
  ok(v.split('').every((c) => allowed.includes(c)), 'letters and spaces only (no capital, digit, hyphen, id): ' + k);
  ok(v === v.trim() && !v.includes('  '), 'clean spacing: ' + k);
  const slot = k.slice(k.indexOf('.') + 1), tool = k.slice(0, k.indexOf('.'));
  ok(v !== slot && v !== tool, 'label is not the code name: ' + k);
}
const perTool = new Map<string, string[]>();
for (const k of keys) { const t = k.slice(0, k.indexOf('.')); perTool.set(t, [...(perTool.get(t) ?? []), SLOT_LABELS[k]]); }
for (const [t, ls] of perTool) ok(new Set(ls).size === ls.length, 'labels differ inside one tool: ' + t);
const covered = required.filter((k) => typeof SLOT_LABELS[k] === 'string').length;
console.log('SLOT_LABELS OK: ' + n + ' checks; ' + covered + ' of ' + required.length + ' required pairs labelled (' + keys.length + ' keys, ' + perTool.size + ' tools)');
