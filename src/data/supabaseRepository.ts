import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { BloodGroup, Donor, ObjectiveValues, Urgency } from '../engine';
import { responseDeadline, type Flag, type PatientInput } from '../workflow';
import { daysSince } from './dates';
import { sectorDistanceKm } from './sectors';
import {
  DonorUnavailableError,
  RequestRefusedError,
  RequestRejectedError,
  type AuditRow,
  type DonorOffer,
  type DonorProfile,
  type DonorState,
  type NewRequestInput,
  type Patient,
  type PrescriptionRecord,
  type Report,
  type ReportKind,
  type Repository,
  type RequestDetail,
  type RequestRow,
  type RequestStatus,
  type RoundInput,
  type SubmitResult,
  type Verification,
} from './types';

interface DonorDbRow {
  id: string;
  code: string;
  blood_group: BloodGroup;
  sector_id: string;
  last_donation_date: string;
  available: boolean;
  accepted_count: number;
  received_count: number;
  contacts_last_30d: number;
  held_by: string | null;
}

interface PoolDbRow extends Omit<DonorDbRow, 'contacts_last_30d'> {
  contacts_30: number;
  held_urgency: Urgency | null;
  held_accepted: boolean;
}

export function toDonor(row: DonorDbRow, requestSector: string): Donor {
  return {
    id: row.id,
    code: row.code,
    group: row.blood_group,
    sector: row.sector_id,
    distanceKm: sectorDistanceKm(row.sector_id, requestSector),
    daysSinceDonation: daysSince(row.last_donation_date),
    available: row.available,
    heldBy: row.held_by,
    contactsLast30d: row.contacts_last_30d,
    accepted: row.accepted_count,
    received: row.received_count,
  };
}

interface RequestDbRow {
  id: string;
  code: string;
  recipient_group: BloodGroup;
  units: number;
  urgency: Urgency;
  sector_id: string;
  k: number;
  status: RequestStatus;
  created_at: string;
  patient_id: string | null;
  hospital_id: string | null;
  verification: Verification;
  flags: Flag[];
  round: number;
  patients?: { full_name: string } | null;
}

interface PatientDbRow {
  id: string;
  full_name: string;
  mr_number: string;
  hospital_id: string;
  blood_group: BloodGroup;
  birth_year: number;
  created_at: string;
}

interface PrescriptionDbRow {
  doctor_name: string;
  pmdc_number: string;
  hospital_id: string;
  issued_on: string;
  blood_group: BloodGroup;
  units_prescribed: number;
  diagnosis: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_hash: string;
}

const toPatient = (p: PatientDbRow): Patient => ({
  id: p.id, fullName: p.full_name, mrNumber: p.mr_number, hospitalId: p.hospital_id, bloodGroup: p.blood_group,
  birthYear: p.birth_year, createdAt: p.created_at,
});

const toPrescription = (p: PrescriptionDbRow): PrescriptionRecord => ({
  doctorName: p.doctor_name, pmdcNumber: p.pmdc_number, hospitalId: p.hospital_id, issuedOn: p.issued_on, bloodGroup: p.blood_group,
  unitsPrescribed: p.units_prescribed, diagnosis: p.diagnosis, fileName: p.file_name, fileType: p.file_type, fileSize: p.file_size,
  fileHash: p.file_hash,
});

const toRequest = (r: RequestDbRow): RequestRow => ({
  id: r.id,
  code: r.code,
  recipientGroup: r.recipient_group,
  units: r.units,
  urgency: r.urgency,
  sector: r.sector_id,
  k: r.k,
  status: r.status,
  createdAt: r.created_at,
  patientId: r.patient_id ?? '',
  patientName: r.patients?.full_name ?? '',
  hospitalId: r.hospital_id ?? '',
  verification: r.verification,
  flags: r.flags ?? [],
  round: r.round,
});

/** Database error codes raised by the functions, in words a person can act on. */
const MESSAGES: Record<string, string> = {
  not_allowed: 'Your account cannot do this.',
  not_found: 'Request not found.',
  not_ready: 'This request is not ready for another round.',
  no_rounds_left: 'This request has used every matching round.',
  nothing_to_send: 'Nothing to send.',
  too_many_donors: 'More donors than this round needs.',
  not_open: 'This offer has already been answered or closed.',
  already_closed: 'This request is already closed.',
  already_donated: 'A donation has been recorded, so this request cannot be cancelled.',
  not_waiting: 'This donor has no donation waiting to be confirmed.',
  not_confirmed: 'This request is not confirmed yet.',
  note_too_long: 'Keep the thank-you note to 200 characters.',
  invalid_kind: 'Choose what the problem is.',
  invalid_note: 'Describe what happened in 5 to 500 characters.',
  not_asked: 'You can only report requests you were asked about.',
  already_reported: 'You have already reported this request.',
};

function fail(error: PostgrestError | { message: string }): never {
  const m = error.message;
  if (m.includes('donor_unavailable')) throw new DonorUnavailableError();
  const refused = /refused:(\[.*\])/s.exec(m);
  if (refused) throw new RequestRefusedError(JSON.parse(refused[1]) as Flag[]);
  const invalid = /invalid:([A-Za-z]+):(.*)/.exec(m);
  if (invalid) throw new RequestRejectedError({ [invalid[1]]: invalid[2] });
  const code = Object.keys(MESSAGES).find((k) => m.includes(k));
  throw new Error(code ? MESSAGES[code] : m);
}

const extension = (type: string) => (type === 'application/pdf' ? 'pdf' : type === 'image/png' ? 'png' : 'jpg');

export class SupabaseRepository implements Repository {
  readonly source = 'supabase' as const;

  constructor(private readonly client: SupabaseClient) {}

  private async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) fail(error);
    return data as T;
  }

  /** Lapse unanswered offers before reading, so every screen sees current state. */
  private sweep() {
    return this.rpc<void>('sweep');
  }

  async getPool(sector: string) {
    await this.sweep();
    const rows = await this.rpc<PoolDbRow[]>('donor_pool');
    return {
      donors: rows.map((r) => ({
        ...toDonor({ ...r, contacts_last_30d: r.contacts_30 }, sector),
        heldUrgency: r.held_urgency,
        heldAccepted: r.held_accepted,
      })),
      source: this.source,
    };
  }

  async listPatients(): Promise<Patient[]> {
    const { data: user } = await this.client.auth.getUser();
    const { data, error } = await this.client
      .from('patients').select('*').eq('owner_id', user.user?.id ?? '').order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as PatientDbRow[]).map(toPatient);
  }

  async savePatient(input: PatientInput): Promise<Patient> {
    const row = await this.rpc<PatientDbRow>('save_patient', {
      p: { full_name: input.fullName, mr_number: input.mrNumber, hospital_id: input.hospitalId, blood_group: input.bloodGroup, birth_year: input.birthYear },
    });
    return toPatient(row);
  }

  async submitRequest(input: NewRequestInput): Promise<SubmitResult> {
    const doc = input.prescription.document;
    if (!input.file || !doc) throw new RequestRejectedError({ document: 'Attach the doctor’s prescription or requisition form.' });
    const { data: user } = await this.client.auth.getUser();
    if (!user.user) throw new Error('Sign in again to continue.');
    // Files are stored by content hash in the account's own folder, so the same file is stored once.
    const path = `${user.user.id}/${doc.hash}.${extension(doc.type)}`;
    const upload = await this.client.storage.from('prescriptions').upload(path, input.file, { contentType: doc.type, upsert: false });
    if (upload.error && !/exists|duplicate/i.test(upload.error.message)) throw new Error(`The file could not be uploaded: ${upload.error.message}`);
    const rx = input.prescription;
    const result = await this.rpc<{ id: string; verification: Verification; flags: Flag[] }>('submit_request', {
      p: {
        patient_id: input.patientId,
        units: input.units,
        urgency: input.urgency,
        prescription: {
          doctor_name: rx.doctorName, pmdc_number: rx.pmdcNumber, hospital_id: rx.hospitalId, issued_on: rx.issuedOn,
          blood_group: rx.bloodGroup, units_prescribed: rx.unitsPrescribed, diagnosis: rx.diagnosis,
          file_path: path, file_name: doc.name, file_type: doc.type, file_size: doc.size, file_hash: doc.hash,
        },
      },
    });
    return result;
  }

  async recordRound(input: RoundInput): Promise<RequestStatus> {
    const a = input.audit;
    return this.rpc<RequestStatus>('record_round', {
      p_request: input.requestId,
      p_donors: input.donors.map((d) => ({ donor_id: d.donorId, rank: d.rank, p: d.p, cost: d.cost })),
      p_audit: {
        algorithm: a.algorithm, engine_version: a.engineVersion, pool_hash: a.poolHash, pool_size: a.poolSize,
        eligible_size: a.eligibleSize, front_size: a.frontSize, evaluated: a.evaluated, shortlisted: a.shortlisted,
        ...(a.objectives ? { objectives: a.objectives } : {}),
      },
    });
  }

  async listRequests() {
    await this.sweep();
    const { data, error } = await this.client
      .from('blood_requests')
      .select('*, patients(full_name)')
      .eq('archived', false)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as RequestDbRow[]).map(toRequest);
  }

  async getRequest(id: string): Promise<RequestDetail | null> {
    await this.sweep();
    const { data: req, error } = await this.client
      .from('blood_requests').select('*, patients(full_name), prescriptions(*)').eq('id', id).eq('archived', false).maybeSingle();
    if (error) fail(error);
    if (!req) return null;
    const [rds, audit] = await Promise.all([
      this.client.from('request_donors').select('*, donors(*)').eq('request_id', id).order('round').order('rank'),
      this.client.from('match_audit').select('*').eq('request_id', id).order('created_at', { ascending: false }).limit(1),
    ]);
    for (const r of [rds, audit]) if (r.error) fail(r.error);
    const row = req as RequestDbRow & { prescriptions: PrescriptionDbRow | PrescriptionDbRow[] | null };
    const request = toRequest(row);
    const donors = (
      rds.data as { id: string; rank: number; round: number; state: DonorState; p: number; cost: number; sent_at: string; feedback: string | null; donors: DonorDbRow }[]
    ).map((r) => ({
      id: r.id,
      rank: r.rank,
      round: r.round,
      state: r.state,
      p: Number(r.p),
      cost: Number(r.cost),
      sentAt: r.sent_at,
      deadline: responseDeadline(r.sent_at, request.urgency),
      feedback: r.feedback,
      donor: toDonor(r.donors, request.sector),
    }));
    const a = (audit.data as Record<string, unknown>[])[0] ?? null;
    const auditRow: AuditRow | null = a
      ? {
          algorithm: String(a.algorithm),
          engineVersion: String(a.engine_version),
          poolSize: Number(a.pool_size),
          eligibleSize: Number(a.eligible_size),
          frontSize: Number(a.front_size),
          evaluated: Number(a.evaluated),
          shortlisted: Boolean(a.shortlisted),
          objectives: a.objectives as ObjectiveValues,
        }
      : null;
    const rx = Array.isArray(row.prescriptions) ? row.prescriptions[0] : row.prescriptions;
    return {
      ...request,
      donors,
      audit: auditRow,
      prescription: rx ? toPrescription(rx) : emptyPrescription(request),
    };
  }

  async cancelRequest(id: string) {
    await this.rpc('cancel_request', { p_id: id });
  }

  async respond(requestDonorId: string, state: 'Accepted' | 'Declined') {
    const { data, error } = await this.client.rpc('respond_to_request', {
      p_request_donor: requestDonorId,
      p_state: state,
    });
    if (error) {
      if (error.message.includes('not_allowed')) throw new Error('This donor answers from their own account.');
      fail(error);
    }
    return data as RequestStatus;
  }

  async confirmDonation(requestDonorId: string, outcome: 'Donated' | 'No show', thanks = '') {
    await this.rpc('confirm_donation', { p_request_donor: requestDonorId, p_outcome: outcome, p_thanks: thanks.trim() });
  }

  async reset() {
    await this.rpc('reset_demo');
  }

  async donorProfile(): Promise<DonorProfile | null> {
    await this.sweep();
    const data = await this.rpc<Record<string, unknown>[] | null>('donor_profile');
    const r = data?.[0];
    if (!r) return null;
    const thanks = await this.rpc<{ donated: number; note: string | null; at: string }[]>('donor_thanks');
    return {
      code: String(r.code),
      group: r.blood_group as BloodGroup,
      sector: String(r.sector_id),
      lastDonationDate: String(r.last_donation_date),
      daysSinceDonation: daysSince(String(r.last_donation_date)),
      available: Boolean(r.available),
      accepted: Number(r.accepted_count),
      received: Number(r.received_count),
      onHold: Boolean(r.on_hold),
      donated: thanks[0]?.donated ?? 0,
      thanks: thanks.filter((t) => t.note).map((t) => ({ note: t.note as string, at: t.at })),
    };
  }

  async donorOffers(): Promise<DonorOffer[]> {
    const data = await this.rpc<Record<string, unknown>[]>('donor_offers');
    return data.map((r) => ({
      id: String(r.request_donor_id),
      requestId: String(r.request_id),
      requestCode: String(r.request_code),
      group: r.recipient_group as BloodGroup,
      units: Number(r.units),
      urgency: r.urgency as Urgency,
      sector: String(r.sector_id),
      state: r.state as DonorState,
      requestStatus: r.request_status as RequestStatus,
      offeredAt: String(r.offered_at),
      deadline: String(r.deadline),
      hospitalId: String(r.hospital_id ?? ''),
      verification: r.verification as Verification,
    }));
  }

  async setAvailability(available: boolean) {
    await this.rpc('set_availability', { p_available: available });
  }

  async reportRequest(input: { requestId: string; kind: ReportKind; note: string }) {
    await this.rpc('report_request', { p: { request_id: input.requestId, kind: input.kind, note: input.note } });
  }

  async myReports(): Promise<Report[]> {
    const rows = await this.rpc<{ id: string; request_id: string; request_code: string; kind: ReportKind; note: string; created_at: string }[]>('my_reports');
    return rows.map((x) => ({ id: x.id, requestId: x.request_id, requestCode: x.request_code, kind: x.kind, note: x.note, createdAt: x.created_at }));
  }

  async prescriptionUrl(requestId: string): Promise<string | null> {
    const { data: rx, error } = await this.client.from('prescriptions').select('file_path').eq('request_id', requestId).maybeSingle();
    if (error) fail(error);
    const path = (rx as { file_path: string } | null)?.file_path;
    if (!path) return null;
    const { data, error: signError } = await this.client.storage.from('prescriptions').createSignedUrl(path, 600);
    if (signError) fail(signError);
    return data.signedUrl;
  }
}

/** Requests raised before prescriptions were required have no prescription record. */
function emptyPrescription(r: RequestRow): PrescriptionRecord {
  return {
    doctorName: '', pmdcNumber: '', hospitalId: r.hospitalId, issuedOn: '', bloodGroup: r.recipientGroup, unitsPrescribed: r.units,
    diagnosis: '', fileName: '', fileType: '', fileSize: 0, fileHash: '',
  };
}
