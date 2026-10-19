import { nearestCompatible, sequentialGreedy, weightedSum } from './baselines';
import { screenDonors, type FilterStage, type Rejection } from './filters';
import { buildContext, dominates, donorTerms, evaluateSet, responseProbability, type PoolContext } from './objectives';
import { igd, nsga3Front, hashSeed, type NSGA3Options } from './nsga3';
import { combinations, paretoFront, selectFromFront, type ParetoPoint } from './selection';
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

export const ENGINE_VERSION = 'nsga3-1';

export interface MatchOptions {
  /** Search used for the live path. NSGA-III by default; 'pareto' is the exact search, kept as the oracle. */
  algorithm?: 'nsga3' | 'pareto';
  nsga3?: Partial<NSGA3Options>;
}

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
  /** Search that produced the chosen set. */
  algorithm: 'nsga3' | 'pareto';
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
  /** NSGA-III generations run, or 0 for the exact search. */
  generations: number;
  /** Distance of the NSGA-III front from the exact front, when the exact front could be computed. Zero is a perfect match. */
  igd: number | null;
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
  options: MatchOptions = {},
): MatchOutcome {
  const algorithm = options.algorithm ?? 'nsga3';
  const k = contactSetSize(request.units, request.urgency);
  const screening = screenDonors(pool, request, config);
  const ctx = buildContext(screening.eligible, request.recipientGroup, config, risk);
  const base = {
    algorithm,
    generations: 0,
    igd: null as number | null,
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

  // The seed comes from the request and the eligible donors, so the same inputs give the same set.
  const seed = hashSeed(
    `${request.recipientGroup}|${request.units}|${request.urgency}|${request.sector}|${screening.eligible.map((d) => d.id).sort().join(',')}`,
  );
  const exactSearch = () => paretoFront(screening.eligible, k, ctx, request.urgency);
  const nsga = algorithm === 'nsga3' ? nsga3Front(screening.eligible, k, ctx, request.urgency, { seed, ...options.nsga3 }) : null;
  const search = nsga
    ? { front: nsga.front, evaluated: nsga.evaluated, shortlisted: false, poolUsed: nsga.poolUsed }
    : exactSearch();
  // The exact front is the oracle: computed only when the pool is small enough to enumerate.
  const oracle =
    nsga && !nsga.exact && !nsga.fellBack && combinations(screening.eligible.length, k) <= ctx.config.maxCombinations
      ? exactSearch()
      : null;
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
  if (nsga?.fellBack) {
    warnings.push('The search ran out of time, so the sequential greedy set was used instead.');
  }
  if (search.shortlisted) {
    warnings.push(
      `The eligible pool is large, so the search covered the ${search.poolUsed} best-scoring donors to stay within the combination budget.`,
    );
  }

  const reference = oracle ? oracle.front : search.front;
  const comparison: AlgorithmOutcome[] = [
    outcomeFor(algorithm, selectedDonors, ctx, reference),
    outcomeFor('weighted', weightedSum(screening.eligible, k, request.urgency, ctx), ctx, reference),
    outcomeFor('greedy', sequentialGreedy(screening.eligible, k, ctx), ctx, reference),
    outcomeFor('nearest', nearestCompatible(screening.eligible, k), ctx, reference),
  ];
  if (nsga && oracle) {
    const exactChoice = selectFromFront(oracle.front, request.urgency);
    const byDonorId = new Map(screening.eligible.map((d) => [d.id, d]));
    const exactSet = (exactChoice?.donorIds ?? []).map((id) => byDonorId.get(id) as Donor);
    comparison.splice(1, 0, outcomeFor('pareto', exactSet, ctx, reference));
  }

  return {
    ...base,
    status: partial ? 'partial' : 'matched',
    selected: describe(selectedDonors, ctx),
    objectives: chosen?.objectives ?? null,
    front: search.front,
    evaluated: search.evaluated,
    shortlisted: search.shortlisted,
    generations: nsga?.generations ?? 0,
    igd: nsga && oracle ? igd(nsga.front, oracle.front) : null,
    comparison,
    warnings,
  };
}

export { responseProbability };
