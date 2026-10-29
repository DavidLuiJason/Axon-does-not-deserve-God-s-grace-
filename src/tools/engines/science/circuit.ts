/**
 * Pure ideal-DC circuit analysis using modified nodal analysis (MNA).
 * Element currents are positive in the direction stated by each element's
 * first node (a/from/plus) to its second node (b/to/minus).
 */

export const CIRCUIT_LIMITS = { maxNodes: 60, maxElements: 200 } as const;

export type Resistor = { kind: 'resistor'; id: string; a: string; b: string; ohms: number };
export type VoltageSource = { kind: 'voltage'; id: string; plus: string; minus: string; volts: number };
export type CurrentSource = { kind: 'current'; id: string; from: string; to: string; amps: number };
export type Element = Resistor | VoltageSource | CurrentSource;
export type DcNetwork = { ground: string; elements: Element[] };

export type CircuitErrorCode =
  | 'INVALID_NETWORK' | 'NO_GROUND_NODE' | 'GROUND_NOT_USED' | 'DUPLICATE_ELEMENT_ID'
  | 'INVALID_RESISTANCE' | 'INVALID_SOURCE_VALUE' | 'FLOATING_PART'
  | 'CONTRADICTORY_VOLTAGE_LOOP' | 'CURRENT_SOURCE_NO_CLOSED_PATH'
  | 'CIRCUIT_LIMITS' | 'SINGULAR_CIRCUIT' | 'INVALID_EQUIVALENT_RESISTANCE';
export type CircuitError = { ok: false; error: CircuitErrorCode; message: string };
export type SolvedElement = { id: string; volts: number; amps: number; watts: number; role: 'supplies' | 'absorbs' };
export type DcResult =
  | { ok: true; nodeVolts: Record<string, number>; elements: SolvedElement[]; assumptions: string[]; powerBalance: number }
  | CircuitError;
export type EquivalentResistanceResult = { ok: true; ohms: number; assumptions: string[] } | CircuitError;

const ASSUMPTIONS = ['ideal sources', 'wires with zero resistance', 'steady DC state'];
const err = (error: CircuitErrorCode, message: string): CircuitError => ({ ok: false, error, message });
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const validNode = (n: unknown): n is string => typeof n === 'string' && n.trim().length > 0;

function nodesOf(elements: Element[]): string[] {
  const set = new Set<string>();
  for (const e of elements) {
    if (e.kind === 'resistor') { set.add(e.a); set.add(e.b); }
    else if (e.kind === 'voltage') { set.add(e.plus); set.add(e.minus); }
    else { set.add(e.from); set.add(e.to); }
  }
  return [...set];
}

function validate(network: DcNetwork): CircuitError | null {
  if (!network || typeof network !== 'object' || !Array.isArray(network.elements))
    return err('INVALID_NETWORK', 'Provide a circuit object with an element list.');
  if (!validNode(network.ground)) return err('NO_GROUND_NODE', 'Provide a non-empty ground node name.');
  if (network.elements.length > CIRCUIT_LIMITS.maxElements)
    return err('CIRCUIT_LIMITS', `A circuit may contain at most ${CIRCUIT_LIMITS.maxElements} elements.`);
  const ids = new Set<string>();
  const nodes = new Set<string>();
  for (const e of network.elements as unknown[]) {
    if (!e || typeof e !== 'object') return err('INVALID_NETWORK', 'Every element must be an object.');
    const x = e as Record<string, unknown>;
    if (typeof x.id !== 'string' || !x.id.trim() || !['resistor','voltage','current'].includes(String(x.kind)))
      return err('INVALID_NETWORK', 'Each element needs a non-empty id and a supported kind.');
    if (ids.has(x.id)) return err('DUPLICATE_ELEMENT_ID', `Element id "${x.id}" is used more than once.`);
    ids.add(x.id);
    let ends: unknown[];
    if (x.kind === 'resistor') {
      ends = [x.a, x.b];
      if (!finite(x.ohms) || x.ohms <= 0) return err('INVALID_RESISTANCE', `Resistor "${x.id}" must have a finite resistance greater than zero.`);
    } else if (x.kind === 'voltage') {
      ends = [x.plus, x.minus];
      if (!finite(x.volts)) return err('INVALID_SOURCE_VALUE', `Voltage source "${x.id}" must have a finite voltage.`);
    } else {
      ends = [x.from, x.to];
      if (!finite(x.amps)) return err('INVALID_SOURCE_VALUE', `Current source "${x.id}" must have a finite current.`);
    }
    if (!ends.every(validNode)) return err('INVALID_NETWORK', `Element "${x.id}" names an invalid or empty node.`);
    for (const n of ends as string[]) nodes.add(n);
  }
  if (!nodes.has(network.ground)) return err('GROUND_NOT_USED', `Ground node "${network.ground}" does not appear in any element.`);
  if (nodes.size > CIRCUIT_LIMITS.maxNodes) return err('CIRCUIT_LIMITS', `A circuit may contain at most ${CIRCUIT_LIMITS.maxNodes} nodes.`);
  const reached = new Set<string>([network.ground]);
  const queue = [network.ground];
  while (queue.length) {
    const n = queue.shift()!;
    for (const e of network.elements) {
      const pair = e.kind === 'resistor' ? [e.a,e.b] : e.kind === 'voltage' ? [e.plus,e.minus] : [e.from,e.to];
      if (pair[0] === n && !reached.has(pair[1])) { reached.add(pair[1]); queue.push(pair[1]); }
      if (pair[1] === n && !reached.has(pair[0])) { reached.add(pair[0]); queue.push(pair[0]); }
    }
  }
  if (reached.size !== nodes.size) {
    const floating = [...nodes].filter(n => !reached.has(n)).sort();
    return err('FLOATING_PART', `These nodes have no path to ground "${network.ground}": ${floating.join(', ')}.`);
  }
  // Voltage-only subgraphs must assign one consistent potential to every node.
  const adjacency = new Map<string, { node: string; delta: number; id: string }[]>();
  for (const e of network.elements) if (e.kind === 'voltage') {
    const p = adjacency.get(e.plus) ?? []; p.push({ node: e.minus, delta: -e.volts, id: e.id }); adjacency.set(e.plus,p);
    const m = adjacency.get(e.minus) ?? []; m.push({ node: e.plus, delta: e.volts, id: e.id }); adjacency.set(e.minus,m);
  }
  const potential = new Map<string,number>();
  for (const start of adjacency.keys()) {
    if (potential.has(start)) continue;
    potential.set(start,0);
    const q=[start];
    while(q.length) {
      const n=q.shift()!;
      for(const edge of adjacency.get(n) ?? []) {
        const want=potential.get(n)!+edge.delta;
        if(!potential.has(edge.node)) { potential.set(edge.node,want); q.push(edge.node); }
        else if(Math.abs(potential.get(edge.node)!-want)>1e-10*Math.max(1,Math.abs(want),Math.abs(potential.get(edge.node)!))) {
          const ids = network.elements.filter((z): z is VoltageSource => z.kind==='voltage' && (potential.has(z.plus)||potential.has(z.minus))).map(z=>z.id);
          return err('CONTRADICTORY_VOLTAGE_LOOP', `Voltage sources ${[...new Set([...ids,edge.id])].join(', ')} form a loop with contradictory voltages.`);
        }
      }
    }
  }
  return null;
}

function solveLinear(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  const a = matrix.map((row,i)=>[...row,rhs[i]]);
  for(let col=0;col<n;col++) {
    let pivot=col, best=Math.abs(a[col][col]);
    for(let r=col+1;r<n;r++) if(Math.abs(a[r][col])>best) { best=Math.abs(a[r][col]); pivot=r; }
    let scale=0;
    for(let r=col;r<n;r++) for(let c=col;c<n;c++) scale=Math.max(scale,Math.abs(a[r][c]));
    if(best <= Number.EPSILON*Math.max(1,scale)*n*16) return null;
    if(pivot!==col) [a[pivot],a[col]]=[a[col],a[pivot]];
    const d=a[col][col];
    for(let c=col;c<=n;c++) a[col][c]/=d;
    for(let r=0;r<n;r++) if(r!==col) {
      const f=a[r][col];
      if(f===0) continue;
      for(let c=col;c<=n;c++) a[r][c]-=f*a[col][c];
    }
  }
  const result=a.map(row=>row[n]);
  return result.every(Number.isFinite)?result:null;
}

export function solveDc(network: DcNetwork): DcResult {
  const validation=validate(network);
  if(validation) return validation;
  const nodes=nodesOf(network.elements);
  const ground=network.ground;
  if(!network.elements.some(e => e.kind==='resistor' || e.kind==='voltage' || e.kind==='current')) return err('GROUND_NOT_USED', `Ground node "${ground}" is not used by any element.`);
  const unknownNodes=nodes.filter(n=>n!==ground);
  const nodeIndex=new Map(unknownNodes.map((n,i)=>[n,i]));
  const voltageSources=network.elements.filter((e):e is VoltageSource=>e.kind==='voltage');
  const size=unknownNodes.length+voltageSources.length;
  const matrix=Array.from({length:size},()=>Array<number>(size).fill(0));
  const rhs=Array<number>(size).fill(0);
  const idx=(n:string)=>n===ground?-1:nodeIndex.get(n)!;
  const add=(r:number,c:number,v:number)=>{if(r>=0&&c>=0)matrix[r][c]+=v;};
  for(const e of network.elements) {
    if(e.kind==='resistor') {
      const a=idx(e.a),b=idx(e.b),g=1/e.ohms;
      add(a,a,g);add(b,b,g);add(a,b,-g);add(b,a,-g);
    } else if(e.kind==='current') {
      const a=idx(e.from),b=idx(e.to);
      if(a>=0)rhs[a]-=e.amps;
      if(b>=0)rhs[b]+=e.amps;
    }
  }
  voltageSources.forEach((e,k)=>{
    const row=unknownNodes.length+k,a=idx(e.plus),b=idx(e.minus);
    add(a,row,1);add(row,a,1);add(b,row,-1);add(row,b,-1);
    rhs[row]=e.volts;
  });
  const solution=solveLinear(matrix,rhs);
  if(!solution) {
    const currentSources=network.elements.filter((e):e is CurrentSource=>e.kind==='current');
    if(currentSources.length) return err('CURRENT_SOURCE_NO_CLOSED_PATH', `Current source${currentSources.length===1?'':'s'} ${currentSources.map(e=>`"${e.id}"`).join(', ')} has no closed path for its imposed current.`);
    return err('SINGULAR_CIRCUIT','The circuit equations do not have one unique finite solution.');
  }
  const nodeVolts:Record<string,number>={};
  nodeVolts[ground]=0;
  unknownNodes.forEach((n,i)=>nodeVolts[n]=solution[i]);
  const sourceAmps=new Map<string,number>();
  voltageSources.forEach((e,k)=>sourceAmps.set(e.id,solution[unknownNodes.length+k]));
  const elements:SolvedElement[]=network.elements.map(e=>{
    let volts:number,amps:number;
    if(e.kind==='resistor') { volts=nodeVolts[e.a]-nodeVolts[e.b];amps=volts/e.ohms; }
    else if(e.kind==='voltage') { volts=e.volts;amps=sourceAmps.get(e.id)!; }
    else { volts=nodeVolts[e.from]-nodeVolts[e.to];amps=e.amps; }
    const watts=volts*amps;
    return {id:e.id,volts,amps,watts,role:watts<0?'supplies':'absorbs'};
  });
  const powerBalance=elements.reduce((s,e)=>s+e.watts,0);
  return {ok:true,nodeVolts,elements,assumptions:[...ASSUMPTIONS],powerBalance};
}

export function equivalentResistance(network: DcNetwork, a: string, b: string): EquivalentResistanceResult {
  if(!validNode(a)||!validNode(b)||a===b) return err('INVALID_EQUIVALENT_RESISTANCE','Choose two different, non-empty nodes for equivalent resistance.');
  if(!network||!Array.isArray(network.elements)||network.elements.some(e=>!e||e.kind!=='resistor'))
    return err('INVALID_EQUIVALENT_RESISTANCE','Equivalent resistance accepts resistor-only networks.');
  const validation=validate(network);
  if(validation) return validation;
  const allNodes=nodesOf(network.elements);
  if(!allNodes.includes(a)||!allNodes.includes(b)) return err('INVALID_EQUIVALENT_RESISTANCE','Both requested nodes must appear in the resistor network.');
  let testId='__equivalent_test_current__';
  const ids=new Set(network.elements.map(e=>e.id));
  while(ids.has(testId)) testId += '_';
  const injected:DcNetwork={ground:b,elements:[...network.elements,{kind:'current',id:testId,from:b,to:a,amps:1}]};
  const result=solveDc(injected);
  if(!result.ok) return result;
  const ohms=result.nodeVolts[a];
  if(!Number.isFinite(ohms)||ohms<0) return err('INVALID_EQUIVALENT_RESISTANCE','The requested nodes do not have a finite non-negative equivalent resistance.');
  return {ok:true,ohms,assumptions:[...ASSUMPTIONS]};
}
