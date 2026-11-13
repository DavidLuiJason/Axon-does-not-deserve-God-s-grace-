const memoryIds=['missing-arithmetic-result','number-pattern-memory','hidden-number-operations','number-relationship-recall','mental-number-matrix','remember-and-rearrange','dual-task-challenge','memory-updating','last-three-items','moving-memory-window','instruction-memory','rule-switching','memory-under-distraction','delayed-instruction','mental-workspace'];
const strategyIds=['chess','chess-tactics','checkmate-in-one','checkmate-in-two','chess-position-memory','blindfold-chess','chess-endgame-challenge','draughts','go','reversi'];
const memoryMechanics={
'missing-arithmetic-result':'Retain operands and compute a missing result; tiers add operation changes, larger values, and multi-step expressions.',
'number-pattern-memory':'Retain and infer arithmetic patterns; tiers introduce longer patterns, changing differences, and mixed rules.',
'hidden-number-operations':'Retain operands and operation order; tiers add more operations and sign changes.',
'number-relationship-recall':'Retain paired values and apply a named relation; tiers add compound relations and interference.',
'mental-number-matrix':'Retain row-column locations; tiers enlarge the matrix and increase coordinate interference.',
'remember-and-rearrange':'Retain a multiset and reorder it; tiers add duplicates, longer spans, and more demanding order transformations.',
'dual-task-challenge':'Maintain a target stream while completing a secondary classification; tiers increase stream length and distractors.',
'memory-updating':'Maintain a changing working value; tiers add more sequential updates and operation switches.',
'last-three-items':'Maintain a sequence and retrieve its trailing window; tiers increase stream length and interference.',
'moving-memory-window':'Update a fixed-width rolling buffer; tiers widen the window and lengthen the stream.',
'instruction-memory':'Retain and execute ordered instructions; tiers add operations and dependent transformations.',
'rule-switching':'Alternate rules by position; tiers lengthen the sequence and increase rule interaction.',
'memory-under-distraction':'Separate target information from irrelevant distractors; tiers increase both streams.',
'delayed-instruction':'Retain a multi-step instruction for later execution; tiers increase operation dependency.',
'mental-workspace':'Hold multiple values, combine them, and transform the result; tiers increase values and calculation depth.'};
const strategyMechanics={
'chess':'Chess rule and position-reasoning challenges; tiers progress from piece rules to legality, tactical motifs, and endgame principles. This batch is not a complete playable chessboard engine.',
'chess-tactics':'Tactical motif recognition and forcing-move reasoning; tiers add competing candidate moves and defensive resources.',
'checkmate-in-one':'Mate-condition recognition and one-move mating principles; tiers add king safety and escape-square analysis.',
'checkmate-in-two':'Forced-mate sequence reasoning; tiers add defensive replies and the requirement to cover every legal defense.',
'chess-position-memory':'Accurate position-state encoding; tiers add side-to-move and special-rights information.',
'blindfold-chess':'Mental board-state updates; tiers add captures, piece relocation, and state consistency.',
'chess-endgame-challenge':'Endgame principles; tiers progress from basic mating methods to coordinated restriction and conversion.',
'draughts':'English draughts rule reasoning; tiers cover movement, capture, crowning, and forced continuation concepts. Not a full board-play engine.',
'go':'Go liberties and capture-rule reasoning; tiers progress to groups, capture conditions, and rule interactions. Not a full Go board engine.',
'reversi':'Reversi legal-move and pass reasoning; tiers progress to outflanking, no-move situations, and position evaluation. Not a full board engine.'};
const all={};
for(const id of memoryIds){all[id]={tiers:Array.from({length:15},(_,i)=>({levels:2+(i%5===4?1:0)+(i>=9?1:0),mechanics:`${memoryMechanics[id]} Tier ${i+1}: ${['guided single operation','independent operation','two-step retention','longer sequence','interference introduced','multiple operations','reduced positional cues','mixed operation patterns','distractor resistance','multi-stage update','complex dependency','novel combinations','high-interference execution','near-maximum supported span','maximum supported task for this generator'][i]}`}))};}
for(const id of strategyIds){all[id]={tiers:Array.from({length:15},(_,i)=>({levels:2+(i%4===3?1:0),mechanics:`${strategyMechanics[id]} Tier ${i+1}: ${['basic rule recognition','single condition','two interacting conditions','common exception','candidate evaluation','multiple conditions','defensive awareness','sequence reasoning','position-state reasoning','counterexample testing','advanced application','compound constraints','novel scenario','near-maximum supported reasoning','maximum supported challenge in this rules quiz'][i]}`}))};}
export const BATCH_TWO_TIER_PROFILES=all;
