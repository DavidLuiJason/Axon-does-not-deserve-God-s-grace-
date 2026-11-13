import { random } from "./random.js";
import { createExpandedRound } from './games/expanded-games.js';
import { createDepthRound } from './games/depth.js';
import { createNumberMemoryRound } from './games/number-memory.js';
import { getTierProfile } from './progression/difficulty.js';
import { GAME_TIER_PROFILES } from './progression/game-tiers.js';
import { GAMES } from './catalogue.js';
import { createBatchTwoMemoryRound, createStrategyChallenge } from './games/batch-two.js';
import { BATCH_TWO_TIER_PROFILES } from './progression/batch-two-tiers.js';
import { createBatchThreeRound } from './games/batch-three.js';
import { BATCH_THREE_TIER_PROFILES } from './progression/batch-three-tiers.js';
import { createBatchFourRound } from './games/batch-four.js';
import { BATCH_FOUR_TIER_PROFILES } from './progression/batch-four-tiers.js';
import { createBatchFiveRound } from './games/batch-five.js';
import { BATCH_FIVE_TIER_PROFILES } from './progression/batch-five-tiers.js';
import { createBatchSixRound } from './games/batch-six.js';
import { BATCH_SIX_TIER_PROFILES } from './progression/batch-six-tiers.js';
const pick=a=>a[Math.floor(random()*a.length)], int=(a,b)=>Math.floor(random()*(b-a+1))+a;
const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;};
const words=['planet','garden','window','silver','puzzle','bridge','forest','candle','rocket','harbor','orange','velvet','signal','marble','castle','little','bright','stream','pencil','camera'];
const primes=[2,3,5,7,11,13,17,19,23,29,31,37];
export function createRound(game,difficulty='Normal',settings={}){
 const tier=Number.isInteger(Number(difficulty))?Math.max(1,Math.min(15,Number(difficulty))):({Easy:2,Normal:5,Hard:9,Expert:13}[difficulty]??5);
 const level=tier-1, n=4+Math.floor(level*10/14), id=game.id, name=game.name, engine=game.engine;
 const profiles={...GAME_TIER_PROFILES,...BATCH_TWO_TIER_PROFILES,...BATCH_THREE_TIER_PROFILES,...BATCH_FOUR_TIER_PROFILES,...BATCH_FIVE_TIER_PROFILES,...BATCH_SIX_TIER_PROFILES};
 const tierProfile=profiles[id]?getTierProfile(id,tier,profiles):null;
 const levelCount=tierProfile?.levels||3, selectedLevel=Math.max(1,Math.min(levelCount,Number(settings.level)||1));
 const depth=createDepthRound(game,tier,selectedLevel,levelCount); if(depth) return depth;
 const expanded=createExpandedRound(game,tier,selectedLevel); if(expanded) return expanded;
 const bespoke=createNumberMemoryRound(game,tier,selectedLevel,levelCount); if(bespoke) return bespoke;
 const batchTwoMemory=createBatchTwoMemoryRound(game,tier,selectedLevel,levelCount); if(batchTwoMemory) return batchTwoMemory;
 const batchThree=createBatchThreeRound(game,tier,selectedLevel,levelCount); if(batchThree) return batchThree;
 const batchFour=createBatchFourRound(game,tier,selectedLevel,levelCount); if(batchFour) return batchFour;
 const batchFive=createBatchFiveRound(game,tier,selectedLevel,levelCount); if(batchFive) return batchFive;
 const batchSix=createBatchSixRound(game,tier,selectedLevel,levelCount); if(batchSix) return batchSix;
 const strategyChallenge=createStrategyChallenge(game,tier,selectedLevel,levelCount); if(strategyChallenge) return strategyChallenge;
 if(id==='find-the-loophole'){
  const topics=[
   {topic:'Logic & language',prompt:'A sign says: “Every visitor must sign the register before entering.” A visitor enters through an emergency exit without signing. What is the loophole?',answer:'emergency exit',rule:'The instruction does not explicitly cover every entrance or prohibit entry through an emergency exit.',steps:['Identify the universal requirement.','Check whether all entry routes are covered.','The emergency exit is an uncovered route.'],fix:'Require sign-in at every normal entrance and define emergency exceptions.'},
   {topic:'Mathematics',prompt:'A rule says: “Divide a number by x, where x is any real number.” What restriction is missing?',answer:'x cannot be zero',rule:'Division by zero is undefined.',steps:['Division requires a multiplicative reciprocal.','Zero has no reciprocal.','Therefore x must not equal zero.'],fix:'State x ≠ 0.'},
   {topic:'Science',prompt:'A treatment group is much older than the untreated control group. What loophole weakens the experiment?',answer:'age is a confounding variable',rule:'The outcome difference may be caused by age rather than treatment.',steps:['Compare the groups.','Identify other variables that could affect the outcome.','Age is a confounder unless controlled.'],fix:'Randomize or match participants and control relevant variables.'},
   {topic:'Everyday rules',prompt:'A kitchen rule says: “Clean your dishes after use.” Someone leaves a pan soaking and claims it is not dirty yet. What wording gap exists?',answer:'clean is undefined and no deadline is specified',rule:'The rule does not define completion or a deadline.',steps:['Find vague terms.','Find missing timing requirements.','“Clean” and “after use” permit disputes.'],fix:'Define clean and require completion immediately after use.'},
   {topic:'Games & puzzles',prompt:'A game says: “Move one piece to an empty square.” It never says the destination must remain on the board. What is missing?',answer:'the board boundary is not enforced',rule:'The legal-move definition omits board boundaries.',steps:['List the stated move constraints.','Check whether edges are included.','An off-board destination is not explicitly prohibited.'],fix:'Require destination squares to be inside the board.'},
   {topic:'Programming',prompt:'A program grants access when age is greater than 18. It does not validate the input type or plausible range. What validation gap exists?',answer:'input type and valid range are not checked',rule:'A single comparison does not establish that the input is a valid age.',steps:['Check the input type.','Check the accepted range.','Reject malformed or implausible values before authorization.'],fix:'Validate type and plausible range before applying the age rule.'},
   {topic:'Business & processes',prompt:'A refund policy says: “Refunds are available within 30 days of purchase.” It does not define whether the purchase day counts. What is ambiguous?',answer:'the start date counting rule is ambiguous',rule:'“Within 30 days” leaves the counting convention unspecified.',steps:['Identify the time window.','Check whether start and end are precise.','Different conventions can change eligibility.'],fix:'Specify the purchase timestamp, timezone, and exact cutoff.'},
   {topic:'Probability & statistics',prompt:'A report says 90% of app users were satisfied but does not explain how respondents were selected. What is the loophole?',answer:'selection bias',rule:'A nonrepresentative sample may not reflect all customers.',steps:['Ask who was included.','Ask who was excluded or did not respond.','A biased sample can distort the percentage.'],fix:'Report sampling method, response rate, and uncertainty.'},
   {topic:'Ethics & decisions',prompt:'A team rule says: “Always prioritize the customer.” Two customers make incompatible requests and resources allow only one. What gap exists?',answer:'there is no conflict resolution rule',rule:'A priority principle without a tie-breaker cannot resolve conflicting cases.',steps:['Identify competing obligations.','Check whether the rule ranks them.','No procedure resolves the conflict.'],fix:'Define fair priority criteria and an escalation process.'},
   {topic:'Visual & spatial reasoning',prompt:'A rectangular room diagram labels the north, south, and east walls but omits the west wall while claiming to show every wall. What is missing?',answer:'the west wall is missing',rule:'The completeness claim conflicts with an omitted boundary.',steps:['Count the expected boundaries.','Compare each expected side with the diagram.','The west side is the missing element.'],fix:'Show and label all four walls.'}
  ];
  const item=topics.find(x=>x.topic===settings.loopholeTopic)||topics[Math.floor(random()*topics.length)];
  const wrong=shuffle(topics.filter(x=>x!==item).map(x=>x.answer)).slice(0,3);return {kind:'choice',title:name,topic:item.topic,prompt:`Topic: ${item.topic}. ${item.prompt}`,question:'Which option names the loophole?',answer:item.answer,choices:shuffle([item.answer,...wrong]),rule:item.rule,steps:item.steps,alternative:item.fix,tier};
 }
  if(id==='tic-tac-toe'||name==='Tic-Tac-Toe Master') return {kind:'ttt',prompt:'You are X. Tap a square. The computer responds with O.',board:Array(9).fill(''),title:name};
 if(id==='mastermind-mini'||name==='Mastermind') return {kind:'mastermind',prompt:'Guess the four-digit code. Feedback reports exact positions and correct digits in wrong positions.',code:Array.from({length:4},()=>int(0,9)),guesses:[],title:name};
 if(engine==='memory'){
   let seq=Array.from({length:n},()=>int(0,9));
   if(/Never Called/i.test(name)){let answer=Array.from({length:10},(_,i)=>i).filter(x=>!seq.includes(x));return {kind:'set-memory',prompt:'Memorize the called digits. Then select every digit that never appeared.',seq,choices:Array.from({length:10},(_,i)=>i),answer,title:name,tier,level,rule:'Select exactly the digits absent from the called sequence; each digit is considered once.',steps:['Scan the called sequence from left to right.','Mark every distinct digit that appears.','Select all digits from 0 to 9 that were never marked.']};}
   if(/Called but Missing/i.test(name)){let missing=seq.filter((_,i)=>i%2===0);return {kind:'set-memory',prompt:'Memorize the called sequence. Then identify values that were called but omitted from the second list.',seq,shown:seq.filter(x=>!missing.includes(x)),choices:[...new Set([...seq,...Array.from({length:10},(_,i)=>i).filter(x=>!seq.includes(x))])].sort((a,b)=>a-b),answer:[...new Set(missing)],title:name,tier,level,rule:'Compare the original called sequence with the second list and select every distinct value that was called but omitted.',steps:['Memorize the called values.','Compare the second list against the original values.','Select each distinct called value that does not appear in the second list.']};}
   let mode=/Reverse/i.test(name)?'reverse':/First and Last/i.test(name)?'ends':/position/i.test(name)?'position':/frequency/i.test(name)?'frequency':/sort|rearrange/i.test(name)?'sort':'recall';
   let position=int(0,seq.length-1);let target=seq[position];return {kind:'memory',prompt:mode==='reverse'?'Memorize the digits, then enter them in reverse order.':mode==='ends'?'Memorize the digits, then enter the first and last digit.':mode==='position'?'Memorize the digits, then answer the position question.':mode==='frequency'?'Memorize the digits, then count how many times the target digit appears.':mode==='sort'?'Memorize the digits, then enter them in ascending order.':'Memorize the digits, then reproduce them in order.',seq,mode,target,answer:mode==='reverse'?[...seq].reverse().join(''):mode==='ends'?[seq[0],seq.at(-1)].join(' '):mode==='position'?seq[position]:mode==='frequency'?seq.filter(x=>x===target).length:mode==='sort'?[...seq].sort((a,b)=>a-b).join(' '):seq.join(''),position,title:name,delay:[3200,2400,1700,1100][level]};
 }
 if(engine==='math'){
  let a=int(5,18+level*15),b=int(2,10+level*8),op=pick(['+','−','×']); if(op==='−'&&b>a)[a,b]=[b,a];
  let answer=op==='+'?a+b:op==='−'?a-b:a*b;
  if(/prime factor/i.test(name)){a=pick([12,18,24,30,42,60]);answer=primes.filter(p=>a%p===0).join(' ');return {kind:'text',prompt:`Enter the distinct prime factors of ${a}, separated by spaces.`,answer,title:name};}
  if(/greatest common/i.test(name)){a=int(2,20);b=int(2,20);answer=gcd(a,b);return {kind:'input',prompt:`Find the greatest common divisor of ${a} and ${b}.`,question:`GCD(${a}, ${b}) = ?`,answer,title:name};}
  if(/least common/i.test(name)){a=int(2,12);b=int(2,12);answer=a*b/gcd(a,b);return {kind:'input',prompt:`Find the least common multiple of ${a} and ${b}.`,question:`LCM(${a}, ${b}) = ?`,answer,title:name};}
  if(/percentage/i.test(name)){a=pick([10,20,25,40,50,75]);b=int(2,20)*5;return {kind:'input',prompt:`Calculate ${a}% of ${b}.`,question:`${a}% × ${b} = ?`,answer:a*b/100,title:name};}
  if(/fraction/i.test(name)){a=int(1,8);b=int(2,9);let c=int(1,8),d=int(2,9);return {kind:'input',prompt:'Compare the fractions and enter 1 if the first is larger, 0 if equal, or -1 if the second is larger.',question:`${a}/${b} compared with ${c}/${d}`,answer:Math.sign(a/b-c/d),title:name};}
  return {kind:'input',prompt:`${name}: calculate accurately.`,question:`${a} ${op} ${b} = ?`,answer,title:name};
 }
 if(engine==='abstract'||/Pattern|Sequence|Pyramid|Matrix/i.test(name)) {let start=int(1,18),step=int(2,8),seq=[start,start+step,start+2*step,start+3*step];return {kind:'input',prompt:`${name}: identify the rule and complete the sequence.`,question:seq.join(' · ')+' · ?',answer:start+4*step,title:name};}
 if(engine==='visual') {let size=level<2?3:4, total=size*size, count=level+3, cells=[];while(cells.length<count){let x=int(0,total-1);if(!cells.includes(x))cells.push(x)}return {kind:'visual',prompt:`Remember the highlighted cells. After they disappear, tap the same cells. Grid ${size}×${size}.`,size,cells,title:name,delay:[2800,2200,1700,1300][level]};}
 if(engine==='language') {let w=pick(words), scrambled=w.split('').sort(()=>random()-.5).join('');while(scrambled===w)scrambled=w.split('').sort(()=>random()-.5).join('');return {kind:'text',prompt:/Reverse Spelling/i.test(name)?`Spell this word backwards: ${w}`:/Letter Count/i.test(name)?`How many letters are in “${w}”?`:`Unscramble the letters to make a word: ${scrambled}`,answer:/Reverse Spelling/i.test(name)?w.split('').reverse().join(''):/Letter Count/i.test(name)?String(w.length):w,title:name};}
 if(engine==='attention') {let target=pick(['●','▲','■','◆']), seq=Array.from({length:12+level*6},()=>pick(['●','▲','■','◆']));seq[int(0,seq.length-1)]=target;return {kind:'input',prompt:`Scan the symbol row and count exact occurrences of ${target}.`,question:seq.join('  '),answer:seq.filter(x=>x===target).length,title:name,tier,level,rule:'Count only exact matches to the target symbol; ignore every other symbol.',steps:['Identify the target symbol before scanning.','Move through the row once from left to right.','Count each exact target occurrence and verify the total.']};}
 if(engine==='spatial') {let size=4+level, path=Array.from({length:3+level},()=>pick(['N','S','E','W']));let x=0,y=0;for(const p of path){if(p==='N')y--;if(p==='S')y++;if(p==='E')x++;if(p==='W')x--;}return {kind:'input',prompt:'Track the movement from (0,0). Enter the final x-coordinate.',question:`Moves: ${path.join(' → ')}`,answer:x,title:name};}
 if(engine==='strategy') {let heaps=[int(1,5),int(1,5),int(1,5)], nim=heaps.reduce((a,b)=>a^b,0);let winning=nim?heaps.findIndex(h=>(h^nim)<h):-1;return {kind:'strategy',prompt:`Nim challenge: three heaps contain ${heaps.join(', ')} tokens. Remove one or more tokens from exactly one heap. Which heap should you play to leave a zero nim-sum?`,heaps,answer:winning,title:name};}
 if(engine==='logic') {let a=int(1,3),b=int(1,9),c=int(1,9);let type=int(0,2);if(type===0)return {kind:'choice',prompt:`${name}: If all Zorbs are Mips, and all Mips are Lums, must all Zorbs be Lums?`,choices:['Yes','No','Cannot determine'],answer:'Yes',title:name,explanation:'The relation is transitive.'};if(type===1)return {kind:'input',prompt:`${name}: A lock code has three digits. The first is ${a}, the second is one more than the first, and the third is twice the second. Enter the code as three digits.`,question:'Code = ?',answer:`${a}${a+1}${2*(a+1)}`,title:name};return {kind:'choice',prompt:`${name}: Exactly one statement is true. A says “B is lying.” B says “C is lying.” C says “A and B are both lying.” Who is telling the truth?`,choices:['A only','B only','C only'],answer:'B only',title:name,explanation:'If B is truthful, C is lying and A is lying, so exactly one statement is true.'};}
 {const p=int(3,12),q=int(4,15);return {kind:'input',prompt:`${name}: solve the challenge and enter the numerical result.`,question:`${p} + ${q} = ?`,answer:p+q,title:name};}
}
function gcd(a,b){while(b){[a,b]=[b,a%b]}return a}
const norm=x=>String(x??'').normalize('NFKC').replace(/[−–]/g,'-').trim().toLowerCase().replace(/\s+/g,' ');
const mathNorm=x=>norm(x).replace(/\s+/g,'').replace(/[x*·]/g,'×');
const isNum=x=>/^[+-]?(\d+\.?\d*|\.\d+)$/.test(norm(x));
const sameText=(a,b)=>{const A=norm(a),B=norm(b);if(A===B)return true;if(isNum(A)&&isNum(B))return Math.abs(Number(A)-Number(B))<1e-9;return mathNorm(A)===mathNorm(B);};
export function validateAnswer(round,raw){
 const v=String(raw).trim();
 if(round.sumTarget!==undefined){const m=/^(\d+)\s*\+\s*(\d+)$/.exec(v);return !!m&&Number(m[1])>0&&Number(m[2])>0&&Number(m[1])+Number(m[2])===round.sumTarget;}
 if(round.mode==='set'||round.kind==='set-memory'){const got=v.split(/[ ,]+/).filter(Boolean).map(Number).sort((a,b)=>a-b),want=[...round.answer].sort((a,b)=>a-b);return got.length===want.length&&got.every((x,i)=>x===want[i]);}
 const wants=[round.answer,...(Array.isArray(round.acceptedAnswers)?round.acceptedAnswers:[])];
 if(round.kind==='memory'){
  if(['position','frequency','input'].includes(round.mode)){const flat=x=>norm(x).replace(/[\s,·]+/g,'');return wants.some(w=>sameText(v,w)||flat(v)===flat(w));}
  return v.replace(/[^0-9]/g,'')===String(round.answer).replace(/[^0-9]/g,'');
 }
 if(round.kind==='text'||round.kind==='input')return wants.some(w=>sameText(v,w));
 if(round.kind==='choice'){const ok=Array.isArray(round.accepted)?round.accepted:[round.answer];return ok.some(w=>norm(v)===norm(w));}
 if(round.kind==='strategy')return wants.some(w=>Number(v)===Number(w));
 return false;
}
