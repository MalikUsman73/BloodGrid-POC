export const BLOOD_GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const URGENCIES = ['Routine', 'Urgent', 'Critical'] as const;
export type Urgency = (typeof URGENCIES)[number];

/** A donor as the matching engine sees them. No name, phone or address exists here. */
export interface Donor {
  id: string;
  /** Anonymous display code, for example D-0042. */
  code: string;
  group: BloodGroup;
  sector: string;
  /** Distance from the donor's sector to the request sector, in kilometres. */
  distanceKm: number;
  daysSinceDonation: number;
  available: boolean;
  /** Id of an open request this donor is already committed to, or null. */
  heldBy: string | null;
  contactsLast30d: number;
  accepted: number;
  received: number;
}

export interface MatchRequest {
  recipientGroup: BloodGroup;
  units: number;
  urgency: Urgency;
  sector: string;
}

export interface MatchConfig {
  /** Minimum days between donations. */
  cooldownDays: number;
  /** Operating radius around the request sector, in kilometres. */
  radiusKm: number;
  /** A donor contacted this many times in 30 days is excluded. */
  contactCap: number;
  /** Shrinkage constant for the response-rate estimate. */
  alpha: number;
  /** Weight of forecast shortage risk in scarcity (0 until CCP-2 is linked). */
  beta: number;
  /** Guards the scarcity division. */
  epsilon: number;
  /** Largest number of k-subsets the exact search will enumerate. */
  maxCombinations: number;
}

export const DEFAULT_CONFIG: MatchConfig = {
  cooldownDays: 90,
  radiusKm: 15,
  contactCap: 3,
  alpha: 5,
  beta: 0,
  epsilon: 0.01,
  maxCombinations: 300_000,
};

export interface ObjectiveValues {
  /** O1, mean distance in km. Minimise. */
  travel: number;
  /** O2, mean days since last donation. Maximise. */
  recovery: number;
  /** O3, probability that at least one selected donor responds. Maximise. */
  fulfilment: number;
  /** O4, summed type-preservation cost. Minimise. */
  preservation: number;
}

export type ObjectiveKey = keyof ObjectiveValues;

export type AlgorithmId = 'nsga3' | 'pareto' | 'weighted' | 'greedy' | 'nearest';
