import { remaining, reserve, type BudgetState } from './budgetBroker';
import { DEVICE_RESOURCES } from './resources/deviceResources';
import { TASK_RESOURCES } from './resources/taskResources';
import { ACCOUNT_RESOURCES } from './resources/accountResources';
import { BUILDER_RESOURCES } from './resources/builderResources';

type EngineSuccess<T> = { readonly ok: true; readonly value: T };
type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type BudgetDomain = 'DEVICE'|'TASK'|'ACCOUNT'|'BUILDER';
export type BudgetOutcome = 'AVAILABLE'|'CONSTRAINED'|'BLOCKED'|'UNKNOWN';
export type BudgetReasonCode = 'overrun'|'over-budget'|'no-figure'|'estimate-only'|'margin'|'reserve-only';
export type BudgetViewValue = { readonly domain: BudgetDomain; readonly outcome: BudgetOutcome;
  readonly reasons: readonly { readonly code: BudgetReasonCode; readonly resource: string }[];
  readonly basis: readonly { readonly resource: string; readonly basis: 'ESTIMATE'|'OBSERVED'; readonly samples: number }[];
  readonly ownerCost: boolean };

export const BUDGET_VIEW_TABLE = Object.freeze({
  sampleMinimum: 5 as const,
  smallRequestPercent: 10 as const,
  marginPercent: Object.freeze({ DEVICE: 20 as const, TASK: 20 as const, ACCOUNT: 20 as const, BUILDER: 20 as const })
});

const ERROR_MESSAGE = 'Budget view input is invalid.';
const RESOURCE_SETS = Object.freeze({
  DEVICE: DEVICE_RESOURCES,
  TASK: TASK_RESOURCES,
  ACCOUNT: ACCOUNT_RESOURCES,
  BUILDER: BUILDER_RESOURCES
});

function failure<T>(error: string): EngineResult<T> {
  return Object.freeze({ ok: false as const, error, message: ERROR_MESSAGE });
}
function plainObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function own(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function budgetView(input: unknown): EngineResult<BudgetViewValue> {
  try {
    if (!plainObject(input)) return failure('bad-input');
    const raw = input;
    if (raw.domain !== 'DEVICE' && raw.domain !== 'TASK' && raw.domain !== 'ACCOUNT' && raw.domain !== 'BUILDER') return failure('bad-domain');
    if (!plainObject(raw.state)) return failure('bad-state');
    const stateRaw = raw.state;
    if (!plainObject(stateRaw.capacity) || !plainObject(stateRaw.verificationReserve) ||
        !plainObject(stateRaw.used) || !plainObject(stateRaw.samples) ||
        !Array.isArray(stateRaw.observed) || !Array.isArray(stateRaw.reservations)) return failure('bad-state');
    if (!plainObject(raw.request)) return failure('bad-request');

    const domain = raw.domain;
    const state = stateRaw as unknown as BudgetState;
    const request = raw.request;
    const resources = RESOURCE_SETS[domain];
    const allowed = new Set<string>(resources.map(item => item.name));
    const requestKeys = Reflect.ownKeys(request);
    for (const key of requestKeys) {
      if (typeof key !== 'string' || !allowed.has(key)) return failure('unknown-resource');
    }
    const names = (requestKeys as string[]).sort();
    for (const name of names) {
      const amount = request[name];
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return failure('bad-amount');
    }
    if (!names.some(name => (request[name] as number) > 0)) return failure('empty-request');

    const reasons: Array<{ code: BudgetReasonCode; resource: string }> = [];
    const basis: Array<{ resource: string; basis: 'ESTIMATE'|'OBSERVED'; samples: number }> = [];
    let ownerCost = false;
    const remainingRows = remaining(state);
    for (const name of names) {
      const amount = request[name] as number;
      if (amount === 0) continue;
      const resourceInfo = resources.find(item => item.name === name);
      if (resourceInfo?.ownerCost === true) ownerCost = true;
      if (!own(state.capacity, name)) {
        reasons.push({ code: 'no-figure', resource: name });
        continue;
      }
      const samples = own(state.samples, name) ? state.samples[name] as number : 0;
      basis.push({ resource: name, basis: samples >= BUDGET_VIEW_TABLE.sampleMinimum ? 'OBSERVED' : 'ESTIMATE', samples });
      const remainingItem = remainingRows.find(item => item.resource === name);
      if (!remainingItem) return failure('bad-state');
      const available = remainingItem.remaining;
      if (available < 0) reasons.push({ code: 'overrun', resource: name });
      const reservation = reserve(state, '__budget_view_probe__', { [name]: amount }, 'work');
      if (!reservation.ok) {
        if (reservation.error !== 'over-budget') return failure('bad-state');
        reasons.push({ code: 'over-budget', resource: name });
      }
      if (samples < BUDGET_VIEW_TABLE.sampleMinimum &&
          amount * 100 > (state.capacity[name] as number) * BUDGET_VIEW_TABLE.smallRequestPercent) {
        reasons.push({ code: 'estimate-only', resource: name });
      }
      if (reservation.ok) {
        const after = available - amount;
        if (after * 100 < (state.capacity[name] as number) * BUDGET_VIEW_TABLE.marginPercent[domain]) {
          reasons.push({ code: 'margin', resource: name });
        }
        if (own(state.verificationReserve, name) &&
            (state.verificationReserve[name] as number) > 0 &&
            after === state.verificationReserve[name]) {
          reasons.push({ code: 'reserve-only', resource: name });
        }
      }
    }
    const blocked = reasons.some(item => item.code === 'overrun' || item.code === 'over-budget');
    const unknown = reasons.some(item => item.code === 'no-figure' || item.code === 'estimate-only');
    const outcome: BudgetOutcome = blocked ? 'BLOCKED' : unknown ? 'UNKNOWN' : reasons.length > 0 ? 'CONSTRAINED' : 'AVAILABLE';
    const frozenReasons = Object.freeze(reasons.map(item => Object.freeze({ ...item })));
    const frozenBasis = Object.freeze(basis.map(item => Object.freeze({ ...item })));
    const value = Object.freeze({ domain, outcome, reasons: frozenReasons, basis: frozenBasis, ownerCost });
    return Object.freeze({ ok: true as const, value });
  } catch {
    return failure('bad-state');
  }
}
