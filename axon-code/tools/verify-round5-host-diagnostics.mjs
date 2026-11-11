import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parseToolchainDiagnostics } from '../dist/analysis/toolchainDiagnostics.js';

const results = JSON.parse(fs.readFileSync(new URL('../docs/ROUND5_HOST_TOOLCHAIN_RESULTS.json', import.meta.url), 'utf8'));
const py = results.results.find((item) => item.id === 'PYTHON-INJECTED-ERROR');
const cpp = results.results.find((item) => item.id === 'CPP-INJECTED-COMPILE-ERROR');
let checked = 0;
if (py?.status === 'PASS') {
  const diagnostics = parseToolchainDiagnostics({ language: 'python', requestedFile: py.requestedFile, output: py.stderr });
  assert.ok(diagnostics.some((item) => item.code === 'PYTHON_NAMEERROR' && item.location?.file === 'python_bad.py' && item.location.line === 2));
  checked += 1;
}
if (cpp?.status === 'PASS') {
  const diagnostics = parseToolchainDiagnostics({ language: 'cpp', requestedFile: cpp.requestedFile, output: cpp.stderr });
  assert.ok(diagnostics.some((item) => item.code === 'CPP_COMPILER_ERROR' && item.location?.file === 'cpp_bad.cpp' && item.location.line === 1));
  checked += 1;
}
console.log(JSON.stringify({ id: 'R5-HOST-DIAGNOSTIC-CROSS-CHECK', checked, status: checked === 2 ? 'PASS' : 'PARTIAL_BLOCKED', note: 'Only diagnostic output produced by available fixed trusted host fixtures was checked.' }, null, 2));
if (checked === 0) process.exitCode = 1;
