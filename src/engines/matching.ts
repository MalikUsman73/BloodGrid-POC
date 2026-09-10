/**
 * CCP 1: donor matching, prototype implementation.
 *
 * This is not NSGA-II. Nothing here performs multi-objective optimisation,
 * non-dominated sorting, crowding-distance calculation, or evolutionary search,
 * and no Pareto front is produced.
 *
 * What it does:
 *   1. Applies ABO/Rh compatibility and the donation-interval rule to get a
 *      feasible candidate set.
 *   2. Normalises five criteria to the range 0 to 1.
 *   3. Combines them with urgency-dependent weights into a single
 *      Prototype Match Score.
 *
 * The five criteria are exposed on every result because they are the objectives
 * the future NSGA-II implementation will optimise over. Showing them explains
 * the shape of the problem without claiming the optimiser exists.
 */

import type {
  BloodGroup, Donor, MatchResult, MatchTier, ObjectiveVector, Urgency,
} from '../types';
import { clamp01 } from '../mock/seed';
import { MIN_DAYS_BETWEEN_DONATIONS } from '../mock/donors';

/**
 * Which donor groups each recipient group can receive. This lookup is standard
 * clinical practice, not simulated.
 */
export const COMPATIBLE_DONOR_GROUPS: Record<BloodGroup, BloodGroup[]> = {
  'O-':  ['O-'],
  'O+':  ['O-', 'O+'],
  'A-':  ['O-', 'A-'],
  'A+':  ['O-', 'O+', 'A-', 'A+'],
  'B-':  ['O-', 'B-'],
  'B+':  ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

export function isCompatible(recipient: BloodGroup, donor: BloodGroup): boolean {
  return COMPATIBLE_DONOR_GROUPS[recipient].includes(donor);
}

/**
 * Criterion weights by urgency.
 *
 * These differ by urgency because no single ordering suits every request, which
 * is the motivation for treating this as a multi-objective problem later. They
 * are hand-chosen demonstration weights, not learned or tuned.
 */
export const CRITERION_WEIGHTS: Record<Urgency, ObjectiveVector> = {
  Critical: { compatibility: 0.30, proximity: 0.32, availability: 0.24, recency: 0.06, reliability: 0.08 },
  Urgent:   { compatibility: 0.30, proximity: 0.24, availability: 0.22, recency: 0.12, reliability: 0.12 },
  Routine:  { compatibility: 0.28, proximity: 0.14, availability: 0.18, recency: 0.22, reliability: 0.18 },
};

export const CRITERIA: { key: keyof ObjectiveVector; label: string; description: string }[] = [
  { key: 'compatibility', label: 'Compatibility', description: 'An exact group match scores highest; a compatible alternate scores slightly lower.' },
  { key: 'proximity',     label: 'Proximity',     description: 'Based on approximate sector-level distance to the request location.' },
  { key: 'availability',  label: 'Availability',  description: 'The availability the donor has declared.' },
  { key: 'recency',       label: 'Donation recency', description: 'A longer gap since the last donation is preferred for donor wellbeing.' },
  { key: 'reliability',   label: 'Reliability',   description: 'Simulated response history, completed donations, and verification state.' },
];

/** Distance at which the proximity criterion reaches zero, in kilometres. */
const PROXIMITY_HORIZON_KM = 16;
/** Gap beyond the minimum interval at which recency reaches its maximum, in days. */
const RECENCY_HORIZON_DAYS = 180;

const AVAILABILITY_SCORE = { Available: 1, Limited: 0.55, Unavailable: 0 };

const TIER_THRESHOLDS: { min: number; tier: MatchTier }[] = [
  { min: 84, tier: 'Excellent' },
  { min: 70, tier: 'Good' },
  { min: 0,  tier: 'Moderate' },
];

function scoreObjectives(donor: Donor, recipient: BloodGroup): ObjectiveVector {
  return {
    compatibility: donor.bloodGroup === recipient ? 1 : 0.85,
    proximity: clamp01(1 - donor.distanceKm / PROXIMITY_HORIZON_KM),
    availability: AVAILABILITY_SCORE[donor.availability],
    recency: clamp01((donor.lastDonationDays - MIN_DAYS_BETWEEN_DONATIONS) / RECENCY_HORIZON_DAYS),
    reliability: clamp01(
      0.6 * donor.responseRate +
      0.3 * clamp01(donor.completedDonations / 10) +
      0.1 * (donor.verified ? 1 : 0),
    ),
  };
}

function tierForScore(score: number): MatchTier {
  return TIER_THRESHOLDS.find((threshold) => score >= threshold.min)!.tier;
}

export interface MatchingOutcome {
  results: MatchResult[];
  /** Screening counts, shown in the interface so the filtering stays visible. */
  poolSize: number;
  incompatibleCount: number;
  withinIntervalCount: number;
}

/**
 * Run the prototype matching engine. Deterministic and stable: ties break by
 * distance, then by donor id.
 */
export function rankDonorsForRequest(
  donors: Donor[],
  request: { bloodGroup: BloodGroup; urgency: Urgency },
): MatchingOutcome {
  const weights = CRITERION_WEIGHTS[request.urgency];
  let incompatibleCount = 0;
  let withinIntervalCount = 0;

  const feasible = donors.filter((donor) => {
    if (!isCompatible(request.bloodGroup, donor.bloodGroup)) { incompatibleCount += 1; return false; }
    if (!donor.eligible) { withinIntervalCount += 1; return false; }
    return true;
  });

  const scored = feasible.map((donor) => {
    const objectives = scoreObjectives(donor, request.bloodGroup);
    const weighted = CRITERIA.reduce(
      (total, criterion) => total + weights[criterion.key] * objectives[criterion.key],
      0,
    );
    const score = Math.round(weighted * 100);
    return { donor, objectives, score, tier: tierForScore(score), rank: 0 };
  });

  scored.sort((a, b) =>
    b.score - a.score ||
    a.donor.distanceKm - b.donor.distanceKm ||
    a.donor.id.localeCompare(b.donor.id),
  );
  scored.forEach((result, index) => { result.rank = index + 1; });

  return {
    results: scored,
    poolSize: donors.length,
    incompatibleCount,
    withinIntervalCount,
  };
}

/** Steps shown while the matching screen is on display. */
export const MATCHING_STEPS = [
  'Reading request parameters',
  'Screening the donor pool for compatibility',
  'Applying donation-interval eligibility',
  'Scoring proximity, availability, recency and reliability',
  'Producing the prototype ranking',
];
