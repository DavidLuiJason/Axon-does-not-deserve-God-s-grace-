import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSourceFile } from '../dist/diagnostics.js';

const codes = (items) => items.map((item) => item.code);

test('R4-FOUND-001 valid class constructor is not mistaken for a closing delimiter', async () => {
  const findings = await analyzeSourceFile('valid.js', 'class Counter { constructor(){ this.value = 0; } }', 'javascript');
  assert.deepEqual(codes(findings), []);
});

test('R4-FOUND-002 object property named constructor is accepted', async () => {
  const findings = await analyzeSourceFile('valid.js', "const item = { constructor: 'value' };", 'javascript');
  assert.deepEqual(codes(findings), []);
});

test('R4-FOUND-003 inherited toString property access is accepted', async () => {
  const findings = await analyzeSourceFile('valid.js', 'const value = {}; value.toString();', 'javascript');
  assert.deepEqual(codes(findings), []);
});

test('R4-FOUND-004 inherited constructor property access is accepted', async () => {
  const findings = await analyzeSourceFile('valid.js', 'const value = {}; value.constructor;', 'javascript');
  assert.deepEqual(codes(findings), []);
});

test('R4-FOUND-005 missing assignment value includes exact source position', async () => {
  const findings = await analyzeSourceFile('broken.js', 'const total = ;', 'javascript');
  const item = findings.find((finding) => finding.code === 'MISSING_ASSIGNMENT_VALUE');
  assert.ok(item);
  assert.equal(item.location.line, 1);
  assert.equal(item.location.column, 15);
});

test('R4-FOUND-006 unclosed comment is identified at its opening position', async () => {
  const findings = await analyzeSourceFile('broken.js', 'const ok = true;\n/* never closed', 'javascript');
  const item = findings.find((finding) => finding.code === 'UNCLOSED_COMMENT');
  assert.ok(item);
  assert.equal(item.location.line, 2);
  assert.equal(item.location.column, 1);
});

test('R4-FOUND-007 unclosed string is identified', async () => {
  const findings = await analyzeSourceFile('broken.js', "const name = 'AXON", 'javascript');
  assert.ok(findings.some((finding) => finding.code === 'UNCLOSED_STRING'));
});

test('R4-FOUND-008 malformed JSON is identified with a location', async () => {
  const findings = await analyzeSourceFile('broken.json', '{"ok": true,}', 'json');
  const item = findings.find((finding) => finding.code === 'JSON_PARSE_ERROR');
  assert.ok(item);
  assert.ok(item.location.line >= 1);
  assert.ok(item.location.column >= 1);
});

test('R4-FOUND-009 unclosed HTML element is reported as a warning', async () => {
  const findings = await analyzeSourceFile('view.html', '<main><section>ok</section>', 'html');
  assert.ok(findings.some((finding) => finding.code === 'HTML_UNCLOSED_TAG' && finding.severity === 'warning'));
});

test('R4-FOUND-010 valid TypeScript structural sample retains balanced delimiters', async () => {
  const findings = await analyzeSourceFile('valid.ts', 'type Point = { x: number; y: number }; const p: Point = { x: 1, y: 2 };', 'typescript');
  assert.equal(findings.some((finding) => ['UNCLOSED_DELIMITER', 'UNEXPECTED_CLOSING_DELIMITER'].includes(finding.code)), false);
});
