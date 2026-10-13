import { versatility } from './compatibility';
import { responseProbability, type PoolContext } from './objectives';
import type { Donor, Urgency } from './types';

const byId = (a: Donor, b: Donor) => a.id.localeCompare(b.id);

/** Current practice in surveyed apps: the k closest compatible donors. */
export function nearestCompatible(eligible: readonly Donor[], k: number): Donor[] {
  return eligible
    .slice()
    .sort((a, b) => a.distanceKm - b.distanceKm || byId(a, b))
    .slice(0, k);
}

/**
 * Sequential greedy, ordered by proximity, then exact group match, then rarity (less versatile
 * first). Lexicographic: an earlier criterion always wins, which is its structural limitation.
 * Distances within 0.05 km are treated as equal so the later criteria can act at all.
 */
export function sequentialGreedy(eligible: readonly Donor[], k: number, ctx: PoolContext): Donor[] {
  return eligible
    .slice()
    .sort((a, b) => {
      const dd = a.distanceKm - b.distanceKm;
      if (Math.abs(dd) > 0.05) return dd;
      const ea = a.group === ctx.recipientGroup ? 0 : 1;
      const eb = b.group === ctx.recipientGroup ? 0 : 1;
      if (ea !== eb) return ea - eb;
      const va = versatility(a.group) - versatility(b.group);
      if (va !== 0) return va;
      return byId(a, b);
    })
    .slice(0, k);
}

/** Weights of the prototype's match score, by urgency. */
export const WEIGHTED_SUM_WEIGHTS: Record<Urgency, { match: number; proximity: number; recency: number; reliability: number }> = {
  Critical: { match: 0.32, proximity: 0.42, recency: 0.1, reliability: 0.16 },
  Urgent: { match: 0.34, proximity: 0.32, recency: 0.16, reliability: 0.18 },
  Routine: { match: 0.32, proximity: 0.2, recency: 0.28, reliability: 0.2 },
};

const PROXIMITY_HORIZON_KM = 16;
const RECENCY_HORIZON_DAYS = 180;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Per-donor weighted score used by the prototype. A single scalar, so it cannot expose a trade-off. */
export function weightedScore(donor: Donor, urgency: Urgency, ctx: PoolContext): number {
  const w = WEIGHTED_SUM_WEIGHTS[urgency];
  const match = donor.group === ctx.recipientGroup ? 1 : 0.6;
  const proximity = clamp01(1 - donor.distanceKm / PROXIMITY_HORIZON_KM);
  const recency = clamp01((donor.daysSinceDonation - ctx.config.cooldownDays) / RECENCY_HORIZON_DAYS);
  const reliability = responseProbability(donor, ctx);
  return w.match * match + w.proximity * proximity + w.recency * recency + w.reliability * reliability;
}

export function weightedSum(eligible: readonly Donor[], k: number, urgency: Urgency, ctx: PoolContext): Donor[] {
  return eligible
    .map((d) => ({ d, s: weightedScore(d, urgency, ctx) }))
    .sort((a, b) => b.s - a.s || byId(a.d, b.d))
    .slice(0, k)
    .map((x) => x.d);
}
