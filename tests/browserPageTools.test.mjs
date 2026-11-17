import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../android-overlay/app/src/main/assets/axon_page_tools.js', import.meta.url), 'utf8');

class El {
  constructor(tagName, props = {}) { this.tagName = tagName.toUpperCase(); Object.assign(this, { innerText: '', hidden: false, paused: true, currentTime: 0, duration: 100, volume: 1 }, props); this.children = []; this.attrs = props.attrs ?? {}; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, value) { this.attrs[name] = value; }
  getBoundingClientRect() { return this.hidden ? { width: 0, height: 0 } : { width: 10, height: 10 }; }
  appendChild(child) { this.children.push(child); return child; }
  play() { this.paused = false; }
  pause() { this.paused = true; }
}
function page(all, extra = {}) {
  const by = (sel) => sel.split(',').flatMap((part) => all.filter((e) => (part.startsWith('a[') ? e.tagName === 'A' : e.tagName === part.toUpperCase())));
  const body = new El('body');
  body.textContent = 'old';
  const selected = { text: extra.selected ?? '', cleared: 0, all: 0 };
  const document = {
    title: 'Doc', body, createElement: (t) => new El(t),
    querySelectorAll: (sel) => by(sel),
    querySelector: (sel) => by(sel)[0] ?? null,
  };
  body.querySelectorAll = document.querySelectorAll;
  const window = { getSelection: () => ({ removeAllRanges: () => { selected.cleared++; }, selectAllChildren: () => { selected.all++; selected.text = 'ALL'; }, toString: () => selected.text }) };
  const ctx = { window, document, location: { href: 'https://example.test/' }, JSON, String, Number, Math, isFinite };
  vm.runInNewContext(source, ctx);
  return { tools: window.__axonTools, body, selected };
}
const run = (tools, name, args) => JSON.parse(tools[name](JSON.stringify(args ?? {})));

test('extract lists visible links, headings and images with caps', () => {
  const links = Array.from({ length: 230 }, (_, i) => new El('a', { innerText: 'L' + i, href: 'https://x.test/' + i }));
  links.push(new El('a', { innerText: 'Hidden', href: 'https://h.test/', hidden: true }));
  const { tools } = page([...links, new El('h1', { innerText: 'Top' }), new El('h2', { innerText: 'Sub' }), new El('img', { src: 'https://i.test/a.png', attrs: { alt: 'logo' } })]);
  const r = run(tools, 'extract');
  assert.equal(r.ok, true);
  assert.equal(r.links.length, 200);
  assert.equal(r.links[0].index, 0);
  assert.equal(r.links.some((l) => l.text === 'Hidden'), false);
  assert.deepEqual(r.headings.map((h) => h.level), [1, 2]);
  assert.equal(r.images[0].alt, 'logo');
  assert.equal(r.title, 'Doc');
});

test('select all and read the selection, capped at 5000 characters', () => {
  const { tools, selected } = page([]);
  assert.equal(run(tools, 'selectText').ok, true);
  assert.equal(selected.all, 1);
  assert.equal(run(tools, 'selection').text, 'ALL');
  selected.text = 'x'.repeat(9000);
  assert.equal(run(tools, 'selection').text.length, 5000);
});

test('reader mode keeps readable blocks and refuses an empty page', () => {
  const { tools, body } = page([new El('h2', { innerText: 'Heading' }), new El('p', { innerText: 'Hello reader' }), new El('p', { innerText: 'x' })]);
  const r = run(tools, 'readerMode');
  assert.deepEqual([r.ok, r.blocks], [true, 2]);
  assert.equal(body.children.length, 1);
  const empty = page([]);
  assert.equal(run(empty.tools, 'readerMode').ok, false);
});

test('media: play and pause, seek within limits, volume clamped, no media reported', () => {
  const video = new El('video');
  const { tools } = page([video]);
  assert.equal(run(tools, 'media', { action: 'playPause' }).playing, true);
  assert.equal(run(tools, 'media', { action: 'playPause' }).playing, false);
  assert.equal(run(tools, 'media', { action: 'seek', delta: 30 }).time, 30);
  assert.equal(run(tools, 'media', { action: 'seek', delta: -999 }).time, 0);
  assert.equal(run(tools, 'media', { action: 'seek', delta: 99999 }).time, 100);
  assert.equal(run(tools, 'media', { action: 'seek', delta: 'x' }).error, 'bad-input');
  assert.equal(run(tools, 'media', { action: 'volume', level: 5 }).volume, 1);
  assert.equal(run(tools, 'media', { action: 'volume', level: -2 }).volume, 0);
  assert.equal(run(tools, 'media', { action: 'dance' }).error, 'bad-input');
  assert.equal(run(page([]).tools, 'media', { action: 'playPause' }).error, 'no-media');
});
