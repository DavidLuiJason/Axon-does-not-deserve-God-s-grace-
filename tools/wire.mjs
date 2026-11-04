// tools/wire.mjs: DIRECTOR TOOL (auto-wiring PROOF, part 1). Reads wiring/*.wire.json cards and writes the DATA parts of a tool's
// shared-registry wiring as text fragments. It edits NOTHING (no file is written, no hand file is touched). No clock, no random, no network.
// Same card gives the same bytes. A bad card skips only that tool and says why.
// Usage: node tools/wire.mjs            (dry run: print every fragment)
//        node tools/wire.mjs --proof    (compare every fragment with the hand wiring in src/; exit 1 on any difference)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
const list = (a) => '[' + a.map(q).join(', ') + ']';

export function checkCard(c) {
  const need = ['toolId', 'displayName', 'catalog', 'chat', 'descriptor', 'schemaRow', 'bindDefaults', 'live'];
  for (const k of need) if (c[k] === undefined) return `missing "${k}"`;
  if (typeof c.toolId !== 'string' || !/^[a-z][a-z0-9-]*$/.test(c.toolId)) return 'toolId must be lower-case words joined by dashes';
  if (!Array.isArray(c.schemaRow) || c.schemaRow.length !== 10 || c.schemaRow[0] !== c.toolId) return 'schemaRow needs 10 columns and must start with the toolId';
  for (const i of c.descriptor.inputs ?? []) if (!['text', 'choice', 'yes-no', 'number'].includes(i.kind)) return `unknown input kind "${i.kind}"`;
  return null;
}

export function fragments(c) {
  const id = c.toolId;
  const inputs = c.descriptor.inputs.map((i) => `{ name: ${q(i.name)}, kind: ${q(i.kind)} as const${i.choices ? ', choices: ' + list(i.choices) : ''} }`).join(', ');
  const live = c.live;
  const fold = live.foldSlot ? `...(args.${live.foldSlot} !== undefined ? { ${live.foldSlot}: ${live.foldFn}(args.${live.foldSlot}) } : {})` : '';
  const bd = Object.entries(c.bindDefaults).map(([slot, d]) => `${slot}: { value: ${q(d.value)}, note: ${q(d.note)} }`).join(', ');
  return [
    { name: 'catalog entry', file: 'src/tools/toolCatalog.ts', text: [`id: ${q(id)},`, `name: ${q(c.displayName)},`, `description: ${q(c.catalog.description)},`, `groupId: ${q(c.catalog.groupId)},`, `status: ${q(c.catalog.status)},`, `opens: ${q(c.catalog.opens)},`].join('\n') },
    { name: 'chat action', file: 'src/capabilities/registerAxonTools.ts', text: [`id: ${q(c.chat.actionId)},`, `purpose: ${q(c.chat.purpose)},`, 'examples: [', ...c.chat.examples.map((e) => `${q(e)},`), '],', `status: ${q(c.chat.status)},`, `link: { actionId: ${q(c.chat.linkActionId)} },`].join('\n') },
    { name: 'descriptor', file: 'src/tools/engines/legacyDescriptors.ts', text: `export const ${c.descriptor.const} = { toolId: ${q(id)}, displayName: ${q(c.displayName)}, purpose: ${q(c.descriptor.purpose)}, examples: ${list(c.descriptor.examples)}, inputs: [${inputs}] } as const;` },
    { name: 'schema row', file: 'src/brain/mind/schema/actionSchemas.ts', text: c.schemaRow.join(' | ') },
    { name: 'bind default', file: 'src/brain/mind/bind/bindDefaults.ts', text: `${q(id)}: Object.freeze({ ${bd} }),` },
    { name: 'live switch', file: 'src/tools/runners/liveSwitches.ts', text: `${q(id)}: ${q(live.switch)} as const` },
    { name: 'live choices', file: 'src/tools/runners/liveSwitches.ts', text: `${q(id)}: Object.freeze({ ${live.choiceSlot}: ${live.choicesConst} })` },
    { name: 'live task', file: 'src/tools/runners/liveSwitches.ts', text: `${q(id)}: Object.freeze({ actionId: ${live.actionConst}.id, input: (args: Readonly<Record<string, unknown>>) => ({ text: args.text, ${fold} }) }),` },
  ];
}

const norm = (s) => s.split('\n').map((l) => l.trim()).filter((l) => l !== '').join('\n');
export function proof(root, card) {
  const rows = [];
  for (const f of fragments(card)) {
    const p = join(root, f.file);
    const hand = existsSync(p) ? norm(readFileSync(p, 'utf8')) : null;
    const gen = norm(f.text);
    rows.push({ name: f.name, file: f.file, ok: hand !== null && hand.includes(gen), gen });
  }
  return rows;
}

export function loadCards(root) {
  const dir = join(root, 'wiring'), cards = [], skipped = [];
  if (!existsSync(dir)) return { cards, skipped };
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.wire.json')).sort()) {
    try { const c = JSON.parse(readFileSync(join(dir, f), 'utf8')); const bad = checkCard(c); if (bad) skipped.push(`${f}: ${bad}`); else cards.push(c); }
    catch (e) { skipped.push(`${f}: not valid JSON`); }
  }
  return { cards, skipped };
}

const isMain = process.argv[1] && process.argv[1].endsWith('wire.mjs');
if (isMain) {
  const root = process.cwd(), doProof = process.argv.includes('--proof');
  const { cards, skipped } = loadCards(root);
  for (const s of skipped) console.log(`SKIPPED ${s}`);
  let bad = 0;
  for (const c of cards) {
    if (doProof) { for (const r of proof(root, c)) { console.log(`${r.ok ? 'MATCH ' : 'DIFFER'} ${c.toolId} | ${r.name} | ${r.file}`); if (!r.ok) bad++; } }
    else for (const f of fragments(c)) console.log(`--- ${c.toolId} | ${f.name} | ${f.file}\n${f.text}`);
  }
  console.log(`WIRE ${doProof ? 'PROOF' : 'DRY RUN'}: ${cards.length} card(s), ${skipped.length} skipped${doProof ? `, ${bad} difference(s)` : ''}`);
  process.exit(bad || skipped.length ? 1 : 0);
}
