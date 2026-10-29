import { solveDc, equivalentResistance, type DcNetwork, type DcResult } from '../src/tools/engines/science/circuit';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function near(actual: number, expected: number, message: string, tol=1e-9): void {
  const scale=Math.max(1,Math.abs(actual),Math.abs(expected));
  assert(Number.isFinite(actual) && Math.abs(actual-expected)<=tol*scale, `${message}: expected ${expected}, got ${actual}`);
}
function solved(n: DcNetwork): Extract<DcResult,{ok:true}> {
  const r=solveDc(n);
  if (!r.ok) throw new Error(`expected solved circuit, got ${r.error}: ${r.message}`);
  return r;
}
function rejected(n: DcNetwork, code: string): void {
  const r=solveDc(n);
  assert(!r.ok && r.error===code, `expected ${code}, got ${r.ok?'success':r.error}`);
}
function verifyKclAndPower(n: DcNetwork, r: Extract<DcResult,{ok:true}>, label: string): number {
  const sums:Record<string,number>={};
  for(const node of Object.keys(r.nodeVolts)) sums[node]=0;
  for(const e of n.elements) {
    let from:string,to:string,amps:number;
    if(e.kind==='resistor') { from=e.a;to=e.b;amps=(r.nodeVolts[from]-r.nodeVolts[to])/e.ohms; }
    else if(e.kind==='voltage') {
      const out=r.elements.find(x=>x.id===e.id)!;
      from=e.plus;to=e.minus;amps=out.amps;
    } else { from=e.from;to=e.to;amps=e.amps; }
    sums[from]=(sums[from]??0)+amps;
    sums[to]=(sums[to]??0)-amps;
  }
  let largest=0;
  for(const [node,sum] of Object.entries(sums)) {
    largest=Math.max(largest,Math.abs(sum));
    near(sum,0,`${label}: KCL at ${node}`);
  }
  const independentPower=r.elements.reduce((s,e)=>s+e.volts*e.amps,0);
  largest=Math.max(largest,Math.abs(independentPower));
  near(independentPower,0,`${label}: independent power sum`);
  near(r.powerBalance,independentPower,`${label}: reported power balance`);
  return largest;
}
let assertions=0, solvedCount=0, errorCount=0, randomCount=0;
let largestResidual=0;
function checkSolved(n:DcNetwork,label:string,check:(r:Extract<DcResult,{ok:true}>)=>void):void {
  const r=solved(n); solvedCount++; check(r); largestResidual=Math.max(largestResidual,verifyKclAndPower(n,r,label)); assertions++;
}
function checkError(n:DcNetwork,code:string):void { rejected(n,code);errorCount++;assertions++; }

// Voltage divider: 12 V, 2 kΩ over 1 kΩ -> 4 V.
const divider:DcNetwork={ground:'0',elements:[
 {kind:'voltage',id:'V1',plus:'in',minus:'0',volts:12},
 {kind:'resistor',id:'R1',a:'in',b:'mid',ohms:2000},
 {kind:'resistor',id:'R2',a:'mid',b:'0',ohms:1000}
]};
checkSolved(divider,'divider',r=>{near(r.nodeVolts.mid,4,'divider midpoint');near(r.elements.find(e=>e.id==='R1')!.amps,0.004,'divider current');});

// Series and parallel equivalent resistance.
const series:DcNetwork={ground:'b',elements:[
 {kind:'resistor',id:'R1',a:'a',b:'x',ohms:3},
 {kind:'resistor',id:'R2',a:'x',b:'b',ohms:7}
]};
const rs=equivalentResistance(series,'a','b');assert(rs.ok,'series equivalent failed');near(rs.ohms,10,'series equivalent');assertions++;
const parallel:DcNetwork={ground:'b',elements:[
 {kind:'resistor',id:'R1',a:'a',b:'b',ohms:6},
 {kind:'resistor',id:'R2',a:'a',b:'b',ohms:3}
]};
const rp=equivalentResistance(parallel,'a','b');assert(rp.ok,'parallel equivalent failed');near(rp.ohms,2,'parallel equivalent');assertions++;

// Balanced Wheatstone bridge: equal ratios -> no bridge current.
const balanced:DcNetwork={ground:'0',elements:[
 {kind:'voltage',id:'V',plus:'top',minus:'0',volts:10},
 {kind:'resistor',id:'R1',a:'top',b:'l',ohms:100},
 {kind:'resistor',id:'R2',a:'l',b:'0',ohms:100},
 {kind:'resistor',id:'R3',a:'top',b:'r',ohms:200},
 {kind:'resistor',id:'R4',a:'r',b:'0',ohms:200},
 {kind:'resistor',id:'RB',a:'l',b:'r',ohms:50}
]};
checkSolved(balanced,'balanced bridge',r=>{near(r.nodeVolts.l,5,'balanced left');near(r.nodeVolts.r,5,'balanced right');near(r.elements.find(e=>e.id==='RB')!.amps,0,'balanced bridge current');});

// Unbalanced Wheatstone bridge, reference solved independently with Python Gaussian elimination.
const unbalanced:DcNetwork={ground:'0',elements:[
 {kind:'voltage',id:'V',plus:'top',minus:'0',volts:10},
 {kind:'resistor',id:'R1',a:'top',b:'l',ohms:100},
 {kind:'resistor',id:'R2',a:'l',b:'0',ohms:200},
 {kind:'resistor',id:'R3',a:'top',b:'r',ohms:150},
 {kind:'resistor',id:'R4',a:'r',b:'0',ohms:100},
 {kind:'resistor',id:'RB',a:'l',b:'r',ohms:80}
]};
checkSolved(unbalanced,'unbalanced bridge',r=>{near(r.nodeVolts.l,5.806451612903227,'unbalanced left');near(r.nodeVolts.r,4.774193548387097,'unbalanced right');});

// Two voltage sources, checked against the independently calculated nodal solution.
const twoSources:DcNetwork={ground:'0',elements:[
 {kind:'voltage',id:'V1',plus:'a',minus:'0',volts:12},
 {kind:'voltage',id:'V2',plus:'b',minus:'0',volts:6},
 {kind:'resistor',id:'R1',a:'a',b:'x',ohms:1000},
 {kind:'resistor',id:'R2',a:'x',b:'b',ohms:2000},
 {kind:'resistor',id:'R3',a:'x',b:'0',ohms:1000}
]};
checkSolved(twoSources,'two sources',r=>{near(r.nodeVolts.x,6,'two-source node');});
const source1Only:DcNetwork={...twoSources,elements:twoSources.elements.map(e=>e.kind==='voltage'&&e.id==='V2'?{...e,volts:0}:e)};
const source2Only:DcNetwork={...twoSources,elements:twoSources.elements.map(e=>e.kind==='voltage'&&e.id==='V1'?{...e,volts:0}:e)};
checkSolved(source1Only,'superposition source 1',r=>near(r.nodeVolts.x,4.8,'source 1 contribution'));
checkSolved(source2Only,'superposition source 2',r=>near(r.nodeVolts.x,1.2,'source 2 contribution'));
near(solved(source1Only).nodeVolts.x+solved(source2Only).nodeVolts.x,solved(twoSources).nodeVolts.x,'superposition sum');assertions++;

// Current source into a resistor: 2 A injected into a 10 ohm resistor -> 20 V.
const currentCase:DcNetwork={ground:'0',elements:[
 {kind:'resistor',id:'R',a:'n',b:'0',ohms:10},
 {kind:'current',id:'I',from:'0',to:'n',amps:2}
]};
checkSolved(currentCase,'current source',r=>{near(r.nodeVolts.n,20,'current-source voltage');near(r.elements.find(e=>e.id==='R')!.watts,40,'resistor power');});

// Ten-stage ladder: each stage has 100 ohm series and 100 ohm shunt, driven by 10 V.
const ladderElements:any[]=[{kind:'voltage',id:'VS',plus:'in',minus:'0',volts:10}];
let previous='in';
for(let i=1;i<=10;i++){
 const node=`n${i}`;
 ladderElements.push({kind:'resistor',id:`S${i}`,a:previous,b:node,ohms:100});
 ladderElements.push({kind:'resistor',id:`P${i}`,a:node,b:'0',ohms:100});
 previous=node;
}
const ladder:DcNetwork={ground:'0',elements:ladderElements};
checkSolved(ladder,'10-stage ladder',r=>{near(r.nodeVolts.n10,0.000913575735,'ladder final node',1e-8);});

// Fixed-seed random family; expected midpoint voltages were generated independently
// with exact Python Fraction arithmetic and are stored, not computed by this solver.
const randomCases:number[][]=[
  [8860, 1972, 70, 12.743722304283605],
  [8173, 5163, 130, 50.329184163167369],
  [280, 5212, 143, 135.70939548434086],
  [6966, 7633, 86, 44.964586615521611],
  [7384, 1770, 171, 33.064234214551014],
  [985, 1642, 146, 91.256947087933],
  [8001, 8095, 141, 70.911717196819083],
  [8458, 2362, 169, 36.892606284658044],
  [5972, 9117, 176, 106.34183842534297],
  [5373, 8096, 38, 22.841190882767837],
  [7746, 2855, 129, 34.741533817564381],
  [8740, 4858, 223, 79.668627739373434],
  [3519, 323, 163, 13.70353982300885],
  [7651, 3584, 45, 14.355140186915888],
  [1030, 9535, 157, 141.69380028395645],
  [7749, 1646, 209, 36.616711016498137],
  [9814, 5840, 222, 82.821004216174785],
  [2427, 4241, 26, 16.536592681463706],
  [6749, 2355, 209, 54.063598418277678],
  [5650, 1381, 57, 11.195704736168397],
  [1360, 6280, 207, 170.15183246073298],
  [184, 2655, 166, 155.24128214159916],
  [9976, 5511, 108, 38.431458642732615],
  [2117, 7777, 105, 82.533353547604605],
  [9986, 8384, 157, 71.654218835057165],
  [3752, 639, 139, 20.22796629469369],
  [2003, 3626, 126, 81.164682892165573],
  [2483, 1370, 142, 50.490526862185312],
  [1768, 6905, 41, 32.642107690533841],
  [4685, 9437, 67, 44.772624274182128],
  [4194, 7354, 136, 86.607551091098031],
  [1809, 8767, 233, 193.14589636913766],
  [7460, 9218, 212, 117.17328216812568],
  [4431, 4174, 8, 3.8805345729227194],
  [9064, 5842, 84, 32.921508117536561],
  [1922, 3604, 187, 121.95946435034384],
  [2080, 6926, 112, 86.132800355318679],
  [6027, 9249, 203, 122.90828750981933],
  [3787, 589, 76, 10.229433272394882],
  [9805, 5423, 70, 24.928421329130551],
  [9393, 1535, 198, 27.812042459736457],
  [5166, 8480, 237, 147.27832331818848],
  [647, 4451, 61, 53.258336602589253],
  [4936, 9637, 80, 52.903314348452618],
  [1369, 3212, 226, 158.46147129447718],
  [3468, 6936, 182, 121.33333333333333],
  [6615, 1491, 80, 14.715025906735752],
  [5104, 3715, 36, 15.164984692141966],
  [5576, 4930, 177, 83.05825242718447],
  [910, 706, 193, 84.318069306930695],
  [2831, 4201, 85, 50.780005688282138],
  [2060, 1904, 82, 39.386478304742681],
  [9202, 1336, 119, 15.086733725564624],
  [2590, 5710, 56, 38.525301204819279],
  [5882, 3691, 223, 85.980674814582684],
  [7006, 6331, 115, 54.589862787733374],
  [5768, 7775, 35, 20.093406187698442],
  [1647, 9790, 194, 166.06277870070824],
  [3150, 1728, 139, 49.239852398523986],
  [3678, 7436, 173, 115.74842540939356],
  [6109, 8568, 179, 104.49492403079648],
  [3982, 4170, 28, 14.322865554465162],
  [6631, 9308, 25, 14.599410251584164],
  [480, 6237, 160, 148.56632425189818],
  [9314, 251, 201, 5.2745426032409828],
  [1799, 4470, 98, 69.877173392885624],
  [6478, 1420, 75, 13.484426437072676],
  [5875, 2854, 164, 53.62080421583228],
  [8962, 1869, 16, 2.7609638999169053],
  [6079, 4698, 42, 18.308991370511276],
  [9819, 210, 185, 3.8737660783727192],
  [728, 9650, 39, 36.264212757756795],
  [6068, 4799, 50, 22.080611024201712],
  [7602, 1473, 88, 14.283636363636363],
  [9643, 348, 151, 5.2595335802222003],
  [7339, 5653, 123, 53.519011699507388],
  [159, 5083, 148, 143.51087371232353],
  [8908, 3692, 213, 62.41238095238095],
  [7238, 701, 173, 15.275601461141202],
  [4674, 1836, 219, 61.764055299539173],
  [6070, 7983, 209, 118.72532555326265],
  [5155, 8479, 168, 104.47938976089189],
  [9695, 9527, 72, 35.685360524399123],
  [2516, 8461, 39, 30.060945613555617],
  [2360, 5881, 155, 110.61218298750151],
  [418, 3309, 60, 53.2707271263751],
  [4665, 2577, 213, 75.794117647058826],
  [5007, 4787, 119, 58.163467429038185],
  [4195, 770, 188, 29.156092648539779],
  [6361, 678, 225, 21.672112515982384],
  [9966, 5717, 82, 29.891857425237518],
  [5756, 6105, 31, 15.956074529972177],
  [1997, 3820, 129, 84.713769984528113],
  [128, 1701, 99, 92.071623838162935],
  [1262, 1708, 189, 108.69090909090909],
  [5977, 3197, 57, 19.863636363636363],
  [1052, 8046, 15, 13.265552868762365],
  [8813, 3591, 177, 51.242099322799099],
  [6273, 2620, 188, 55.387383335207467],
  [191, 365, 142, 93.219424460431654],
  [7379, 6958, 8, 3.8825416753853665],
  [3363, 6043, 111, 71.313310652774831],
  [9770, 5297, 72, 25.31253733324484],
  [7948, 6384, 174, 77.50600055819146],
  [5471, 4660, 38, 17.479024775441715],
  [7374, 3780, 173, 58.628294782140934],
  [6153, 1615, 27, 5.6134140061791964],
  [9195, 3164, 158, 40.44922728376082],
  [2332, 1627, 194, 79.726698661278107],
  [3743, 6151, 24, 14.920557913887205],
  [9863, 5872, 88, 32.839911026374324],
  [6535, 4497, 140, 57.068527918781726],
  [8461, 2749, 115, 28.201159678858161],
  [4437, 8252, 99, 64.382378438017184],
  [7110, 9899, 200, 116.39720148156859],
  [5578, 869, 221, 29.788894059252364],
  [4401, 2623, 107, 39.957431662870157],
  [8787, 8406, 236, 115.3850985866341],
  [2578, 665, 38, 7.7921677459142771],
  [7585, 7718, 114, 57.495393060184277],
  [9205, 15, 79, 0.12852494577006507],
  [746, 97, 168, 19.330960854092528],
  [3638, 2869, 66, 29.100046104195481],
  [756, 8618, 123, 113.08022189033497],
  [3109, 1169, 121, 33.064282374941563],
  [8128, 9, 134, 0.14821187169718569],
  [1435, 9980, 1, 0.87428821725799388],
  [1946, 3450, 202, 129.15122312824315],
  [9820, 2354, 135, 26.103992114342041],
  [5210, 4212, 143, 63.92655487157716],
  [9840, 5506, 33, 11.84008862244233],
  [2640, 4728, 18, 11.550488599348535],
  [8506, 5510, 5, 1.9656107305936072],
  [9982, 9100, 5, 2.3844460748349228],
  [651, 3186, 172, 142.817826426896],
  [3988, 9196, 82, 57.195995145631066],
  [1030, 8061, 45, 39.901550984490157],
  [1851, 5116, 116, 85.180996124587338],
  [890, 4627, 127, 106.51241616820735],
  [2833, 6974, 187, 132.98032017946366],
  [6963, 448, 173, 10.457967885575496],
  [4821, 5019, 189, 96.401524390243907],
  [8003, 2525, 91, 21.825132978723403],
  [5165, 3574, 71, 29.036960750657968],
  [9159, 9638, 62, 31.789966484013405],
  [9009, 6633, 50, 21.202531645569621],
  [2976, 886, 172, 39.459347488348008],
  [8867, 8814, 209, 104.18675414286523],
  [3140, 966, 69, 16.233317096931319],
  [4460, 2647, 112, 41.714366117911915],
  [5544, 1873, 26, 6.5657273830389649],
  [3124, 8232, 67, 48.568510038746034],
  [8453, 5405, 4, 1.5601096839370761],
  [7800, 8568, 133, 69.620234604105576],
  [2357, 6377, 211, 154.05850698419968],
  [5443, 4076, 6, 2.5691774346044753],
  [5005, 7624, 25, 15.092248000633463],
  [2398, 5887, 100, 71.056125528062765],
  [9748, 327, 42, 1.3631761786600496],
  [1531, 1316, 100, 46.224095539164033],
  [5461, 1563, 200, 44.504555808656036],
  [8554, 4536, 71, 24.603208556149731],
  [6042, 2529, 21, 6.1963598179908992],
  [1976, 8010, 165, 132.3502904065692],
  [9257, 7062, 96, 41.543722041791774],
  [4207, 1404, 224, 56.049901978256997],
  [4878, 8080, 78, 48.637135360395121],
  [5127, 8984, 156, 99.319963149316138],
  [2077, 9256, 6, 4.9003794229242033],
  [8667, 1926, 136, 24.727272727272727],
  [3735, 4608, 175, 96.655879180151018],
  [9064, 9209, 232, 116.92048377387403],
  [5045, 4614, 139, 66.398799047520441],
  [6162, 5205, 195, 89.291369754552647],
  [1208, 1530, 48, 26.822498173849525],
  [1692, 1939, 131, 69.955659597906916],
  [903, 1300, 51, 30.095324557421698],
  [9089, 851, 100, 8.5613682092555337],
  [2773, 893, 3, 0.73076923076923073],
  [9190, 5000, 164, 57.787174066243836],
  [8468, 358, 197, 7.9907092680716065],
  [138, 9497, 22, 21.684898806434873],
  [1808, 9115, 70, 58.413439531264302],
  [6519, 7826, 21, 11.456674799581736],
  [6286, 4119, 131, 51.858625660740032],
  [4122, 6013, 224, 132.89708929452394],
  [9389, 6670, 68, 28.243352637150508],
  [2635, 9543, 33, 25.859664969617342],
  [1664, 4050, 102, 72.296114805740288],
  [4252, 157, 39, 1.3887502835110002],
  [5544, 4494, 216, 96.702928870292894],
  [2286, 7399, 84, 64.173051109963865],
  [482, 9779, 93, 88.631419939577043],
  [8930, 984, 103, 10.223118821868065],
  [1923, 3156, 98, 60.895451860602478],
  [1768, 3101, 131, 83.432121585541182],
  [7477, 6015, 61, 27.19500444707975],
  [1467, 3997, 226, 165.32247437774524],
  [9755, 6263, 87, 34.016793607191907],
  [9511, 5114, 212, 74.131145299145302]
];
for(let i=0;i<randomCases.length;i++){
 const [rtop,rbottom,volts,expected]=randomCases[i];
 const n:DcNetwork={ground:'0',elements:[
  {kind:'voltage',id:'V',plus:'in',minus:'0',volts},
  {kind:'resistor',id:'RT',a:'in',b:'mid',ohms:rtop},
  {kind:'resistor',id:'RB',a:'mid',b:'0',ohms:rbottom}
 ]};
 checkSolved(n,`seeded case ${i}`,r=>near(r.nodeVolts.mid,expected,`seeded case ${i} midpoint`));
 randomCount++;
}

// Typed errors and hostile inputs.
checkError({elements:[{kind:'resistor',id:'R',a:'a',b:'b',ohms:1}]} as unknown as DcNetwork,'NO_GROUND_NODE');
checkError({ground:'missing',elements:[{kind:'resistor',id:'R',a:'a',b:'b',ohms:1}]},'GROUND_NOT_USED');
checkError({ground:'0',elements:[{kind:'resistor',id:'R',a:'a',b:'b',ohms:1}]},'GROUND_NOT_USED');
checkError({ground:'0',elements:[
 {kind:'resistor',id:'R',a:'0',b:'n',ohms:10},
 {kind:'resistor',id:'R',a:'n',b:'0',ohms:20}
]},'DUPLICATE_ELEMENT_ID');
checkError({ground:'0',elements:[{kind:'resistor',id:'R',a:'0',b:'n',ohms:0}]},'INVALID_RESISTANCE');
checkError({ground:'0',elements:[{kind:'resistor',id:'R',a:'0',b:'n',ohms:-1}]},'INVALID_RESISTANCE');
checkError({ground:'0',elements:[{kind:'resistor',id:'R',a:'0',b:'n',ohms:NaN}]},'INVALID_RESISTANCE');
checkError({ground:'0',elements:[{kind:'resistor',id:'R',a:'0',b:'n',ohms:Infinity}]},'INVALID_RESISTANCE');
checkError({ground:'0',elements:[
 {kind:'resistor',id:'R1',a:'0',b:'n',ohms:1},
 {kind:'resistor',id:'R2',a:'x',b:'y',ohms:2}
]},'FLOATING_PART');
checkError({ground:'0',elements:[
 {kind:'voltage',id:'V1',plus:'n',minus:'0',volts:5},
 {kind:'voltage',id:'V2',plus:'n',minus:'0',volts:6}
]},'CONTRADICTORY_VOLTAGE_LOOP');
checkError({ground:'0',elements:[
 {kind:'current',id:'Iopen',from:'0',to:'n',amps:1}
]},'CURRENT_SOURCE_NO_CLOSED_PATH');
checkError({ground:'0',elements:[]},'GROUND_NOT_USED');
checkError({ground:'',elements:[]},'NO_GROUND_NODE');
checkError({ground:'0',elements:[{kind:'resistor',id:'R',a:'0',b:'',ohms:1}]},'INVALID_NETWORK');
const tooManyNodes:DcNetwork={ground:'n0',elements:Array.from({length:60},(_,i)=>({kind:'resistor' as const,id:`R${i}`,a:`n${i}`,b:`n${i+1}`,ohms:1}))};
checkError(tooManyNodes,'CIRCUIT_LIMITS');
const tooManyElements:DcNetwork={ground:'0',elements:Array.from({length:201},(_,i)=>({kind:'resistor' as const,id:`R${i}`,a:'0',b:'n',ohms:1}))};
checkError(tooManyElements,'CIRCUIT_LIMITS');
const invalidSource:DcNetwork={ground:'0',elements:[{kind:'current',id:'I',from:'0',to:'n',amps:Infinity}]};
checkError(invalidSource,'INVALID_SOURCE_VALUE');

// Director addition (C28 check): the supplies/absorbs labels were untested.
const roleNet:DcNetwork={ground:'0',elements:[{kind:'voltage',id:'V',plus:'a',minus:'0',volts:10},{kind:'resistor',id:'R',a:'a',b:'0',ohms:1000}]};
const roleRes=solved(roleNet);
const roleOf=(id:string)=>roleRes.elements.find(e=>e.id===id)?.role;
assert(roleOf('V')==='supplies'&&roleOf('R')==='absorbs','a source supplies power and a resistor absorbs it');
assertions++;
const assumptions=solved(divider).assumptions;
assert(assumptions.includes('ideal sources')&&assumptions.includes('wires with zero resistance')&&assumptions.includes('steady DC state'),'required assumptions missing');
assertions++;
console.log(`C28 circuit tests PASS: ${assertions} assertions; ${solvedCount} solved networks; ${errorCount} typed-error cases; ${randomCount} seeded independent cases.`);
console.log(`Largest observed KCL/power residual: ${largestResidual.toExponential(3)} (relative tolerance 1e-9).`);
