import { BLOOD_GROUPS, type BloodGroup, type Urgency } from '../engine';
import { findDoctor, findHospital } from './registry';

/**
 * Recipient verification. A request needs a patient record and the doctor's prescription before any
 * donor is contacted. Two kinds of check run on it:
 *
 * - validation errors block the request outright (a malformed PMDC number, a prescription for fewer
 *   units than requested, a blood group that disagrees with the patient record);
 * - flags are signs of misuse or fraud (a reused document, a patient recorded with two blood groups,
 *   a burst of requests). Serious flags, or several minor ones, refuse the request; one or two minor
 *   ones let it through marked unverified. No person reviews requests in the normal flow.
 *
 * The database runs the same rules on submission, so a modified browser cannot skip them.
 */

export const PMDC_PATTERN = /^\d{4,6}-[A-Z]$/;
export const MR_PATTERN = /^[A-Z0-9][A-Z0-9-]{3,19}$/;
/** A prescription older than this is refused. */
export const PRESCRIPTION_MAX_DAYS = 30;
/** A prescription older than this is accepted but flagged. */
export const PRESCRIPTION_FRESH_DAYS = 7;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
/** Requests by one account in 24 hours before the account is flagged. */
export const BURST_LIMIT = 3;
export const MAX_UNITS = 4;
/** A request with this many medium warnings at once is refused, even though each alone would only be noted. */
export const MEDIUM_FLAG_LIMIT = 3;
/** Donors who must report an account's requests for fraud or payment demands before the account is flagged. */
export const FRAUD_REPORT_LIMIT = 2;

export interface PatientInput {
  fullName: string;
  /** Hospital medical record number. */
  mrNumber: string;
  hospitalId: string;
  bloodGroup: BloodGroup | '';
  birthYear: number | null;
}

export interface DocumentInfo {
  name: string;
  type: string;
  size: number;
  /** SHA-256 of the file contents, hex. Identical files have identical hashes. */
  hash: string;
}

export interface PrescriptionInput {
  doctorName: string;
  pmdcNumber: string;
  hospitalId: string;
  /** yyyy-mm-dd */
  issuedOn: string;
  bloodGroup: BloodGroup | '';
  unitsPrescribed: number;
  diagnosis: string;
  document: DocumentInfo | null;
}

export interface RequestInput {
  patient: PatientInput;
  prescription: PrescriptionInput;
  units: number;
  urgency: Urgency;
}

/** What the system already knows that bears on this request. */
export interface RequestHistory {
  /**
   * Other requests that used a document with the same hash, from another account or for another
   * patient. The same account reusing a document for the same patient (a follow-up) does not count.
   */
  documentUses: number;
  /** Blood groups recorded earlier for the same medical record number at the same hospital, by anyone. */
  patientGroups: BloodGroup[];
  /** Requests this account raised in the last 24 hours. */
  requestsLast24h: number;
  /** Open requests for the same patient. */
  openForPatient: number;
  /** The account was flagged after fraud reports from several donors. */
  accountFlagged: boolean;
}

export const NO_HISTORY: RequestHistory = {
  documentUses: 0, patientGroups: [], requestsLast24h: 0, openForPatient: 0, accountFlagged: false,
};

export type FieldKey =
  | 'patientName' | 'mrNumber' | 'hospitalId' | 'patientGroup' | 'birthYear'
  | 'doctorName' | 'pmdcNumber' | 'issuedOn' | 'prescriptionGroup' | 'unitsPrescribed' | 'units' | 'document' | 'duplicate';

export type RequestErrors = Partial<Record<FieldKey, string>>;

export type FlagCode =
  | 'document-reused'
  | 'patient-group-conflict'
  | 'account-flagged'
  | 'request-burst'
  | 'stale-prescription'
  | 'unregistered-doctor'
  | 'doctor-elsewhere'
  | 'hospital-mismatch'
  | 'many-units';

export type Severity = 'high' | 'medium' | 'low';

export interface Flag {
  code: FlagCode;
  severity: Severity;
  message: string;
}

export type Decision = 'Verified' | 'Unverified' | 'Rejected';

const DAY_MS = 86_400_000;
const today = (now: Date) => Date.parse(now.toISOString().slice(0, 10) + 'T00:00:00Z');
const ageDays = (iso: string, now: Date) => Math.floor((today(now) - Date.parse(`${iso}T00:00:00Z`)) / DAY_MS);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export function validatePatient(p: PatientInput, now = new Date()): RequestErrors {
  const e: RequestErrors = {};
  const name = p.fullName.trim();
  if (name.length < 2) e.patientName = 'Enter the patient’s full name.';
  else if (name.length > 80) e.patientName = 'Use 80 characters or fewer.';
  if (!MR_PATTERN.test(p.mrNumber.trim().toUpperCase())) e.mrNumber = 'Enter the hospital record number, 4 to 20 letters, digits or dashes.';
  if (!findHospital(p.hospitalId)) e.hospitalId = 'Choose the hospital treating the patient.';
  if (!(BLOOD_GROUPS as readonly string[]).includes(p.bloodGroup)) e.patientGroup = 'Choose the patient’s blood group.';
  const year = now.getUTCFullYear();
  if (p.birthYear === null || !Number.isInteger(p.birthYear) || p.birthYear < year - 120 || p.birthYear > year) {
    e.birthYear = 'Enter a valid year of birth.';
  }
  return e;
}

export function validateRequest(input: RequestInput, history: RequestHistory = NO_HISTORY, now = new Date()): RequestErrors {
  const { patient: p, prescription: rx } = input;
  const e: RequestErrors = validatePatient(p, now);

  if (rx.doctorName.trim().length < 3) e.doctorName = 'Enter the prescribing doctor’s name.';
  if (!PMDC_PATTERN.test(rx.pmdcNumber.trim().toUpperCase())) e.pmdcNumber = 'Enter the PMDC registration number, like 12345-P.';
  if (!isDate(rx.issuedOn)) e.issuedOn = 'Enter the date on the prescription.';
  else if (ageDays(rx.issuedOn, now) < 0) e.issuedOn = 'The prescription date cannot be in the future.';
  else if (ageDays(rx.issuedOn, now) > PRESCRIPTION_MAX_DAYS) e.issuedOn = `The prescription is older than ${PRESCRIPTION_MAX_DAYS} days. Ask the doctor for a current one.`;
  if (!(BLOOD_GROUPS as readonly string[]).includes(rx.bloodGroup)) e.prescriptionGroup = 'Choose the blood group written on the prescription.';
  else if (p.bloodGroup && rx.bloodGroup !== p.bloodGroup) {
    e.prescriptionGroup = `The prescription says ${rx.bloodGroup} but the patient record says ${p.bloodGroup}. Check both before continuing.`;
  }
  if (!Number.isInteger(rx.unitsPrescribed) || rx.unitsPrescribed < 1 || rx.unitsPrescribed > 10) {
    e.unitsPrescribed = 'Enter the units prescribed, 1 to 10.';
  }
  if (!Number.isInteger(input.units) || input.units < 1 || input.units > MAX_UNITS) e.units = `Request 1 to ${MAX_UNITS} units.`;
  else if (Number.isInteger(rx.unitsPrescribed) && input.units > rx.unitsPrescribed) {
    e.units = `The prescription allows ${rx.unitsPrescribed} ${rx.unitsPrescribed === 1 ? 'unit' : 'units'}. You cannot request more.`;
  }

  const doc = rx.document;
  if (!doc) e.document = 'Attach the doctor’s prescription or requisition form.';
  else if (!(ALLOWED_FILE_TYPES as readonly string[]).includes(doc.type)) e.document = 'Attach a PDF, JPG or PNG file.';
  else if (doc.size <= 0) e.document = 'The file is empty.';
  else if (doc.size > MAX_FILE_BYTES) e.document = 'The file is larger than 5 MB.';
  else if (!/^[0-9a-f]{64}$/.test(doc.hash)) e.document = 'The file could not be read. Attach it again.';

  if (history.openForPatient > 0) {
    e.duplicate = 'This patient already has an open request. Follow that one, or cancel it before raising another.';
  }
  return e;
}

/** Signs of misuse. They feed decide(); only the serious ones, or several together, refuse a request. */
export function detectFlags(input: RequestInput, history: RequestHistory = NO_HISTORY, now = new Date()): Flag[] {
  const flags: Flag[] = [];
  const { patient: p, prescription: rx } = input;
  if (history.documentUses > 0) {
    flags.push({
      code: 'document-reused', severity: 'high',
      message: `The same prescription file was already used on ${history.documentUses} other ${history.documentUses === 1 ? 'request' : 'requests'}.`,
    });
  }
  const others = history.patientGroups.filter((g) => g !== p.bloodGroup);
  if (others.length > 0) {
    flags.push({
      code: 'patient-group-conflict', severity: 'high',
      message: `This hospital record number was registered before with blood group ${[...new Set(others)].join(', ')}.`,
    });
  }
  if (history.accountFlagged) {
    flags.push({ code: 'account-flagged', severity: 'high', message: 'Several donors reported this account’s earlier requests for fraud or payment demands.' });
  }
  if (history.requestsLast24h >= BURST_LIMIT) {
    flags.push({
      code: 'request-burst', severity: 'medium',
      message: `This account raised ${history.requestsLast24h} requests in the last 24 hours.`,
    });
  }
  if (isDate(rx.issuedOn) && ageDays(rx.issuedOn, now) > PRESCRIPTION_FRESH_DAYS) {
    flags.push({ code: 'stale-prescription', severity: 'medium', message: `The prescription is ${ageDays(rx.issuedOn, now)} days old.` });
  }
  const doctor = findDoctor(rx.pmdcNumber);
  if (!doctor) {
    flags.push({ code: 'unregistered-doctor', severity: 'medium', message: `PMDC number ${rx.pmdcNumber.trim().toUpperCase()} is not in the doctor registry.` });
  } else if (doctor.hospitalId !== rx.hospitalId) {
    flags.push({ code: 'doctor-elsewhere', severity: 'low', message: `${doctor.name} is registered at another hospital.` });
  }
  if (rx.hospitalId !== p.hospitalId) {
    flags.push({ code: 'hospital-mismatch', severity: 'medium', message: 'The prescription is from a different hospital than the patient record.' });
  }
  if (input.units >= 3 && input.urgency === 'Routine') {
    flags.push({ code: 'many-units', severity: 'low', message: `${input.units} units for a routine request is unusual.` });
  }
  return flags;
}

/**
 * What happens to the request, by rules alone; no person reviews it.
 * - Rejected: any high flag (a reused document, a conflicting patient record, a flagged account), or
 *   three or more medium warnings together. The seeker can correct the details and submit again.
 * - Unverified: one or two medium warnings. Donors are contacted at once and told BloodGrid could not
 *   verify every detail, so a legitimate request with one odd detail is never held up.
 * - Verified: no flag above low.
 * Urgency does not change the decision: an emergency is helped by showing nearby blood banks, not by
 * lowering the bar for fraud.
 */
export function decide(flags: readonly Flag[]): Decision {
  if (flags.some((f) => f.severity === 'high')) return 'Rejected';
  const medium = flags.filter((f) => f.severity === 'medium').length;
  if (medium >= MEDIUM_FLAG_LIMIT) return 'Rejected';
  return medium > 0 ? 'Unverified' : 'Verified';
}

/** SHA-256 of a file, hex, for duplicate-document detection. */
export async function hashFile(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
