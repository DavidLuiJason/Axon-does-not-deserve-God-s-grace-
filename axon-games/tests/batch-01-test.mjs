import assert from 'node:assert/strict';
import { GAMES } from '../src/catalogue.js';
import { createRound, validateAnswer } from '../src/engine.js';
import { GAME_TIER_PROFILES } from '../src/progression/game-tiers.js';
const batch=GAMES.slice(0,25);
assert.equal(batch.length,25);
assert.equal(new Set(batch.map(g=>g.id)).size,25);
const signatures=new Set();
for(const game of batch){
 const profile=GAME_TIER_PROFILES[game.id];
 assert.ok(profile && profile.tiers.length===15,`${game.id}: missing 15 tiers`);
 for(let tier=1;tier<=15;tier++){
  const tierProfile=profile.tiers[tier-1];
  for(let level=1;level<=tierProfile.levels;level++){
  const r=createRound(game,tier,{level});
  assert.equal(r.title,game.name,`${game.id} tier ${tier}: title`);
  assert.ok(r.questionText,`${game.id} tier ${tier}: question`);
  assert.ok(r.rule&&r.steps?.length>=2,`${game.id} tier ${tier}: teaching`);
  const answer=Array.isArray(r.answer)?r.answer.join(' '):String(r.answer);
  assert.equal(validateAnswer(r,answer),true,`${game.id} tier ${tier}: known answer rejected (${r.mode})`);
  assert.equal(validateAnswer(r,`definitely-wrong-${tier}`),false,`${game.id} tier ${tier}: wrong answer accepted`);
  assert.equal(r.level,level,`${game.id} tier ${tier}: level selection`);
  assert.equal(r.levelsInTier,tierProfile.levels,`${game.id} tier ${tier}: level count`);
  if(tier===8)signatures.add(`${game.id}:${r.mode}:${r.questionText.split(/[ .?!]/)[0]}`);
  }
 }
}
assert.equal(batch.filter(g=>GAME_TIER_PROFILES[g.id]).length,25);
const loophole=GAMES.find(g=>g.id==='find-the-loophole');
assert.ok(loophole,'Find the Loophole catalogue entry missing');
const topics=['Logic & language','Mathematics','Science','Everyday rules','Games & puzzles','Programming','Business & processes','Probability & statistics','Ethics & decisions','Visual & spatial reasoning'];
for(const topic of topics){const r=createRound(loophole,5,{loopholeTopic:topic});assert.equal(r.topic,topic,`topic selector failed: ${topic}`);assert.ok(r.steps.length>=2&&r.rule&&r.alternative);assert.equal(validateAnswer(r,r.answer),true);}
const maze=GAMES.find(g=>g.id==='maze-master');
assert.ok(maze,'existing Maze Master entry must be preserved');
console.log(`PASS: 25 games × 15 tiers and every configured level generated; all known answers accepted and wrong-answer probes rejected.`);
console.log(`PASS: individual teaching rules and step lists present for every tested round.`);
console.log(`PASS: Find the Loophole topic selector covers all ten topics; Maze Master retained.`);
