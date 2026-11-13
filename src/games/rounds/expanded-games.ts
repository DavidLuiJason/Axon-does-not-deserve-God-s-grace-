import { random } from "../random";
import type { GameEntry, Round } from '../types';
const pick=<T,>(a:readonly T[]):T=>a[Math.floor(random()*a.length)];
const words=[['planet','space'],['garden','nature'],['window','home'],['silver','materials'],['bridge','structures'],['forest','nature'],['candle','objects'],['rocket','space'],['harbor','geography'],['velvet','materials'],['stream','nature'],['pencil','objects'],['camera','technology'],['thunder','weather'],['journey','travel'],['compass','navigation'],['lantern','objects'],['mountain','geography'],['whisper','language'],['library','places']];
const shuffle=(s:string):string=>s.split('').sort(()=>random()-.5).join('');
const tierSkills=['identify one clear signal','combine two relevant facts','ignore one irrelevant detail','compare competing explanations','track a dependency','handle a missing piece of information','balance two constraints','notice a hidden assumption','compare short- and long-term effects','revise a plan after new evidence','handle several interacting constraints','evaluate uncertainty and source reliability','preserve a fallback under resource pressure','compare multiple valid paths and justify a trade-off','solve the full situation while explaining limits and residual uncertainty'];
const base=(game:GameEntry,tier:number,level:number,kind:string,prompt:string,extra:Record<string,any>={})=>({kind,title:game.name,prompt,questionText:prompt,tierFocus:tierSkills[tier-1],tier,level,levelsInTier:3,rule:extra.rule||'Use the information given; separate evidence from assumptions.',steps:extra.steps||['Read the complete situation.','Identify the constraint or pattern.','Check that your response follows from the available information.'],...extra});
export const EXPANDED_IDS=['imagine','scrambled-words','what-would-you-do','find-a-way-to-escape','escape-room','the-detective','the-interrogator','the-negotiator','the-strategist','the-impostor','the-paradox','the-architect','the-survival-planner','the-investigator','the-codebreaker','the-experimenter','the-deceiver','the-systems-breaker'];
export function createExpandedRound(game:GameEntry,tier:number,level:number){
 const id=game.id, n=Math.max(1,Math.min(15,tier)), l=Math.max(1,Math.min(3,level));
 if(id==='imagine'){
  const prompts=['Imagine a circle without drawing one.','Imagine a triangle that has never been seen before.','Imagine a horse standing beside a river.','Imagine a city built inside a giant tree.','Imagine a machine that can fold light.','Imagine a world where gravity changes direction every hour.','Imagine an object that has no familiar shape, purpose, or material.'];
  const p=prompts[Math.min(6,Math.floor((n-1)/2))]; const count=Math.min(2500,40+n*110+l*35);
  return base(game,n,l,'imagine',p,{visual:{type:n<4?'dots':n<8?'shapes':n<12?'lines':'abstract',count},rule:'There is no single correct image. The challenge is to explore an idea, not to match AXON’s imagination.',steps:['Pause and form any mental impression you can.','Notice shape, scale, position, movement, texture, or color.','You may describe it, sketch it, or continue imagining silently.'],answer:'open-ended'});
 }
 if(id==='scrambled-words'){
  const pool=words.filter(([w])=>w.length>=Math.min(4,3+Math.floor(n/5)));const [answer,topic]=pick(pool);let scrambled=shuffle(answer);while(scrambled===answer)scrambled=shuffle(answer);
  return base(game,n,l,'text',`Category: ${topic}. Unscramble these letters to make one English word: ${scrambled}`,{question:'Enter the restored word.',answer,rule:'Every letter is used exactly once; order is the only thing changed.',steps:['Count the letters.','Use the category as a clue.','Try common beginnings, endings, and letter pairs.','Check that your answer uses every letter exactly once.'],alternative:'The category narrows the meaning without revealing the word.'});
 }
 if(id==='what-would-you-do'){
  const scenarios=[{q:'Two urgent tasks need attention, but you can safely complete only one now. What is the best first move?',choices:['Check immediate risk and deadlines, then communicate a fair priority','Silently choose the easiest task','Promise both will be finished immediately'],answer:'Check immediate risk and deadlines, then communicate a fair priority',explanation:'Prioritize by harm, urgency, and dependencies; explain the trade-off.'},{q:'A teammate makes a mistake that can still be corrected. What should you do?',choices:['Hide it','Explain the impact respectfully and help correct it','Blame them publicly'],answer:'Explain the impact respectfully and help correct it',explanation:'Address the issue promptly while preserving accountability and dignity.'},{q:'You receive a claim that could affect an important decision, but its source is unclear.',choices:['Forward it immediately','Verify the source and seek independent confirmation','Treat confidence as proof'],answer:'Verify the source and seek independent confirmation',explanation:'Verification reduces the risk of acting on misinformation.'}];const s=scenarios[(n+l-2)%scenarios.length];
  return base(game,n,l,'choice',s.q,{choices:s.choices,answer:s.answer,explanation:s.explanation,accepted:[s.answer],rule:'Several responses may be defensible in real life. This training round evaluates the stated priorities and consequences, not personal worth.'});
 }
 if(id==='find-a-way-to-escape'){
  const s=[{q:'You are in a fictional research station during a power failure. The emergency door is locked electronically; a manual release is marked in the maintenance cabinet. What is the safest first plan?',choices:['Check the posted emergency procedure and use the manual release if safe','Break random equipment','Run deeper into the building'],answer:'Check the posted emergency procedure and use the manual release if safe'},{q:'You are on a marked wilderness trail, weather is worsening, and your phone battery is low.',choices:['Check map and weather, conserve battery, and choose the nearest safe marked shelter','Leave the trail without direction','Use the remaining battery for entertainment'],answer:'Check map and weather, conserve battery, and choose the nearest safe marked shelter'},{q:'A fictional puzzle chamber has a visible exit, a numbered keypad, and a clue card.',choices:['Inspect the clue card and test the code logically','Guess random codes repeatedly','Ignore the exit and dismantle the walls'],answer:'Inspect the clue card and test the code logically'}][(n+l-2)%3];
  return base(game,n,l,'choice',s.q,{choices:s.choices,answer:s.answer,explanation:'A viable escape plan uses observation, safe procedures, available resources, and a route that can be checked.',rule:'This is a fictional planning puzzle. Never apply game actions to a real emergency in place of local emergency guidance.'});
 }
 if(id==='escape-room'){
  const code=['314','527','806','142','693','258','471','935','620','784','159','362','817','490','235'][(n-1)%15];
  return base(game,n,l,'input',`Escape-room sequence: a note says “first digit = number of sides on a triangle; second = 2 more than first; third = first + second.” Enter the three-digit code.`,{question:'Three-digit code',rule:'Solve each clue in order; do not confuse the clue sequence with the exit code.',steps:['A triangle has 3 sides.','The second digit is 3 + 2 = 5.','The third digit is 3 + 5 = 8.'],answer:'358'});
 }
 if(id==='the-detective'||id==='the-investigator'){
  const cases=[{q:'A museum room was locked. A wet umbrella is found inside, but the floor near the only window is dry. Which conclusion is best supported?',choices:['Someone entered through the window','The umbrella was brought in before the room was locked','The curator is guilty'],answer:'The umbrella was brought in before the room was locked',explanation:'The evidence does not establish a window entry or identify a culprit.'},{q:'Three witnesses give conflicting times. A timestamped access log independently records 14:05. What should you do next?',choices:['Treat the log as useful evidence and verify its clock/source','Choose the most confident witness','Average all statements without checking'],answer:'Treat the log as useful evidence and verify its clock/source',explanation:'Check provenance and clock accuracy before treating a record as decisive.'}];const c=cases[(n+l-2)%2];return base(game,n,l,'choice',c.q,{choices:c.choices,answer:c.answer,explanation:c.explanation,rule:'Distinguish observation, inference, and unsupported accusation.'});
 }
 if(id==='the-interrogator'){
  const q='A witness says they arrived “around noon,” but the access log shows their badge first used at 12:47. Which follow-up question is most useful?';const choices=['What do you mean by “arrived,” and where were you before the badge was used?','Why are you obviously lying?','Can we stop asking questions?'];return base(game,n,l,'choice',q,{choices,answer:choices[0],explanation:'A neutral, specific question clarifies terms and tests the timeline without assuming guilt.'});
 }
 if(id==='the-negotiator'){
  const choices=['Agree on the shared deadline, list each side’s must-haves, then trade lower-priority items transparently','Demand everything and refuse discussion','Accept an unclear deal without recording it'];return base(game,n,l,'choice','Two teams need the same limited workspace. Both have a deadline. Which opening move best supports a durable agreement?',{choices,answer:choices[0],explanation:'Identify interests and constraints before proposing a transparent exchange.'});
 }
 if(id==='the-strategist'){
  const choices=['Secure the critical dependency first, preserve a fallback, then sequence the remaining tasks','Spend all resources on the optional first task','Ignore dependencies and begin randomly'];return base(game,n,l,'choice','A project has three stages; stage C cannot begin until A and B are complete. One resource may fail. What is the strongest plan?',{choices,answer:choices[0],explanation:'Respect dependencies and maintain a contingency.'});
 }
 if(id==='the-impostor'){
  const answer='Mira';const choices=['Mira','Jon','Sana','Cannot determine'];return base(game,n,l,'choice','Three explorers report: Mira says “Jon did not take the map.” Jon says “Sana took it.” Sana says “Jon is telling the truth.” Exactly one statement is true. Who took the map?',{choices,answer,explanation:'Mira took it: Mira’s statement is true, Jon’s is false, Sana’s is false.'});
 }
 if(id==='the-paradox'){
  const choices=['It creates a self-reference problem; the sentence cannot be assigned a consistent ordinary true/false value','It is simply true','It is simply false'];return base(game,n,l,'choice','Consider: “This sentence is false.” What is the central logical issue?',{choices,answer:choices[0],explanation:'If true, it is false; if false, it is true. This is the liar paradox.'});
 }
 if(id==='the-architect'){
  const target=12+n;const choices=[`A 3 × ${Math.ceil(target/3)} rectangle (area ${3*Math.ceil(target/3)})`,`A 1 × 1 square`,`A shape with no measured area`];const answer=choices[0];return base(game,n,l,'choice',`You need a simple rectangular platform with area at least ${target} square units. Which option guarantees enough area?`,{choices,answer,explanation:'Multiply length by width and verify the result meets the minimum.'});
 }
 if(id==='the-survival-planner'){
  const choices=['Water, shelter, and a reliable way to signal for help','Decorative items and extra entertainment','Spend all supplies immediately'];return base(game,n,l,'choice','A fictional outdoor scenario gives you limited carrying space. Weather is worsening and the route is uncertain. Which supplies deserve first priority?',{choices,answer:choices[0],explanation:'Prioritize immediate life-safety needs and communication. This is a game scenario, not a substitute for survival training.'});
 }
 if(id==='the-codebreaker'){
  const plain='AXON';const shift=1+(n%5);const cipher=plain.split('').map(c=>String.fromCharCode(65+(c.charCodeAt(0)-65+shift)%26)).join('');const answer=plain;return base(game,n,l,'input',`Caesar cipher: shift each letter backward ${shift} place(s). Decode: ${cipher}`,{question:'Enter the decoded four-letter word.',answer,rule:'A Caesar cipher rotates letters by a fixed number of alphabet positions.',steps:[`Move each letter ${shift} position(s) backward.`,`Wrap from A back to Z when needed.`,'Read the decoded letters in order.']});
 }
 if(id==='the-experimenter'){
  const choices=['Change one variable, use a suitable comparison group, repeat trials, and record outcomes','Change five variables at once','Run one trial and assume it proves the claim'];return base(game,n,l,'choice','You want to test whether light affects seedling growth. Which experiment gives the clearest evidence?',{choices,answer:choices[0],explanation:'Control other conditions and vary the factor being tested.'});
 }
 if(id==='the-deceiver'){
  const choices=['Ask for independently checkable evidence and look for contradictions','Assume a confident speaker is truthful','Decide based only on appearance'];return base(game,n,l,'choice','A speaker makes a persuasive claim but gives no source. What is the strongest way to detect possible deception?',{choices,answer:choices[0],explanation:'Check evidence and consistency rather than relying on confidence or appearance.'});
 }
 if(id==='the-systems-breaker'){
  const choices=['Map dependencies, identify the failed component, and trace downstream effects','Replace every component without diagnosis','Ignore dependent services'];return base(game,n,l,'choice','A central service fails and three dependent services stop responding. What is the best first analysis?',{choices,answer:choices[0],explanation:'Trace dependencies and failure propagation before changing the system.'});
 }
 return null;
}
