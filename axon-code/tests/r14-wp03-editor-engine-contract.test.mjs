import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCodeMirror6Factory, assertXtermFactory } from '../dist/workbench/editorEngineContracts.js';
test('C5 accepts only a CodeMirror 6 mounting adapter', () => { assertCodeMirror6Factory({ mount() { return { state: { doc: { toString: () => '', length: 0 }, selection: { main: { head: 0 } } }, dispatch() {}, focus() {}, destroy() {} }; } }); });
test('C5 refuses a missing editor module rather than silently falling back to textarea', () => { assert.throws(() => assertCodeMirror6Factory(null), /refusing to fall back/); });
test('C5 accepts only xterm.js with fit support', () => { assertXtermFactory({ create() { return {}; }, fit() {} }); });
test('C5 refuses fake terminal adapters', () => { assert.throws(() => assertXtermFactory({ create() {} }), /refusing to emulate/); });
