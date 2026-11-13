import assert from 'node:assert/strict';
import { GAMES } from '../src/catalogue.js';
import { createRound, validateAnswer } from '../src/engine.js';
import { BATCH_FOUR_TIER_PROFILES } from '../src/progression/batch-four-tiers.js';
const batch=GAMES.slice(75,100);
assert.equal(batch.length,25,'Batch 04 must contain exactly catalogue entries 76–100');
assert.equal(new Set(batch.map(g=>g.id)).size,25,'Game IDs must be unique');
for(const game of batch){
 const profile=BATCH_FOUR_TIER_PROFILES[game.id];assert.ok(profile,`${game.id}: missing tier profile`);assert.equal(profile.tiers.length,15);
 for(let tier=1;tier<=15;tier++)for(let level=1;level<=profile.tiers[tier-1].levels;level++){
  const r=createRound(game,tier,{level});
  assert.equal(r.title,game.name,`${game.id} title`);assert.equal(r.tier,tier);assert.equal(r.level,level);assert.equal(r.levelsInTier,profile.tiers[tier-1].levels);
  assert.ok(r.rule&&r.steps?.length>=2,`${game.id} needs teaching rule and steps`);
  if(r.kind==='choice'){
   assert.ok(r.choices.includes(r.answer),`${game.id} correct answer missing from choices`);
   assert.equal(validateAnswer(r,r.answer),true,`${game.id} correct choice rejected`);
   assert.equal(validateAnswer(r,'__deliberately_wrong_answer__'),false,`${game.id} accepts invalid choice`);
  } else {
   assert.equal(validateAnswer(r,String(r.answer)),true,`${game.id} correct answer rejected at ${tier}/${level}`);
   assert.equal(validateAnswer(r,'__deliberately_wrong_answer__'),false,`${game.id} accepts invalid answer`);
  }
 }
}
console.log(`PASS: Batch 04 — ${batch.length} games × 15 tiers × every configured level generated.`);
console.log('PASS: every generated correct answer accepted and deliberately incorrect answer rejected.');
console.log('PASS: every round includes a game-specific teaching rule and at least two reasoning steps.');
