type EngineSuccess<T>={readonly ok:true;readonly value:T};
type EngineFailure={readonly ok:false;readonly error:string;readonly message:string};
type EngineResult<T>=EngineSuccess<T>|EngineFailure;
export type FileEntry={readonly path:string;readonly sha256:string;readonly bytes:number};
export type Comparison={readonly missing:readonly string[];readonly extra:readonly string[];readonly different:readonly string[];readonly same:number;readonly identical:boolean};
const fail=(error:string,message:string):EngineResult<never>=>Object.freeze({ok:false,error,message});
const validPath=(p:string):boolean=>p.length>0&&!p.startsWith('/')&&!p.includes('\\')&&!p.split('/').some(s=>s===''||s==='.'||s==='..');
const validEntry=(e:unknown):e is FileEntry=>e!==null&&typeof e==='object'&&typeof (e as FileEntry).path==='string'&&validPath((e as FileEntry).path)&&typeof (e as FileEntry).sha256==='string'&&/^[0-9a-f]{64}$/.test((e as FileEntry).sha256)&&Number.isInteger((e as FileEntry).bytes)&&(e as FileEntry).bytes>=0;
export function compareManifests(before:readonly FileEntry[],after:readonly FileEntry[]):EngineResult<Comparison>{
 if(!Array.isArray(before)||!Array.isArray(after)||before.length>100000||after.length>100000)return fail('bad-manifest','Before and after must be arrays of at most 100000 valid entries.');
 for(let i=0;i<before.length;i++)if(!validEntry(before[i]))return fail('bad-manifest','before list has an invalid entry at index '+i+'.');
 for(let i=0;i<after.length;i++)if(!validEntry(after[i]))return fail('bad-manifest','after list has an invalid entry at index '+i+'.');
 const bm=new Map<string,FileEntry>(),am=new Map<string,FileEntry>();for(const e of before){if(bm.has(e.path))return fail('duplicate-path','before list contains a duplicate path.');bm.set(e.path,e);}for(const e of after){if(am.has(e.path))return fail('duplicate-path','after list contains a duplicate path.');am.set(e.path,e);}
 const missing:string[]=[],extra:string[]=[],different:string[]=[],sameCount={n:0};
 for(const [p,e] of bm){const a=am.get(p);if(!a)missing.push(p);else if(a.sha256!==e.sha256||a.bytes!==e.bytes)different.push(p);else sameCount.n++;}
 for(const p of am.keys())if(!bm.has(p))extra.push(p);
 missing.sort();extra.sort();different.sort();const identical=missing.length===0&&extra.length===0&&different.length===0;
 return Object.freeze({ok:true,value:Object.freeze({missing:Object.freeze(missing),extra:Object.freeze(extra),different:Object.freeze(different),same:sameCount.n,identical})});
}
export function touchedUnder(c:Comparison,prefixes:readonly string[]):EngineResult<readonly string[]>{
 if(c===null||typeof c!=='object'||!Array.isArray(c.missing)||!Array.isArray(c.extra)||!Array.isArray(c.different)||![...c.missing,...c.extra,...c.different].every(x=>typeof x==='string'))return fail('bad-comparison','Comparison must contain three arrays of strings.');
 if(!Array.isArray(prefixes)||prefixes.length<1||prefixes.length>50||!prefixes.every(p=>typeof p==='string'&&p.length>0&&p.endsWith('/')))return fail('bad-prefixes','Prefixes must contain 1 to 50 non-empty strings ending in a slash.');
 const paths=new Set<string>();for(const p of [...c.missing,...c.extra,...c.different])if(prefixes.some(prefix=>p.startsWith(prefix)))paths.add(p);return Object.freeze({ok:true,value:Object.freeze(Array.from(paths).sort())});
}
