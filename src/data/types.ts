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
  reset(): Promise<void>;
}

export class DonorUnavailableError extends Error {
  constructor() {
    super('One of the selected donors was just committed to another request.');
    this.name = 'DonorUnavailableError';
  }
}
