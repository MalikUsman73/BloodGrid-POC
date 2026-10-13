import { isCompatible, versatility } from './compatibility';
import type { BloodGroup, Donor, MatchConfig, ObjectiveValues } from './types';

/** Facts about the filtered pool that the objectives depend on. */
export interface PoolContext {
  recipientGroup: BloodGroup;
  /** Pool mean response rate, the shrinkage target. */
  poolRate: number;
  /** Share of each group in the eligible pool. */
  share: Partial<Record<BloodGroup, number>>;
  /** Forecast shortage risk per group, 0 to 1 (CCP-2 link, zero until integrated). */
  risk: Partial<Record<BloodGroup, number>>;
  config: MatchConfig;
}

export function buildContext(
  eligible: readonly Donor[],
  recipientGroup: BloodGroup,
  config: MatchConfig,
  risk: Partial<Record<BloodGroup, number>> = {},
): PoolContext {
  let accepted = 0;
  let received = 0;
  const counts: Partial<Record<BloodGroup, number>> = {};
  for (const d of eligible) {
    accepted += d.accepted;
    received += d.received;
    counts[d.group] = (counts[d.group] ?? 0) + 1;
  }
  const share: Partial<Record<BloodGroup, number>> = {};
  for (const g of Object.keys(counts) as BloodGroup[]) {
    share[g] = (counts[g] ?? 0) / Math.max(1, eligible.length);
  }
  return { recipientGroup, poolRate: received > 0 ? accepted / received : 0.5, share, risk, config };
}

/** Shrinkage estimate of a donor's response probability. Donors with no history fall back to the pool rate. */
export function responseProbability(donor: Donor, ctx: PoolContext): number {
  const { alpha } = ctx.config;
  return (donor.accepted + alpha * ctx.poolRate) / (donor.received + alpha);
}

/** Adjusted scarcity S_adj(g) = (1 / max(eps, share)) x (1 + beta x risk). */
export function adjustedScarcity(group: BloodGroup, ctx: PoolContext): number {
  const share = ctx.share[group] ?? 0;
  const risk = ctx.risk[group] ?? 0;
  return (1 / Math.max(ctx.config.epsilon, share)) * (1 + ctx.config.beta * risk);
}

/** Cost of spending this donor on this request. Zero for an exact group match. */
export function preservationCost(donor: Donor, ctx: PoolContext): number {
  if (donor.group === ctx.recipientGroup) return 0;
  return versatility(donor.group) * adjustedScarcity(donor.group, ctx);
}

/** Per-donor terms, computed once so that thousands of candidate sets are cheap to score. */
export interface DonorTerms {
  donor: Donor;
  distance: number;
  days: number;
  /** log(1 - p), so that the product in O3 becomes a sum. */
  logMiss: number;
  p: number;
  cost: number;
}

export function donorTerms(donor: Donor, ctx: PoolContext): DonorTerms {
  const p = responseProbability(donor, ctx);
  return {
    donor,
    distance: donor.distanceKm,
    days: donor.daysSinceDonation,
    p,
    logMiss: Math.log(Math.max(1e-12, 1 - p)),
    cost: preservationCost(donor, ctx),
  };
}

export function evaluateTerms(terms: readonly DonorTerms[]): ObjectiveValues {
  const n = terms.length;
  if (n === 0) return { travel: 0, recovery: 0, fulfilment: 0, preservation: 0 };
  let dist = 0;
  let days = 0;
  let miss = 1;
  let cost = 0;
  for (const t of terms) {
    dist += t.distance;
    days += t.days;
    miss *= 1 - t.p;
    cost += t.cost;
  }
  return { travel: dist / n, recovery: days / n, fulfilment: 1 - miss, preservation: cost };
}

export function evaluateSet(set: readonly Donor[], ctx: PoolContext): ObjectiveValues {
  return evaluateTerms(set.map((d) => donorTerms(d, ctx)));
}

/** Is a at least as good as b on every objective and strictly better on one? */
export function dominates(a: ObjectiveValues, b: ObjectiveValues): boolean {
  const noWorse =
    a.travel <= b.travel && a.recovery >= b.recovery && a.fulfilment >= b.fulfilment && a.preservation <= b.preservation;
  const better =
    a.travel < b.travel || a.recovery > b.recovery || a.fulfilment > b.fulfilment || a.preservation < b.preservation;
  return noWorse && better;
}

export { isCompatible };
