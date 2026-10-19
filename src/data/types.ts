import type { BloodGroup, Donor, ObjectiveValues, Urgency } from '../engine';
import type { Flag, PatientInput, PrescriptionInput } from '../workflow';

export type DataSource = 'supabase' | 'local';
/**
 * Awaiting response: donors are being asked. Confirmed: enough donors accepted. Unfilled: the round
 * ended short, and another round can run. Cancelled: withdrawn, or closed after fraud reports.
 */
export type RequestStatus = 'Awaiting response' | 'Confirmed' | 'Unfilled' | 'Cancelled';
/**
 * Expired: no answer in time. Reassigned: taken by a critical request before answering. Donated and
 * No show: confirmed by the seeker after the donor was due.
 */
export type DonorState = 'Sent' | 'Accepted' | 'Declined' | 'Stood Down' | 'Expired' | 'Reassigned' | 'Donated' | 'No show';
/** Unverified: the request went ahead, but BloodGrid's checks found something minor, and donors are told. */
export type Verification = 'Verified' | 'Unverified';
/** What a donor can report about a request. Several donors reporting fraud or payment demands flags the account. */
export const REPORT_KINDS = ['Asked for payment', 'Suspected fraud', 'Wrong details', 'Other'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export interface Pool {
  donors: Donor[];
  source: DataSource;
}

export interface Patient {
  id: string;
  fullName: string;
  mrNumber: string;
  hospitalId: string;
  bloodGroup: BloodGroup;
  birthYear: number;
  createdAt: string;
}

/** The prescription as stored. The file itself is kept in private storage; only its details are here. */
export interface PrescriptionRecord {
  doctorName: string;
  pmdcNumber: string;
  hospitalId: string;
  issuedOn: string;
  bloodGroup: BloodGroup;
  unitsPrescribed: number;
  diagnosis: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
}

export interface RequestRow {
  id: string;
  code: string;
  recipientGroup: BloodGroup;
  units: number;
  urgency: Urgency;
  sector: string;
  /** Donors notified across all rounds. */
  k: number;
  status: RequestStatus;
  createdAt: string;
  patientId: string;
  patientName: string;
  hospitalId: string;
  verification: Verification;
  flags: Flag[];
  /** Matching rounds run so far. Zero until the first round. */
  round: number;
}

export interface RequestDonorRow {
  id: string;
  rank: number;
  round: number;
  state: DonorState;
  p: number;
  cost: number;
  sentAt: string;
  /** When an unanswered offer lapses. */
  deadline: string;
  /** The seeker's thank-you note, once they confirmed the donation. */
  feedback: string | null;
  donor: Omit<Donor, 'distanceKm'> & { distanceKm: number };
}

/** A donor's report about a request, kept as a record. The requester is never named. */
export interface Report {
  id: string;
  requestId: string;
  requestCode: string;
  kind: ReportKind;
  note: string;
  createdAt: string;
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
  prescription: PrescriptionRecord;
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
  /** Donations the seekers confirmed. */
  donated: number;
  /** Thank-you notes from seekers, newest first. The seeker is never named. */
  thanks: { note: string; at: string }[];
}

/** A request that asked this donor to help. The recipient's identity is never included. */
export interface DonorOffer {
  id: string;
  requestId: string;
  requestCode: string;
  group: BloodGroup;
  units: number;
  urgency: Urgency;
  sector: string;
  state: DonorState;
  requestStatus: RequestStatus;
  offeredAt: string;
  deadline: string;
  hospitalId: string;
  /** Unverified means BloodGrid could not check every detail of the request. */
  verification: Verification;
}

export interface NewRequestInput {
  patientId: string;
  prescription: PrescriptionInput;
  /** The prescription file. Its hash must match prescription.document.hash. */
  file: Blob | null;
  units: number;
  urgency: Urgency;
}

export interface SubmitResult {
  id: string;
  verification: Verification;
  flags: Flag[];
}

export interface RoundInput {
  requestId: string;
  donors: { donorId: string; rank: number; p: number; cost: number }[];
  audit: Omit<AuditRow, 'objectives'> & { poolHash: string; objectives: ObjectiveValues | null };
}

/**
 * Everything the screens read and write. Both implementations enforce the same rules: the in-memory
 * one in TypeScript, the Supabase one in database functions, so the browser can never skip a check.
 */
export interface Repository {
  readonly source: DataSource;
  getPool(sector: string): Promise<Pool>;

  // Recipient: patients and requests
  listPatients(): Promise<Patient[]>;
  /** Adds a patient, or updates the caller's record with the same hospital and record number. */
  savePatient(input: PatientInput): Promise<Patient>;
  /** Checks the request by the verification rules and saves it, or throws RequestRefusedError. */
  submitRequest(input: NewRequestInput): Promise<SubmitResult>;
  /** Saves one matching round: the donors to notify. Returns the request status after it. */
  recordRound(input: RoundInput): Promise<RequestStatus>;
  listRequests(): Promise<RequestRow[]>;
  getRequest(id: string): Promise<RequestDetail | null>;
  cancelRequest(id: string): Promise<void>;
  respond(requestDonorId: string, state: 'Accepted' | 'Declined'): Promise<RequestStatus>;
  /**
   * The seeker confirms whether an accepted donor came. "Donated" starts the donor's rest period and may
   * carry a thank-you note; "No show" frees the place so another round can run.
   */
  confirmDonation(requestDonorId: string, outcome: 'Donated' | 'No show', thanks?: string): Promise<void>;
  /** Archives the caller's own requests and releases the donors they held. */
  reset(): Promise<void>;

  // Donor
  donorProfile(): Promise<DonorProfile | null>;
  donorOffers(): Promise<DonorOffer[]>;
  setAvailability(available: boolean): Promise<void>;

  /** A donor reports a request they were asked about. Several donors reporting fraud flags the account. */
  reportRequest(input: { requestId: string; kind: ReportKind; note: string }): Promise<void>;
  /** The caller's own reports. */
  myReports(): Promise<Report[]>;
  /** Prescription file of the caller's own request, for them to view again. */
  prescriptionUrl(requestId: string): Promise<string | null>;
}

/** A request that failed the checks. Field errors use the same keys as validateRequest. */
export class RequestRejectedError extends Error {
  constructor(readonly fields: Partial<Record<string, string>>) {
    super(Object.values(fields)[0] ?? 'The request was not accepted.');
    this.name = 'RequestRejectedError';
  }
}

export class DonorUnavailableError extends Error {
  constructor() {
    super('One of the selected donors was just committed to another request.');
    this.name = 'DonorUnavailableError';
  }
}

/** A request the verification rules refused. The flags say why, so the seeker can correct the details. */
export class RequestRefusedError extends Error {
  constructor(readonly flags: Flag[]) {
    super('BloodGrid could not verify this request.');
    this.name = 'RequestRefusedError';
  }
}
