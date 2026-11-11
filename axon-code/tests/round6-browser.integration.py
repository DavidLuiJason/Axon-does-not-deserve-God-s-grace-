#!/usr/bin/env python3
"""Round 6 actual Chromium Worker workflow; reports origin-restricted IndexedDB as blocked."""
from __future__ import annotations
import asyncio, json, os, subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROMIUM = os.environ.get('AXON_CHROMIUM', '/usr/bin/chromium')


def prepare_fixtures() -> dict:
    completed = subprocess.run(['node', 'tests/round6-fixtures.mjs'], cwd=ROOT, capture_output=True, text=True, timeout=60)
    if completed.returncode:
        raise RuntimeError(completed.stdout + '\n' + completed.stderr)
    return json.loads(completed.stdout.strip().splitlines()[-1])


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
        lines.append(line)
    return '\n'.join(lines)


def compose_browser_script(fixtures: dict) -> str:
    modules = [
        read_module('dist/pathSafety.js'),
        read_module('dist/lexer.js'),
        read_module('dist/diagnostics.js', ("import { tokenize } from './lexer.js';",)),
        read_module('dist/runtime/sourceMaps.js'),
        read_module('dist/runtime/javascriptWorker.js', ("import { normalizeProjectPath } from '../pathSafety.js';", "import { analyzeSourceFile } from '../diagnostics.js';")),
        read_module('dist/runtime/browserOpaqueWorkerProvider.js'),
        read_module('dist/runtime/browserHostConformance.js'),
        read_module('dist/storage/indexedDbStore.js')
    ]
    entry = r"""
const __r6Fixtures = __FIXTURES__;
(async () => {
  const result = { pageOrigin: location.origin, secureContext: isSecureContext, pageErrors: [] };
  const provider = new BrowserOpaqueWorkerProvider(document);
  const attestation = await provider.initialize(5000);
  result.workerAttestation = attestation;
  const sources = {
    'src/main.ts': __r6Fixtures.bundle.source,
    'src/failure.ts': __r6Fixtures.runtimeErrorBundle.source,
    'src/output.ts': __r6Fixtures.outputLimitBundle.source,
    'src/timeout.ts': __r6Fixtures.timeoutBundle.source
  };
  async function runWorker(sourceOverride, requestId, entryFile, limits = {}) {
    const sourceProvider = {
      supportedExtensions: ['.ts'],
      requiresSourceMap: entryFile === 'src/failure.ts',
      async readSingleEntry(request) {
        const chosen = typeof sourceOverride === 'string' ? sourceOverride : sources[request.entryFiles[0]];
        return chosen ? { path: request.entryFiles[0], source: chosen } : null;
      }
    };
    const adapter = new JavaScriptWorkerExecutionAdapter(sourceProvider, provider, { maxTimeoutMs: 2500, maxOutputBytes: 4096, maxSourceBytes: 1024 * 1024 });
    return adapter.execute({ requestId, projectId: 'r6-project', entryFiles: [entryFile], runtimeId: 'javascript-worker-ac2',
      mode: 'FULL_LOCAL', timeoutMs: limits.timeoutMs || 1500, outputLimitBytes: limits.outputLimitBytes || 4096,
      networkAllowed: false, fileAccess: 'none' }, limits.signal);
  }
  result.host = await probeBrowserHost(window);
  result.appExecution = await runWorker(null, 'r6-app', 'src/main.ts');
  result.injectedRuntimeError = await runWorker(null, 'r6-error', 'src/failure.ts');
  result.workerPolicy = await runWorker("console.log('R6_POLICY', typeof fetch, typeof indexedDB, typeof document, typeof localStorage);", 'r6-policy', 'src/main.ts');
  result.outputLimit = await runWorker(null, 'r6-output', 'src/output.ts', { outputLimitBytes: 128 });
  result.timeout = await runWorker(null, 'r6-timeout', 'src/timeout.ts', { timeoutMs: 180 });
  try {
    const store = new IndexedDbKeyValueStore('axon-code-r6-opaque-origin-test', 'records');
    await store.put('probe', { value: true });
    result.indexedDbProbe = { opened: true, note: 'IndexedDB opened on this document origin.' };
    await store.close();
  } catch (error) {
    result.indexedDbProbe = { opened: false, name: error && error.name || 'Error', message: String(error && error.message || error) };
  }
  result.pageOrigin = location.origin;
  result.secureContext = isSecureContext;
  provider.dispose();
  window.__AXON_R6_RESULT__ = result;
  window.__AXON_R6_DONE__ = true;
})().catch(error => {
  window.__AXON_R6_ERROR__ = String(error && error.stack || error);
  window.__AXON_R6_DONE__ = true;
});
""".replace('__FIXTURES__', json.dumps(fixtures, ensure_ascii=False))
    return '\n'.join(modules) + '\n' + entry


async def main() -> int:
    fixtures = prepare_fixtures()
    script = compose_browser_script(json.loads((ROOT / 'tests/round6-browser-fixtures.json').read_text(encoding='utf-8')))
    checks = []
    async with async_playwright() as p:
        args = ['--disable-dev-shm-usage']
        if hasattr(os, 'geteuid') and os.geteuid() == 0:
            # Container-only Chromium launch exception; not a production runtime setting.
            args.append('--no-sandbox')
        browser = await p.chromium.launch(headless=True, executable_path=CHROMIUM, args=args)
        page = await browser.new_page()
        page_errors = []
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        await page.set_content('<!doctype html><html><head><meta charset="utf-8"></head><body><main>AXON R6</main></body></html>')
        await page.add_script_tag(content=script, type='module')
        await page.wait_for_function('window.__AXON_R6_DONE__ === true', timeout=30_000)
        if await page.evaluate('window.__AXON_R6_ERROR__'):
            raise RuntimeError(await page.evaluate('window.__AXON_R6_ERROR__'))
        result = await page.evaluate('window.__AXON_R6_RESULT__')
        await browser.close()

    host = result.get('host', {})
    attest = result.get('workerAttestation', {})
    app = result.get('appExecution', {})
    injected = result.get('injectedRuntimeError', {})
    policy = result.get('workerPolicy', {})
    output_limit = result.get('outputLimit', {})
    timeout = result.get('timeout', {})
    idb = result.get('indexedDbProbe', {})
    tests = [
        ('R6B-001', 'Chromium host identified by live browser probe', host.get('hostKind') == 'chromium'),
        ('R6B-002', 'Opaque-origin Worker sandbox attestation passed', all(attest.get(key) is True for key in ['isolatedOrigin', 'networkBlockedByHostPolicy', 'filesystemBridgeAbsent', 'restrictiveCspConfirmed', 'noPrivilegedHostBridge'])),
        ('R6B-003', 'Multi-file TypeScript bundle actually executed in Chromium Worker', app.get('status') == 'completed' and 'R6_APP 42 AXON browser' in app.get('stdout', '')),
        ('R6B-004', 'Injected runtime failure returned a correctly classified diagnostic', injected.get('status') == 'failed' and any(item.get('code') == 'JAVASCRIPT_RUNTIME_ERROR' for item in injected.get('diagnostics', [])) and 'R6_INJECTED_RUNTIME_FAILURE' in ' '.join(injected.get('notes', []))),
        ('R6B-005', 'Bundled runtime diagnostic withholds unverified generated line and lowers confidence', bool(injected.get('diagnostics')) and injected['diagnostics'][0].get('location', {}).get('file') == 'src/failure.ts' and injected['diagnostics'][0].get('location', {}).get('line') is None and injected['diagnostics'][0].get('location', {}).get('column') is None and injected['diagnostics'][0].get('confidence') == 'low' and 'source-map' in injected['diagnostics'][0].get('explanation', '').lower()),
        ('R6B-006', 'Worker denied network, IndexedDB, document and localStorage APIs', policy.get('status') == 'completed' and 'R6_POLICY undefined undefined undefined undefined' in policy.get('stdout', '')),
        ('R6B-007', 'Actual Worker output limit terminated excessive output', output_limit.get('status') == 'blocked' and 'output limit' in ' '.join(output_limit.get('notes', [])).lower()),
        ('R6B-008', 'Actual infinite-loop Worker was terminated at timeout', timeout.get('status') == 'timed-out'),
        ('R6B-009', 'Browser host does not falsely claim IndexedDB is usable on an opaque about:blank origin', result.get('pageOrigin') == 'null' and idb.get('opened') is False and idb.get('name') == 'SecurityError'),
        ('R6B-010', 'No uncaught host page errors occurred', len(page_errors) == 0)
    ]
    for test_id, title, passed in tests:
        checks.append({'id': test_id, 'test': title, 'status': 'PASS' if passed else 'FAIL'})
    print(json.dumps({'fixturePreparation': fixtures}, ensure_ascii=False))
    print(json.dumps({'browserResults': result, 'pageErrors': page_errors}, ensure_ascii=False))
    for item in checks:
        print(json.dumps(item, ensure_ascii=False))
    print('R6 Chromium integration: %d/%d PASS' % (sum(row['status'] == 'PASS' for row in checks), len(checks)))
    print('R6 browser persistence: BLOCKED — the policy-restricted about:blank test context has an opaque origin and IndexedDB raises SecurityError; localhost/file navigation is blocked by this test environment. No durable browser-origin persistence claim is made.')
    return 0 if all(row['status'] == 'PASS' for row in checks) else 1

if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
