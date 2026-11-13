import {build} from 'esbuild';
import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'build/ui');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
const entries=['ui/engineBootstrap.js','ui/workbench.js','ui/workbench.css','node_modules/@xterm/xterm/css/xterm.css'];
const result=await build({absWorkingDir:root,entryPoints:entries,bundle:true,format:'esm',platform:'browser',target:['es2022'],outdir:out,entryNames:'[name]-[hash]',assetNames:'[name]-[hash]',metafile:true,write:true,legalComments:'none'});
const assets=[];
for(const f of Object.keys(result.metafile.outputs)){const p=path.join(root,f);const b=await readFile(p);assets.push({file:path.basename(f),bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}
const py=path.join(root,'node_modules/pyodide');
for(const name of ['pyodide.js','pyodide.asm.mjs','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json']){try{const src=path.join(py,name),dest=path.join(out,name);await copyFile(src,dest);const b=await readFile(dest);assets.push({file:name,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}catch{}}
const html=await readFile(path.join(root,'ui/index.html'),'utf8');
const scripts=assets.filter(x=>x.file.endsWith('.js')&&x.file!=='pyodide.js').map(x=>`<script type="module" src="./${x.file}"></script>`).join('\n');
const css=assets.filter(x=>x.file.endsWith('.css'));
let clean=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace(/<script type="module" src="\.\/engineBootstrap\.js"><\/script>\s*/,'').replace(/<script type="module" src="\.\/workbench\.js"><\/script>/,'');
clean=clean.replace(/<link rel="stylesheet" href="\.\/workbench\.css">/,'').replace(/<link rel="stylesheet" href="\.\.\/node_modules\/@xterm\/xterm\/css\/xterm\.css">/,'');
clean=clean.replace('</head>',`${css.map(x=>`<link rel="stylesheet" href="./${x.file}">`).join('\n')}\n</head>`).replace('</body>',`${scripts}\n</body>`);
await writeFile(path.join(out,'index.html'),clean);
const total=assets.reduce((n,a)=>n+a.bytes,0);const report={schemaVersion:1,budgetBytes:16*1024*1024,totalBytes:total,withinBudget:total<=16*1024*1024,assets};
await writeFile(path.join(out,'size-report.json'),JSON.stringify(report,null,2)+'\n');
if(!report.withinBudget)throw new Error(`UI bundle exceeds 16 MiB budget: ${total}`);
console.log(JSON.stringify(report));
