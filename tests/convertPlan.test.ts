import assert from 'node:assert/strict';
import { planImageConversion, planBatchNames, supportedInputs, supportedOutputs } from '../src/tools/engines/images/convertPlan';
const base = { name: 'photo.png', width: 4000, height: 2000, mime: 'image/png', toFormat: 'jpg' as const, hasAlpha: true };
const p: any = planImageConversion(base); assert.equal(p.outputName, 'photo.jpg'); assert.equal(p.outputMime, 'image/jpeg'); assert.equal(p.width, 4000); assert.equal(p.height, 2000); assert.equal(p.background, 'white'); assert.equal(p.quality, 0.92);
const scaled: any = planImageConversion({ ...base, name: 'photo.png', toFormat: 'webp', maxSide: 1000, quality: 5 }); assert.equal(scaled.width, 1000); assert.equal(scaled.height, 500); assert.equal(scaled.quality, 1);
assert.equal((planImageConversion({ ...base, name: 'photo.jpg' }) as any).outputName, 'photo-converted.jpg'); assert.equal((planImageConversion({ ...base, name: '.hidden' }) as any).outputName, '.hidden.jpg'); assert.equal((planImageConversion({ ...base, name: '無題📷' }) as any).outputName, '無題📷.jpg'); assert.equal((planImageConversion({ ...base, toFormat: 'png' }) as any).quality, null); assert.equal((planImageConversion({ ...base, toFormat: 'gif' as any }) as any).error, 'unsupported-format');
for (const n of [0, -1, NaN, Infinity, 1.2, Number.MAX_SAFE_INTEGER]) assert.ok((planImageConversion({ ...base, width: n }) as any).ok === false); assert.equal((planImageConversion({ ...base, width: 5000, height: 5000 }) as any).error, 'too-large'); assert.equal((planImageConversion({ ...base, maxSide: 0 }) as any).error, 'invalid-input'); assert.equal((planImageConversion({ ...base, quality: NaN }) as any).error, 'invalid-input'); assert.equal((planImageConversion({ ...base, mime: 'application/pdf' }) as any).error, 'unsupported-format');
const batch: any = planBatchNames(['a.png', 'a.png', 'A.PNG', 'résumé.webp', 'résumé.webp']); assert.equal(batch.ok, true); assert.equal(new Set(batch.names.map((n: string) => n.normalize('NFC').toLowerCase())).size, batch.names.length); assert.equal(planBatchNames(['']).ok, false); assert.ok(supportedInputs.includes('image/svg+xml')); assert.deepEqual(supportedOutputs, ['png', 'jpg', 'webp']); 
// Director additions (expected values worked out by hand from the rules in the job text).
{
  const b = { name: 'photo.png', width: 4000, height: 3000, mime: 'image/png', toFormat: 'jpg' as const };
  const bg = (o: object) => { const r = planImageConversion({ ...b, ...o } as any); return r.ok ? r.background : r.error; };
  assert.equal(bg({ hasAlpha: true }), 'white'); assert.equal(bg({}), 'white'); assert.equal(bg({ hasAlpha: false }), 'transparent'); assert.equal(bg({ toFormat: 'png' }), 'transparent'); assert.equal(bg({ toFormat: 'webp' }), 'transparent');
  const svg = (o: object) => planImageConversion({ name: 'l.svg', width: 100, height: 50, mime: 'image/svg+xml', toFormat: 'png', ...o } as any);
  const s1 = svg({ svgWidth: 800 }); assert.equal(s1.ok && s1.width, 800); assert.equal(s1.ok && s1.height, 400);
  const s2 = svg({ svgWidth: 800, maxSide: 400 }); assert.equal(s2.ok && s2.width, 400); assert.equal(s2.ok && s2.height, 200);
  const s3 = svg({ svgWidth: 0.2 }); assert.equal(s3.ok && s3.width, 1); assert.equal(s3.ok && s3.height, 1);
  assert.equal(svg({ svgWidth: 16000 }).ok, false); assert.equal((svg({ svgWidth: 16000 }) as any).error, 'too-large');
  assert.equal((planImageConversion({ ...b, width: 24_000_000, height: 1 }) as any).error, 'too-large');
  const ok = planImageConversion({ ...b, width: 24_000_000, height: 1, maxSide: 1000 }); assert.equal(ok.ok && ok.width, 1000); assert.equal(ok.ok && ok.height, 1);
  assert.equal(planImageConversion({ ...b, width: 16384, height: 1000 }).ok, true); assert.equal(planImageConversion({ ...b, width: 16385, height: 1000 }).ok, false);
  const n = planImageConversion({ ...b, name: 'a\nb\u0000c.png' }); assert.equal(n.ok && n.outputName, 'a_b_c.jpg');
}
console.log('convertPlan: PASS (dimensions, naming, format, quality and hostile inputs)');
