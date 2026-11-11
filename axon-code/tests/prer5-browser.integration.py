#!/usr/bin/env python3
"""Chromium integration for real TypeScript/JSX bundles and pure WebAssembly Workers."""
from __future__ import annotations
import json, os, subprocess, time
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROMIUM = os.environ.get('AXON_CHROMIUM', '/usr/bin/chromium')

def read_module(path: str, remove: tuple[str, ...] = ()) -> str:
    text = (ROOT / path).read_text(encoding='utf-8')
    for fragment in remove:
        text = text.replace(fragment, '')
    lines = []
    for line in text.splitlines():
        if line.startswith('import '):
            continue
        if line.startswith('export '):
            line = line[len('export '):]
        if line.strip() == 'export {};' or line.strip() == 'export {};':
            continue
        lines.append(line)
    return '\n'.join(lines)

async def main() -> int:
    fixture = subprocess.run(['node', 'tests/prer5-browser-fixtures.mjs'], cwd=ROOT, capture_output=True, text=True, check=True)
    fixtures = json.loads(fixture.stdout)
    chunks = [
        read_module('dist/pathSafety.js'),
        read_module('dist/lexer.js'),
        read_module('dist/diagnostics.js', ("import { tokenize } from './lexer.js';",)),
        read_module('dist/runtime/javascriptWorker.js', ("import { normalizeProjectPath } from '../pathSafety.js';", "import { analyzeSourceFile } from '../diagnostics.js';")),
        read_module('dist/runtime/browserOpaqueWorkerProvider.js'),
        read_module('dist/runtime/webAssemblyWorker.js', ("import type { ExecutionRequest, ExecutionResult, RuntimeAdapter, RuntimeDescriptor } from '../types.js';", "import type { SecureWorkerProvider } from './javascriptWorker.js';", "import { JavaScriptWorkerExecutionAdapter } from './javascriptWorker.js';")),
        read_module('dist/runtime/browserHostConformance.js')
    ]
    entry = r"""
const typedBundle = __FIX_TYPED__;
const jsxBundle = __FIX_JSX__;
const wasmBytes = new Uint8Array(__FIX_WASM__);
const provider = new BrowserOpaqueWorkerProvider(document);
let initError = null;
try { await provider.initialize(5000); } catch (e) { initError = String(e); }
const sourceProvider = { supportedExtensions: ['.ts', '.tsx', '.jsx'], async readSingleEntry(request) { const item = request.entryFiles[0] === 'src/main.ts' ? typedBundle : request.entryFiles[0] === 'src/view.tsx' ? jsxBundle : null; return item ? { path: request.entryFiles[0], source: item.source } : null; } };
const jsAdapter = new JavaScriptWorkerExecutionAdapter(sourceProvider, provider, { maxTimeoutMs: 5000, maxOutputBytes: 65536, maxSourceBytes: 1024*1024 });
const wasmAdapter = new WebAssemblyWorkerExecutionAdapter({ async readBinaryEntry(request) { return { path: request.entryFiles[0], bytes: wasmBytes }; } }, provider);
window.__prer5 = {
  ready: !initError && provider.attest().isolatedOrigin,
  initError, attestation: provider.attest(),
  async runTs() { return jsAdapter.execute({ requestId: 'prer5-ts', projectId: 'p', entryFiles: ['src/main.ts'], runtimeId: 'javascript-worker-ac2', mode: 'FULL_LOCAL', timeoutMs: 2500, outputLimitBytes: 8192, networkAllowed: false, fileAccess: 'none' }); },
  async runJsx() { return jsAdapter.execute({ requestId: 'prer5-jsx', projectId: 'p', entryFiles: ['src/view.tsx'], runtimeId: 'javascript-worker-ac2', mode: 'FULL_LOCAL', timeoutMs: 2500, outputLimitBytes: 8192, networkAllowed: false, fileAccess: 'none' }); },
  async runWasm() { return wasmAdapter.execute({ requestId: 'prer5-wasm', projectId: 'p', entryFiles: ['main.wasm'], runtimeId: 'webassembly-pure-worker', mode: 'FULL_LOCAL', timeoutMs: 2500, outputLimitBytes: 8192, networkAllowed: false, fileAccess: 'none' }); },
  async hostProbe() { return await probeBrowserHost(window); },
  dispose() { provider.dispose(); }
};
"""
    entry = entry.replace('__FIX_TYPED__', json.dumps(fixtures['typed'])).replace('__FIX_JSX__', json.dumps(fixtures['jsx'])).replace('__FIX_WASM__', json.dumps(fixtures['wasm42']))
    bundle = '\n'.join(chunks) + '\n' + entry
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path=CHROMIUM, args=['--no-sandbox'])
        page = await browser.new_page()
        page_errors = []
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        await page.set_content('<!doctype html><html><body></body></html>')
        await page.add_script_tag(content=bundle, type='module')
        await page.wait_for_function('window.__prer5 !== undefined')
        ready = await page.evaluate('window.__prer5.ready')
        if not ready:
            raise RuntimeError(f'Browser provider failed: {await page.evaluate("window.__prer5.initError")}')
        for case_id, method, marker in [
            ('R5B-001', 'runTs', 'TS_RUN 42 7'),
            ('R5B-002', 'runJsx', 'JSX_RUN div hello'),
            ('R5B-003', 'runWasm', 'WASM_RESULT 42')
        ]:
            start = time.perf_counter()
            result = await page.evaluate(f'() => window.__prer5.{method}()')
            elapsed = round((time.perf_counter()-start)*1000, 2)
            okay = result.get('status') == 'completed' and marker in result.get('stdout','')
            results.append({'id':case_id,'status':result.get('status'),'marker':marker,'stdout':result.get('stdout'),'elapsedMs':elapsed,'pass':okay,'result':result})
        attestation = await page.evaluate('window.__prer5.attestation')
        host_probe = await page.evaluate('window.__prer5.hostProbe()')
        results.append({'id':'R5B-004','status':'attested' if all(attestation.get(k) is True for k in ['isolatedOrigin','networkBlockedByHostPolicy','filesystemBridgeAbsent','restrictiveCspConfirmed','noPrivilegedHostBridge']) else 'not-attested','attestation':attestation,'pass':all(attestation.get(k) is True for k in ['isolatedOrigin','networkBlockedByHostPolicy','filesystemBridgeAbsent','restrictiveCspConfirmed','noPrivilegedHostBridge'])})
        required = ['worker','blob','object-url','abort-controller','webassembly']
        features = {x['id']:x['state'] for x in host_probe['features']}
        results.append({'id':'R5B-005','hostKind':host_probe['hostKind'],'features':host_probe['features'],'pass':all(features.get(k)=='AVAILABLE' for k in required)})
        results.append({'id':'R5B-006','pageErrors':page_errors,'pass':len(page_errors)==0})
        await page.evaluate('window.__prer5.dispose()')
        await browser.close()
    for item in results:
        print(json.dumps(item, ensure_ascii=False))
    if not all(item.get('pass') for item in results): return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(__import__('asyncio').run(main()))
