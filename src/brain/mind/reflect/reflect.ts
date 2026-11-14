// P06 REFLECTION (pure). After a task, decide what could be LEARNED. It only ever produces CANDIDATES.
// Nothing here can change the Charter, permissions, source code or trusted knowledge.
export type EngineSuccess<T> = { readonly ok: true; readonly value: T };
export type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
export type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type StepRecord = { readonly toolId: string; readonly ok: boolean; readonly verified: boolean; readonly assumption: string };
export type TaskRecord = {
  readonly taskId: string;
  readonly goal: string;
  readonly status: 'SUCCESS' | 'FAILED' | 'ABANDONED';
  readonly steps: readonly StepRecord[];
  readonly wrongAssumptions: readonly string[];
  readonly ownerCorrections: readonly string[];
  readonly memoryAllowed: boolean;
};
export type Candidate = {
  readonly kind: 'LESSON' | 'MISTAKE' | 'PREFERENCE' | 'TOOL_NOTE';
  readonly text: string;
  readonly stage: 'CANDIDATE';
  readonly needsRegressionTest: boolean;
  readonly expiresAfterDays: number | null;
  readonly source: string;
};
export type Reflection = {
  readonly progressMade: boolean;
  readonly completed: boolean;
  readonly candidates: readonly Candidate[];
  readonly dropped: readonly string[];
};

const fail = (message: string): EngineFailure => ({ ok: false, error: 'bad-input', message });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const clip = (s: string): string => (s.length > 500 ? s.slice(0, 500) : s);

export function reflect(record: unknown): EngineResult<Reflection> {
  if (!isObj(record)) return fail('The task record must be an object.');
  const { taskId, goal, status, steps, wrongAssumptions, ownerCorrections, memoryAllowed } = record;
  if (!nonEmpty(taskId) || !nonEmpty(goal)) return fail('taskId and goal are required.');
  if (status !== 'SUCCESS' && status !== 'FAILED' && status !== 'ABANDONED') return fail('status is not valid.');
  if (!Array.isArray(steps) || steps.length > 200) return fail('steps must be a list of at most 200.');
  for (const s of steps) {
    if (!isObj(s) || !nonEmpty(s.toolId) || typeof s.ok !== 'boolean' || typeof s.verified !== 'boolean' || typeof s.assumption !== 'string') return fail('a step record is not valid.');
  }
  if (!Array.isArray(wrongAssumptions) || wrongAssumptions.length > 50 || !wrongAssumptions.every((x) => typeof x === 'string')) return fail('wrongAssumptions must be a list of at most 50 strings.');
  if (!Array.isArray(ownerCorrections) || ownerCorrections.length > 50 || !ownerCorrections.every((x) => typeof x === 'string')) return fail('ownerCorrections must be a list of at most 50 strings.');
  if (typeof memoryAllowed !== 'boolean') return fail('memoryAllowed must be true or false.');

  const list = steps as readonly StepRecord[];
  const source = 'task:' + taskId;
  const progressMade = list.some((s) => s.ok && s.verified);
  const hasUnverified = list.some((s) => s.ok && !s.verified);
  const completed = status === 'SUCCESS' && list.length > 0 && !hasUnverified && list.every((s) => s.ok);
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const add = (c: Candidate): void => { if (!seen.has(c.kind + '|' + c.text)) { seen.add(c.kind + '|' + c.text); out.push(c); } };

  for (const a of wrongAssumptions as readonly string[]) {
    const t = a.trim();
    if (t !== '') add({ kind: 'MISTAKE', text: clip('Wrong assumption: ' + t), stage: 'CANDIDATE', needsRegressionTest: true, expiresAfterDays: null, source });
  }
  for (const s of list) if (!s.ok) add({ kind: 'TOOL_NOTE', text: clip(s.toolId + ' failed during ' + source), stage: 'CANDIDATE', needsRegressionTest: false, expiresAfterDays: 30, source });
  for (const s of list) if (s.ok && !s.verified) add({ kind: 'TOOL_NOTE', text: clip(s.toolId + ' result was never verified in ' + source), stage: 'CANDIDATE', needsRegressionTest: false, expiresAfterDays: 30, source });
  const dropped: string[] = [];
  const corrections = (ownerCorrections as readonly string[]).map((c) => c.trim()).filter((c) => c !== '');
  if (corrections.length > 0) {
    if (memoryAllowed) for (const c of corrections) add({ kind: 'PREFERENCE', text: clip(c), stage: 'CANDIDATE', needsRegressionTest: false, expiresAfterDays: null, source });
    else dropped.push(corrections.length + ' owner correction(s) not kept: memory is not allowed for this task');
  }
  if (status !== 'SUCCESS') add({ kind: 'LESSON', text: clip('Task did not succeed: ' + (goal as string).trim()), stage: 'CANDIDATE', needsRegressionTest: false, expiresAfterDays: 30, source });
  return { ok: true, value: { progressMade, completed, candidates: out, dropped } };
}
