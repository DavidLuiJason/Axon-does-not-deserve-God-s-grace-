#!/usr/bin/env python3
"""R6 ten-task browser acceptance. Reports each task; never substitutes fake Python execution."""
import pathlib, subprocess, sys, time
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
server=subprocess.Popen([sys.executable,'-m','http.server','8767','--directory',str(ROOT)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
results=[]
def record(name, passed, detail=''):
    results.append((name,passed,detail)); print(('PASS' if passed else 'FAIL')+' '+name+((': '+detail) if detail else ''))
try:
    time.sleep(.5)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True); context=browser.new_context(accept_downloads=True); page=context.new_page()
        page.goto('http://127.0.0.1:8767/build/ui/index.html',wait_until='domcontentloaded')
        page.locator('#newProjectButton').click(); page.locator('#projectNameInput').fill('R6 acceptance')
        page.locator('#createProjectConfirm').click(); page.wait_for_timeout(150)
        page.locator('#newFileButton').click(); page.locator('#newFilePath').fill('main.js')
        page.locator('#createFileConfirm').click(); page.wait_for_timeout(150)
        editor=page.locator('.cm-content')
        editor.click(); page.keyboard.insert_text("console.log('acceptance');")
        page.locator('#saveButton').click()
        record('create a file, edit it and save it', 'main.js' in page.locator('#fileTree').inner_text())
        page.reload(); page.wait_for_selector('#fileTree')
        record('reload and find the saved file', 'main.js' in page.locator('#fileTree').inner_text())
        editor=page.locator('.cm-content'); editor.click(); page.keyboard.press('Control+A'); page.keyboard.insert_text("console.log('R6_JS');")
        page.locator('#runButton').click()
        page.wait_for_function("document.querySelector('#runStatus').textContent.startsWith('Completed') || document.querySelector('#runStatus').textContent.startsWith('Failed')",timeout=8000)
        record('run JavaScript', 'R6_JS' in page.locator('#outputText').inner_text())
        if page.locator('#runPythonButton').count():
            page.locator('#runPythonButton').click()
            page.wait_for_timeout(500)
            record('run Python', 'Completed' in page.locator('#pythonRunStatus').inner_text())
        else:
            record('run Python', False, 'R2 browser Python worker is not implemented')
        editor.click(); page.keyboard.press('Control+A'); page.keyboard.insert_text('while(true){}')
        page.locator('#runButton').click(); page.wait_for_timeout(100); page.locator('#stopButton').click()
        record('stop an infinite loop', 'Stopped by user' in page.locator('#runStatus').inner_text())
        page.locator('#renameButton').click(); page.once('dialog',lambda d:d.accept('renamed.js')); page.wait_for_timeout(150)
        page.locator('#moveButton').click(); page.once('dialog',lambda d:d.accept('src/renamed.js')); page.wait_for_timeout(150)
        record('rename and move a file', 'src/renamed.js' in page.locator('#fileTree').inner_text())
        page.locator('#exportButton').click()
        with page.expect_download(timeout=8000) as download_info:
            page.locator('#exportConfirm').click()
        download=download_info.value
        record('export the project', bool(download.suggested_filename))
        page.locator('.cm-content').click(); page.keyboard.press('Control+A'); page.keyboard.insert_text('while(true){}')
        page.locator('#runButton').click(); page.wait_for_timeout(100)
        page.locator('[data-panel="jobs"]').click(); page.wait_for_selector('#jobsList button')
        page.locator('#jobsList button',has_text='Cancel').last.click()
        record('cancel a running job', 'cancelled' in page.locator('#jobsList').inner_text().lower())
        page.locator('.cm-content').click(); page.keyboard.press('Control+A'); page.keyboard.insert_text('while(true){}')
        page.locator('#runButton').click(); page.wait_for_timeout(100); page.reload(); page.wait_for_selector('#fileTree')
        page.locator('[data-panel="jobs"]').click(); page.wait_for_timeout(150)
        record('reload with running job and see interrupted', 'interrupted' in page.locator('#jobsList').inner_text().lower())
        page.locator('[data-panel="capabilities"]').click()
        record('open capability status', page.locator('#capabilityList').count()==1 and page.locator('#capabilityList').inner_text()!='')
        browser.close()
finally:
    server.terminate(); server.wait(timeout=5)
failed=sum(1 for _,passed,_ in results if not passed)
print(f'Acceptance summary: {len(results)-failed}/{len(results)} passed; {failed} failed.')
sys.exit(1 if failed else 0)
