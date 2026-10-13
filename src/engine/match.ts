import { nearestCompatible, sequentialGreedy, weightedSum } from './baselines';
import { screenDonors, type FilterStage, type Rejection } from './filters';
import { buildContext, dominates, donorTerms, evaluateSet, responseProbability, type PoolContext } from './objectives';
import { paretoFront, selectFromFront, type ParetoPoint } from './selection';
import { contactSetSize } from './setSize';
import {
  DEFAULT_CONFIG,
  type AlgorithmId,
  type BloodGroup,
  type Donor,
  type MatchConfig,
  type MatchRequest,
  type ObjectiveValues,
} from './types';

export const ENGINE_VERSION = 'exact-pareto-1';

export type MatchStatus = 'matched' | 'partial' | 'empty-pool' | 'none-eligible';

export interface SelectedDonor {
  donor: Donor;
  /** Estimated response probability. */
  p: number;
  /** Type-preservation cost of spending this donor on this request. */
  cost: number;
}

export interface AlgorithmOutcome {
  algorithm: AlgorithmId;
  donors: SelectedDonor[];
  objectives: ObjectiveValues;
  /** True when some contact set beats this one on every objective (so the method left value on the table). */
  dominated: boolean;
}

export interface MatchOutcome {
  status: MatchStatus;
  request: MatchRequest;
  /** Requested contact set size. */
  k: number;
  poolSize: number;
  stages: FilterStage[];
  rejections: Rejection[];
  eligibleCount: number;
  /** Chosen set (exact Pareto selection). Empty when no one is eligible. */
  selected: SelectedDonor[];
  objectives: ObjectiveValues | null;
  front: ParetoPoint[];
  evaluated: number;
  shortlisted: boolean;
  /** Same request through each method, for comparison. */
  comparison: AlgorithmOutcome[];
  /** Human-readable notes: a shortfall, a shortlist, an empty result. */
  warnings: string[];
  context: PoolContext;
}

function describe(set: readonly Donor[], ctx: PoolContext): SelectedDonor[] {
  return set.map((donor) => {
    const t = donorTerms(donor, ctx);
    return { donor, p: t.p, cost: t.cost };
  });
}

function outcomeFor(
  algorithm: AlgorithmId,
  set: readonly Donor[],
  ctx: PoolContext,
  front: readonly ParetoPoint[],
): AlgorithmOutcome {
  const objectives = evaluateSet(set, ctx);
  return {
    algorithm,
    donors: describe(set, ctx),
    objectives,
    dominated: front.some((p) => dominates(p.objectives, objectives)),
  };
}

/** Run the whole pipeline: screen, size, search, select. Pure and deterministic. */
export function runMatch(
  pool: readonly Donor[],
  request: MatchRequest,
  config: MatchConfig = DEFAULT_CONFIG,
  risk: Partial<Record<BloodGroup, number>> = {},
): MatchOutcome {
  const k = contactSetSize(request.units, request.urgency);
  const screening = screenDonors(pool, request, config);
  const ctx = buildContext(screening.eligible, request.recipientGroup, config, risk);
  const base = {
    request,
    k,
    poolSize: pool.length,
    stages: screening.stages,
    rejections: screening.rejections,
    eligibleCount: screening.eligible.length,
    context: ctx,
  };

  if (pool.length === 0) {
    return {
      ...base, status: 'empty-pool', selected: [], objectives: null, front: [], evaluated: 0,
      shortlisted: false, comparison: [], warnings: ['The donor pool is empty.'],
    };
  }
  if (screening.eligible.length === 0) {
    return {
      ...base, status: 'none-eligible', selected: [], objectives: null, front: [], evaluated: 0,
      shortlisted: false, comparison: [],
      warnings: ['No donor passes every screening rule for this request.'],
    };
  }

  const search = paretoFront(screening.eligible, k, ctx, request.urgency);
  const chosen = selectFromFront(search.front, request.urgency);
  const byId = new Map(screening.eligible.map((d) => [d.id, d]));
  const selectedDonors = (chosen?.donorIds ?? []).map((id) => byId.get(id) as Donor);

  const warnings: string[] = [];
  const partial = screening.eligible.length < k;
  if (partial) {
    warnings.push(
      `Only ${screening.eligible.length} eligible ${screening.eligible.length === 1 ? 'donor is' : 'donors are'} available for a contact set of ${k}. All of them are notified.`,
    );
  }
  if (search.shortlisted) {
    warnings.push(
      `The eligible pool is large, so the search covered the ${search.poolUsed} best-scoring donors to stay within the combination budget.`,
    );
  }

  const comparison: AlgorithmOutcome[] = [
    outcomeFor('pareto', selectedDonors, ctx, search.front),
    outcomeFor('weighted', weightedSum(screening.eligible, k, request.urgency, ctx), ctx, search.front),
    outcomeFor('greedy', sequentialGreedy(screening.eligible, k, ctx), ctx, search.front),
    outcomeFor('nearest', nearestCompatible(screening.eligible, k), ctx, search.front),
  ];

  return {
    ...base,
    status: partial ? 'partial' : 'matched',
    selected: describe(selectedDonors, ctx),
    objectives: chosen?.objectives ?? null,
    front: search.front,
    evaluated: search.evaluated,
    shortlisted: search.shortlisted,
    comparison,
    warnings,
  };
}

export { responseProbability };
