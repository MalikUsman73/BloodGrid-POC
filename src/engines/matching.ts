/**
 * ============================================================================
 * CCP 1 — DONOR MATCHING  ::  PROTOTYPE / SIMULATED MATCHING ENGINE
 * ============================================================================
 *
 * THIS IS NOT NSGA-II. NOTHING IN THIS FILE PERFORMS MULTI-OBJECTIVE
 * OPTIMISATION, NON-DOMINATED SORTING, CROWDING-DISTANCE CALCULATION, OR ANY
 * EVOLUTIONARY SEARCH. NO PARETO FRONT IS COMPUTED.
 *
 * What this file does:
 *   1. Applies real ABO/Rh compatibility and a donation-interval eligibility
 *      rule to produce a feasible candidate set.
 *   2. Normalises five criteria to [0,1].
 *   3. Combines them with urgency-dependent weights into a single
 *      "Prototype Match Score" for demonstration purposes.
 *
 * The five criteria are exposed on every result because they are the objectives
 * that the FUTURE implementation — NSGA-II multi-objective optimisation — is
 * intended to optimise over. Showing them communicates the problem structure
 * without claiming the optimiser exists.
 *
 * Output must always be presented in the UI as:
 *   "Prototype Match Score — Simulated Matching Output"
 *   "Future Implementation: NSGA-II Multi-Objective Optimization"
 *
 * The engine is fully deterministic: identical input always yields identical
 * ranking, so the live defense demonstration is exactly repeatable.
 * ============================================================================
 */

import type {
  BloodGroup, Donor, MatchResult, MatchTier, ObjectiveVector, Urgency,
} from '../types';
import { clamp } from '../mock/seed';
import { MIN_DAYS_BETWEEN_DONATIONS } from '../mock/donors';

/**
 * Standard ABO/Rh red-cell compatibility: which donor groups a given recipient
 * group can receive. This lookup is clinically standard, not simulated.
 */
export const COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
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
  return COMPATIBILITY[recipient].includes(donor);
}

/**
 * Urgency-dependent criterion weights.
 *
 * These vary by urgency precisely because no single ranking is optimal across
 * all requests — which is the motivation for the future multi-objective
 * treatment. They are hand-chosen demonstration weights, not learned or tuned.
 */
export const WEIGHTS: Record<Urgency, ObjectiveVector> = {
  Critical: { compatibility: 0.30, proximity: 0.32, availability: 0.24, recency: 0.06, reliability: 0.08 },
  Urgent:   { compatibility: 0.30, proximity: 0.24, availability: 0.22, recency: 0.12, reliability: 0.12 },
  Routine:  { compatibility: 0.28, proximity: 0.14, availability: 0.18, recency: 0.22, reliability: 0.18 },
};

export const CRITERIA: { key: keyof ObjectiveVector; label: string; hint: string }[] = [
  { key: 'compatibility', label: 'Compatibility', hint: 'Exact group match scores highest; compatible alternates score slightly lower.' },
  { key: 'proximity',     label: 'Proximity',     hint: 'Derived from approximate sector-level distance to the request location.' },
  { key: 'availability',  label: 'Availability',  hint: 'Donor-declared availability state at the time of the request.' },
  { key: 'recency',       label: 'Donation Recency', hint: 'Longer since last donation is preferred for donor wellbeing.' },
  { key: 'reliability',   label: 'Reliability',   hint: 'Simulated response history, completed donations, and verification state.' },
];

/** Maximum distance used to normalise proximity, in kilometres. */
const PROXIMITY_HORIZON_KM = 16;

function objectivesFor(donor: Donor, recipient: BloodGroup): ObjectiveVector {
  const compatibility = donor.bloodGroup === recipient ? 1.0 : 0.85;

  const proximity = clamp(1 - donor.distanceKm / PROXIMITY_HORIZON_KM);

  const availability =
    donor.availability === 'Available' ? 1.0 :
    donor.availability === 'Limited'   ? 0.55 : 0.0;

  const recency = clamp((donor.lastDonationDays - MIN_DAYS_BETWEEN_DONATIONS) / 180);

  const reliability = clamp(
    0.6 * donor.responseRate +
    0.3 * clamp(donor.completedDonations / 10) +
    0.1 * (donor.verified ? 1 : 0),
  );

  return { compatibility, proximity, availability, recency, reliability };
}

function tierFor(score: number): MatchTier {
  if (score >= 84) return 'Excellent';
  if (score >= 70) return 'Good';
  return 'Moderate';
}

export interface MatchInput {
  bloodGroup: BloodGroup;
  urgency: Urgency;
}

export interface MatchOutcome {
  results: MatchResult[];
  /** Diagnostics shown in the UI so the filtering is transparent, not hidden. */
  poolSize: number;
  incompatibleCount: number;
  ineligibleCount: number;
}

/**
 * Run the SIMULATED matching engine.
 * Deterministic and stable: ties break by distance, then donor id.
 */
export function runMatching(donors: Donor[], input: MatchInput): MatchOutcome {
  const weights = WEIGHTS[input.urgency];

  let incompatibleCount = 0;
  let ineligibleCount = 0;

  // Stage 1 — hard feasibility filter.
  const feasible = donors.filter((d) => {
    if (!isCompatible(input.bloodGroup, d.bloodGroup)) { incompatibleCount++; return false; }
    if (!d.eligible) { ineligibleCount++; return false; }
    return true;
  });

  // Stages 2 & 3 — normalise criteria, then combine with urgency weights.
  const scored = feasible.map((donor) => {
    const objectives = objectivesFor(donor, input.bloodGroup);
    const raw =
      weights.compatibility * objectives.compatibility +
      weights.proximity     * objectives.proximity +
      weights.availability  * objectives.availability +
      weights.recency       * objectives.recency +
      weights.reliability   * objectives.reliability;
    const score = Math.round(raw * 100);
    return { donor, objectives, score, tier: tierFor(score), rank: 0 };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.donor.distanceKm !== b.donor.distanceKm) return a.donor.distanceKm - b.donor.distanceKm;
    return a.donor.id.localeCompare(b.donor.id);
  });

  scored.forEach((r, i) => { r.rank = i + 1; });

  return {
    results: scored,
    poolSize: donors.length,
    incompatibleCount,
    ineligibleCount,
  };
}

/** Stages shown during the matching processing screen. Presentation only. */
export const MATCHING_STAGES = [
  'Reading blood request parameters',
  'Screening donor pool for ABO/Rh compatibility',
  'Applying donation-interval eligibility rules',
  'Evaluating proximity, availability, recency and reliability',
  'Producing prototype ranking',
];
