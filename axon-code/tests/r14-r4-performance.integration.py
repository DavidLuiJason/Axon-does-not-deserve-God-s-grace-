#!/usr/bin/env python3
"""R4 Chromium performance measurements. Phone measurements are deliberately NOT RUN here."""
import pathlib, subprocess, sys, time, json
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
server=subprocess.Popen([sys.executable,'-m','http.server','8766','--directory',str(ROOT)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    time.sleep(.5)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        context=browser.new_context()
        page=context.new_page()
        cdp=context.new_cdp_session(page)
        cdp.send('Emulation.setCPUThrottlingRate', {'rate':4})
        page.goto('http://127.0.0.1:8766/build/ui/index.html',wait_until='domcontentloaded')
        page.wait_for_selector('#newProjectButton')
        edit_start=time.perf_counter()
        page.locator('#newProjectButton').click()
        page.locator('#projectNameInput').fill('R4 performance')
        page.locator('#createProjectConfirm').click()
        page.wait_for_timeout(150)
        page.locator('#newFileButton').click()
        page.locator('#newFilePath').fill('main.js')
        page.locator('#createFileConfirm').click()
        page.wait_for_selector('.cm-content')
        first_edit=(time.perf_counter()-edit_start)*1000
        editor=page.locator('.cm-content')
        editor.click(); page.keyboard.insert_text("console.log('r4');")
        js_start=time.perf_counter(); page.locator('#runButton').click()
        page.wait_for_function("document.querySelector('#runStatus').textContent.startsWith('Completed') || document.querySelector('#runStatus').textContent.startsWith('Failed')",timeout=10000)
        first_js=(time.perf_counter()-js_start)*1000
        for _ in range(9):
            page.locator('#runButton').click()
            page.wait_for_function("document.querySelector('#runStatus').textContent.startsWith('Completed') || document.querySelector('#runStatus').textContent.startsWith('Failed')",timeout=10000)
        heap=cdp.send('Runtime.getHeapUsage').get('usedSize')
        page_heap=page.evaluate("performance.memory?.usedJSHeapSize ?? null")
        if page.locator('#runPythonButton').count():
            py_start=time.perf_counter(); page.locator('#runPythonButton').click()
            page.wait_for_function("document.querySelector('#pythonRunStatus')?.textContent.includes('Completed') || document.querySelector('#pythonRunStatus')?.textContent.includes('Failed')",timeout=60000)
            first_python=(time.perf_counter()-py_start)*1000
        else:
            first_python='NOT RUN — R2 browser Python worker is not implemented'
        print(json.dumps({'timeToFirstEditMs':round(first_edit,2),'timeToFirstJavaScriptRunMs':round(first_js,2),'timeToFirstPythonRunMs':round(first_python,2) if isinstance(first_python,float) else first_python,'heapAfterTenRunsCDPBytes':heap,'heapAfterTenRunsPerformanceMemoryBytes':page_heap,'cpuThrottle':4,'phoneMeasurements':'NOT RUN'}))
        browser.close()
finally:
    server.terminate(); server.wait(timeout=5)
