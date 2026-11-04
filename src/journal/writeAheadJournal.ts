export type EngineSuccess<T> = { readonly ok: true; readonly value: T };
export type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
export type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type StartEntry = { readonly seq: number; readonly jobId: string; readonly kind: 'start'; readonly steps: readonly string[] };
export type BeginEntry = { readonly seq: number; readonly jobId: string; readonly kind: 'begin'; readonly step: string };
export type DoneEntry = { readonly seq: number; readonly jobId: string; readonly kind: 'done'; readonly step: string; readonly output: string };
export type EndEntry = { readonly seq: number; readonly jobId: string; readonly kind: 'end' };
export type JournalEntry = StartEntry | BeginEntry | DoneEntry | EndEntry;
export type Journal = readonly JournalEntry[];

export type ResumePlan = {
  readonly completed: readonly { readonly step: string; readonly output: string }[];
  readonly next: string | null;
  readonly retry: boolean;
  readonly finished: boolean;
};
export type RunJobValue = { readonly journal: Journal; readonly executed: readonly string[] };
export type RunJobResult = EngineSuccess<RunJobValue> | (EngineFailure & { readonly journal: Journal; readonly executed: readonly string[] });
export type ParsedJournal = { readonly journal: Journal; readonly tornTail: boolean };

function failure<T = never>(error: string, message: string): EngineResult<T> {
  return Object.freeze({ ok: false, error, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result.length > 0 ? result : null;
}

function freezeEntries(entries: readonly JournalEntry[]): Journal {
  const copied: JournalEntry[] = entries.map((entry) => {
    if (entry.kind === 'start') {
      return Object.freeze({ seq: entry.seq, jobId: entry.jobId, kind: 'start', steps: Object.freeze(entry.steps.slice()) });
    }
    if (entry.kind === 'begin') return Object.freeze({ seq: entry.seq, jobId: entry.jobId, kind: 'begin', step: entry.step });
    if (entry.kind === 'done') return Object.freeze({ seq: entry.seq, jobId: entry.jobId, kind: 'done', step: entry.step, output: entry.output });
    return Object.freeze({ seq: entry.seq, jobId: entry.jobId, kind: 'end' });
  });
  return Object.freeze(copied);
}

type JobState = {
  readonly steps: string[];
  readonly completed: Array<{ step: string; output: string }>;
  pendingBegins: number;
  ended: boolean;
};
type Inspection = { readonly ok: true; readonly entries: Journal; readonly jobs: Map<string, JobState> } | EngineFailure;

function inspectJournal(input: unknown): Inspection {
  if (!Array.isArray(input)) return { ok: false, error: 'invalid-journal', message: 'Journal must be an array.' };
  const entries: JournalEntry[] = [];
  const jobs = new Map<string, JobState>();

  for (let index = 0; index < input.length; index += 1) {
    const raw: unknown = input[index];
    if (!isRecord(raw) || raw.seq !== index + 1 || typeof raw.jobId !== 'string' || clean(raw.jobId) === null) {
      return { ok: false, error: 'damaged-journal', message: `Journal entry ${index + 1} has an invalid sequence or identity.` };
    }
    const jobId = clean(raw.jobId)!;
    if (raw.kind === 'start') {
      if (jobs.has(jobId) || !Array.isArray(raw.steps) || raw.steps.length === 0 || raw.steps.length > 1000) {
        return { ok: false, error: 'damaged-journal', message: `Start entry for ${jobId} is invalid.` };
      }
      const steps: string[] = [];
      const seen = new Set<string>();
      for (const rawStep of raw.steps) {
        const step = clean(rawStep);
        if (step === null || seen.has(step)) return { ok: false, error: 'damaged-journal', message: `Start entry for ${jobId} has an invalid or repeated step.` };
        seen.add(step);
        steps.push(step);
      }
      const entry: StartEntry = Object.freeze({ seq: index + 1, jobId, kind: 'start', steps: Object.freeze(steps.slice()) });
      entries.push(entry);
      jobs.set(jobId, { steps, completed: [], pendingBegins: 0, ended: false });
      continue;
    }

    const state = jobs.get(jobId);
    if (state === undefined || state.ended) {
      return { ok: false, error: 'damaged-journal', message: `Entry ${index + 1} refers to an unknown or finished job.` };
    }
    const nextStep = state.steps[state.completed.length];

    if (raw.kind === 'begin') {
      const step = clean(raw.step);
      if (step === null || nextStep === undefined || step !== nextStep) {
        return { ok: false, error: 'damaged-journal', message: `Begin entry ${index + 1} is out of order.` };
      }
      state.pendingBegins += 1;
      entries.push(Object.freeze({ seq: index + 1, jobId, kind: 'begin', step }));
      continue;
    }

    if (raw.kind === 'done') {
      const step = clean(raw.step);
      if (step === null || typeof raw.output !== 'string' || nextStep === undefined || step !== nextStep || state.pendingBegins < 1) {
        return { ok: false, error: 'damaged-journal', message: `Done entry ${index + 1} has no matching begin.` };
      }
      entries.push(Object.freeze({ seq: index + 1, jobId, kind: 'done', step, output: raw.output }));
      state.completed.push({ step, output: raw.output });
      state.pendingBegins = 0;
      continue;
    }

    if (raw.kind === 'end') {
      if (state.completed.length !== state.steps.length || state.pendingBegins !== 0) {
        return { ok: false, error: 'damaged-journal', message: `End entry ${index + 1} appears before all steps are done.` };
      }
      state.ended = true;
      entries.push(Object.freeze({ seq: index + 1, jobId, kind: 'end' }));
      continue;
    }

    return { ok: false, error: 'damaged-journal', message: `Journal entry ${index + 1} has an unknown kind.` };
  }

  return { ok: true, entries: freezeEntries(entries), jobs };
}

function append(journal: Journal, entry: Omit<StartEntry, 'seq'> | Omit<BeginEntry, 'seq'> | Omit<DoneEntry, 'seq'> | Omit<EndEntry, 'seq'>): Journal {
  const next = [...journal, { ...entry, seq: journal.length + 1 } as JournalEntry];
  return freezeEntries(next);
}

export function startJob(journal: Journal, jobId: string, steps: string[]): EngineResult<Journal> {
  const inspected = inspectJournal(journal);
  if (!inspected.ok) return failure(inspected.error, inspected.message);
  const id = clean(jobId);
  if (id === null) return failure('invalid-job-id', 'Job id must be a non-empty string.');
  if (inspected.jobs.has(id)) return failure('duplicate-job-id', `Job ${id} already exists.`);
  if (!Array.isArray(steps) || steps.length === 0 || steps.length > 1000) {
    return failure('invalid-steps', 'A job needs 1 to 1,000 steps.');
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const rawStep of steps) {
    const step = clean(rawStep);
    if (step === null || seen.has(step)) return failure('invalid-steps', 'Steps must be unique non-empty strings.');
    normalized.push(step);
    seen.add(step);
  }
  return Object.freeze({ ok: true, value: append(inspected.entries, { jobId: id, kind: 'start', steps: normalized }) });
}

export function beginStep(journal: Journal, jobId: string): EngineResult<Journal> {
  const inspected = inspectJournal(journal);
  if (!inspected.ok) return failure(inspected.error, inspected.message);
  const id = clean(jobId);
  if (id === null) return failure('invalid-job-id', 'Job id must be a non-empty string.');
  const state = inspected.jobs.get(id);
  if (state === undefined) return failure('unknown-job', `Job ${id} does not exist.`);
  if (state.ended) return failure('job-finished', `Job ${id} is already finished.`);
  const step = state.steps[state.completed.length];
  if (step === undefined) return failure('job-complete', `Job ${id} has no remaining step.`);
  return Object.freeze({ ok: true, value: append(inspected.entries, { jobId: id, kind: 'begin', step }) });
}

export function finishStep(journal: Journal, jobId: string, output: string): EngineResult<Journal> {
  const inspected = inspectJournal(journal);
  if (!inspected.ok) return failure(inspected.error, inspected.message);
  const id = clean(jobId);
  if (id === null) return failure('invalid-job-id', 'Job id must be a non-empty string.');
  if (typeof output !== 'string') return failure('invalid-output', 'Step output must be a string.');
  const state = inspected.jobs.get(id);
  if (state === undefined) return failure('unknown-job', `Job ${id} does not exist.`);
  if (state.ended) return failure('job-finished', `Job ${id} is already finished.`);
  const step = state.steps[state.completed.length];
  if (step === undefined || state.pendingBegins < 1) return failure('step-not-begun', 'The next step must have a begin entry before it can finish.');
  return Object.freeze({ ok: true, value: append(inspected.entries, { jobId: id, kind: 'done', step, output }) });
}

export function finishJob(journal: Journal, jobId: string): EngineResult<Journal> {
  const inspected = inspectJournal(journal);
  if (!inspected.ok) return failure(inspected.error, inspected.message);
  const id = clean(jobId);
  if (id === null) return failure('invalid-job-id', 'Job id must be a non-empty string.');
  const state = inspected.jobs.get(id);
  if (state === undefined) return failure('unknown-job', `Job ${id} does not exist.`);
  if (state.ended) return failure('job-finished', `Job ${id} is already finished.`);
  if (state.completed.length !== state.steps.length || state.pendingBegins !== 0) {
    return failure('steps-incomplete', 'Every step must be done before the job can end.');
  }
  return Object.freeze({ ok: true, value: append(inspected.entries, { jobId: id, kind: 'end' }) });
}

export function planResume(journal: Journal, jobId: string): EngineResult<ResumePlan> {
  const inspected = inspectJournal(journal);
  if (!inspected.ok) return failure(inspected.error, inspected.message);
  const id = clean(jobId);
  if (id === null) return failure('invalid-job-id', 'Job id must be a non-empty string.');
  const state = inspected.jobs.get(id);
  if (state === undefined) return failure('unknown-job', `Job ${id} does not exist.`);
  const next = state.steps[state.completed.length] ?? null;
  const completed = state.completed.map((item) => Object.freeze({ step: item.step, output: item.output }));
  return Object.freeze({ ok: true, value: Object.freeze({
    completed: Object.freeze(completed),
    next,
    retry: next !== null && state.pendingBegins > 0,
    finished: state.ended,
  }) });
}

export function runJob(
  journal: Journal,
  jobId: string,
  execute: (step: string, outputsSoFar: string[]) => string,
): RunJobResult {
  const inspected = inspectJournal(journal);
  if (!inspected.ok) return Object.freeze({ ...inspected, journal: freezeEntries([]), executed: Object.freeze([]) });
  const id = clean(jobId);
  if (id === null) return Object.freeze({ ok: false, error: 'invalid-job-id', message: 'Job id must be a non-empty string.', journal: inspected.entries, executed: Object.freeze([]) });
  if (typeof execute !== 'function') return Object.freeze({ ok: false, error: 'invalid-executor', message: 'Executor must be a function.', journal: inspected.entries, executed: Object.freeze([]) });
  const initial = inspected.jobs.get(id);
  if (initial === undefined) return Object.freeze({ ok: false, error: 'unknown-job', message: `Job ${id} does not exist.`, journal: inspected.entries, executed: Object.freeze([]) });
  if (initial.ended) return Object.freeze({ ok: true, value: Object.freeze({ journal: inspected.entries, executed: Object.freeze([]) }) });

  let current = inspected.entries;
  const executed: string[] = [];
  while (true) {
    const plan = planResume(current, id);
    if (!plan.ok) return Object.freeze({ ok: false, error: plan.error, message: plan.message, journal: current, executed: Object.freeze(executed.slice()) });
    const step = plan.value.next;
    if (step === null) break;
    const begun = beginStep(current, id);
    if (!begun.ok) return Object.freeze({ ok: false, error: begun.error, message: begun.message, journal: current, executed: Object.freeze(executed.slice()) });
    current = begun.value;
    executed.push(step);
    const outputs = plan.value.completed.map((item) => item.output);
    let output: string;
    try {
      output = execute(step, outputs);
      if (typeof output !== 'string') throw new TypeError('Executor returned a non-string output.');
    } catch (thrown) {
      let message = 'Step execution failed.';
      if (thrown instanceof Error && typeof thrown.message === 'string') message = thrown.message;
      else if (typeof thrown === 'string') message = thrown;
      return Object.freeze({ ok: false, error: 'step-failed', message, journal: current, executed: Object.freeze(executed.slice()) });
    }
    const finished = finishStep(current, id, output);
    if (!finished.ok) return Object.freeze({ ok: false, error: finished.error, message: finished.message, journal: current, executed: Object.freeze(executed.slice()) });
    current = finished.value;
  }

  const ended = finishJob(current, id);
  if (!ended.ok && ended.error !== 'job-finished') {
    return Object.freeze({ ok: false, error: ended.error, message: ended.message, journal: current, executed: Object.freeze(executed.slice()) });
  }
  current = ended.ok ? ended.value : current;
  return Object.freeze({ ok: true, value: Object.freeze({ journal: current, executed: Object.freeze(executed.slice()) }) });
}

export function serializeJournal(journal: Journal): EngineResult<string> {
  const inspected = inspectJournal(journal);
  if (!inspected.ok) return failure(inspected.error, inspected.message);
  if (inspected.entries.length === 0) return Object.freeze({ ok: true, value: '' });
  const text = inspected.entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n';
  return Object.freeze({ ok: true, value: text });
}

export function parseJournal(text: string): EngineResult<ParsedJournal> {
  if (typeof text !== 'string') return failure('invalid-text', 'Journal text must be a string.');
  if (text.length === 0) return Object.freeze({ ok: true, value: Object.freeze({ journal: freezeEntries([]), tornTail: false }) });

  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  let tornTail = false;
  const parsed: unknown[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    try {
      parsed.push(JSON.parse(line) as unknown);
    } catch {
      if (index !== lines.length - 1) return failure('damaged-journal', `Journal line ${index + 1} is damaged before the tail.`);
      tornTail = true;
    }
  }
  const inspected = inspectJournal(parsed);
  if (!inspected.ok) return failure('damaged-journal', inspected.message);
  return Object.freeze({ ok: true, value: Object.freeze({ journal: inspected.entries, tornTail }) });
}
