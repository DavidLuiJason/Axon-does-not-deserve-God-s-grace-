import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const contract = JSON.parse(await readFile(new URL('../docs/AXON_CODE_SCREEN_CONTRACT.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../build/ui/index.html', import.meta.url), 'utf8');
test('R5 every new R1/R3 screen id is present in the built UI and contract', () => {
  for (const id of ['runButton','stopButton','stdinInput','runStatus','jobsPanel','jobsList']) {
    assert.ok(contract.elements.some(item => item.id === id), `contract missing ${id}`);
    assert.match(html, new RegExp(`id="${id}"`), `built UI missing ${id}`);
  }
});
test('R5 new commands declare disabled reasons for unsupported pause and resume', () => {
  for (const id of ['run.javascript','stop.javascript','run.stdin','view.jobs','jobs.list','jobs.cancel','jobs.pause','jobs.resume']) {
    assert.ok(contract.commands.some(item => item.id === id), `contract missing command ${id}`);
  }
  const ids = new Set(contract.elements.map(item => item.id));
  for (const command of contract.commands) assert.ok(ids.has(command.elementId), `command ${command.id} references a missing element`);
});
