import { strict as a } from 'node:assert';
import { inspectBytes, hexDump, describeSize } from '../src/tools/engines/files/inspect';
let checks=0;const eq=(x:unknown,y:unknown)=>{a.equal(x,y);checks++};
const inspect=(name:string,bytes:number[])=>inspectBytes({name,size:bytes.length,head:new Uint8Array(bytes)});
const samples:[string,number[],string][]=[
['x.png',[137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,2],'png'],
['x.jpg',[255,216,255],'jpeg'],['x.gif',[71,73,70,56,57,97,1,0,2,0],'gif'],['x.bmp',[66,77,...Array(24).fill(0)],'bmp'],
['x.pdf',[37,80,68,70,45],'pdf'],['x.zip',[80,75,3,4],'zip'],['x.gz',[31,139],'gzip'],['x.mp3',[73,68,51],'mp3'],
['x.ogg',[79,103,103,83],'ogg'],['x.flac',[102,76,97,67],'flac'],['x.db',[83,81,76,105,116,101,32,102,111,114,109,97,116,32,51,0],'sqlite'],
['x.exe',[77,90],'exe'],['x.class',[202,254,186,190],'java-class'],['x.elf',[127,69,76,70],'elf'],['x.txt',[104,105],'text'],
['x.ico',[0,0,1,0],'ico'],['x.tif',[73,73,42,0],'tiff'],['x.wav',[82,73,70,70,0,0,0,0,87,65,86,69],'wav'],
['x.7z',[55,122,188,175,39,28],'7z'],['x.rar',[82,97,114,33,26,7,0],'rar'],['x.tar',[...Array(257).fill(0),117,115,116,97,114],'tar'],
['x.mp4',[0,0,0,24,102,116,121,112,105,115,111,109],'mp4'],['x.apk',[80,75,3,4],'apk'],['x.docx',[80,75,3,4],'docx'],['x.xlsx',[80,75,3,4],'xlsx'],['x.pptx',[80,75,3,4],'pptx'],['x.jar',[80,75,3,4],'jar']
];
for(const [name,b,t] of samples){const r=inspect(name,b);eq(r.ok,true);if(r.ok)eq(r.type,t);}
const png=inspect('x.png',[137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,2]);if(png.ok){eq(png.dimensions?.width,1);eq(png.dimensions?.height,2);}
eq(inspectBytes({name:'x',size:0,head:new Uint8Array()}).ok,true);
eq(inspectBytes({name:'x',size:-1,head:new Uint8Array()}).ok,false);
eq(inspectBytes({name:'x',size:1,head:new Uint8Array(4097)}).ok,false);
eq(hexDump(new Uint8Array([65,0,66]),0,3),'00000000  41 00 42                                         A.B');
eq(describeSize(1572864).startsWith('1.5 MB (1,572,864 bytes'),true);
let seed=42;for(let i=0;i<300;i++){seed=(seed*1664525+1013904223)>>>0;const n=seed%512;const b=new Uint8Array(n);for(let j=0;j<n;j++){seed=(seed*1664525+1013904223)>>>0;b[j]=seed&255;}const r=inspectBytes({name:'random.bin',size:n,head:b});a.equal(typeof r.ok,'boolean');checks++;}
// Director additions: bytes taken from files written by Pillow (independent writer; the `file` command reports 37 x 21 for the webp).
{const hex='524946464c0000005745425056503820400000005003009d012a250015003e6d3697';const w=hex.match(/../g)!.map(x=>parseInt(x,16));const r:any=inspect('lossy.webp',w);eq(r.type,'webp');eq(r.dimensions.width,37);eq(r.dimensions.height,21);}
{const r:any=inspect('u16.txt',[0xff,0xfe,0x68,0,0x69,0,0x20,0,0x74,0,0x68,0,0x65,0,0x72,0,0x65,0]);eq(r.type,'text');eq(r.textDetection.encoding,'UTF-16 LE');}
{const r:any=inspect('t.mp3',[0xff,0xfb,0x90,0x00,0xff,0xfb,0x90,0x00]);eq(r.type,'mp3');}
{const r:any=inspect('x.bin',[0xff,0xfe,0x41,0x00]);eq(r.type==='mp3',false);}

console.log(`fileInspect.test.ts PASS ${checks} checks; magic-number fixtures constructed byte-by-byte from documented signatures.`);
