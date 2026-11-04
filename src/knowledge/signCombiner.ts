export type EngineSuccess<T> = { readonly ok: true; readonly value: T };
export type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
export type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type Rule = {
  readonly id: string;
  readonly ifAll: readonly string[];
  readonly concludes: string;
  readonly weight: number;
  readonly baseRate?: number;
};

export type InferredConclusion = {
  readonly conclusion: string;
  readonly score: number;
  readonly label: 'INFERRED';
  readonly signsUsed: readonly string[];
  readonly rulesUsed: readonly string[];
  readonly chance: number | null;
  readonly basis: string;
};

export type NearMiss = {
  readonly ruleId: string;
  readonly missingSign: string;
  readonly concludes: string;
};

export type SignCombination = {
  readonly conclusions: readonly InferredConclusion[];
  readonly nearMisses: readonly NearMiss[];
  readonly reason: 'no-rule-matched' | null;
};

function failure<T = never>(error: string, message: string): EngineResult<T> {
  return Object.freeze({ ok: false, error, message });
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function combineSigns(observed: string[], rules: Rule[]): EngineResult<SignCombination> {
  if (!Array.isArray(observed)) return failure('invalid-observed', 'Observed signs must be an array.');
  if (!Array.isArray(rules)) return failure('invalid-rules', 'Rules must be an array.');
  if (rules.length === 0) return failure('no-rule-table', 'At least one rule is required.');
  if (rules.length > 1000) return failure('too-many-rules', 'The rule table cannot exceed 1,000 rules.');

  const observedSet = new Set<string>();
  for (let index = 0; index < observed.length; index += 1) {
    const sign = cleanText(observed[index]);
    if (sign === null) return failure('invalid-sign', `Observed sign ${index} must be a non-empty string.`);
    observedSet.add(sign);
  }

  const ids = new Set<string>();
  const normalizedRules: Array<{ id: string; ifAll: string[]; concludes: string; weight: number; baseRate?: number }> = [];
  for (let index = 0; index < rules.length; index += 1) {
    const candidate: unknown = rules[index];
    if (candidate === null || typeof candidate !== 'object') {
      return failure('invalid-rule', `Rule ${index} must be an object.`);
    }
    const raw = candidate as Record<string, unknown>;
    const id = cleanText(raw.id);
    const concludes = cleanText(raw.concludes);
    if (id === null) return failure('invalid-rule-id', `Rule ${index} needs a non-empty id.`);
    if (ids.has(id)) return failure('duplicate-rule-id', `Rule id ${id} is duplicated.`);
    ids.add(id);
    if (concludes === null) return failure('invalid-conclusion', `Rule ${id} needs a non-empty conclusion.`);
    if (!Array.isArray(raw.ifAll) || raw.ifAll.length === 0) {
      return failure('empty-rule-signs', `Rule ${id} needs at least one required sign.`);
    }
    if (raw.ifAll.length > 200) return failure('too-many-rule-signs', `Rule ${id} exceeds 200 signs.`);
    if (typeof raw.weight !== 'number' || !Number.isFinite(raw.weight) || raw.weight <= 0) {
      return failure('invalid-weight', `Rule ${id} needs a finite weight greater than zero.`);
    }
    let baseRate: number | undefined;
    if (raw.baseRate !== undefined) {
      if (typeof raw.baseRate !== 'number' || !Number.isFinite(raw.baseRate) || raw.baseRate < 0 || raw.baseRate > 1) {
        return failure('invalid-base-rate', `Rule ${id} baseRate must be between zero and one.`);
      }
      baseRate = raw.baseRate;
    }
    const signSet = new Set<string>();
    for (let signIndex = 0; signIndex < raw.ifAll.length; signIndex += 1) {
      const sign = cleanText(raw.ifAll[signIndex]);
      if (sign === null) return failure('invalid-rule-sign', `Rule ${id} has an empty or invalid sign.`);
      signSet.add(sign);
    }
    const normalized: { id: string; ifAll: string[]; concludes: string; weight: number; baseRate?: number } = {
      id,
      ifAll: Array.from(signSet).sort(compareCodeUnits),
      concludes,
      weight: raw.weight,
    };
    if (baseRate !== undefined) normalized.baseRate = baseRate;
    normalizedRules.push(normalized);
  }

  const groups = new Map<string, {
    score: number;
    signs: Set<string>;
    rules: string[];
    basisRule: { id: string; signCount: number; weight: number; baseRate?: number } | null;
  }>();
  const nearMisses: NearMiss[] = [];

  for (const rule of normalizedRules) {
    const missing = rule.ifAll.filter((sign) => !observedSet.has(sign));
    if (missing.length === 1) {
      nearMisses.push(Object.freeze({ ruleId: rule.id, missingSign: missing[0]!, concludes: rule.concludes }));
    }
    if (missing.length !== 0) continue;

    let group = groups.get(rule.concludes);
    if (group === undefined) {
      group = { score: 0, signs: new Set<string>(), rules: [], basisRule: null };
      groups.set(rule.concludes, group);
    }
    group.score += rule.weight;
    if (!Number.isFinite(group.score)) return failure('score-overflow', 'Matching rule weights produced a non-finite score.');
    for (const sign of rule.ifAll) group.signs.add(sign);
    group.rules.push(rule.id);

    const current = group.basisRule;
    const hasPriority = current === null
      || rule.ifAll.length > current.signCount
      || (rule.ifAll.length === current.signCount && rule.weight > current.weight)
      || (rule.ifAll.length === current.signCount && rule.weight === current.weight && compareCodeUnits(rule.id, current.id) < 0);
    if (hasPriority) {
      const basis: { id: string; signCount: number; weight: number; baseRate?: number } = {
        id: rule.id,
        signCount: rule.ifAll.length,
        weight: rule.weight,
      };
      if (rule.baseRate !== undefined) basis.baseRate = rule.baseRate;
      group.basisRule = basis;
    }
  }

  const conclusions: InferredConclusion[] = [];
  for (const [conclusion, group] of groups) {
    const selected = group.basisRule;
    const chance = selected?.baseRate ?? null;
    conclusions.push(Object.freeze({
      conclusion,
      score: group.score,
      label: 'INFERRED',
      signsUsed: Object.freeze(Array.from(group.signs).sort(compareCodeUnits)),
      rulesUsed: Object.freeze(group.rules.slice().sort(compareCodeUnits)),
      chance,
      basis: selected?.baseRate === undefined
        ? 'no measured basis'
        : `base rate ${selected.baseRate} from rule ${selected.id}`,
    }));
  }
  conclusions.sort((left, right) => right.score - left.score || compareCodeUnits(left.conclusion, right.conclusion));
  nearMisses.sort((left, right) => compareCodeUnits(left.ruleId, right.ruleId));

  const value: SignCombination = Object.freeze({
    conclusions: Object.freeze(conclusions),
    nearMisses: Object.freeze(nearMisses),
    reason: conclusions.length === 0 ? 'no-rule-matched' : null,
  });
  return Object.freeze({ ok: true, value });
}
