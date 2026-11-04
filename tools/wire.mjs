// tools/wire.mjs: DIRECTOR TOOL (auto-wiring, part 2). Reads wiring/*.wire.json cards and RENDERS the six generated registry files
// (src/generated/wired*.ts) as text. It writes NOTHING itself: tools/wire-write.mjs is the only writer, and only into src/generated/.
// No clock, no random, no network. Same cards give the same bytes. A bad card skips only that tool and says why; a part that is
// already wired by hand is REFUSED (list it in the card's "handParts" so it is only proven equal, never generated).
// Usage: node tools/wire.mjs            (dry run: print every generated file)
//        node tools/wire.mjs --proof    (compare every card's handParts with the hand wiring in src/; exit 1 on any difference)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
const list = (a) => '[' + a.map(q).join(', ') + ']';
const indent = (text, n) => text.split('\n').map((l) => ' '.repeat(n) + l).join('\n');

export const PARTS = ['catalog', 'chat', 'descriptor', 'schema', 'bind', 'live'];
export const GENERATED_FILES = ['wiredCatalog.ts', 'wiredChatActions.ts', 'wiredDescriptors.ts', 'wiredSchemaRows.ts', 'wiredBindDefaults.ts', 'wiredLive.ts'];
const CHAT_STATUSES = ['available', 'needs-screen', 'needs-permission', 'not-built'];

export function checkCard(c) {
  const need = ['toolId', 'displayName', 'catalog', 'chat', 'descriptor', 'schemaRow', 'bindDefaults', 'live'];
  for (const k of need) if (c[k] === undefined) return `missing "${k}"`;
  if (typeof c.toolId !== 'string' || !/^[a-z][a-z0-9-]*$/.test(c.toolId)) return 'toolId must be lower-case words joined by dashes';
  if (!Array.isArray(c.schemaRow) || c.schemaRow.length !== 10 || c.schemaRow[0] !== c.toolId) return 'schemaRow needs 10 columns and must start with the toolId';
  for (const i of c.descriptor.inputs ?? []) if (!['text', 'choice', 'yes-no', 'number'].includes(i.kind)) return `unknown input kind "${i.kind}"`;
  const hand = c.handParts ?? [];
  if (!Array.isArray(hand) || hand.some((p) => !PARTS.includes(p))) return `handParts may only list: ${PARTS.join(', ')}`;
  if (!['available', 'coming-soon'].includes(c.catalog.status)) return 'catalog.status must be available or coming-soon';
  if ((c.catalog.status === 'available') !== (c.catalog.opens !== undefined)) return 'catalog.opens is present exactly when catalog.status is available';
  if (!CHAT_STATUSES.includes(c.chat.status)) return 'chat.status is not a chat action status';
  if (c.live !== null) {
    const l = c.live;
    if (typeof l !== 'object') return 'live must be null (not live) or an object';
    for (const k of ['switch', 'choicesConst', 'choiceSlot', 'actionConst']) if (typeof l[k] !== 'string' || l[k] === '') return `live.${k} is missing`;
    if ((l.foldSlot === undefined) !== (l.foldFn === undefined)) return 'live.foldSlot and live.foldFn go together';
    if (!hand.includes('live')) {
      if (typeof l.approvedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(l.approvedOn)) return 'a generated live block needs live.approvedOn (YYYY-MM-DD, set only after tests, golden transcript and the owner phone check)';
      if (!Array.isArray(l.imports) || l.imports.length === 0 || l.imports.some((i) => typeof i.from !== 'string' || !Array.isArray(i.names))) return 'a generated live block needs live.imports [{ from, names }] (paths relative to src/)';
      const named = new Set(l.imports.flatMap((i) => i.names));
      for (const k of ['choicesConst', 'actionConst', 'foldFn']) if (l[k] !== undefined && !named.has(l[k])) return `live.${k} "${l[k]}" is not in live.imports`;
    }
  }
  return null;
}

export function fragments(c) {
  const id = c.toolId;
  const inputs = c.descriptor.inputs.map((i) => `{ name: ${q(i.name)}, kind: ${q(i.kind)} as const${i.choices ? ', choices: ' + list(i.choices) : ''} }`).join(', ');
  const live = c.live;
  const bd = Object.entries(c.bindDefaults).map(([slot, d]) => `${slot}: { value: ${q(d.value)}, note: ${q(d.note)} }`).join(', ');
  const out = [
    { part: 'catalog', name: 'catalog entry', file: 'src/tools/toolCatalog.ts', text: [`id: ${q(id)},`, `name: ${q(c.displayName)},`, `description: ${q(c.catalog.description)},`, `groupId: ${q(c.catalog.groupId)},`, `status: ${q(c.catalog.status)},`, ...(c.catalog.opens !== undefined ? [`opens: ${q(c.catalog.opens)},`] : [])].join('\n') },
    { part: 'chat', name: 'chat action', file: 'src/capabilities/registerAxonTools.ts', text: [`id: ${q(c.chat.actionId)},`, `purpose: ${q(c.chat.purpose)},`, 'examples: [', ...c.chat.examples.map((e) => `${q(e)},`), '],', `status: ${q(c.chat.status)},`, ...(c.chat.linkActionId !== undefined ? [`link: { actionId: ${q(c.chat.linkActionId)} },`] : [])].join('\n') },
    { part: 'descriptor', name: 'descriptor', file: 'src/tools/engines/legacyDescriptors.ts', text: `export const ${c.descriptor.const} = { toolId: ${q(id)}, displayName: ${q(c.displayName)}, purpose: ${q(c.descriptor.purpose)}, examples: ${list(c.descriptor.examples)}, inputs: [${inputs}] } as const;` },
    { part: 'schema', name: 'schema row', file: 'src/brain/mind/schema/actionSchemas.ts', text: c.schemaRow.join(' | ') },
    { part: 'bind', name: 'bind default', file: 'src/brain/mind/bind/bindDefaults.ts', text: `${q(id)}: Object.freeze({ ${bd} }),` },
  ];
  if (live !== null) {
    const fold = live.foldSlot ? `...(args.${live.foldSlot} !== undefined ? { ${live.foldSlot}: ${live.foldFn}(args.${live.foldSlot}) } : {})` : '';
    out.push(
      { part: 'live', name: 'live switch', file: 'src/tools/runners/liveSwitches.ts', text: `${q(id)}: ${q(live.switch)} as const` },
      { part: 'live', name: 'live choices', file: 'src/tools/runners/liveSwitches.ts', text: `${q(id)}: Object.freeze({ ${live.choiceSlot}: ${live.choicesConst} })` },
      { part: 'live', name: 'live task', file: 'src/tools/runners/liveSwitches.ts', text: `${q(id)}: Object.freeze({ actionId: ${live.actionConst}.id, input: (args: Readonly<Record<string, unknown>>) => ({ text: args.text, ${fold} }) }),` },
    );
  }
  return out;
}

const norm = (s) => s.split('\n').map((l) => l.trim()).filter((l) => l !== '').join('\n');
export function proof(root, card) {
  const hand = card.handParts ?? [];
  const rows = [];
  for (const f of fragments(card).filter((x) => hand.includes(x.part))) {
    const p = join(root, f.file);
    const text = existsSync(p) ? norm(readFileSync(p, 'utf8')) : null;
    const gen = norm(f.text);
    rows.push({ name: f.name, file: f.file, ok: text !== null && text.includes(gen), gen });
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

const rd = (root, f) => { const p = join(root, f); return existsSync(p) ? readFileSync(p, 'utf8') : ''; };
export function handHas(root, part, c) {
  const id = c.toolId;
  if (part === 'catalog') return rd(root, 'src/tools/toolCatalog.ts').includes(`id: ${q(id)},`);
  if (part === 'chat') return rd(root, 'src/capabilities/registerAxonTools.ts').includes(`id: ${q(c.chat.actionId)},`);
  if (part === 'descriptor') return rd(root, 'src/tools/engines/legacyDescriptors.ts').includes(`toolId: ${q(id)},`);
  if (part === 'schema') return rd(root, 'src/brain/mind/schema/actionSchemas.ts').split('\n').some((l) => l.startsWith(`${id} |`));
  if (part === 'bind') { const t = rd(root, 'src/brain/mind/bind/bindDefaults.ts'); return t.includes(`${q(id)}: Object.freeze(`) || t.includes(`\n  ${id}: Object.freeze(`); }
  if (part === 'live') return rd(root, 'src/tools/runners/liveSwitches.ts').includes(`${q(id)}: `);
  return false;
}

const present = (c, part) => (part === 'live' ? c.live !== null : part === 'bind' ? Object.keys(c.bindDefaults).length > 0 : true);

/** Which parts of which card will be generated, and which are refused. Reads hand files only to refuse; writes nothing. */
export function plan(root) {
  const { cards, skipped } = loadCards(root);
  const refused = [], items = [], seen = new Set();
  for (const c of cards) {
    if (seen.has(c.toolId)) { refused.push(`${c.toolId}: a second card has the same toolId`); continue; }
    seen.add(c.toolId);
    const hand = c.handParts ?? [];
    const emit = PARTS.filter((p) => !hand.includes(p) && present(c, p));
    const bad = emit.filter((p) => handHas(root, p, c));
    for (const p of bad) refused.push(`${c.toolId}: part "${p}" is already wired by hand; add it to handParts`);
    items.push({ card: c, emit: bad.length ? [] : emit });
  }
  return { items, skipped, refused };
}

const HEAD = (items) => {
  const gen = items.filter((i) => i.emit.length > 0).map((i) => i.card.toolId);
  const proofOnly = items.filter((i) => i.emit.length === 0).map((i) => i.card.toolId);
  return `// GENERATED by tools/wire-write.mjs from wiring/*.wire.json: DO NOT EDIT BY HAND (tests/wireGenerated.test.ts fails when this file is stale).\n// Tools with generated parts: ${gen.length ? gen.join(', ') : 'none'}. Cards with no generated part (hand-wired, proof only): ${proofOnly.length ? proofOnly.join(', ') : 'none'}.\n`;
};
const frag = (items, part, name) => items.filter((i) => i.emit.includes(part)).flatMap((i) => fragments(i.card).filter((f) => f.part === part && (name === undefined || f.name === name)));

/** Pure: plan in, { file name: text } out. */
export function render(pl) {
  const items = pl.items, head = HEAD(items), out = {};
  out['wiredCatalog.ts'] = `${head}import type { CatalogTool } from '../tools/toolCatalog';\n\nexport const GENERATED_CATALOG_TOOLS: readonly CatalogTool[] = [\n${frag(items, 'catalog').map((f) => `  {\n${indent(f.text, 4)}\n  },\n`).join('')}];\n`;
  out['wiredChatActions.ts'] = `${head}import type { ChatAction } from '../capabilities/types';\n\nexport const GENERATED_CHAT_ACTIONS: readonly ChatAction[] = [\n${frag(items, 'chat').map((f) => `  {\n${indent(f.text, 4)}\n  },\n`).join('')}];\n`;
  const ds = frag(items, 'descriptor');
  out['wiredDescriptors.ts'] = `${head}\n${ds.map((f) => f.text + '\n').join('')}export const GENERATED_DESCRIPTORS = [${items.filter((i) => i.emit.includes('descriptor')).map((i) => i.card.descriptor.const).join(', ')}] as const;\n`;
  out['wiredSchemaRows.ts'] = `${head}\nexport const GENERATED_SCHEMA_ROWS: readonly string[] = [\n${frag(items, 'schema').map((f) => `  ${q(f.text)},\n`).join('')}];\n`;
  out['wiredBindDefaults.ts'] = `${head}\n// The slot default shape is written out here on purpose: a file in src/generated/ must not import the brain (tests/brainBoundary.test.ts).\nexport const GENERATED_SLOT_DEFAULTS: Readonly<Record<string, Readonly<Record<string, { readonly value: string | number; readonly note: string }>>>> = Object.freeze({\n${frag(items, 'bind').map((f) => `  ${f.text}\n`).join('')}});\n`;
  const liveItems = items.filter((i) => i.emit.includes('live'));
  const byFrom = new Map();
  for (const i of liveItems) for (const im of i.card.live.imports) { const s = byFrom.get(im.from) ?? new Set(); im.names.forEach((n) => s.add(n)); byFrom.set(im.from, s); }
  const imports = [...byFrom.keys()].sort().map((from) => `import { ${[...byFrom.get(from)].sort().join(', ')} } from '../${from}';\n`).join('');
  const strip = (t) => t.replace(/,$/, '');
  out['wiredLive.ts'] = `${head}import type { RunnerSwitches } from '../tools/runners/runnerRegistry';\n${imports}\nexport const GENERATED_LIVE_SWITCHES: RunnerSwitches = Object.freeze({\n${frag(items, 'live', 'live switch').map((f) => `  ${strip(f.text)},\n`).join('')}});\n\nexport const GENERATED_LIVE_CHOICES: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = Object.freeze({\n${frag(items, 'live', 'live choices').map((f) => `  ${strip(f.text)},\n`).join('')}});\n\nexport const GENERATED_LIVE_TASKS: Readonly<Record<string, { readonly actionId: string; readonly input: (args: Readonly<Record<string, unknown>>) => Record<string, unknown> }>> = Object.freeze({\n${frag(items, 'live', 'live task').map((f) => `  ${f.text}\n`).join('')}});\n`;
  return out;
}

const isMain = process.argv[1] && process.argv[1].endsWith('wire.mjs');
if (isMain) {
  const root = process.cwd(), doProof = process.argv.includes('--proof');
  const { cards, skipped } = loadCards(root);
  for (const s of skipped) console.log(`SKIPPED ${s}`);
  let bad = 0;
  if (doProof) {
    for (const c of cards) for (const r of proof(root, c)) { console.log(`${r.ok ? 'MATCH ' : 'DIFFER'} ${c.toolId} | ${r.name} | ${r.file}`); if (!r.ok) bad++; }
  } else {
    const pl = plan(root);
    for (const r of pl.refused) { console.log(`REFUSED ${r}`); bad++; }
    const files = render(pl);
    for (const n of GENERATED_FILES) console.log(`--- src/generated/${n}\n${files[n]}`);
  }
  console.log(`WIRE ${doProof ? 'PROOF' : 'DRY RUN'}: ${cards.length} card(s), ${skipped.length} skipped${doProof ? `, ${bad} difference(s)` : `, ${bad} refused`}`);
  process.exit(bad || skipped.length ? 1 : 0);
}
