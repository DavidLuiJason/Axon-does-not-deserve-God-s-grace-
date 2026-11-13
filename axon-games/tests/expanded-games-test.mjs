import assert from 'node:assert/strict';
import { GAMES } from '../src/catalogue.js';
import { createExpandedRound, EXPANDED_IDS } from '../src/games/expanded-games.js';
import { validateAnswer } from '../src/engine.js';
assert.equal(EXPANDED_IDS.length,18);
for(const id of EXPANDED_IDS){
 const game=GAMES.find(g=>g.id===id);assert.ok(game,`catalogue missing ${id}`);
 for(let tier=1;tier<=15;tier++)for(let level=1;level<=3;level++){
  const r=createExpandedRound(game,tier,level);assert.ok(r,`${id} no round`);assert.equal(r.tier,tier);assert.equal(r.level,level);assert.ok(r.prompt);assert.ok(r.rule);assert.ok(Array.isArray(r.steps)&&r.steps.length>=2);
  if(r.kind==='imagine'){assert.ok(r.visual.count>=100&&r.visual.count<=2500);continue;}
  if(r.kind==='choice'){assert.ok(r.choices.includes(r.answer));assert.equal(validateAnswer(r,r.answer),true);assert.equal(validateAnswer(r,'__deliberately_wrong__'),false);}
  else {assert.equal(validateAnswer(r,r.answer),true,`${id} tier ${tier} level ${level} answer`);assert.equal(validateAnswer(r,'__deliberately_wrong__'),false,`${id} accepted wrong answer`);}
 }
}
const word=GAMES.find(g=>g.id==='scrambled-words');for(let i=0;i<100;i++){const r=createExpandedRound(word,1+(i%15),1+(i%3));assert.equal(validateAnswer(r,r.answer),true);}
console.log(`PASS: ${EXPANDED_IDS.length} new games × 15 tiers × 3 levels; answer validation, teaching metadata, and Imagine visual-field bounds checked.`);
