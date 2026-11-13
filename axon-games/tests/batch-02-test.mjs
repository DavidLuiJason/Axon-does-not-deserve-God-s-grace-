import assert from 'node:assert/strict';
import { GAMES } from '../src/catalogue.js';
import { createRound, validateAnswer } from '../src/engine.js';
import { BATCH_TWO_TIER_PROFILES } from '../src/progression/batch-two-tiers.js';
const batch=GAMES.slice(25,50);
assert.equal(batch.length,25);
assert.equal(new Set(batch.map(g=>g.id)).size,25);
for(const game of batch){
 const profile=BATCH_TWO_TIER_PROFILES[game.id];
 assert.ok(profile,`${game.id}: missing tier profile`);
 assert.equal(profile.tiers.length,15);
 for(let tier=1;tier<=15;tier++){
  const tp=profile.tiers[tier-1];
  for(let level=1;level<=tp.levels;level++){
   const r=createRound(game,tier,{level});
   assert.equal(r.title,game.name,`${game.id} title`);
   assert.ok(r.questionText||r.prompt,`${game.id} question`);
   assert.ok(r.rule&&r.steps?.length>=2,`${game.id} teaching`);
   assert.equal(r.tier,tier,`${game.id} tier`);
   assert.equal(r.level,level,`${game.id} level`);
   assert.equal(r.levelsInTier,tp.levels,`${game.id} level count`);
   const answer=Array.isArray(r.answer)?r.answer.join(' '):String(r.answer);
   assert.equal(validateAnswer(r,answer),true,`${game.id} known answer rejected at ${tier}/${level}`);
   const wrong=r.kind==='choice'?r.choices.find(x=>x!==r.answer):'definitely-wrong-answer';
   assert.equal(validateAnswer(r,wrong),false,`${game.id} wrong answer accepted at ${tier}/${level}`);
  }
 }
}
console.log(`PASS: ${batch.length} games × 15 tiers × every configured level generated.`);
console.log('PASS: every generated correct answer accepted and wrong-answer probe rejected.');
console.log('PASS: every round carries game-specific rules, teaching steps, tier, and level metadata.');
console.log('LIMIT: chess, draughts, Go, and Reversi are rules/position reasoning challenges in this batch, not complete playable board engines.');
