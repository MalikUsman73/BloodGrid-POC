import { dominates, donorTerms, evaluateTerms, type DonorTerms, type PoolContext } from './objectives';
import type { Donor, ObjectiveKey, ObjectiveValues, Urgency } from './types';

export interface ParetoPoint {
  donorIds: string[];
  objectives: ObjectiveValues;
}

export interface ParetoSearch {
  front: ParetoPoint[];
  /** k-subsets actually evaluated. */
  evaluated: number;
  /** True when the pool was cut to a shortlist to stay within the combination budget. */
  shortlisted: boolean;
  poolUsed: number;
}

/** Number of k-subsets of n, as a float (large values lose precision, which is fine for a budget check). */
export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= Math.min(k, n - k); i += 1) r = (r * (n - i + 1)) / i;
  return Math.round(r);
}

/**
 * Importance of each objective when one point is chosen from the front. Critical requests favour
 * fulfilment and speed, routine requests favour donor recovery and conserving scarce groups.
 */
export const URGENCY_DIRECTION: Record<Urgency, Record<ObjectiveKey, number>> = {
  Critical: { fulfilment: 0.4, travel: 0.35, recovery: 0.1, preservation: 0.15 },
  Urgent: { fulfilment: 0.3, travel: 0.3, recovery: 0.2, preservation: 0.2 },
  Routine: { fulfilment: 0.2, travel: 0.15, recovery: 0.35, preservation: 0.3 },
};

/** Cheap per-donor score used only to shortlist a very large pool before enumeration. */
function shortlistScore(t: DonorTerms, urgency: Urgency, maxDist: number, maxDays: number, maxCost: number): number {
  const w = URGENCY_DIRECTION[urgency];
  return (
    w.travel * (1 - t.distance / Math.max(1e-9, maxDist)) +
    w.recovery * (t.days / Math.max(1e-9, maxDays)) +
    w.fulfilment * t.p +
    w.preservation * (1 - t.cost / Math.max(1e-9, maxCost))
  );
}

function tieKey(ids: string[]): string {
  return ids.join('|');
}

/**
 * Exact search: evaluate every k-subset of the pool and keep the non-dominated ones.
 * If the number of subsets exceeds the budget, the pool is first cut to the best-scoring
 * donors so that the count fits, and the result is flagged as shortlisted.
 */
export function paretoFront(
  eligible: readonly Donor[],
  k: number,
  ctx: PoolContext,
  urgency: Urgency,
): ParetoSearch {
  const all = eligible.map((d) => donorTerms(d, ctx)).sort((a, b) => a.donor.id.localeCompare(b.donor.id));
  let terms = all;
  let shortlisted = false;
  const budget = ctx.config.maxCombinations;
  if (combinations(all.length, k) > budget) {
    shortlisted = true;
    const maxDist = Math.max(...all.map((t) => t.distance));
    const maxDays = Math.max(...all.map((t) => t.days));
    const maxCost = Math.max(...all.map((t) => t.cost));
    const ranked = all
      .map((t) => ({ t, s: shortlistScore(t, urgency, maxDist, maxDays, maxCost) }))
      .sort((a, b) => b.s - a.s || a.t.donor.id.localeCompare(b.t.donor.id));
    let m = all.length;
    while (m > k && combinations(m, k) > budget) m -= 1;
    terms = ranked
      .slice(0, m)
      .map((r) => r.t)
      .sort((a, b) => a.donor.id.localeCompare(b.donor.id));
  }

  const n = terms.length;
  if (k <= 0 || n === 0) return { front: [], evaluated: 0, shortlisted, poolUsed: n };
  if (n <= k) {
    const objectives = evaluateTerms(terms);
    return {
      front: [{ donorIds: terms.map((t) => t.donor.id), objectives }],
      evaluated: 1,
      shortlisted,
      poolUsed: n,
    };
  }

  const front: { idx: number[]; objectives: ObjectiveValues }[] = [];
  const idx = Array.from({ length: k }, (_, i) => i);
  let evaluated = 0;
  for (;;) {
    evaluated += 1;
    const objectives = evaluateTerms(idx.map((i) => terms[i]));
    let dominated = false;
    for (const f of front) {
      if (dominates(f.objectives, objectives)) {
        dominated = true;
        break;
      }
    }
    if (!dominated) {
      for (let j = front.length - 1; j >= 0; j -= 1) {
        if (dominates(objectives, front[j].objectives)) front.splice(j, 1);
      }
      front.push({ idx: idx.slice(), objectives });
    }
    let p = k - 1;
    while (p >= 0 && idx[p] === n - k + p) p -= 1;
    if (p < 0) break;
    idx[p] += 1;
    for (let q = p + 1; q < k; q += 1) idx[q] = idx[q - 1] + 1;
  }

  return {
    front: front.map((f) => ({ donorIds: f.idx.map((i) => terms[i].donor.id), objectives: f.objectives })),
    evaluated,
    shortlisted,
    poolUsed: n,
  };
}

/** Direction of improvement for each objective. */
const MINIMISE: Record<ObjectiveKey, boolean> = {
  travel: true,
  recovery: false,
  fulfilment: false,
  preservation: true,
};

/**
 * Pick one set from the front with a weighted Chebyshev distance to the ideal point.
 * Objectives are scaled to 0 (best on the front) to 1 (worst on the front). Ties fall back to
 * the weighted sum, then to donor ids, so the choice is deterministic.
 */
export function selectFromFront(front: readonly ParetoPoint[], urgency: Urgency): ParetoPoint | null {
  if (front.length === 0) return null;
  const keys = Object.keys(MINIMISE) as ObjectiveKey[];
  const lo: Record<string, number> = {};
  const hi: Record<string, number> = {};
  for (const key of keys) {
    const values = front.map((p) => p.objectives[key]);
    lo[key] = Math.min(...values);
    hi[key] = Math.max(...values);
  }
  const weights = URGENCY_DIRECTION[urgency];
  let best: { point: ParetoPoint; cheb: number; sum: number } | null = null;
  for (const point of front) {
    let cheb = 0;
    let sum = 0;
    for (const key of keys) {
      const span = hi[key] - lo[key];
      const norm = span === 0 ? 0 : MINIMISE[key] ? (point.objectives[key] - lo[key]) / span : (hi[key] - point.objectives[key]) / span;
      cheb = Math.max(cheb, weights[key] * norm);
      sum += weights[key] * norm;
    }
    if (
      best === null ||
      cheb < best.cheb - 1e-12 ||
      (Math.abs(cheb - best.cheb) <= 1e-12 &&
        (sum < best.sum - 1e-12 ||
          (Math.abs(sum - best.sum) <= 1e-12 && tieKey(point.donorIds) < tieKey(best.point.donorIds))))
    ) {
      best = { point, cheb, sum };
    }
  }
  return best ? best.point : null;
}
