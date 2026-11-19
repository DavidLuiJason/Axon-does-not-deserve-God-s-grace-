#!/usr/bin/env python3
"""R1 real Chromium integration proof. Requires Playwright and its Chromium binary."""
import os, pathlib, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
server = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "--directory", str(ROOT)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(0.5)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://127.0.0.1:8765/ui/index.html", wait_until="domcontentloaded")
        page.locator("#newProjectButton").click()
        page.locator("#projectNameInput").fill("R1 browser proof")
        page.locator("#createProjectConfirm").click()
        page.wait_for_timeout(250)
        page.locator("#newFileButton").click()
        page.locator("#newFilePath").fill("main.js")
        page.locator("#createFileConfirm").click()
        page.wait_for_timeout(250)
        editor = page.locator("#editorHost .cm-content")
        def set_source(source):
            editor.click()
            page.keyboard.press("Control+A")
            page.keyboard.insert_text(source)
        def run_and_wait():
            page.locator("#runButton").click()
            page.wait_for_function("document.querySelector('#runStatus').textContent.startsWith('Completed') || document.querySelector('#runStatus').textContent.startsWith('Failed') || document.querySelector('#runStatus').textContent.startsWith('Blocked')", timeout=8000)
        set_source("console.log('R1_HELLO');")
        run_and_wait()
        assert "R1_HELLO" in page.locator("#outputText").inner_text()
        print("PASS print")
        set_source("throw new Error('R1_EXPECTED_ERROR');")
        run_and_wait()
        assert "R1_EXPECTED_ERROR" in page.locator("#outputText").inner_text()
        print("PASS error")
        set_source("while (true) {}")
        page.locator("#runButton").click()
        page.wait_for_timeout(150)
        page.locator("#stopButton").click()
        assert "Stopped by user" in page.locator("#runStatus").inner_text()
        print("PASS infinite loop stopped")
        set_source("for(let i=0;i<300000;i++) console.log('x'.repeat(1000));")
        run_and_wait()
        assert "Output limit exceeded" in page.locator("#outputText").inner_text()
        print("PASS huge output capped")
        set_source("try { await fetch('https://example.com'); console.log('NETWORK_ALLOWED'); } catch (e) { console.log('NETWORK_BLOCKED'); }")
        run_and_wait()
        assert "NETWORK_BLOCKED" in page.locator("#outputText").inner_text()
        assert "NETWORK_ALLOWED" not in page.locator("#outputText").inner_text()
        print("PASS network attempt blocked")
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=5)
