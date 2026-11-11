#!/usr/bin/env python3
"""Round 7 real Chromium verification of the browser download host adapter.
Clipboard and native-share availability are probed, not claimed if unsupported.
"""
from __future__ import annotations
import asyncio, json, os, subprocess, tempfile
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROMIUM = os.environ.get('AXON_CHROMIUM', '/usr/bin/chromium')


def browser_module() -> str:
    source = (ROOT / 'dist/workspace/hostActions.js').read_text(encoding='utf-8')
    lines = []
    for line in source.splitlines():
        if line.startswith('export '):
            line = line[len('export '):]
        lines.append(line)
    return '\n'.join(lines) + '\nglobalThis.BrowserDownloadAdapter = BrowserDownloadAdapter;'


async def main() -> int:
    async with async_playwright() as p:
        args = ['--disable-dev-shm-usage']
        if hasattr(os, 'geteuid') and os.geteuid() == 0:
            args.append('--no-sandbox')
        browser = await p.chromium.launch(headless=True, executable_path=CHROMIUM, args=args)
        context = await browser.new_context(accept_downloads=True)
        page = await context.new_page()
        page_errors: list[str] = []
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        await page.set_content('<!doctype html><html><head><meta charset="utf-8"></head><body><main>AXON R7 browser actions</main></body></html>')
        await page.add_script_tag(content=browser_module(), type='module')
        await page.wait_for_timeout(25)
        browser_caps = await page.evaluate("""() => ({
          secureContext: globalThis.isSecureContext === true,
          clipboardWrite: Boolean(globalThis.navigator?.clipboard?.writeText),
          nativeShare: typeof globalThis.navigator?.share === 'function',
          downloadApi: typeof URL?.createObjectURL === 'function' && Boolean(document.body)
        })""")
        async with page.expect_download(timeout=15000) as download_info:
            await page.evaluate("""async () => {
              window.__r7Revoked = [];
              const original = URL.revokeObjectURL.bind(URL);
              URL.revokeObjectURL = (url) => { window.__r7Revoked.push(url); original(url); };
              const adapter = new BrowserDownloadAdapter(document, URL, Blob, (callback) => setTimeout(callback, 0));
              const bytes = new TextEncoder().encode('AXON R7 REAL BROWSER DOWNLOAD\\nsource export verified\\n');
              await adapter.download({ filename: 'axon-r7-project.txt', mimeType: 'text/plain;charset=utf-8', format: 'txt', bytes,
                sizeBytes: bytes.length, sourceFingerprint: 'r7-test', includedFiles: ['src/main.ts'], warnings: [] });
            }""")
        download = await download_info.value
        with tempfile.TemporaryDirectory(prefix='axon-r7-download-') as tmp:
            destination = Path(tmp) / 'downloaded.txt'
            await download.save_as(destination)
            content = destination.read_text(encoding='utf-8')
        await page.wait_for_timeout(30)
        host_cleanup = await page.evaluate("""() => ({
          downloadAnchorsRemaining: document.querySelectorAll('a[download]').length,
          revokedObjectUrls: window.__r7Revoked.length
        })""")
        await context.close()
        await browser.close()

    checks = [
        ('R7B-001', 'Real Chromium browser download event occurred', download.suggested_filename == 'axon-r7-project.txt'),
        ('R7B-002', 'Downloaded file contains the exact TXT payload', content == 'AXON R7 REAL BROWSER DOWNLOAD\nsource export verified\n'),
        ('R7B-003', 'Temporary download anchor was removed', host_cleanup['downloadAnchorsRemaining'] == 0),
        ('R7B-004', 'Blob URL was scheduled for revocation', host_cleanup['revokedObjectUrls'] >= 1),
        ('R7B-005', 'Browser download APIs were genuinely present', browser_caps['downloadApi'] is True),
        ('R7B-006', 'No uncaught browser page errors occurred', len(page_errors) == 0)
    ]
    for test_id, name, passed in checks:
        print(json.dumps({'id': test_id, 'test': name, 'status': 'PASS' if passed else 'FAIL'}))
    print(json.dumps({'browserCapabilities': browser_caps, 'downloadedFilename': download.suggested_filename,
                      'downloadedBytes': len(content.encode('utf-8')), 'hostCleanup': host_cleanup,
                      'pageErrors': page_errors}, ensure_ascii=False))
    print('Round 7 Chromium browser-action integration: %d/%d PASS' % (sum(x[2] for x in checks), len(checks)))
    print('Clipboard/native-share: capability-probed only; headless browser support is host-dependent and mocks cover success/cancel/unsupported branches.')
    return 0 if all(x[2] for x in checks) else 1

if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
