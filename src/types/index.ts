/**
 * BloodGrid POC — shared domain types.
 *
 * PROTOTYPE / DEMONSTRATION ONLY.
 * All records described by these types are fictional demonstration data.
 * No real patient, donor, or blood-bank data is represented anywhere in this project.
 */

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type Urgency = 'Routine' | 'Urgent' | 'Critical';

export type Availability = 'Available' | 'Limited' | 'Unavailable';

export type Role = 'seeker' | 'donor' | 'bank';

/** A fictional demonstration donor. Location is sector-level and approximate by design. */
export interface Donor {
  id: string;
  name: string;
  bloodGroup: BloodGroup;
  /** Generalised city sector (e.g. "F-7"). Never a residential address. */
  sector: string;
  /** Map-space coordinates 0-100. Deliberately NOT real latitude/longitude. */
  coords: { x: number; y: number };
  distanceKm: number;
  availability: Availability;
  lastDonationDays: number;
  /** Derived: donors must be >= 90 days since last donation. */
  eligible: boolean;
  completedDonations: number;
  /** 0-1 historical response rate (simulated). */
  responseRate: number;
  verified: boolean;
  age: number;
  contactMasked: string;
}

export type RequestStatus = 'Matching' | 'Donors Contacted' | 'Fulfilled';

export interface BloodRequest {
  id: string;
  bloodGroup: BloodGroup;
  urgency: Urgency;
  sector: string;
  units: number;
  /** Case reference only — never a patient name. */
  patientRef: string;
  hospital: string;
  note?: string;
  createdAt: string;
  createdLabel: string;
  status: RequestStatus;
  contactedDonorIds: string[];
}

/** The five criteria the future NSGA-II implementation will optimise over. */
export interface ObjectiveVector {
  compatibility: number;
  proximity: number;
  availability: number;
  recency: number;
  reliability: number;
}

export type MatchTier = 'Excellent' | 'Good' | 'Moderate';

/**
 * Output of the SIMULATED matching engine (CCP 1).
 * `score` is a Prototype Match Score, NOT an NSGA-II result.
 */
export interface MatchResult {
  donor: Donor;
  objectives: ObjectiveVector;
  score: number;
  tier: MatchTier;
  rank: number;
}

export interface DemandPoint {
  date: string;
  label: string;
  units: number;
}

export interface ForecastPoint {
  date: string;
  label: string;
  projected: number;
  /** Illustrative range only — NOT a fitted statistical prediction interval. */
  bandLow: number;
  bandHigh: number;
}

/** An illustrative, simulated scenario factor. Not a real causal finding. */
export interface ScenarioFactor {
  id: string;
  label: string;
  description: string;
  startIndex: number;
  endIndex: number;
  scope: 'history' | 'forecast';
}

export type StockStatus = 'Healthy' | 'Watch' | 'Low' | 'Critical';

export interface InventoryItem {
  bloodGroup: BloodGroup;
  units: number;
  capacity: number;
  status: StockStatus;
  daysOfCover: number;
}

export interface BloodBank {
  id: string;
  name: string;
  sector: string;
  partner: boolean;
  distanceKm?: number;
  /** Simulated indicative availability shown in the coordination workflow. */
  indicativeStock?: Partial<Record<BloodGroup, number>>;
}

export interface DemandSeries {
  bloodGroup: BloodGroup;
  history: DemandPoint[];
  forecast: ForecastPoint[];
  factors: ScenarioFactor[];
  trailingMean: number;
  peakProjected: number;
  peakLabel: string;
  highDemand: boolean;
  shortageRisk: boolean;
  projectedTotal: number;
  currentUnits: number;
  projectedGap: number;
  /** Simulated routine collection expected across the forward window. */
  expectedCollection: number;
  /** currentUnits + expectedCollection. */
  projectedSupply: number;
}

export interface OutreachCampaign {
  id: string;
  bloodGroup: BloodGroup;
  sectors: string[];
  donorCount: number;
  createdLabel: string;
}

export interface InterBankRequest {
  id: string;
  bankId: string;
  bankName: string;
  bloodGroup: BloodGroup;
  units: number;
  createdLabel: string;
}
