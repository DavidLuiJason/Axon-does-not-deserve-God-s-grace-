#!/usr/bin/env python3
"""Round 12: run real bundled TLA and source-map workloads in opaque-origin Chromium Worker."""
from __future__ import annotations
import asyncio, json, os, subprocess
from pathlib import Path
from playwright.async_api import async_playwright
ROOT = Path(__file__).resolve().parents[1]
CHROMIUM = os.environ.get('AXON_CHROMIUM', '/usr/bin/chromium')

def read_module(path: str, remove: tuple[str, ...] = ()) -> str:
    text=(ROOT/path).read_text(encoding='utf-8')
    for item in remove: text=text.replace(item,'')
    rows=[]
    for line in text.splitlines():
        if line.startswith('import '): continue
        if line.startswith('export '): line=line[len('export '):]
        rows.append(line)
    return '\n'.join(rows)

def make_script(fixtures: dict) -> str:
    modules=[
      read_module('dist/pathSafety.js'),
      read_module('dist/lexer.js'),
      read_module('dist/diagnostics.js', ("import { tokenize } from './lexer.js';",)),
      read_module('dist/runtime/sourceMaps.js'),
      read_module('dist/runtime/javascriptWorker.js', ("import { normalizeProjectPath } from '../pathSafety.js';", "import { mapGeneratedPosition } from './sourceMaps.js';")),
      read_module('dist/runtime/browserOpaqueWorkerProvider.js')]
    workload = json.dumps({k:{'source':v['bundle']['source'],'sourceMap':v['bundle']['sourceMap']} for k,v in fixtures.items()})
    entry = r"""
const fixtures=__R12_FIXTURES__;
(async()=>{
 const provider=new BrowserOpaqueWorkerProvider(document);
 const attestation=await provider.initialize(5000);
 async function run(key, requestId) {
   const item=fixtures[key];
   const entryProvider={supportedExtensions:['.ts'],requiresSourceMap:true,async readSingleEntry(){return {path:'src/main.ts',source:item.source,sourceMap:item.sourceMap};}};
   const adapter=new JavaScriptWorkerExecutionAdapter(entryProvider,provider,{maxTimeoutMs:6000,maxOutputBytes:65536,maxSourceBytes:2*1024*1024});
   return adapter.execute({requestId,projectId:'r12-runtime',entryFiles:['src/main.ts'],runtimeId:'javascript-worker-ac2',mode:'FULL_LOCAL',timeoutMs:4000,outputLimitBytes:32768,networkAllowed:false,fileAccess:'none'});
 }
 const invalidProvider={supportedExtensions:['.js'],async readSingleEntry(){return {path:'src/invalid.js',source:'const invalid = ;\nconsole.log(\"MUST_NOT_RUN\");'};}};
 const invalidAdapter=new JavaScriptWorkerExecutionAdapter(invalidProvider,provider,{maxTimeoutMs:3000,maxOutputBytes:4096,maxSourceBytes:65536});
 const invalidSyntax=await invalidAdapter.execute({requestId:'r12-invalid-js',projectId:'r12-runtime',entryFiles:['src/invalid.js'],runtimeId:'javascript-worker-ac2',mode:'FULL_LOCAL',timeoutMs:1500,outputLimitBytes:2048,networkAllowed:false,fileAccess:'none'});
 const results={attestation,topLevelAwait:await run('topLevelAwait','r12-tla-browser'),mappedRuntimeError:await run('mappedRuntimeError','r12-source-map-browser'),invalidSyntax};
 provider.dispose(); window.__AXON_R12_RUNTIME__=results; window.__AXON_R12_RUNTIME_DONE__=true;
})().catch(error=>{window.__AXON_R12_RUNTIME_ERROR__=String(error&&error.stack||error);window.__AXON_R12_RUNTIME_DONE__=true;});
""".replace('__R12_FIXTURES__',workload)
    return '\n'.join(modules)+'\n'+entry

async def main() -> int:
    prep=subprocess.run(['node','tests/round12-prepare-browser-fixtures.mjs'],cwd=ROOT,capture_output=True,text=True,timeout=120)
    if prep.returncode: raise RuntimeError(prep.stdout+'\n'+prep.stderr)
    fixtures=json.loads((ROOT/'tests/round12-browser-fixtures.json').read_text(encoding='utf-8'))
    script=make_script(fixtures)
    async with async_playwright() as p:
      args=['--disable-dev-shm-usage']
      if hasattr(os,'geteuid') and os.geteuid()==0: args.append('--no-sandbox')
      browser=await p.chromium.launch(headless=True,executable_path=CHROMIUM,args=args)
      page=await browser.new_page(viewport={'width':1000,'height':760})
      await page.set_content('<!doctype html><html><body><main>AXON Round 12 browser runtime host</main></body></html>')
      await page.add_script_tag(content=script,type='module')
      await page.wait_for_function('window.__AXON_R12_RUNTIME_DONE__===true',timeout=30000)
      error=await page.evaluate('window.__AXON_R12_RUNTIME_ERROR__')
      if error: raise RuntimeError(error)
      result=await page.evaluate('window.__AXON_R12_RUNTIME__')
      await browser.close()
    tla=result['topLevelAwait']; mapped=result['mappedRuntimeError']; diag=(mapped.get('diagnostics') or [{}])[0]
    invalid=result['invalidSyntax']; invalid_diag=(invalid.get('diagnostics') or [{}])[0]
    checks=[
      ('R12-RUN-01','Actual bundled TypeScript project with top-level await passes project semantic check',fixtures['topLevelAwait']['checked']['success']),
      ('R12-RUN-02','Top-level await bundle executes in the actual isolated browser Worker',tla.get('status')=='completed' and 'R12_TLA_EXECUTED 42' in tla.get('stdout','')),
      ('R12-RUN-03','Runtime exception is surfaced from the actual Worker with expected marker',mapped.get('status')=='failed' and 'R12_RUNTIME_SOURCE_MAP' in ' '.join(mapped.get('notes',[]))),
      ('R12-RUN-04','Worker runtime error source map resolves original TS file and line 3',diag.get('location',{}).get('file')=='src/main.ts' and diag.get('location',{}).get('line')==3 and diag.get('confidence')=='high'),
      ('R12-RUN-05','Opaque-origin Worker attestation confirms network/filesystem/host bridge restrictions',all(result.get('attestation',{}).get(k) is True for k in ['isolatedOrigin','networkBlockedByHostPolicy','filesystemBridgeAbsent','restrictiveCspConfirmed','noPrivilegedHostBridge'])),
      ('R12-RUN-06','Native ECMAScript parser rejects malformed JavaScript before Worker execution',invalid.get('status')=='failed' and invalid_diag.get('code')=='JAVASCRIPT_SYNTAX_ERROR' and 'MUST_NOT_RUN' not in invalid.get('stdout','') and invalid.get('diagnostics',[{}])[0].get('location',{}).get('line') is None)]
    report={'environment':{'browser':'Chromium','workerProvider':'browser-opaque-origin-blob-worker-v1','rootContainerLaunchFlag':'--no-sandbox (container-only browser launcher setting; not a product setting)'},
      'topLevelAwait':tla,'mappedRuntimeError':mapped,'invalidSyntax':invalid,'checks':[{'id':i,'description':d,'status':'PASS' if ok else 'FAIL'} for i,d,ok in checks],
      'passed':sum(bool(x[2]) for x in checks),'failed':sum(not bool(x[2]) for x in checks),
      'securityBoundary':'Opaque-origin browser Worker with restrictive browser policy; NOT an OS process sandbox and not native Android/desktop isolation.'}
    (ROOT/'docs'/'ROUND12_BROWSER_RUNTIME_RESULTS.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
    return 0 if report['failed']==0 else 1
if __name__=='__main__': raise SystemExit(asyncio.run(main()))
