import { readFile } from 'node:fs/promises';

let checks = 0;
function check(condition: unknown, label: string): void {
  checks += 1;
  if (!condition) throw new Error(`FAIL ${label}`);
}

// The generator is a plain .mjs Director tool; load it by a variable path so the type check does not need a declaration file.
const toolPath = '../tools/wire.mjs';
const wire: any = await import(toolPath);
const card = JSON.parse(await readFile('./wiring/sort-lines.wire.json', 'utf8'));
const clone = () => JSON.parse(JSON.stringify(card));
const root = '.';

// 1. The card is valid and the generated wiring equals the hand wiring for Sort Lines (the PROOF).
check(wire.checkCard(card) === null, 'the Sort Lines card passes the card check');
const rows = wire.proof(root, card);
check(rows.length === 8, `eight data fragments are proven (got ${rows.length})`);
for (const r of rows) check(r.ok, `generated ${r.name} equals the hand wiring in ${r.file}`);

// 2. Same input, same bytes.
check(JSON.stringify(wire.fragments(card)) === JSON.stringify(wire.fragments(clone())), 'the same card gives the same fragments twice');

// 3. Mutants: every change to the card must break at least one comparison.
const mutants: Array<[string, (c: any) => void]> = [
  ['catalog description', (c) => { c.catalog.description += ' x'; }],
  ['catalog group', (c) => { c.catalog.groupId = 'media'; }],
  ['chat purpose', (c) => { c.chat.purpose = 'Sort text'; }],
  ['chat example dropped', (c) => { c.chat.examples.pop(); }],
  ['chat example newline lost', (c) => { c.chat.examples[0] = c.chat.examples[0].replace('\n', ' '); }],
  ['chat link', (c) => { c.chat.linkActionId = 'text.sorted'; }],
  ['descriptor purpose', (c) => { c.descriptor.purpose = 'Sort lines.'; }],
  ['descriptor choice removed', (c) => { c.descriptor.inputs[1].choices.pop(); }],
  ['descriptor input order', (c) => { c.descriptor.inputs.reverse(); }],
  ['schema verb', (c) => { c.schemaRow[2] += ' order'; }],
  ['schema slot flag', (c) => { c.schemaRow[5] = c.schemaRow[5].replace('mode:choice:r', 'mode:choice:o'); }],
  ['schema pace', (c) => { c.schemaRow[8] = 'slow high'; }],
  ['bind default value', (c) => { c.bindDefaults.mode.value = 'descending'; }],
  ['bind default note', (c) => { c.bindDefaults.mode.note = 'sorting'; }],
  ['live switch', (c) => { c.live.switch = 'old'; }],
  ['live choices constant', (c) => { c.live.choicesConst = 'CASE_MODE_CHOICES'; }],
  ['live fold function', (c) => { c.live.foldFn = 'foldCaseMode'; }],
  ['live action constant', (c) => { c.live.actionConst = 'TEXT_CASE_ACTION'; }],
  ['display name', (c) => { c.displayName = 'Sort Line'; }],
];
for (const [label, mutate] of mutants) {
  const c = clone();
  mutate(c);
  const differs = wire.proof(root, c).some((r: any) => !r.ok);
  check(differs, `mutant "${label}" is caught by the proof`);
}

// 4. A bad card is refused with a reason (it would be skipped, never half-applied).
const badCards: Array<[string, (c: any) => void]> = [
  ['missing live block', (c) => { delete c.live; }],
  ['missing schema row', (c) => { delete c.schemaRow; }],
  ['uppercase tool id', (c) => { c.toolId = 'Sort-Lines'; }],
  ['schema row too short', (c) => { c.schemaRow.pop(); }],
  ['schema row names another tool', (c) => { c.schemaRow[0] = 'text-compare'; }],
  ['unknown input kind', (c) => { c.descriptor.inputs[0].kind = 'blob'; }],
];
for (const [label, mutate] of badCards) {
  const c = clone();
  mutate(c);
  const reason = wire.checkCard(c);
  check(typeof reason === 'string' && reason.length > 0, `bad card "${label}" is refused with a reason`);
}

// 5. The tool edits nothing and reads no clock, no randomness, no network.
const src = await readFile('./tools/wire.mjs', 'utf8');
for (const word of ['Date.now', 'new Date', 'Math.random', 'fetch(', 'writeFile', 'appendFile', 'unlink', 'rmSync', 'renameSync', 'child_process']) {
  check(!src.includes(word), `tools/wire.mjs does not use ${word}`);
}

console.log(`WIRE PROOF OK: ${checks} checks`);
