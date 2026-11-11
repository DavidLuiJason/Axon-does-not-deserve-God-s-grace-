#!/usr/bin/env python3
"""Round 10: run bundled project fixtures in the actual guarded Chromium Worker and exercise Web/game previews."""
from __future__ import annotations
import asyncio, json, os, subprocess
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
        lines.append(line)
    return '\n'.join(lines)


def compose_script(fixtures: dict) -> str:
    modules = [
        read_module('dist/pathSafety.js'),
        read_module('dist/lexer.js'),
        read_module('dist/diagnostics.js', ("import { tokenize } from './lexer.js';",)),
        read_module('dist/runtime/sourceMaps.js'),
        read_module('dist/runtime/javascriptWorker.js', ("import { normalizeProjectPath } from '../pathSafety.js';", "import { analyzeSourceFile } from '../diagnostics.js';")),
        read_module('dist/runtime/browserOpaqueWorkerProvider.js')
    ]
    entry = r"""
const __r10 = __FIXTURES__;
(async () => {
  const results = { workers: {}, pageErrors: [] };
  const provider = new BrowserOpaqueWorkerProvider(document);
  results.attestation = await provider.initialize(5000);
  async function run(source, requestId, entryPath) {
    const sourceProvider = { supportedExtensions: ['.ts', '.tsx', '.jsx'], async readSingleEntry() { return { path: entryPath, source }; }, requiresSourceMap: true };
    const adapter = new JavaScriptWorkerExecutionAdapter(sourceProvider, provider, { maxTimeoutMs: 5000, maxOutputBytes: 65536, maxSourceBytes: 2 * 1024 * 1024 });
    return adapter.execute({ requestId, projectId: 'r10-projects', entryFiles: [entryPath], runtimeId: 'javascript-worker-ac2',
      mode: 'FULL_LOCAL', timeoutMs: 2500, outputLimitBytes: 32768, networkAllowed: false, fileAccess: 'none' });
  }
  results.workers.website = await run(__r10.website.bundleSource, 'r10-website-worker', 'src/main.ts');
  results.workers.aiTool = await run(__r10.aiTool.bundleSource, 'r10-ai-tool-worker', 'src/main.ts');
  results.workers.selfHost = await run(__r10.selfhost.bundleSource, 'r10-selfhost-worker', 'tests/round10-selfhost/main.ts');
  results.workers.injectedError = await run("console.log('BEFORE_R10_FAILURE'); throw new Error('R10_INJECTED_APP_FAILURE');", 'r10-injected-error', 'src/failure.ts');
  provider.dispose();
  window.__AXON_R10_WORKERS__ = results;
  window.__AXON_R10_WORKERS_DONE__ = true;
})().catch(error => { window.__AXON_R10_WORKER_ERROR__ = String(error && error.stack || error); window.__AXON_R10_WORKERS_DONE__ = true; });
""".replace('__FIXTURES__', json.dumps({
        'website': {'bundleSource': fixtures['website']['bundle']['source']},
        'aiTool': {'bundleSource': fixtures['aiTool']['bundle']['source']},
        'selfhost': {'bundleSource': fixtures['selfhost']['bundle']['source']}
    }, ensure_ascii=False))
    return '\n'.join(modules) + '\n' + entry


async def main() -> int:
    prepared = subprocess.run(['node', 'tests/round10-prepare-fixtures.mjs'], cwd=ROOT, capture_output=True, text=True, timeout=120)
    if prepared.returncode:
        raise RuntimeError(prepared.stdout + '\n' + prepared.stderr)
    fixture_path = ROOT / 'tests/round10-browser-fixtures.json'
    fixtures = json.loads(fixture_path.read_text(encoding='utf-8'))
    script = compose_script(fixtures)
    checks = []
    results: dict = {}
    page_errors: list[str] = []
    async with async_playwright() as p:
        args = ['--disable-dev-shm-usage']
        if hasattr(os, 'geteuid') and os.geteuid() == 0:
            # Container-only Chromium launch exception; it is not a product security setting.
            args.append('--no-sandbox')
        browser = await p.chromium.launch(headless=True, executable_path=CHROMIUM, args=args)
        page = await browser.new_page(viewport={'width': 1000, 'height': 760})
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        await page.set_content('<!doctype html><html><head><meta charset="utf-8"></head><body><main>AXON R10 worker host</main></body></html>')
        await page.add_script_tag(content=script, type='module')
        await page.wait_for_function('window.__AXON_R10_WORKERS_DONE__ === true', timeout=30_000)
        worker_error = await page.evaluate('window.__AXON_R10_WORKER_ERROR__')
        if worker_error:
            await browser.close()
            raise RuntimeError(worker_error)
        results['workerHost'] = await page.evaluate('window.__AXON_R10_WORKERS__')

        # Run the actual static website files as a browser-hosted preview fixture.
        site = fixtures['website']
        site_html = site['html'].replace('<link rel="stylesheet" href="./site.css">', f"<style>{site['css']}</style>")
        site_html = site_html.replace('<script src="./site.js"></script>', f"<script>{site['javascript']}</script>")
        await page.set_content(site_html)
        site_before = await page.locator('#count').inner_text()
        await page.locator('.add').nth(0).click()
        await page.locator('.add').nth(1).click()
        site_after = {'count': await page.locator('#count').inner_text(), 'status': await page.locator('#status').inner_text(), 'heading': await page.locator('h1').inner_text()}
        results['websitePreview'] = {'before': site_before, 'after': site_after}

        # Run the actual Canvas game fixture and verify controls, collision/collection, render and restart.
        game = fixtures['game']['files']
        game_html = game['index.html'].replace('<script src="game.js"></script>', f"<script>{game['game.js']}</script>")
        await page.set_content(game_html)
        initial_state = await page.evaluate('({x:window.__round10Game.state.x, score:window.__round10Game.state.score})')
        for _ in range(4):
            await page.locator('#right').click()
        await page.locator('#collect').click()
        collected_state = await page.evaluate('({x:window.__round10Game.state.x, score:window.__round10Game.state.score, canvas:document.querySelector("canvas").toDataURL().length})')
        screenshot_path = ROOT / 'docs' / 'ROUND10_GAME_PREVIEW.png'
        await page.screenshot(path=str(screenshot_path), full_page=True)
        await page.locator('#reset').click()
        reset_state = await page.evaluate('({x:window.__round10Game.state.x, score:window.__round10Game.state.score})')
        results['gamePreview'] = {'initial': initial_state, 'afterMovesAndCollection': collected_state, 'afterRestart': reset_state, 'screenshot': 'docs/ROUND10_GAME_PREVIEW.png'}
        results['pageErrors'] = page_errors
        await browser.close()

    att = results['workerHost'].get('attestation', {})
    worker_rows = results['workerHost'].get('workers', {})
    tests = [
        ('R10-W01', 'Opaque-origin guarded Worker provider attests isolation and no privileged bridge', all(att.get(key) is True for key in ['isolatedOrigin', 'networkBlockedByHostPolicy', 'filesystemBridgeAbsent', 'restrictiveCspConfirmed', 'noPrivilegedHostBridge'])),
        ('R10-W02', 'Multi-file TypeScript website business logic actually executes in guarded Worker', worker_rows.get('website', {}).get('status') == 'completed' and 'R10_WEBSITE_APP' in worker_rows.get('website', {}).get('stdout', '') and '"total":27' in worker_rows.get('website', {}).get('stdout', '')),
        ('R10-W03', 'Deterministic AI-tool test double executes and discloses TEST_DOUBLE rather than claiming a real model', worker_rows.get('aiTool', {}).get('status') == 'completed' and 'R10_AI_TOOL_SIMULATION' in worker_rows.get('aiTool', {}).get('stdout', '') and 'TEST_DOUBLE' in worker_rows.get('aiTool', {}).get('stdout', '')),
        ('R10-W04', 'A selected subset of AXON Code own source executes through AXON Code bundler and Worker runtime', worker_rows.get('selfHost', {}).get('status') == 'completed' and 'R10_SELF_HOST src/main.ts 5 0' in worker_rows.get('selfHost', {}).get('stdout', '')),
        ('R10-W05', 'Injected project runtime error is reported with correct failure classification and marker', worker_rows.get('injectedError', {}).get('status') == 'failed' and any(item.get('code') == 'JAVASCRIPT_RUNTIME_ERROR' for item in worker_rows.get('injectedError', {}).get('diagnostics', [])) and 'R10_INJECTED_APP_FAILURE' in ' '.join(worker_rows.get('injectedError', {}).get('notes', []))),
        ('R10-W06', 'Website browser preview updates cart count and live status after two user actions', results['websitePreview']['before'] == '0' and results['websitePreview']['after']['count'] == '2' and '2 items' in results['websitePreview']['after']['status']),
        ('R10-W07', 'Canvas game accepts input and moves player within game bounds', results['gamePreview']['afterMovesAndCollection']['x'] > results['gamePreview']['initial']['x'] and results['gamePreview']['afterMovesAndCollection']['x'] <= 302),
        ('R10-W08', 'Canvas game collection updates score and draws a non-empty canvas', results['gamePreview']['afterMovesAndCollection']['score'] == 1 and results['gamePreview']['afterMovesAndCollection']['canvas'] > 100),
        ('R10-W09', 'Canvas game restart resets score and player position', results['gamePreview']['afterRestart'] == {'x': 16, 'score': 0}),
        ('R10-W10', 'No uncaught browser page errors occurred during workload and preview tests', len(page_errors) == 0)
    ]
    report = {'workerHost': results['workerHost'], 'websitePreview': results['websitePreview'], 'gamePreview': results['gamePreview'],
              'checks': [{'id': tid, 'description': title, 'status': 'PASS' if passed else 'FAIL'} for tid, title, passed in tests],
              'passed': sum(bool(passed) for _, _, passed in tests), 'total': len(tests),
              'securityNote': 'Chromium launched with --no-sandbox because the test container runs as root. This is a container-only test limitation, not a production host security claim.'}
    (ROOT / 'docs' / 'ROUND10_BROWSER_RESULTS.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    lines = [f"[{row['status']}] {row['id']} {row['description']}" for row in report['checks']]
    (ROOT / 'docs' / 'ROUND10_BROWSER_TEST_LOG.txt').write_text('\n'.join(lines) + f"\nRound 10 browser checks: {report['passed']}/{report['total']} PASS\n", encoding='utf-8')
    print(json.dumps({'checks': report['checks'], 'websitePreview': results['websitePreview'], 'gamePreview': results['gamePreview'], 'passed': report['passed'], 'total': report['total']}, indent=2))
    return 0 if report['passed'] == report['total'] else 1

if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
