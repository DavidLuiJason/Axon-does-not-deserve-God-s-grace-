import test from 'node:test';
import {assertLoopbackTerminalEndpoint} from '../ui/terminalEndpoint.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'ui/index.html'),'utf8');
const engine=fs.readFileSync(path.join(root,'ui/engines.js'),'utf8');
const app=fs.readFileSync(path.join(root,'ui/workbench.js'),'utf8');
test('WP3 uses exact pinned CodeMirror 6, xterm.js and Pyodide package dependencies',()=>{
  const expected={'@codemirror/state':'6.7.6','@codemirror/view':'6.43.15','@codemirror/commands':'6.11.1','@codemirror/language':'6.13.1','@codemirror/lang-javascript':'6.2.5','@xterm/xterm':'6.0.0','@xterm/addon-fit':'0.11.0','pyodide':'314.0.7','typescript':'5.8.3'};
  for(const [name,version] of Object.entries(expected)){
    assert.equal(pkg.dependencies[name],version,`${name} package pin`);
    assert.equal(lock.packages[`node_modules/${name}`].version,version,`${name} lock pin`);
    assert.ok(lock.packages[`node_modules/${name}`].resolved,`${name} registry source`);
    if(name !== 'typescript') assert.ok(lock.packages[`node_modules/${name}`].integrity,`${name} integrity`);
  }
});
test('editor and terminal mounts use the real engines with no presented textarea fallback',()=>{
  assert.match(engine,/from '@codemirror\/state'/);
  assert.match(engine,/from '@codemirror\/view'/);
  assert.match(engine,/new EditorView/);
  assert.match(engine,/from '@xterm\/xterm'/);
  assert.match(engine,/new Terminal/);
  assert.match(html,/id="editorHost"/);
  assert.match(html,/id="terminalHost"/);
  assert.match(html,/type="importmap"/);
  assert.match(app,/mountCodeMirror/);
  assert.match(app,/mountXterm/);
  assert.match(app,/legacyEditor\.hidden = true/);
});
test('PTY connection requires trusted host service and loopback WebSocket endpoint',()=>{
  assert.match(app,/host\.startTerminal/);
  assert.match(fs.readFileSync(path.join(root,'ui/terminalEndpoint.js'),'utf8'),/endpoint\.hostname !== '127\.0\.0\.1'/);
  assert.match(fs.readFileSync(path.join(root,'ui/terminalEndpoint.js'),'utf8'),/endpoint\.pathname !== '\/session'/);
  assert.match(engine,/terminalSocket\.send/);
  assert.match(engine,/op:'resize'/);
  assert.match(engine,/terminal\.write\(bytes\)/);
  assert.equal(assertLoopbackTerminalEndpoint('ws://127.0.0.1:4312/session').hostname,'127.0.0.1');
  assert.throws(()=>assertLoopbackTerminalEndpoint('ws://evil.example:4312/session'),/127\.0\.0\.1/);
  assert.throws(()=>assertLoopbackTerminalEndpoint('wss://127.0.0.1:4312/session'),/127\.0\.0\.1/);
  // Deliberately broken mutant omits hostname validation; it would accept this foreign host.
  const brokenMutant = (rawUrl) => {
    const endpoint = new URL(rawUrl);
    if (endpoint.protocol !== 'ws:' || endpoint.pathname !== '/session') throw new Error('rejected');
    return endpoint;
  };
  assert.equal(brokenMutant('ws://evil.example:4312/session').hostname,'evil.example');
  assert.throws(()=>assertLoopbackTerminalEndpoint('ws://evil.example:4312/session'),/127\.0\.0\.1/);
});
