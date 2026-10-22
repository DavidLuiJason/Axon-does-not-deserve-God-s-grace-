import assert from 'node:assert/strict';
import { summarizeText } from '../src/tools/engines/text/summarize';
const cn=[
'公园里的孩子正在玩耍。',
'公园附近有很多花。',
'今天我们一起去公园。',
'公园里的人们很开心。',
'我喜欢在公园散步。',
'海边的风景非常美丽。',
'山上的天气十分凉爽。',
'学校今天举办活动。',
'朋友正在准备晚餐。',
'城市夜晚灯光明亮。',
'音乐让大家感到快乐。',
'书店里面有很多书。'
].join('\n');
const r=summarizeText(cn,{sentences:3});assert.equal(r.ok,true);if(r.ok){assert.ok(r.keywords[0]==='公园' || r.keywords[0]==='园里' || r.keywords[0]==='在公' || r.keywords[0]==='公园里' || r.keywords[0]==='公园附' || r.keywords[0]==='公园里');assert.ok(r.sentences.filter(s=>s.text.includes('公园')).length>=2);assert.ok(r.warnings.includes('Sentence choice for this script is approximate: it is based on repeated character pairs.'));assert.ok(!r.warnings.includes('This text does not look like English, so the result may be poor.'));}
const ja=['公園で子供たちが遊んでいる。','スーパーで買い物をする。','今日は公園へ行きます。','スーパーで買い物をする。','スーパーで買い物をする。','公園の近くに花が咲く。','公園では人々が楽しむ。','スーパーで買い物をする。','私は公園を散歩する。','海辺の景色は美しい。','山の天気は涼しい。','学校でイベントがある。','友達が夕食を作る。','都市の夜景が輝く。','音楽が人を元気にする。','本屋に本がたくさんある。'].join('\n');
const j=summarizeText(ja,{sentences:3});assert.equal(j.ok,true);if(j.ok){assert.ok(j.keywords.some(w=>w.includes('公')&&w.includes('園')));assert.ok(j.keywords.includes('スー'));assert.ok(j.sentences.filter(s=>s.text.includes('公園')).length>=2);}
const mixed=summarizeText('Apple发布了新手机。苹果公司展示了新功能。Apple发布了新手机。',{sentences:2});assert.equal(mixed.ok,true);if(mixed.ok){assert.ok(mixed.keywords.includes('apple'));assert.ok(mixed.keywords.includes('发布'));}
const astral=summarizeText('𠀀公园很大。𠀀公园很美。Emoji 😀 stays whole.');assert.equal(astral.ok,true);if(astral.ok)assert.ok(astral.keywords.some(w=>w.includes('𠀀')));
assert.equal(summarizeText('汉',{sentences:1}).ok,true);const units=summarizeText('公园。公园。',{sentences:2});assert.equal(units.ok,true);if(units.ok){assert.equal(units.stats.wordsIn,4);assert.equal(units.stats.wordsOut,4);}
for(const text of ['ไทยไม่มีช่องว่างภาษาไทย','ພາສາລາວທดสอบ','ភាសាខ្មែរមិនមានចន្លោះ','မြန်မာစာစမ်းသပ်မှု'])assert.equal(summarizeText(text,{sentences:1}).ok,true);
const sentence='公园里的孩子正在快乐地玩耍并且一起学习新的知识和技能。';const huge=Array.from({length:5000},()=>sentence).join('');const start=performance.now();const h=summarizeText(huge,{sentences:3});assert.equal(h.ok,true);assert.ok(performance.now()-start<1000);
assert.equal(summarizeText('😀 אבג العربية',{sentences:0}).ok,false);
console.log('summarize CJK tests passed');
