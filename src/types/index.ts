/**
 * BloodGrid domain types.
 *
 * Prototype, demonstration only. Every record described here is fictional.
 * No real patient, donor, or blood-bank data exists in this project.
 *
 * Two privacy decisions are enforced by these types rather than by convention:
 * a donor has no address field and no phone field, so neither can be displayed
 * even by mistake. Donors are located to sector level, and contact happens
 * inside BloodGrid after a donor accepts a request.
 */

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type Urgency = 'Routine' | 'Urgent' | 'Critical';

export type Role = 'seeker' | 'donor' | 'bank';

export interface Donor {
  id: string;
  name: string;
  bloodGroup: BloodGroup;
  /** Generalised city sector, for example "F-7". Never a street address. */
  sector: string;
  /** Map-space coordinates, 0 to 100. Deliberately not latitude and longitude. */
  coords: { x: number; y: number };
  distanceKm: number;
  /**
   * Whether the donor has declared themselves available to donate.
   * A binary feasibility flag: available donors are in the pool, the rest are
   * not considered at all. It is never traded off against other criteria.
   */
  available: boolean;
  lastDonationDays: number;
  /** Derived from lastDonationDays against the minimum donation interval. */
  eligible: boolean;
  completedDonations: number;
  /** Share of past requests this donor responded to, 0 to 1. Simulated. */
  responseRate: number;
  verified: boolean;
  age: number;
}

export type RequestStatus =
  | 'Matching'
  | 'Awaiting Response'
  | 'Donor Accepted'
  | 'Fulfilled';

/**
 * Changes applied to a donor once they have accepted and been confirmed.
 * Held separately from the base record so the demonstration data stays intact
 * and a session reset restores it.
 */
export interface DonorAdjustment {
  lastDonationDays: number;
  completedDonations: number;
}

export interface BloodRequest {
  id: string;
  bloodGroup: BloodGroup;
  urgency: Urgency;
  sector: string;
  units: number;
  /** Case reference only. Patient names are never stored. */
  patientRef: string;
  facility: string;
  note?: string;
  createdLabel: string;
  status: RequestStatus;
}

/**
 * How a single donor responded to a single request.
 *
 * 'Stood Down' means the donor accepted, but the request had already been
 * covered by others. Their eligibility is not consumed.
 */
export type DonorRequestState = 'Sent' | 'Accepted' | 'Declined' | 'Stood Down';

export interface ConversationMessage {
  id: string;
  from: 'seeker' | 'donor';
  text: string;
  timeLabel: string;
}

/**
 * One request sent to one donor. Conversation is only reachable once `state`
 * is 'Accepted', which is what keeps contact out of the pre-acceptance flow.
 */
export interface DonorRequest {
  requestId: string;
  donorId: string;
  state: DonorRequestState;
  sentLabel: string;
  messages: ConversationMessage[];
  /**
   * The ranking that caused this donor to be notified, captured at that
   * moment. It is not recomputed later: a donor's record changes once they
   * accept, and recomputing would both alter the displayed reasoning and drop
   * the accepted donor from the list entirely.
   */
  rank: number;
  score: number;
  tier: MatchTier;
  objectives: ObjectiveVector;
}

/**
 * The criteria the future multi-objective optimiser will work over.
 *
 * Availability is deliberately absent: it is a hard feasibility constraint,
 * not something to be traded off, so it never reaches the objective vector.
 */
export interface ObjectiveVector {
  compatibility: number;
  proximity: number;
  recency: number;
  reliability: number;
}

export type MatchTier = 'Excellent' | 'Good' | 'Moderate';

/** Output of the simulated matching engine. `score` is not an optimiser result. */
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
  /** Illustrative range only, not a fitted statistical prediction interval. */
  bandLow: number;
  bandHigh: number;
}

/** An illustrative simulated scenario factor, not a measured causal finding. */
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
  distanceKm?: number;
  /** Simulated indicative availability shown in the coordination workflow. */
  indicativeStock?: Partial<Record<BloodGroup, number>>;
}

export interface DemandSeries {
  bloodGroup: BloodGroup;
  history: DemandPoint[];
  forecast: ForecastPoint[];
  trailingMean: number;
  peakProjected: number;
  peakLabel: string;
  highDemand: boolean;
  shortageRisk: boolean;
  projectedTotal: number;
  currentUnits: number;
  expectedCollection: number;
  projectedSupply: number;
  projectedGap: number;
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
