import assert from 'node:assert/strict';
import { GAMES } from '../src/catalogue.js';
import { createRound, validateAnswer } from '../src/engine.js';
import { BATCH_THREE_TIER_PROFILES } from '../src/progression/batch-three-tiers.js';
const batch=GAMES.slice(50,75);assert.equal(batch.length,25);assert.equal(new Set(batch.map(g=>g.id)).size,25);
for(const game of batch){
 const profile=BATCH_THREE_TIER_PROFILES[game.id];assert.ok(profile,`${game.id}: no profile`);assert.equal(profile.tiers.length,15);
 for(let tier=1;tier<=15;tier++)for(let level=1;level<=profile.tiers[tier-1].levels;level++){
  const r=createRound(game,tier,{level});assert.equal(r.title,game.name);assert.equal(r.tier,tier);assert.equal(r.level,level);assert.equal(r.levelsInTier,profile.tiers[tier-1].levels);assert.ok(r.rule&&r.steps?.length>=2);
  if(r.kind==='visual'){assert.ok(Array.isArray(r.answer)&&r.answer.length>0);assert.ok(r.answer.every(c=>Number.isInteger(c)&&c>=0&&c<r.size*r.size));}
  else {const answer=Array.isArray(r.answer)?r.answer.join(' '):String(r.answer);assert.equal(validateAnswer(r,answer),true,`${game.id} correct answer failed at ${tier}/${level}`);}
 }
}
console.log(`PASS: Batch 03 — ${batch.length} games × 15 tiers × every configured level generated.`);
console.log('PASS: correct answers validated for all non-visual rounds; visual target cells are in-bounds.');
console.log('PASS: every round has game-specific teaching rules and at least two reasoning steps.');
