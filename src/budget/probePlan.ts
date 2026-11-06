import { BUDGET_VIEW_TABLE, type BudgetDomain } from './budgetView';
import { DEVICE_RESOURCES } from './resources/deviceResources';
import { TASK_RESOURCES } from './resources/taskResources';
import { ACCOUNT_RESOURCES } from './resources/accountResources';
import { BUILDER_RESOURCES } from './resources/builderResources';

type EngineSuccess<T> = { readonly ok: true; readonly value: T };
type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type ProbeSource = 'MEASURED'|'REPORTED';
export type ProbeOutcome = 'PROBE'|'NOT-NEEDED'|'NEEDS-OWNER-YES'|'CONFLICT'|'NO-RANGE';
export type ProbeRecord = { readonly domain: BudgetDomain; readonly resource: string;
  readonly provider: string; readonly model: string; readonly account: string; readonly taskClass: string; readonly workloadShape: string;
  readonly measured: number; readonly reported: number; readonly limitEvents: number;
  readonly safeHigh: number|null; readonly limitLow: number|null; readonly lastDate: string|null };
export type ProbePlanValue = { readonly outcome: ProbeOutcome; readonly maxAmount: number|null;
  readonly measured: number; readonly reported: number; readonly ownerCost: boolean };

export const PROBE_TABLE = Object.freeze({
  probePercent: 10 as const,
  labelMax: 64 as const,
  amountMax: 1000000000000 as const
});

const ERROR_MESSAGE = 'Probe input is invalid.';
const RESOURCE_SETS = Object.freeze({
  DEVICE: DEVICE_RESOURCES,
  TASK: TASK_RESOURCES,
  ACCOUNT: ACCOUNT_RESOURCES,
  BUILDER: BUILDER_RESOURCES
});
const RECORD_KEYS = [
  'domain','resource','provider','model','account','taskClass','workloadShape',
  'measured','reported','limitEvents','safeHigh','limitLow','lastDate'
] as const;

function failure<T>(error: string): EngineResult<T> {
  return Object.freeze({ ok: false as const, error, message: ERROR_MESSAGE });
}

function success<T>(value: T): EngineResult<T> {
  return Object.freeze({ ok: true as const, value });
}

function plainObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function own(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isDomain(value: unknown): value is BudgetDomain {
  return value === 'DEVICE' || value === 'TASK' || value === 'ACCOUNT' || value === 'BUILDER';
}

function isResource(domain: BudgetDomain, resource: unknown): resource is string {
  if (typeof resource !== 'string') return false;
  return RESOURCE_SETS[domain].some(item => item.name === resource);
}

function isLabel(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 &&
    value.length <= PROBE_TABLE.labelMax && value === value.trim();
}

function isWholeAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= 1 && value <= PROBE_TABLE.amountMax;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= 0 && value <= PROBE_TABLE.amountMax;
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 10) return false;
  for (let i = 0; i < 10; i++) {
    if (i === 4 || i === 7) {
      if (value[i] !== '-') return false;
    } else {
      const code = value.charCodeAt(i);
      if (code < 48 || code > 57) return false;
    }
  }
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function validRecord(value: unknown): value is ProbeRecord {
  if (!plainObject(value)) return false;
  for (const key of RECORD_KEYS) {
    if (!own(value, key)) return false;
  }
  if (!isDomain(value.domain)) return false;
  if (!isResource(value.domain, value.resource)) return false;
  if (!isLabel(value.provider) || !isLabel(value.model) || !isLabel(value.account) ||
      !isLabel(value.taskClass) || !isLabel(value.workloadShape)) return false;
  if (!isCount(value.measured) || !isCount(value.reported) || !isCount(value.limitEvents)) return false;
  if (value.safeHigh !== null && !isWholeAmount(value.safeHigh)) return false;
  if (value.limitLow !== null && !isWholeAmount(value.limitLow)) return false;
  if (value.lastDate !== null && !isDate(value.lastDate)) return false;
  const ranCount = value.measured + value.reported;
  const allCount = ranCount + value.limitEvents;
  if ((value.safeHigh === null) !== (ranCount === 0)) return false;
  if ((value.limitLow === null) !== (value.limitEvents === 0)) return false;
  if ((value.lastDate === null) !== (allCount === 0)) return false;
  return true;
}

function makeRecord(
  domain: BudgetDomain, resource: string, provider: string, model: string,
  account: string, taskClass: string, workloadShape: string,
  measured: number, reported: number, limitEvents: number,
  safeHigh: number|null, limitLow: number|null, lastDate: string|null
): ProbeRecord {
  return Object.freeze({
    domain, resource, provider, model, account, taskClass, workloadShape,
    measured, reported, limitEvents, safeHigh, limitLow, lastDate
  });
}

export function newProbeRecord(input: unknown): EngineResult<ProbeRecord> {
  try {
    if (!plainObject(input)) return failure('bad-input');
    const raw = input;
    if (!isDomain(raw.domain)) return failure('bad-domain');
    if (!isResource(raw.domain, raw.resource)) return failure('bad-resource');
    if (!isLabel(raw.provider) || !isLabel(raw.model) || !isLabel(raw.account) ||
        !isLabel(raw.taskClass) || !isLabel(raw.workloadShape)) return failure('bad-label');
    const record = makeRecord(
      raw.domain, raw.resource, raw.provider, raw.model, raw.account, raw.taskClass, raw.workloadShape,
      0, 0, 0, null, null, null
    );
    return success(record);
  } catch {
    return failure('bad-input');
  }
}

export function recordSample(input: unknown): EngineResult<ProbeRecord> {
  try {
    if (!plainObject(input)) return failure('bad-input');
    const raw = input;
    if (!validRecord(raw.record)) return failure('bad-record');
    if (!plainObject(raw.sample)) return failure('bad-sample');
    const sample = raw.sample;
    if (sample.kind !== 'ran' && sample.kind !== 'limit') return failure('bad-sample');
    if (sample.source !== 'MEASURED' && sample.source !== 'REPORTED') return failure('bad-sample');
    if (!isWholeAmount(sample.amount) || !isDate(sample.date)) return failure('bad-sample');
    if (sample.kind === 'limit' && sample.source === 'MEASURED') return failure('bad-sample');

    const record = raw.record;
    const measured = record.measured + (sample.kind === 'ran' && sample.source === 'MEASURED' ? 1 : 0);
    const reported = record.reported + (sample.kind === 'ran' && sample.source === 'REPORTED' ? 1 : 0);
    const limitEvents = record.limitEvents + (sample.kind === 'limit' ? 1 : 0);
    if (!isCount(measured) || !isCount(reported) || !isCount(limitEvents)) return failure('bad-sample');

    let safeHigh = record.safeHigh;
    let limitLow = record.limitLow;
    if (sample.kind === 'ran') safeHigh = safeHigh === null ? sample.amount : Math.max(safeHigh, sample.amount);
    if (sample.kind === 'limit') limitLow = limitLow === null ? sample.amount : Math.min(limitLow, sample.amount);
    const lastDate = record.lastDate === null || sample.date > record.lastDate ? sample.date : record.lastDate;

    const next = makeRecord(
      record.domain, record.resource, record.provider, record.model, record.account, record.taskClass, record.workloadShape,
      measured, reported, limitEvents, safeHigh, limitLow, lastDate
    );
    return success(next);
  } catch {
    return failure('bad-input');
  }
}

export function planProbe(input: unknown): EngineResult<ProbePlanValue> {
  try {
    if (!plainObject(input)) return failure('bad-input');
    const raw = input;
    if (!validRecord(raw.record)) return failure('bad-record');
    if (raw.ownerYes !== true && raw.ownerYes !== false) return failure('bad-owner-yes');

    const record = raw.record;
    const ownerCost = RESOURCE_SETS[record.domain].some(
      item => item.name === record.resource && item.ownerCost === true
    );
    const conflict = record.limitLow !== null && record.safeHigh !== null &&
      record.limitLow <= record.safeHigh;
    const maxAmount = record.safeHigh === null ? null :
      Math.floor(record.safeHigh * PROBE_TABLE.probePercent / 100);

    let outcome: ProbeOutcome;
    if (conflict) outcome = 'CONFLICT';
    else if (record.measured >= BUDGET_VIEW_TABLE.sampleMinimum) outcome = 'NOT-NEEDED';
    else if (ownerCost && raw.ownerYes === false) outcome = 'NEEDS-OWNER-YES';
    else if (maxAmount === null || maxAmount < 1) outcome = 'NO-RANGE';
    else outcome = 'PROBE';

    const value: ProbePlanValue = Object.freeze({
      outcome,
      maxAmount: outcome === 'PROBE' ? maxAmount : null,
      measured: record.measured,
      reported: record.reported,
      ownerCost
    });
    return success(value);
  } catch {
    return failure('bad-input');
  }
}
