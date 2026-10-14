import type { BloodGroup, Donor, ObjectiveValues, Urgency } from '../engine';

export type DataSource = 'supabase' | 'local';
export type RequestStatus = 'Awaiting response' | 'Confirmed' | 'Unfilled';
export type DonorState = 'Sent' | 'Accepted' | 'Declined' | 'Stood Down';

export interface Pool {
  donors: Donor[];
  source: DataSource;
}

export interface RequestRow {
  id: string;
  code: string;
  recipientGroup: BloodGroup;
  units: number;
  urgency: Urgency;
  sector: string;
  k: number;
  status: RequestStatus;
  createdAt: string;
}

export interface RequestDonorRow {
  id: string;
  rank: number;
  state: DonorState;
  p: number;
  cost: number;
  donor: Omit<Donor, 'distanceKm'> & { distanceKm: number };
}

export interface AuditRow {
  algorithm: string;
  engineVersion: string;
  poolSize: number;
  eligibleSize: number;
  frontSize: number;
  evaluated: number;
  shortlisted: boolean;
  objectives: ObjectiveValues;
}

export interface RequestDetail extends RequestRow {
  donors: RequestDonorRow[];
  audit: AuditRow | null;
}

/** A donor's own record, as the donor sees it. Never includes anyone else's details. */
export interface DonorProfile {
  code: string;
  group: BloodGroup;
  sector: string;
  lastDonationDate: string;
  daysSinceDonation: number;
  available: boolean;
  accepted: number;
  received: number;
  onHold: boolean;
}

/** A request that asked this donor to help. The recipient's identity is never included. */
export interface DonorOffer {
  id: string;
  requestCode: string;
  group: BloodGroup;
  units: number;
  urgency: Urgency;
  sector: string;
  state: DonorState;
  requestStatus: RequestStatus;
  offeredAt: string;
}

export interface Repository {
  readonly source: DataSource;
  getPool(sector: string): Promise<Pool>;
  createRequest(args: {
    request: { recipientGroup: BloodGroup; units: number; urgency: Urgency; sector: string; k: number };
    donors: { donorId: string; rank: number; p: number; cost: number }[];
    audit: Omit<AuditRow, 'objectives'> & { poolHash: string; objectives: ObjectiveValues };
  }): Promise<string>;
  listRequests(): Promise<RequestRow[]>;
  getRequest(id: string): Promise<RequestDetail | null>;
  respond(requestDonorId: string, state: 'Accepted' | 'Declined'): Promise<RequestStatus>;
  /** Archives the caller's own requests and releases the donors they held. */
  reset(): Promise<void>;
  donorProfile(): Promise<DonorProfile | null>;
  donorOffers(): Promise<DonorOffer[]>;
  setAvailability(available: boolean): Promise<void>;
}

export class DonorUnavailableError extends Error {
  constructor() {
    super('One of the selected donors was just committed to another request.');
    this.name = 'DonorUnavailableError';
  }
}
