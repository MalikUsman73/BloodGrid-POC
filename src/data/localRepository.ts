import { canPreempt, contactSetSize, isCompatible, type BloodGroup, type Donor, type Urgency } from '../engine';
import {
  CONFIRMED_HOLD_HOURS, FRAUD_REPORT_LIMIT, MAX_ROUNDS, RESPONSE_MINUTES, decide, detectFlags, findHospital, hashFile, matchConfigFor,
  responseDeadline, validatePatient, validateRequest,
  type Flag, type PatientInput, type RequestHistory,
} from '../workflow';
import { daysSince } from './dates';
import { sectorDistanceKm } from './sectors';
import { generateDonors, type DonorRow } from './synthetic';
import {
  REPORT_KINDS,
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

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Held = Omit<DonorRow, 'contactsLast30d'> & {
  heldBy: string | null;
  lastDonationDate: string;
  /** When each contact happened, so the 30-day cap is a true rolling window. */
  contacts: number[];
};

interface LocalRow {
  id: string;
  donorId: string;
  rank: number;
  round: number;
  state: DonorState;
  p: number;
  cost: number;
  sentAt: string;
  respondedAt: string | null;
  feedback: string | null;
}

interface LocalPatient extends Patient {
  ownerId: string;
}

interface LocalRequest {
  id: string;
  code: string;
  requesterId: string;
  archived: boolean;
  patientId: string;
  recipientGroup: BloodGroup;
  units: number;
  urgency: Urgency;
  sector: string;
  hospitalId: string;
  k: number;
  status: RequestStatus;
  createdAt: string;
  confirmedAt: string | null;
  verification: Verification;
  flags: Flag[];
  round: number;
  prescription: PrescriptionRecord;
  fileUrl: string | null;
  rows: LocalRow[];
  audit: AuditRow | null;
}

interface LocalReport {
  id: string;
  requestId: string;
  raiserId: string;
  kind: ReportKind;
  note: string;
  createdAt: string;
}

export interface LocalDonorSeed {
  group: BloodGroup;
  sector: string;
  /** ISO date; absent means the donor has never given, so they are eligible straight away. */
  lastDonation?: string;
}

const toPatient = (p: LocalPatient): Patient => ({
  id: p.id, fullName: p.fullName, mrNumber: p.mrNumber, hospitalId: p.hospitalId, bloodGroup: p.bloodGroup, birthYear: p.birthYear, createdAt: p.createdAt,
});

/** Requests that can still change. */
const OPEN: RequestStatus[] = ['Awaiting response', 'Unfilled'];
const FRAUD_KINDS: ReportKind[] = ['Suspected fraud', 'Asked for payment'];

/**
 * In-memory stand-in used when no database is configured or it cannot be reached, so a demo never
 * dies on a network problem. State lasts until the page is reloaded. It follows the same rules as the
 * database functions: recipients raise and read their own requests, donors answer for themselves,
 * seekers confirm donations, and every hard rule is checked again on save, whatever the screen sent.
 */
export class LocalRepository implements Repository {
  readonly source = 'local' as const;
  private donors = new Map<string, Held>();
  private requests: LocalRequest[] = [];
  private patients: LocalPatient[] = [];
  private reports: LocalReport[] = [];
  private accounts = new Map<string, string>(); // user id -> donor code
  private flagged = new Set<string>();
  private user: string | null = null;
  private seq = 1001;
  private donorSeq = 1001;
  private idSeq = 1;

  /** `clock` lets tests move time forward to check expiry. */
  constructor(private readonly clock: () => number = () => Date.now()) {
    const now = this.clock();
    for (const d of generateDonors()) {
      const { contactsLast30d, ...rest } = d;
      // Seeded contacts are spread over the last four weeks.
      const contacts = Array.from({ length: contactsLast30d }, (_, i) => now - (4 + i * 8) * DAY);
      this.donors.set(d.code, { ...rest, heldBy: null, lastDonationDate: this.isoDaysAgo(d.daysSinceDonation), contacts });
    }
  }

  private iso(t = this.clock()) {
    return new Date(t).toISOString();
  }

  private isoDaysAgo(days: number) {
    return new Date(this.clock() - days * DAY).toISOString().slice(0, 10);
  }

  private nextId(prefix: string) {
    this.idSeq += 1;
    return `${prefix}-${this.idSeq}`;
  }

  /** Who is signed in. The auth service keeps this in step. */
  setUser(userId: string | null) {
    this.user = userId;
  }

  /** Adds a signed-up donor to the pool and returns their donor code. Idempotent per user. */
  registerDonor(userId: string, seed: LocalDonorSeed): string {
    const existing = this.accounts.get(userId);
    if (existing) return existing;
    const code = `D-${this.donorSeq}`;
    this.donorSeq += 1;
    const last = seed.lastDonation ?? this.isoDaysAgo(365);
    this.donors.set(code, {
      code, group: seed.group, sector: seed.sector, daysSinceDonation: daysSince(last, this.clock()), available: true,
      accepted: 0, received: 0, contacts: [], heldBy: null, lastDonationDate: last,
    });
    this.accounts.set(userId, code);
    return code;
  }

  // ---------- roles ----------

  private role(): 'donor' | 'recipient' | null {
    if (!this.user) return null;
    return this.accounts.has(this.user) ? 'donor' : 'recipient';
  }

  private requireRecipient(): string {
    if (this.role() !== 'recipient') throw new Error('Only recipient accounts can do this.');
    return this.user as string;
  }

  private ownRequest(id: string): LocalRequest {
    const r = this.requests.find((x) => x.id === id && !x.archived);
    if (!r || r.requesterId !== this.user) throw new Error('Request not found.');
    return r;
  }

  // ---------- state rules shared by every write ----------

  private contacts30(d: Held): number {
    const since = this.clock() - 30 * DAY;
    return d.contacts.filter((t) => t > since).length;
  }

  private release(donorId: string, requestId: string) {
    const d = this.donors.get(donorId);
    if (d && d.heldBy === requestId) d.heldBy = null;
  }

  private covered(r: LocalRequest): number {
    return r.rows.filter((x) => x.state === 'Accepted' || x.state === 'Donated').length;
  }

  /** Work out a request's status from its donor rows. */
  private refresh(r: LocalRequest) {
    if (r.status === 'Cancelled') return;
    if (this.covered(r) >= r.units) {
      for (const x of r.rows.filter((y) => y.state === 'Sent')) {
        x.state = 'Stood Down';
        x.respondedAt = this.iso();
        this.release(x.donorId, r.id);
      }
      if (r.status !== 'Confirmed') r.confirmedAt = this.iso();
      r.status = 'Confirmed';
      return;
    }
    r.confirmedAt = null;
    r.status = r.round === 0 || r.rows.some((x) => x.state === 'Sent') ? 'Awaiting response' : 'Unfilled';
  }

  /** Lapse unanswered offers and release donors held too long after confirmation. Runs before every read and write. */
  private sweep() {
    const now = this.clock();
    for (const r of this.requests) {
      if (r.archived) continue;
      let changed = false;
      for (const x of r.rows) {
        if (x.state === 'Sent' && Date.parse(x.sentAt) + RESPONSE_MINUTES[r.urgency] * 60_000 <= now) {
          x.state = 'Expired';
          x.respondedAt = this.iso();
          this.release(x.donorId, r.id);
          changed = true;
        }
      }
      if (r.status === 'Confirmed' && r.confirmedAt && Date.parse(r.confirmedAt) + CONFIRMED_HOLD_HOURS * HOUR <= now) {
        for (const x of r.rows) this.release(x.donorId, r.id);
      }
      if (changed) this.refresh(r);
    }
  }

  private closeRequest(r: LocalRequest) {
    for (const x of r.rows) {
      if (x.state === 'Sent' || x.state === 'Accepted') {
        x.state = 'Stood Down';
        x.respondedAt = this.iso();
      }
      this.release(x.donorId, r.id);
    }
    r.status = 'Cancelled';
  }

  // ---------- mapping ----------

  private toDonor(row: Held, sector: string): Donor {
    const holder = row.heldBy ? this.requests.find((r) => r.id === row.heldBy) : undefined;
    return {
      id: row.code,
      code: row.code,
      group: row.group,
      sector: row.sector,
      distanceKm: sectorDistanceKm(row.sector, sector),
      daysSinceDonation: daysSince(row.lastDonationDate, this.clock()),
      available: row.available,
      heldBy: row.heldBy,
      heldUrgency: holder?.urgency ?? null,
      heldAccepted: holder?.rows.some((x) => x.donorId === row.code && x.state === 'Accepted') ?? false,
      contactsLast30d: this.contacts30(row),
      accepted: row.accepted,
      received: row.received,
    };
  }

  private toRow(r: LocalRequest): RequestRow {
    const patient = this.patients.find((p) => p.id === r.patientId);
    return {
      id: r.id, code: r.code, recipientGroup: r.recipientGroup, units: r.units, urgency: r.urgency, sector: r.sector, k: r.k,
      status: r.status, createdAt: r.createdAt, patientId: r.patientId, patientName: patient?.fullName ?? '', hospitalId: r.hospitalId,
      verification: r.verification, flags: r.flags, round: r.round,
    };
  }

  // ---------- pool ----------

  async getPool(sector: string) {
    this.sweep();
    return { donors: [...this.donors.values()].map((d) => this.toDonor(d, sector)), source: this.source };
  }

  // ---------- patients and requests ----------

  async listPatients(): Promise<Patient[]> {
    const me = this.requireRecipient();
    return this.patients.filter((p) => p.ownerId === me).map(toPatient);
  }

  async savePatient(input: PatientInput): Promise<Patient> {
    const me = this.requireRecipient();
    const errors = validatePatient(input, new Date(this.clock()));
    if (Object.keys(errors).length > 0) throw new RequestRejectedError(errors);
    const mr = input.mrNumber.trim().toUpperCase();
    const fields = {
      fullName: input.fullName.trim(), mrNumber: mr, hospitalId: input.hospitalId,
      bloodGroup: input.bloodGroup as BloodGroup, birthYear: input.birthYear as number,
    };
    let p = this.patients.find((x) => x.ownerId === me && x.hospitalId === input.hospitalId && x.mrNumber === mr);
    if (p) Object.assign(p, fields);
    else {
      p = { id: this.nextId('pt'), ownerId: me, createdAt: this.iso(), ...fields };
      this.patients.push(p);
    }
    return toPatient(p);
  }

  private history(me: string, patient: LocalPatient, hash: string): RequestHistory {
    const now = this.clock();
    return {
      // A follow-up by the same account for the same patient is not reuse.
      documentUses: this.requests.filter((r) => r.prescription.fileHash === hash && (r.requesterId !== me || r.patientId !== patient.id)).length,
      patientGroups: this.patients
        .filter((p) => p.hospitalId === patient.hospitalId && p.mrNumber === patient.mrNumber)
        .map((p) => p.bloodGroup),
      requestsLast24h: this.requests.filter((r) => r.requesterId === me && Date.parse(r.createdAt) > now - DAY).length,
      openForPatient: this.requests.filter((r) => r.patientId === patient.id && !r.archived && OPEN.includes(r.status)).length,
      accountFlagged: this.flagged.has(me),
    };
  }

  async submitRequest(input: NewRequestInput): Promise<SubmitResult> {
    this.sweep();
    const me = this.requireRecipient();
    const patient = this.patients.find((p) => p.id === input.patientId && p.ownerId === me);
    if (!patient) throw new RequestRejectedError({ patientName: 'Choose one of your patients.' });
    const doc = input.prescription.document;
    if (!input.file || !doc || (await hashFile(input.file)) !== doc.hash || input.file.size !== doc.size) {
      throw new RequestRejectedError({ document: 'The attached file does not match its details. Attach it again.' });
    }
    const request = { patient, prescription: input.prescription, units: input.units, urgency: input.urgency };
    const history = this.history(me, patient, doc.hash);
    const now = new Date(this.clock());
    const errors = validateRequest(request, history, now);
    if (Object.keys(errors).length > 0) throw new RequestRejectedError(errors);

    const flags = detectFlags(request, history, now);
    const decision = decide(flags);
    if (decision === 'Rejected') throw new RequestRefusedError(flags);
    const hospital = findHospital(patient.hospitalId)!;
    const rx = input.prescription;
    const id = `local-${this.seq}`;
    const r: LocalRequest = {
      id,
      code: `BR-${this.seq}`,
      requesterId: me,
      archived: false,
      patientId: patient.id,
      recipientGroup: patient.bloodGroup,
      units: input.units,
      urgency: input.urgency,
      sector: hospital.sector,
      hospitalId: hospital.id,
      k: 0,
      status: 'Awaiting response',
      createdAt: this.iso(),
      confirmedAt: null,
      verification: decision,
      flags,
      round: 0,
      prescription: {
        doctorName: rx.doctorName.trim(), pmdcNumber: rx.pmdcNumber.trim().toUpperCase(), hospitalId: rx.hospitalId,
        issuedOn: rx.issuedOn, bloodGroup: rx.bloodGroup as BloodGroup, unitsPrescribed: rx.unitsPrescribed,
        diagnosis: rx.diagnosis.trim(), fileName: doc.name, fileType: doc.type, fileSize: doc.size, fileHash: doc.hash,
      },
      fileUrl: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(input.file) : null,
      rows: [],
      audit: null,
    };
    this.seq += 1;
    this.requests.unshift(r);
    return { id, verification: decision, flags };
  }

  async recordRound(input: RoundInput): Promise<RequestStatus> {
    this.sweep();
    this.requireRecipient();
    const r = this.ownRequest(input.requestId);
    if (!(r.status === 'Unfilled' || (r.status === 'Awaiting response' && r.round === 0))) {
      throw new Error('This request is not ready for another round.');
    }
    const round = r.round + 1;
    if (round > MAX_ROUNDS[r.urgency]) throw new Error('This request has used every matching round.');
    if (input.donors.length === 0) throw new Error('Nothing to send.');

    const need = r.units - this.covered(r);
    // Donors: every hard rule again, whatever the screen sent.
    const config = matchConfigFor({ urgency: r.urgency, round });
    const k = contactSetSize(Math.max(1, need), r.urgency);
    if (input.donors.length > k) throw new Error('More donors than this round needs.');
    const takenFrom: LocalRequest[] = [];
    for (const d of input.donors) {
      const row = this.donors.get(d.donorId);
      if (!row) throw new DonorUnavailableError();
      const donor = this.toDonor(row, r.sector);
      const free = donor.heldBy === null || (donor.heldBy !== r.id && canPreempt(r.urgency, donor.heldUrgency, donor.heldAccepted));
      if (
        !isCompatible(r.recipientGroup, donor.group) ||
        !donor.available ||
        !free ||
        r.rows.some((x) => x.donorId === d.donorId) ||
        donor.daysSinceDonation < config.cooldownDays ||
        donor.distanceKm > config.radiusKm ||
        donor.contactsLast30d >= config.contactCap
      ) {
        throw new DonorUnavailableError();
      }
      if (donor.heldBy) takenFrom.push(this.requests.find((x) => x.id === donor.heldBy)!);
    }

    for (const other of takenFrom) {
      for (const x of other.rows) {
        if (x.state === 'Sent' && input.donors.some((d) => d.donorId === x.donorId)) {
          x.state = 'Reassigned';
          x.respondedAt = this.iso();
          this.release(x.donorId, other.id);
        }
      }
      this.refresh(other);
    }
    const sentAt = this.iso();
    for (const d of input.donors) {
      r.rows.push({ id: `${r.id}:${d.donorId}`, ...d, round, state: 'Sent', sentAt, respondedAt: null, feedback: null });
      const row = this.donors.get(d.donorId)!;
      row.heldBy = r.id;
      row.contacts.push(this.clock());
      row.received += 1;
    }
    r.round = round;
    r.k += input.donors.length;
    if (input.audit.objectives) r.audit = { ...input.audit, objectives: input.audit.objectives };
    this.refresh(r);
    return r.status;
  }

  async listRequests(): Promise<RequestRow[]> {
    this.sweep();
    return this.requests.filter((r) => r.requesterId === this.user && !r.archived).map((r) => this.toRow(r));
  }

  async getRequest(id: string): Promise<RequestDetail | null> {
    this.sweep();
    const r = this.requests.find((x) => x.id === id && !x.archived && x.requesterId === this.user);
    if (!r) return null;
    return {
      ...this.toRow(r),
      audit: r.audit,
      prescription: r.prescription,
      donors: r.rows.map((row) => ({
        id: row.id,
        rank: row.rank,
        round: row.round,
        state: row.state,
        p: row.p,
        cost: row.cost,
        sentAt: row.sentAt,
        deadline: responseDeadline(row.sentAt, r.urgency),
        feedback: row.feedback,
        donor: this.toDonor(this.donors.get(row.donorId) as Held, r.sector),
      })),
    };
  }

  async cancelRequest(id: string) {
    this.sweep();
    this.requireRecipient();
    const r = this.ownRequest(id);
    if (r.status === 'Cancelled') throw new Error('This request is already closed.');
    if (r.rows.some((x) => x.state === 'Donated')) throw new Error('A donation has been confirmed, so this request cannot be cancelled.');
    this.closeRequest(r);
  }

  async respond(requestDonorId: string, state: 'Accepted' | 'Declined'): Promise<RequestStatus> {
    this.sweep();
    if (!this.user) throw new Error('Sign in to respond.');
    const r = this.requests.find((x) => requestDonorId.startsWith(`${x.id}:`));
    const row = r?.rows.find((x) => x.id === requestDonorId);
    if (!r || !row || row.state !== 'Sent' || r.status !== 'Awaiting response') {
      throw new Error('This offer has already been answered or closed.');
    }

    const own = this.accounts.get(this.user) === row.donorId;
    const claimed = [...this.accounts.values()].includes(row.donorId);
    if (!own && !(r.requesterId === this.user && !claimed)) throw new Error('This donor answers from their own account.');

    row.state = state;
    row.respondedAt = this.iso();
    const donor = this.donors.get(row.donorId);
    if (donor) {
      if (state === 'Accepted') donor.accepted += 1;
      else this.release(row.donorId, r.id);
    }
    this.refresh(r);
    return r.status;
  }

  async reset() {
    if (!this.user) throw new Error('Sign in first.');
    for (const r of this.requests.filter((x) => x.requesterId === this.user && !x.archived)) {
      if (OPEN.includes(r.status)) this.closeRequest(r);
      for (const row of r.rows) this.release(row.donorId, r.id);
      r.archived = true;
    }
  }

  // ---------- donor ----------

  private ownDonor(): Held | null {
    const code = this.user ? this.accounts.get(this.user) : undefined;
    return code ? (this.donors.get(code) ?? null) : null;
  }

  private donorRows(code: string) {
    return this.requests.flatMap((r) => r.rows.filter((x) => x.donorId === code).map((row) => ({ r, row })));
  }

  async donorProfile(): Promise<DonorProfile | null> {
    this.sweep();
    const d = this.ownDonor();
    if (!d) return null;
    return {
      code: d.code, group: d.group, sector: d.sector, lastDonationDate: d.lastDonationDate,
      daysSinceDonation: daysSince(d.lastDonationDate, this.clock()), available: d.available, accepted: d.accepted,
      received: d.received, onHold: d.heldBy !== null,
      donated: this.donorRows(d.code).filter((x) => x.row.state === 'Donated').length,
      thanks: this.donorRows(d.code)
        .filter((x) => x.row.feedback)
        .map((x) => ({ note: x.row.feedback as string, at: x.row.respondedAt ?? x.row.sentAt }))
        .sort((a, b) => b.at.localeCompare(a.at)),
    };
  }

  async donorOffers(): Promise<DonorOffer[]> {
    this.sweep();
    const d = this.ownDonor();
    if (!d) return [];
    const out: DonorOffer[] = [];
    for (const r of this.requests) {
      if (r.archived) continue;
      const row = r.rows.find((x) => x.donorId === d.code);
      if (!row) continue;
      out.push({
        id: row.id, requestId: r.id, requestCode: r.code, group: r.recipientGroup, units: r.units, urgency: r.urgency,
        sector: r.sector, state: row.state, requestStatus: r.status, offeredAt: row.sentAt,
        deadline: responseDeadline(row.sentAt, r.urgency), hospitalId: r.hospitalId, verification: r.verification,
      });
    }
    return out;
  }

  async setAvailability(available: boolean) {
    const d = this.ownDonor();
    if (!d) throw new Error('Only donor accounts have availability.');
    d.available = available;
  }

  // ---------- reports and confirmation ----------

  async reportRequest(input: { requestId: string; kind: ReportKind; note: string }) {
    this.sweep();
    if (this.role() !== 'donor') throw new Error('Only donors can report a request.');
    const note = input.note.trim();
    if (!REPORT_KINDS.includes(input.kind)) throw new Error('Choose what went wrong.');
    if (note.length < 5 || note.length > 500) throw new Error('Describe what happened in 5 to 500 characters.');
    const code = this.accounts.get(this.user as string);
    const r = this.requests.find((x) => x.id === input.requestId && !x.archived);
    if (!r || !r.rows.some((x) => x.donorId === code)) throw new Error('You can only report requests you were asked about.');
    if (this.reports.some((d) => d.requestId === r.id && d.raiserId === this.user && d.kind === input.kind)) {
      throw new Error('You have already reported this.');
    }
    this.reports.unshift({ id: this.nextId('rp'), requestId: r.id, raiserId: this.user as string, kind: input.kind, note, createdAt: this.iso() });

    // Several different donors reporting fraud or payment demands against one account flags it.
    const mine = this.requests.filter((x) => x.requesterId === r.requesterId).map((x) => x.id);
    const reporters = new Set(this.reports.filter((d) => FRAUD_KINDS.includes(d.kind) && mine.includes(d.requestId)).map((d) => d.raiserId));
    if (reporters.size >= FRAUD_REPORT_LIMIT) {
      this.flagged.add(r.requesterId);
      for (const open of this.requests.filter((x) => x.requesterId === r.requesterId && OPEN.includes(x.status))) this.closeRequest(open);
    }
  }

  async myReports(): Promise<Report[]> {
    if (!this.user) throw new Error('Sign in first.');
    return this.reports
      .filter((d) => d.raiserId === this.user)
      .map((d) => ({ id: d.id, requestId: d.requestId, requestCode: this.requests.find((r) => r.id === d.requestId)?.code ?? '', kind: d.kind, note: d.note, createdAt: d.createdAt }));
  }

  async prescriptionUrl(requestId: string): Promise<string | null> {
    const r = this.requests.find((x) => x.id === requestId && x.requesterId === this.user);
    return r?.fileUrl ?? null;
  }

  async confirmDonation(requestDonorId: string, outcome: 'Donated' | 'No show', thanks = '') {
    this.sweep();
    this.requireRecipient();
    const r = this.requests.find((x) => x.requesterId === this.user && !x.archived && requestDonorId.startsWith(`${x.id}:`));
    const row = r?.rows.find((y) => y.id === requestDonorId);
    if (!r || !row || row.state !== 'Accepted') throw new Error('This donor is not waiting to be confirmed.');
    if (r.status !== 'Confirmed') throw new Error('Confirm donors once enough have accepted.');
    const note = thanks.trim();
    if (note.length > 200) throw new Error('Keep the thank-you note to 200 characters.');
    const donor = this.donors.get(row.donorId)!;
    row.state = outcome;
    row.respondedAt = this.iso();
    if (outcome === 'Donated') {
      donor.lastDonationDate = this.iso().slice(0, 10);
      row.feedback = note || null;
    } else {
      donor.accepted = Math.max(0, donor.accepted - 1);
    }
    this.release(row.donorId, r.id);
    if (this.covered(r) < r.units) r.status = 'Unfilled';
    this.refresh(r);
  }
}
