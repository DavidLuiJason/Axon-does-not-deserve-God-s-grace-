#!/usr/bin/env python3
"""Round 4 actual Chromium Blob Worker integration tests.

Requires Python Playwright and Chromium. It bundles the compiled AXON Code source
modules into an inline browser module, then tests the real adapter and provider.
This worker is designed for owner-approved JavaScript snippets, not hostile internet
programs or a substitute for an OS-level process/container sandbox.
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROMIUM = os.environ.get("AXON_CHROMIUM", "/usr/bin/chromium")

CASES = [
    # Actual execution: common small JavaScript workloads.
    ("R4-EXEC-001", "arithmetic", "console.log(6 * 7);", "completed", "42"),
    ("R4-EXEC-002", "function-and-loop", "function sum(n){ let s=0; for(let i=1;i<=n;i++) s+=i; return s; } console.log(sum(100));", "completed", "5050"),
    ("R4-EXEC-003", "array-transform", "const values=[1,2,3,4,5]; console.log(values.map(x=>x*x).reduce((a,b)=>a+b,0));", "completed", "55"),
    ("R4-EXEC-004", "sorting", "const values=[9,1,8,2,7,3]; values.sort((a,b)=>a-b); console.log(values.join(','));", "completed", "1,2,3,7,8,9"),
    ("R4-EXEC-005", "object-aggregation", "const rows=[{n:'A',v:3},{n:'B',v:4}]; console.log(rows.reduce((s,r)=>s+r.v,0));", "completed", "7"),
    ("R4-EXEC-006", "async-await", "const v=await Promise.resolve(21); console.log(v*2);", "completed", "42"),
    ("R4-EXEC-007", "promise-chain", "const v=await Promise.resolve(2).then(x=>x+3).then(x=>x*4); console.log(v);", "completed", "20"),
    ("R4-EXEC-008", "unicode", "console.log('AXON — Intelligence in Motion — 🌍');", "completed", "AXON"),
    ("R4-EXEC-009", "date-logic", "const d=new Date('2024-02-29T00:00:00Z'); console.log(d.toISOString().slice(0,10));", "completed", "2024-02-29"),
    ("R4-EXEC-010", "regex", "console.log('axon-code-2026'.match(/[a-z]+/g).join('|'));", "completed", "axon|code"),
    ("R4-EXEC-011", "class", "class Counter{constructor(){this.n=0} inc(){this.n++}} const c=new Counter(); c.inc(); c.inc(); console.log(c.n);", "completed", "2"),
    ("R4-EXEC-012", "recursion", "function fib(n){return n<2?n:fib(n-1)+fib(n-2)} console.log(fib(10));", "completed", "55"),
    ("R4-EXEC-013", "map-set", "const s=new Set([1,2,2,3]); console.log([...s].join(','));", "completed", "1,2,3"),
    ("R4-EXEC-014", "json-transform", "const obj=JSON.parse('{\"a\":2,\"b\":3}'); console.log(JSON.stringify({sum:obj.a+obj.b}));", "completed", "sum"),
    ("R4-EXEC-015", "matrix", "const a=[[1,2],[3,4]], b=[[5,6],[7,8]]; console.log(a.map((r,i)=>r.map((v,j)=>v+b[i][j]).join(',')).join(';'));", "completed", "6,8;10,12"),
    ("R4-EXEC-016", "closure", "function make(){let n=0;return ()=>++n} const next=make(); console.log(next(),next(),next());", "completed", "1 2 3"),
    ("R4-EXEC-017", "numeric-format", "console.log([1.25,2.5,5].map(x=>x.toFixed(1)).join(','));", "completed", "1.3,2.5,5.0"),
    ("R4-EXEC-018", "empty-reduce", "console.log([].reduce((a,b)=>a+b,0));", "completed", "0"),
    ("R4-EXEC-019", "boolean-logic", "console.log(Boolean(0 || '' || 'axon'));", "completed", "true"),
    ("R4-EXEC-020", "data-summary", "const xs=Array.from({length:100},(_,i)=>i+1); console.log(xs.length,xs[0],xs.at(-1));", "completed", "100 1 100"),
    ("R4-EXEC-021", "typed-array", "const b=new Uint8Array([1,2,255]); console.log([...b].join(','));", "completed", "1,2,255"),
    ("R4-EXEC-022", "async-iteration", "let total=0; for await (const n of [1,2,3]) total+=n; console.log(total);", "completed", "6"),
    ("R4-EXEC-023", "map-grouping", "const xs=['a','bb','c']; console.log(xs.reduce((o,x)=>(o[x.length]=(o[x.length]||0)+1,o),{}).toString ? Object.keys(xs.reduce((o,x)=>(o[x.length]=(o[x.length]||0)+1,o),{})).sort().join(',') : 'bad');", "completed", "1,2"),
    ("R4-EXEC-024", "promise-all", "const vals=await Promise.all([Promise.resolve(2),Promise.resolve(3)]); console.log(vals.reduce((a,b)=>a+b));", "completed", "5"),
    ("R4-EXEC-025", "string-unicode", "console.log(Array.from('AXON🌍').length);", "completed", "5"),
    ("R4-EXEC-026", "optional-chaining-nullish", "const user={profile:{name:'Ada'}}; console.log(user?.profile?.name ?? 'unknown');", "completed", "Ada"),
    ("R4-EXEC-027", "template-literal", "const version=4; console.log(`round-${version}`);", "completed", "round-4"),
    ("R4-EXEC-028", "generator", "function* ids(){yield 2;yield 4;yield 6;} console.log([...ids()].join(','));", "completed", "2,4,6"),
    ("R4-EXEC-029", "bigint", "console.log((9007199254740993n + 7n).toString());", "completed", "9007199254741000"),
    ("R4-EXEC-030", "object-prototype-names", "const o={constructor:'kept',toString:'value'}; console.log(o.constructor,o.toString);", "completed", "kept value"),
    ("R4-EXEC-031", "map-object-grouping", "const m=new Map([['a',2],['b',3]]); console.log([...m.values()].reduce((a,b)=>a+b,0));", "completed", "5"),
    ("R4-EXEC-032", "switch-branch", "const n=2; let label=''; switch(n){case 1:label='one';break;case 2:label='two';break;default:label='other'} console.log(label);", "completed", "two"),
    ("R4-EXEC-033", "caught-exception", "try { throw new Error('expected'); } catch (error) { console.log('caught',error.message); }", "completed", "caught expected"),
    ("R4-EXEC-034", "handled-promise-rejection", "await Promise.reject(new Error('handled')).catch(error=>console.log(error.message));", "completed", "handled"),
    ("R4-EXEC-035", "async-unhandled-rejection", "Promise.reject(new Error('unhandled-by-test'));", "failed", "JAVASCRIPT_UNHANDLED_REJECTION"),
    ("R4-EXEC-036", "blocked-dynamic-import", "await import('data:text/javascript,console.log(1)');", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-EXEC-037", "blocked-worker-bridge", "postMessage('escape');", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-EXEC-038", "blocked-worker-close", "close();", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-EXEC-039", "for-of-aggregation", "let sum=0; for (const n of [2,4,6,8]) sum+=n; console.log(sum);", "completed", "20"),
    ("R4-EXEC-040", "default-parameters", "function greet(name='AXON'){return `Hello ${name}`} console.log(greet());", "completed", "Hello AXON"),
    ("R4-EXEC-041", "destructuring", "const {a,b:[first]}={a:3,b:[9]}; console.log(a+first);", "completed", "12"),
    ("R4-EXEC-042", "map-filter-flatmap", "console.log([1,2,3,4].filter(n=>n%2===0).flatMap(n=>[n,n*10]).join(','));", "completed", "2,20,4,40"),
    ("R4-EXEC-043", "regexp-groups", "const m='2026-11-07'.match(/(\\d{4})-(\\d{2})-(\\d{2})/); console.log(m[1],m[2],m[3]);", "completed", "2026 11 07"),
    ("R4-EXEC-044", "unicode-output", "console.log('🌍'.repeat(3));", "completed", "🌍🌍🌍"),
    ("R4-EXEC-045", "nested-array", "const xs=[[1,2],[3,4]]; console.log(xs.flat().reduce((a,b)=>a+b));", "completed", "10"),
    ("R4-EXEC-046", "class-inheritance", "class A{v(){return 3}} class B extends A{v(){return super.v()+2}} console.log(new B().v());", "completed", "5"),
    ("R4-EXEC-047", "date-range", "const a=new Date('2026-01-01Z'),b=new Date('2026-01-08Z'); console.log((b-a)/86400000);", "completed", "7"),
    ("R4-EXEC-048", "stable-object-sort", "const o={z:1,a:2,m:3}; console.log(Object.keys(o).sort().join(','));", "completed", "a,m,z"),
    ("R4-EXEC-049", "worker-control-handler-not-exposed", "console.log(self.onmessage === null);", "completed", "true"),
    ("R4-EXEC-050", "restricted-host-apis", "console.log(typeof fetch,typeof XMLHttpRequest,typeof WebSocket,typeof indexedDB,typeof document,typeof Worker,typeof SharedWorker,typeof WebTransport,typeof RTCPeerConnection,typeof postMessage,typeof close);", "completed", "undefined undefined undefined"),
    # Injected faults: actual execution must fail and report a structured diagnostic.
    ("R4-ERR-001", "syntax-missing-expression", "const total = ;", "failed", "JAVASCRIPT_SYNTAX_ERROR"),
    ("R4-ERR-002", "syntax-unclosed-block", "function run(){\n  console.log('x');\n", "failed", "JAVASCRIPT_SYNTAX_ERROR"),
    ("R4-ERR-003", "runtime-reference-error", "const total = 4;\nconsole.log(missingValue + total);", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-004", "runtime-type-error", "const value = 5;\nconsole.log(value.toUpperCase());", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-005", "runtime-null-access", "const user = null;\nconsole.log(user.name);", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-006", "runtime-json-parse", "const text = '{bad json}';\nJSON.parse(text);", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-007", "runtime-not-callable", "const action = 4;\naction();", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-008", "runtime-explicit-throw", "const status = 'ready';\nthrow new Error('expected failure');", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-009", "blocked-network-fetch", "await fetch('https://example.com');", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-010", "blocked-websocket", "new WebSocket('wss://example.com');", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-011", "blocked-indexeddb", "indexedDB.open('should-not-exist');", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-012", "blocked-dom", "document.body.innerHTML = 'x';", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-013", "blocked-importscripts", "importScripts('https://example.com/x.js');", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-014", "blocked-xhr", "new XMLHttpRequest();", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-015", "compiler-syntax-error", "const result = (1 + );", "failed", "JAVASCRIPT_SYNTAX_ERROR"),
    ("R4-ERR-016", "second-line-missing-value", "const good = 1;\nconst broken = ;", "failed", "JAVASCRIPT_SYNTAX_ERROR"),
    ("R4-ERR-017", "unclosed-comment", "const safe = 1;\n/* never closed", "failed", "JAVASCRIPT_SYNTAX_ERROR"),
    ("R4-ERR-018", "arrow-missing-body", "const fn = () => ;", "failed", "JAVASCRIPT_SYNTAX_ERROR"),
    ("R4-ERR-019", "async-runtime-error", "const ready = true;\nawait Promise.reject(new Error('async-failure'));", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-020", "nested-runtime-error", "function outer(){\n  function inner(){ throw new Error('nested'); }\n  inner();\n}\nouter();", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-021", "long-error-message-bounded", "throw new Error('x'.repeat(100000));", "failed", "JAVASCRIPT_RUNTIME_ERROR"),
    ("R4-ERR-022", "recursion-stack-overflow", "function recurse(){return recurse()} recurse();", "failed", "JAVASCRIPT_STACK_OVERFLOW"),
]

async def main() -> int:
    async with async_playwright() as p:
        launch_args = ["--no-sandbox"] if os.environ.get("AXON_CHROMIUM_NO_SANDBOX") == "1" else []
        browser = await p.chromium.launch(headless=True, executable_path=CHROMIUM, args=launch_args)
        page = await browser.new_page()
        page_errors: list[str] = []
        external_probe_requests: list[str] = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on("request", lambda request: external_probe_requests.append(request.url) if "axon-csp-probe.invalid" in request.url else None)
        console_messages: list[str] = []
        page.on("console", lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))
        await page.set_content("<!doctype html><html><body></body></html>")

        await page.evaluate("window.__r4debug = []; window.addEventListener('message', e => window.__r4debug.push({origin:e.origin,data:e.data}));")
        path_module = (ROOT / "dist/pathSafety.js").read_text(encoding="utf-8")
        lexer_module = (ROOT / "dist/lexer.js").read_text(encoding="utf-8")
        diagnostics_module = (ROOT / "dist/diagnostics.js").read_text(encoding="utf-8").replace("import { tokenize } from './lexer.js';", "")
        source_maps_module = (ROOT / "dist/runtime/sourceMaps.js").read_text(encoding="utf-8")
        source_maps_module = "\n".join(line[len("export "):] if line.startswith("export ") else line for line in source_maps_module.splitlines() if not line.startswith("import "))
        adapter_module = (ROOT / "dist/runtime/javascriptWorker.js").read_text(encoding="utf-8")
        adapter_module = adapter_module.replace("import { normalizeProjectPath } from '../pathSafety.js';", "").replace("import { mapGeneratedPosition } from './sourceMaps.js';", "").replace("import { analyzeSourceFile } from '../diagnostics.js';", "")
        provider_module = (ROOT / "dist/runtime/browserOpaqueWorkerProvider.js").read_text(encoding="utf-8")
        browser_entry = r"""
const provider = new BrowserOpaqueWorkerProvider(document);
let adapter = null;
let initError = null;
const requestSources = new Map();
try {
  await provider.initialize(5000);
  adapter = new JavaScriptWorkerExecutionAdapter(
    { async readSingleEntry(request) { return requestSources.get(request.requestId) || null; } },
    provider,
    { maxTimeoutMs: 5000, maxOutputBytes: 65536, maxSourceBytes: 1024 * 1024 }
  );
} catch (error) { initError = String(error); }
window.__axonR4 = {
  ready: Boolean(adapter), initError, attestation: provider.attest(),
  async run(input) {
    if (!adapter) return { status: 'not-implemented', notes: [initError || 'Browser Worker provider unavailable.'], diagnostics: [] };
    const entryPath = input.entryPath || 'src/main.js';
    requestSources.set(input.requestId || 'r4-request', { path: entryPath, source: input.source });
    const controller = new AbortController();
    if (input.abortBefore === true) controller.abort();
    if (input.cancelAfterMs !== undefined) setTimeout(() => controller.abort(), input.cancelAfterMs);
    const request = {
      requestId: input.requestId || 'r4-request', projectId: 'r4-project',
      entryFiles: [entryPath], runtimeId: 'javascript-worker-ac2', mode: input.mode || 'FULL_LOCAL',
      timeoutMs: input.timeoutMs === undefined ? 5000 : input.timeoutMs,
      outputLimitBytes: input.outputLimitBytes === undefined ? 65536 : input.outputLimitBytes,
      networkAllowed: input.networkAllowed === undefined ? false : input.networkAllowed,
      fileAccess: input.fileAccess || 'none'
    };
    return await adapter.execute(request, (input.cancelAfterMs !== undefined || input.abortBefore === true) ? controller.signal : undefined);
  },
  dispose() { provider.dispose(); }
};
window.__axonR4Ready = true;
"""
        bundle = path_module + "\n" + lexer_module + "\n" + diagnostics_module + "\n" + source_maps_module + "\n" + adapter_module + "\n" + provider_module + "\n" + browser_entry
        await page.add_script_tag(content=bundle, type="module")
        try:
            await page.wait_for_function("window.__axonR4Ready === true", timeout=15_000)
        except Exception as error:
            raise RuntimeError(f"Harness failed to initialize: {error}; pageErrors={page_errors}; console={console_messages}") from error
        ready = await page.evaluate("window.__axonR4.ready")
        attestation = await page.evaluate("window.__axonR4.attestation")
        init_error = await page.evaluate("window.__axonR4.initError")
        if not ready:
            raise RuntimeError(f"AXON browser worker provider not ready: {init_error}; attestation={attestation}; debug={await page.evaluate('window.__r4debug')}; pageErrors={page_errors}")

        results: list[dict[str, Any]] = []
        required_attestation = ["isolatedOrigin", "networkBlockedByHostPolicy", "filesystemBridgeAbsent", "restrictiveCspConfirmed", "noPrivilegedHostBridge"]
        attestation_ok = all(attestation.get(key) is True for key in required_attestation) and not external_probe_requests
        results.append({"id": "R4-SEC-001", "name": "opaque-origin-and-csp-network-probe", "expectedStatus": "attested-and-no-network-request",
                        "actualAttestation": attestation, "externalProbeRequests": external_probe_requests, "pass": attestation_ok})
        for case_id, name, source, expected_status, expected_marker in CASES:
            started = time.perf_counter()
            result = await page.evaluate("input => window.__axonR4.run(input)", {
                "requestId": case_id, "source": source, "entryPath": "src/fixtures/main.js",
                "timeoutMs": 1500, "outputLimitBytes": 8192
            })
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            actual_status = result.get("status")
            haystack = json.dumps(result, ensure_ascii=False)
            marker_found = expected_marker in (result.get("stdout", "") + haystack)
            diagnostic = (result.get("diagnostics") or [{}])[0]
            location = diagnostic.get("location")
            passed = actual_status == expected_status and marker_found
            if expected_status == "failed":
                passed = passed and len(result.get("diagnostics", [])) == 1 and location and location.get("file") == "src/fixtures/main.js"
                passed = passed and diagnostic.get("severity") == "error"
                passed = passed and diagnostic.get("code") == expected_marker
                expected_stages = {"UNCLOSED_COMMENT": "lexical", "MISSING_ASSIGNMENT_VALUE": "syntax", "UNCLOSED_DELIMITER": "syntax", "MISSING_ARROW_BODY": "syntax", "JAVASCRIPT_SYNTAX_ERROR": "syntax", "JAVASCRIPT_RUNTIME_ERROR": "runtime", "JAVASCRIPT_UNHANDLED_REJECTION": "runtime"}
                passed = passed and diagnostic.get("stage") == expected_stages.get(expected_marker, diagnostic.get("stage"))
                # Source-map the known baseline cases exactly; compiler-generated messages may only identify the file.
                expected_positions = {
                    "R4-ERR-003": (2, 13), "R4-ERR-004": (2, 19),
                    "R4-ERR-005": (2, 18), "R4-ERR-006": (2, 6),
                    "R4-ERR-007": (2, 1), "R4-ERR-008": (2, 7),
                    "R4-ERR-009": (1, 7), "R4-ERR-010": (1, 1),
                    "R4-ERR-011": (1, 11), "R4-ERR-012": (1, 1),
                    "R4-ERR-013": (1, 1), "R4-ERR-014": (1, 1),
                    "R4-ERR-019": (2, 22),
                    "R4-ERR-020": (2, 27),
                    "R4-ERR-021": (1, 7),
                    "R4-ERR-022": (1, 1),
                    "R4-EXEC-035": (1, 16),
                }
                if case_id in expected_positions:
                    expected_line, expected_column = expected_positions[case_id]
                    passed = passed and location and location.get("line") == expected_line and location.get("column") == expected_column
                expected_message_prefixes = {
                    "R4-ERR-003": "ReferenceError:", "R4-ERR-004": "TypeError:",
                    "R4-ERR-005": "TypeError:", "R4-ERR-006": "SyntaxError:",
                    "R4-ERR-007": "TypeError:", "R4-ERR-008": "Error: expected failure",
                    "R4-ERR-009": "TypeError:", "R4-ERR-010": "TypeError:",
                    "R4-ERR-011": "TypeError:", "R4-ERR-012": "ReferenceError:",
                    "R4-ERR-013": "TypeError:", "R4-ERR-014": "TypeError:",
                    "R4-ERR-015": "SyntaxError:", "R4-ERR-019": "Error: async-failure",
                    "R4-ERR-020": "Error: nested", "R4-ERR-021": "Error: ",
                    "R4-ERR-022": "RangeError:", "R4-EXEC-035": "Error: unhandled-by-test"
                }
                prefix = expected_message_prefixes.get(case_id)
                if prefix:
                    passed = passed and str(diagnostic.get("message", "")).startswith(prefix)
                if location and location.get("line") is not None and case_id != "R4-ERR-022":
                    # Runtime stack positions without an original-source map are useful,
                    # but remain medium-confidence rather than source-map verified.
                    passed = passed and diagnostic.get("confidence") == "medium"
                if case_id == "R4-ERR-022":
                    passed = passed and diagnostic.get("confidence") == "low"
                if expected_marker == "JAVASCRIPT_SYNTAX_ERROR":
                    passed = passed and diagnostic.get("stage") == "syntax" and location.get("line") is None and location.get("column") is None and diagnostic.get("confidence") == "high"
                if case_id == "R4-ERR-021":
                    passed = passed and len(diagnostic.get("message", "")) <= 4_100 and len(diagnostic.get("explanation", "")) <= 4_000
            results.append({"id": case_id, "name": name, "expectedStatus": expected_status, "actualStatus": actual_status,
                            "expectedMarker": expected_marker, "markerFound": marker_found, "location": location,
                            "diagnostic": diagnostic, "elapsedMs": duration_ms, "pass": passed, "result": result})

        # Worker timeout must not freeze the host page.
        started = time.perf_counter()
        timeout_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-LIMIT-001", "source": "while (true) {}", "timeoutMs": 150, "outputLimitBytes": 8192
        })
        results.append({"id": "R4-LIMIT-001", "name": "worker-timeout-termination", "expectedStatus": "timed-out",
                        "actualStatus": timeout_result.get("status"), "elapsedMs": round((time.perf_counter()-started)*1000,2),
                        "pass": timeout_result.get("status") == "timed-out", "result": timeout_result})

        output_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-LIMIT-002", "source": "console.log('x'.repeat(10000));", "timeoutMs": 1500, "outputLimitBytes": 256
        })
        results.append({"id": "R4-LIMIT-002", "name": "output-limit-enforcement", "expectedStatus": "blocked",
                        "actualStatus": output_result.get("status"), "pass": output_result.get("status") == "blocked", "result": output_result})

        cancel_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-LIMIT-003", "source": "await new Promise(resolve => setTimeout(resolve, 1000)); console.log('late');",
            "timeoutMs": 1500, "outputLimitBytes": 8192, "cancelAfterMs": 100
        })
        results.append({"id": "R4-LIMIT-003", "name": "abort-signal-cancellation", "expectedStatus": "cancelled",
                        "actualStatus": cancel_result.get("status"), "pass": cancel_result.get("status") == "cancelled", "result": cancel_result})

        network_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-GUARD-001", "source": "console.log('should not run');", "networkAllowed": True
        })
        results.append({"id": "R4-GUARD-001", "name": "network-enabled-request-rejected", "expectedStatus": "blocked",
                        "actualStatus": network_result.get("status"), "pass": network_result.get("status") == "blocked", "result": network_result})
        path_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-GUARD-002", "source": "console.log('should not run');", "entryPath": "../escape.js"
        })
        results.append({"id": "R4-GUARD-002", "name": "path-traversal-entry-rejected", "expectedStatus": "blocked",
                        "actualStatus": path_result.get("status"), "pass": path_result.get("status") == "blocked", "result": path_result})
        size_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-GUARD-003", "source": "//" + ("x" * (1024*1024 + 5)), "timeoutMs": 1000
        })
        results.append({"id": "R4-GUARD-003", "name": "source-size-limit", "expectedStatus": "blocked",
                        "actualStatus": size_result.get("status"), "pass": size_result.get("status") == "blocked", "result": size_result})
        typescript_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-GUARD-004", "source": "const answer: number = 42;", "entryPath": "src/main.ts"
        })
        results.append({"id": "R4-GUARD-004", "name": "typescript-not-misrouted-to-js-runtime", "expectedStatus": "blocked",
                        "actualStatus": typescript_result.get("status"), "pass": typescript_result.get("status") == "blocked", "result": typescript_result})
        jsx_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-GUARD-005", "source": "const view = <div />;", "entryPath": "src/view.jsx"
        })
        results.append({"id": "R4-GUARD-005", "name": "jsx-not-misrouted-to-js-runtime", "expectedStatus": "blocked",
                        "actualStatus": jsx_result.get("status"), "pass": jsx_result.get("status") == "blocked", "result": jsx_result})
        project_access_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-GUARD-006", "source": "console.log('no project access');", "fileAccess": "project-read-only"
        })
        results.append({"id": "R4-GUARD-006", "name": "project-filesystem-access-rejected", "expectedStatus": "blocked",
                        "actualStatus": project_access_result.get("status"), "pass": project_access_result.get("status") == "blocked", "result": project_access_result})
        invalid_limit_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-GUARD-007", "source": "console.log('bad limit');", "timeoutMs": 0
        })
        results.append({"id": "R4-GUARD-007", "name": "invalid-timeout-rejected", "expectedStatus": "blocked",
                        "actualStatus": invalid_limit_result.get("status"), "pass": invalid_limit_result.get("status") == "blocked", "result": invalid_limit_result})
        invalid_output_limit_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-GUARD-008", "source": "console.log('bad output limit');", "outputLimitBytes": 0
        })
        results.append({"id": "R4-GUARD-008", "name": "invalid-output-limit-rejected", "expectedStatus": "blocked",
                        "actualStatus": invalid_output_limit_result.get("status"), "pass": invalid_output_limit_result.get("status") == "blocked", "result": invalid_output_limit_result})
        wrong_mode_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-GUARD-009", "source": "console.log('not full local');", "mode": "WAIT_FOR_RESOURCES"
        })
        results.append({"id": "R4-GUARD-009", "name": "non-local-execution-mode-rejected", "expectedStatus": "blocked",
                        "actualStatus": wrong_mode_result.get("status"), "pass": wrong_mode_result.get("status") == "blocked", "result": wrong_mode_result})

        pre_cancel_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-LIMIT-005", "source": "console.log('must not start');", "abortBefore": True
        })
        results.append({"id": "R4-LIMIT-005", "name": "pre-aborted-request-not-started", "expectedStatus": "cancelled",
                        "actualStatus": pre_cancel_result.get("status"), "pass": pre_cancel_result.get("status") == "cancelled", "result": pre_cancel_result})

        concurrent_inputs = [
            {"requestId": f"R4-CONCURRENT-{i}", "source": f"console.log({i} * {i});", "entryPath": "src/concurrent.js"}
            for i in range(1, 7)
        ]
        concurrent_results = await page.evaluate("items => Promise.all(items.map(item => window.__axonR4.run(item)))", concurrent_inputs)
        concurrent_ok = len(concurrent_results) == 6 and all(r.get("status") == "completed" and f"{i*i}\n" in r.get("stdout", "") for i, r in enumerate(concurrent_results, start=1))
        results.append({"id": "R4-CONCURRENT-001", "name": "six-concurrent-worker-runs", "expectedStatus": "completed x6",
                        "actualStatus": [r.get("status") for r in concurrent_results], "pass": concurrent_ok,
                        "results": concurrent_results})
        responsive_value = await page.evaluate("1 + 1")
        results.append({"id": "R4-LIMIT-004", "name": "host-page-responsive-after-worker-timeout", "expectedValue": 2,
                        "actualValue": responsive_value, "pass": responsive_value == 2})

        await page.evaluate("window.__axonR4.dispose()")
        disposed_result = await page.evaluate("input => window.__axonR4.run(input)", {
            "requestId": "R4-LIMIT-006", "source": "console.log('provider must not be reused after dispose');"
        })
        results.append({"id": "R4-LIMIT-006", "name": "disposed-provider-refuses-new-work", "expectedStatus": "blocked",
                        "actualStatus": disposed_result.get("status"), "pass": disposed_result.get("status") == "blocked", "result": disposed_result})
        await browser.close()

    failures = [r for r in results if not r["pass"]]
    payload = {
        "suite": "AXON Code Round 4 actual browser execution integration",
        "browser": "Chromium headless",
        "engine": "actual Chromium Blob Worker in sandboxed opaque-origin iframe",
        "attestation": attestation,
        "cases": len(results), "passed": len(results) - len(failures), "failed": len(failures),
        "pageErrors": page_errors, "externalCspProbeRequests": external_probe_requests, "results": results,
    }
    report_path = ROOT / "docs" / "ROUND4_BROWSER_RESULTS.json"
    report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 1 if failures or page_errors else 0

if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
