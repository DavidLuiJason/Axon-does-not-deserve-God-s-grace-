#!/usr/bin/env python3
"""Round 12 UI interactions in Chromium. Uses an in-memory IndexedDB-compatible test shim because this container blocks browser navigation."""
from __future__ import annotations
import asyncio, json, os, zipfile
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROMIUM = os.environ.get('AXON_CHROMIUM', '/usr/bin/chromium')

IDB_SHIM = r"""
(() => {
  const data = new Map([['projects', new Map()], ['files', new Map()]]);
  const copy = value => value === undefined ? undefined : structuredClone(value);
  const keyOf = (store, value) => store === 'files' ? JSON.stringify([value.projectId, value.path]) : value.id;
  const makeRequest = (value) => { const r = {result: undefined, error: null, onsuccess: null, onerror: null}; setTimeout(() => { r.result = copy(value); r.onsuccess?.({target:r}); }, 1); return r; };
  const database = {
    objectStoreNames: {contains: name => data.has(name)},
    createObjectStore(name) { if (!data.has(name)) data.set(name, new Map()); return {}; },
    transaction(names, mode) {
      const tx = {error:null, oncomplete:null, onerror:null, onabort:null, objectStore(name) {
        const map = data.get(name); if (!map) throw new Error('Unknown store '+name);
        const write = value => { if (mode !== 'readwrite') throw new Error('Readonly transaction'); map.set(keyOf(name,value), copy(value)); return makeRequest(value); };
        return {
          put: write,
          get: key => makeRequest(map.get(name === 'files' ? JSON.stringify(key) : key)),
          getAll: () => makeRequest([...map.values()]),
          delete: key => { map.delete(name === 'files' ? JSON.stringify(key) : key); return makeRequest(undefined); }
        };
      }};
      setTimeout(() => tx.oncomplete?.({target:tx}), 12);
      return tx;
    }
  };
  Object.defineProperty(window, 'indexedDB', {configurable:true, value:{open() {
    const request = {result:database, error:null, onupgradeneeded:null, onsuccess:null, onerror:null};
    setTimeout(() => { request.onupgradeneeded?.({target:request}); setTimeout(() => request.onsuccess?.({target:request}), 1); }, 1);
    return request;
  }}});
})();
"""

async def main() -> int:
    checks = []
    page_errors = []
    results = {}
    async with async_playwright() as p:
        args = ['--disable-dev-shm-usage']
        if hasattr(os, 'geteuid') and os.geteuid() == 0: args.append('--no-sandbox')
        browser = await p.chromium.launch(headless=True, executable_path=CHROMIUM, args=args)
        context = await browser.new_context(accept_downloads=True, viewport={'width': 1440, 'height': 900})
        page = await context.new_page()
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        html = (ROOT / 'ui' / 'index.html').read_text(encoding='utf-8')
        css = (ROOT / 'ui' / 'workbench.css').read_text(encoding='utf-8')
        js = (ROOT / 'ui' / 'workbench.js').read_text(encoding='utf-8')
        html = html.replace('<link rel="stylesheet" href="./workbench.css">', '<style>'+css+'</style>')
        html = html.replace('<script type="module" src="./workbench.js"></script>', '')
        await page.set_content(html)
        registry_payload = json.loads((ROOT / 'docs' / 'CAPABILITY_REGISTRY.json').read_text(encoding='utf-8'))
        await page.add_script_tag(content='window.__AXON_CAPABILITY_REGISTRY__ = '+json.dumps(registry_payload)+';')
        await page.add_script_tag(content=IDB_SHIM)
        await page.add_script_tag(content=js, type='module')
        await page.wait_for_function("document.querySelector('#outputText').textContent.includes('direct-user Workbench loaded')")

        await page.get_by_role('button', name='New Project').click()
        await page.locator('#projectNameInput').fill('R12 UI Integration')
        await page.locator('#createProjectConfirm').click()
        await page.wait_for_function("document.querySelector('#projectName').textContent.includes('R12 UI Integration')")
        checks.append(('R12-UI-01', 'Direct user can create a local project without AXON Brain', True))

        await page.locator('#newFileButton').click()
        await page.locator('#newFilePath').fill('index.html')
        await page.locator('#createFileConfirm').click()
        await page.wait_for_function("document.querySelector('#languageStatus').textContent === 'HTML'")
        html_source = '<!doctype html><html><head><title>R12 Preview</title></head><body><h1>Direct preview</h1><button id="add">Add</button><output id="count">0</output><script src="./app.js"></script></body></html>'
        await page.locator('#editor').fill(html_source)
        await page.locator('#saveButton').click()
        await page.wait_for_function("document.querySelector('#editorStatus').textContent === 'Saved'")

        await page.locator('#newFileButton').click()
        await page.locator('#newFilePath').fill('app.js')
        await page.locator('#createFileConfirm').click()
        await page.wait_for_function("document.querySelector('#languageStatus').textContent === 'JavaScript'")
        await page.locator('#editor').fill("document.querySelector('#add').addEventListener('click', () => { document.querySelector('#count').textContent = String(Number(document.querySelector('#count').textContent) + 1); });")
        await page.locator('#saveButton').click()
        await page.locator('#previewButton').click()
        frame = page.frame_locator('#previewFrame')
        await frame.locator('#add').click()
        await frame.locator('#add').click()
        count = await frame.locator('#count').inner_text()
        checks.append(('R12-UI-02', 'User edits and saves a multi-file web project; isolated iframe preview executes linked local JavaScript', count == '2'))
        results['previewCount'] = count

        # Reopen the same saved file through the live workspace store, not a page reload.
        await page.locator('#fileTree').get_by_role('button', name='index.html').click()
        await page.wait_for_function("document.querySelector('#languageStatus').textContent === 'HTML'")
        persisted = '<script src="./app.js"></script>' in await page.locator('#editor').input_value()
        checks.append(('R12-UI-03', 'Saved text is read back from the workspace storage adapter', persisted))

        # Delete is confirmation-gated and undo restores the same path/content.
        await page.locator('#fileTree').get_by_role('button', name='app.js').click()
        page.once('dialog', lambda dialog: asyncio.create_task(dialog.accept()))
        await page.locator('#deleteButton').click()
        await page.locator('#undoDeleteButton').click()
        await page.wait_for_function("document.querySelector('#editor').value.includes('addEventListener')")
        restored = await page.locator('#editor').input_value()
        checks.append(('R12-UI-04', 'Delete moves a file to undo area and restore brings its content back', 'addEventListener' in restored))

        await page.locator('#exportButton').click()
        async with page.expect_download() as download_info:
            await page.locator('#exportConfirm').click()
        download = await download_info.value
        download_path = await download.path()
        with zipfile.ZipFile(download_path) as archive:
            names = sorted(archive.namelist())
            archive.testzip()
            results['exportedContents'] = {name: archive.read(name).decode('utf-8') for name in names}
        results['exportedFiles'] = names
        checks.append(('R12-UI-05', 'Project ZIP export is a readable archive containing saved files', 'index.html' in names and 'app.js' in names))

        await page.locator('#paletteButton').click()
        palette_visible = await page.locator('#paletteDialog').evaluate('(el) => el.open')
        await page.locator('#paletteDialog button[value="cancel"]').click()
        await page.locator('[data-panel="terminal"]').click()
        terminal_text = await page.locator('#terminalStatus').inner_text()
        checks.append(('R12-UI-06', 'Command palette opens; unavailable terminal is disclosed rather than simulated', palette_visible and 'No terminal host connected' in terminal_text))

        await page.locator('[data-panel="resources"]').click()
        resource_text = await page.locator('#resourceText').inner_text()
        checks.append(('R12-UI-07', 'Resource panel distinguishes exposed browser values from unavailable host/thermal data', 'Host runtime' in resource_text and 'Thermal / battery' in resource_text))

        await page.locator('[data-panel="capabilities"]').click()
        capability_text = await page.locator('#capabilityList').inner_text()
        results['capabilityText'] = capability_text
        checks.append(('R14-UI-09', 'Capability panel displays statuses loaded from the machine-derived registry', 'linux-pty-provider' in capability_text and 'TESTED' in capability_text and 'android-native-host' in capability_text and 'NOT RUN' in capability_text and 'chromium-browser-verification' in capability_text and 'TESTED' in capability_text))

        await page.screenshot(path=str(ROOT / 'docs' / 'ROUND12_WORKBENCH_PREVIEW.png'), full_page=True)
        results['pageErrors'] = page_errors
        await browser.close()

    checks.append(('R12-UI-08', 'No uncaught browser page errors during direct-user workflow', len(page_errors) == 0))
    report = {'environment': {'browser':'Chromium', 'viewport':'1440x900', 'origin':'about:blank',
                              'storage':'in-memory IndexedDB-compatible test shim; persistent browser IndexedDB not exercised because Chromium navigation is blocked by container policy'},
              'checks':[{'id':i,'description':d,'status':'PASS' if ok else 'FAIL'} for i,d,ok in checks],
              'passed':sum(bool(x[2]) for x in checks),'failed':sum(not bool(x[2]) for x in checks),
              'pageErrors':page_errors,'exportedFiles':results.get('exportedFiles',[]),'exportedContents':results.get('exportedContents',{}),
              'previewScreenshot':'docs/ROUND12_WORKBENCH_PREVIEW.png','capabilityText':results.get('capabilityText',''),
              'securityBoundary':'Browser iframe sandbox and CSP only; not an operating-system process sandbox.'}
    (ROOT / 'docs' / 'ROUND12_UI_TEST_RESULTS.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
    return 0 if report['failed']==0 else 1

if __name__ == '__main__': raise SystemExit(asyncio.run(main()))
