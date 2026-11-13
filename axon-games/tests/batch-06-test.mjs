import assert from 'node:assert/strict';
import { GAMES } from '../src/catalogue.js';
import { createRound, validateAnswer } from '../src/engine.js';
import { BATCH_SIX_TIER_PROFILES } from '../src/progression/batch-six-tiers.js';
const batch=GAMES.slice(125,150);assert.equal(batch.length,25);assert.equal(new Set(batch.map(g=>g.id)).size,25);
for(const game of batch){const profile=BATCH_SIX_TIER_PROFILES[game.id];assert.ok(profile,game.id);assert.equal(profile.tiers.length,15);for(let tier=1;tier<=15;tier++)for(let level=1;level<=profile.tiers[tier-1].levels;level++)for(let repeat=0;repeat<30;repeat++){const r=createRound(game,tier,{level});assert.equal(r.title,game.name);assert.equal(r.tier,tier);assert.equal(r.level,level);assert.equal(r.levelsInTier,profile.tiers[tier-1].levels);assert.ok(r.rule&&r.steps?.length>=2,game.id+' teaching');if(r.kind==='mastermind'){assert.equal(r.code.length,4);assert.ok(r.code.every(x=>Number.isInteger(x)&&x>=0&&x<=9));assert.ok(r.steps.length>=3);}else{assert.equal(validateAnswer(r,r.answer),true,game.id+' answer '+JSON.stringify(r));assert.equal(validateAnswer(r,'__wrong_answer__'),false,game.id+' wrong accepted');}if(r.kind==='choice')assert.ok(r.choices.includes(r.answer));}}
console.log('PASS: Batch 06 — 25 games × 15 tiers × every configured level × 30 randomized rounds.');
console.log('PASS: correct/wrong validation, teaching metadata, choice integrity.');
