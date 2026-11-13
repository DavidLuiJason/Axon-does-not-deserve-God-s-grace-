const mechanics={
'mental-math':'Order of operations, multi-step mental arithmetic, negative and fractional values where supported',
'rapid-calculation':'Mental decomposition, larger operands, carry operations and accuracy under the host timer',
'missing-equation':'Inverse operations, multi-factor equations and less direct unknown placement',
'number-pyramid':'Adjacent-sum construction, deeper rows and missing/intermediate brick reasoning',
'mathematical-sequence':'Constant differences, changing differences, alternating and compound sequence rules',
'prime-factor-challenge':'Small-prime decomposition, repeated factors, larger composites and exponent notation',
'greatest-common-divisor':'Common factors, Euclidean algorithm and larger coprime or shared-factor pairs',
'least-common-multiple':'Prime factorization, GCD relation and larger overlapping factor structures',
'fraction-duel':'Like denominators, unlike denominators, equivalent fractions and close magnitude comparisons',
'percentage-master':'Common percentages, compound percentage steps and reverse-percentage reasoning',
'algebra-detective':'One-step linear equations, multi-step equations and coefficient/constant variation',
'equation-balancer':'Inverse operations, maintaining equality and multi-step equation transformations',
'target-number-mathematics':'Exact target construction, restricted operations and multi-operation expression planning',
'mathematical-proof-puzzle':'Parity, divisibility, counterexamples, universal claims and short proof reasoning',
'probability-challenge':'Single events, reduced fractions, compound events and conditional reasoning foundations',
'target-switch':'Single target rules, changing rules, conjunctions/disjunctions and rule-switch costs',
'count-the-occurrences':'Short streams, larger symbol sets, near-match distractors and multiple target counts',
'distractor-filter':'Single filters, ordered multi-item filtering, overlapping features and exclusion constraints',
'color-word-conflict':'Feature comparison, conflict detection and careful rule-following under interference',
'go-or-no-go':'Target detection, withholding on non-targets, rare targets and changing target rules',
'sequence-violation':'Single anomaly, subtle deviations, multiple rule checks and earliest-violation detection',
'rapid-symbol-search':'Target localization, larger fields, distractor similarity and first-occurrence precision',
'sustained-attention':'Longer streams, changing targets, dense distractors and consistent monitoring',
'interruption-recovery':'Retaining intermediate state, resuming multi-step tasks and detecting state-loss errors',
'cube-counting':'Cuboid layers, larger dimensions, decomposition and 3D unit-cube reasoning'
};
const stages=['guided single-step challenge','basic independent application','two-step combination','reduced hints','larger values or fields','similar distractors','boundary and exception cases','multi-stage reasoning','competing strategies','mixed constraints','novel combinations','dense information','advanced generalization','near-maximum supported challenge','maximum supported by this generator'];
export const BATCH_FIVE_TIER_PROFILES=Object.fromEntries(Object.entries(mechanics).map(([id,m],i)=>[id,{tiers:stages.map((s,j)=>({levels:2+((i+j)%3===0?1:0),mechanics:`${m}; ${s}`}))}]));
