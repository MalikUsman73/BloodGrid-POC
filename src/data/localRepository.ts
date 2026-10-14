import type { BloodGroup, Donor, ObjectiveValues, Urgency } from '../engine';
import { daysSince } from './dates';
import { sectorDistanceKm } from './sectors';
import { generateDonors, type DonorRow } from './synthetic';
import {
  DonorUnavailableError,
  type AuditRow,
  type DonorOffer,
  type DonorProfile,
  type DonorState,
  type Repository,
  type RequestDetail,
  type RequestRow,
  type RequestStatus,
} from './types';

type Held = DonorRow & { heldBy: string | null; lastDonationDate: string };

interface LocalRequest extends RequestRow {
  requesterId: string | null;
  archived: boolean;
  rows: { id: string; donorId: string; rank: number; state: DonorState; p: number; cost: number }[];
  audit: AuditRow;
}

export interface LocalDonorSeed {
  group: BloodGroup;
  sector: string;
  /** ISO date; absent means the donor has never given, so they are eligible straight away. */
  lastDonation?: string;
}

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/**
 * In-memory stand-in used when no database is configured or it cannot be reached, so a demo never
 * dies on a network problem. State lasts until the page is reloaded. It follows the same rules as the
 * database: recipients raise and read their own requests, donors answer for themselves, and a recipient
 * may only simulate an answer for a pool donor who has no account.
 */
export class LocalRepository implements Repository {
  readonly source = 'local' as const;
  private donors = new Map<string, Held>();
  private requests: LocalRequest[] = [];
  private accounts = new Map<string, string>(); // user id -> donor code
  private user: string | null = null;
  private seq = 1001;
  private donorSeq = 1001;

  constructor() {
    for (const d of generateDonors()) {
      this.donors.set(d.code, { ...d, heldBy: null, lastDonationDate: isoDaysAgo(d.daysSinceDonation) });
    }
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
    const last = seed.lastDonation ?? isoDaysAgo(365);
    this.donors.set(code, {
      code, group: seed.group, sector: seed.sector, daysSinceDonation: daysSince(last), available: true,
      accepted: 0, received: 0, contactsLast30d: 0, heldBy: null, lastDonationDate: last,
    });
    this.accounts.set(userId, code);
    return code;
  }

  private toDonor(row: Held, sector: string): Donor {
    return {
      id: row.code,
      code: row.code,
      group: row.group,
      sector: row.sector,
      distanceKm: sectorDistanceKm(row.sector, sector),
      daysSinceDonation: daysSince(row.lastDonationDate),
      available: row.available,
      heldBy: row.heldBy,
      contactsLast30d: row.contactsLast30d,
      accepted: row.accepted,
      received: row.received,
    };
  }

  private requireRecipient(): string {
    if (!this.user || this.accounts.has(this.user)) throw new Error('Only recipient accounts can raise requests.');
    return this.user;
  }

  private mine(): LocalRequest[] {
    return this.requests.filter((r) => r.requesterId === this.user && !r.archived);
  }

  async getPool(sector: string) {
    return { donors: [...this.donors.values()].map((d) => this.toDonor(d, sector)), source: this.source };
  }

  async createRequest({ request, donors, audit }: Parameters<Repository['createRequest']>[0]) {
    const requesterId = this.requireRecipient();
    for (const d of donors) {
      const row = this.donors.get(d.donorId);
      if (!row || row.heldBy || !row.available) throw new DonorUnavailableError();
    }
    const id = `local-${this.seq}`;
    const code = `BR-${this.seq}`;
    this.seq += 1;
    this.requests.unshift({
      id,
      code,
      requesterId,
      archived: false,
      recipientGroup: request.recipientGroup as BloodGroup,
      units: request.units,
      urgency: request.urgency as Urgency,
      sector: request.sector,
      k: request.k,
      status: 'Awaiting response',
      createdAt: new Date().toISOString(),
      rows: donors.map((d) => ({ id: `${id}:${d.donorId}`, ...d, state: 'Sent' as DonorState })),
      audit: {
        algorithm: audit.algorithm,
        engineVersion: audit.engineVersion,
        poolSize: audit.poolSize,
        eligibleSize: audit.eligibleSize,
        frontSize: audit.frontSize,
        evaluated: audit.evaluated,
        shortlisted: audit.shortlisted,
        objectives: audit.objectives as ObjectiveValues,
      },
    });
    for (const d of donors) {
      const row = this.donors.get(d.donorId);
      if (row) {
        row.heldBy = id;
        row.contactsLast30d += 1;
        row.received += 1;
      }
    }
    return id;
  }

  async listRequests() {
    return this.mine().map((r) => ({
      id: r.id, code: r.code, recipientGroup: r.recipientGroup, units: r.units, urgency: r.urgency,
      sector: r.sector, k: r.k, status: r.status, createdAt: r.createdAt,
    }));
  }

  async getRequest(id: string): Promise<RequestDetail | null> {
    const r = this.mine().find((x) => x.id === id);
    if (!r) return null;
    return {
      id: r.id, code: r.code, recipientGroup: r.recipientGroup, units: r.units, urgency: r.urgency,
      sector: r.sector, k: r.k, status: r.status, createdAt: r.createdAt,
      audit: r.audit,
      donors: r.rows.map((row) => ({
        id: row.id,
        rank: row.rank,
        state: row.state,
        p: row.p,
        cost: row.cost,
        donor: this.toDonor(this.donors.get(row.donorId) as Held, r.sector),
      })),
    };
  }

  async respond(requestDonorId: string, state: 'Accepted' | 'Declined'): Promise<RequestStatus> {
    if (!this.user) throw new Error('Sign in to respond.');
    const r = this.requests.find((x) => requestDonorId.startsWith(`${x.id}:`));
    const row = r?.rows.find((x) => x.id === requestDonorId);
    if (!r || !row || row.state !== 'Sent') throw new Error('This offer has already been answered or closed.');

    const own = this.accounts.get(this.user) === row.donorId;
    const claimed = [...this.accounts.values()].includes(row.donorId);
    if (!own && !(r.requesterId === this.user && !claimed)) throw new Error('This donor answers from their own account.');

    row.state = state;
    const donor = this.donors.get(row.donorId);
    if (donor) {
      if (state === 'Accepted') donor.accepted += 1;
      else donor.heldBy = null;
    }
    if (r.rows.filter((x) => x.state === 'Accepted').length >= r.units) {
      for (const x of r.rows.filter((y) => y.state === 'Sent')) {
        x.state = 'Stood Down';
        const d = this.donors.get(x.donorId);
        if (d) d.heldBy = null;
      }
      r.status = 'Confirmed';
    } else if (r.rows.every((x) => x.state !== 'Sent')) {
      r.status = 'Unfilled';
    }
    return r.status;
  }

  async reset() {
    if (!this.user) throw new Error('Sign in first.');
    for (const r of this.mine()) {
      for (const row of r.rows) {
        const d = this.donors.get(row.donorId);
        if (d && d.heldBy === r.id) d.heldBy = null;
      }
      r.archived = true;
    }
  }

  private ownDonor(): Held | null {
    const code = this.user ? this.accounts.get(this.user) : undefined;
    return code ? (this.donors.get(code) ?? null) : null;
  }

  async donorProfile(): Promise<DonorProfile | null> {
    const d = this.ownDonor();
    if (!d) return null;
    return {
      code: d.code, group: d.group, sector: d.sector, lastDonationDate: d.lastDonationDate,
      daysSinceDonation: daysSince(d.lastDonationDate), available: d.available, accepted: d.accepted,
      received: d.received, onHold: d.heldBy !== null,
    };
  }

  async donorOffers(): Promise<DonorOffer[]> {
    const d = this.ownDonor();
    if (!d) return [];
    const out: DonorOffer[] = [];
    for (const r of this.requests) {
      if (r.archived) continue;
      const row = r.rows.find((x) => x.donorId === d.code);
      if (!row) continue;
      out.push({
        id: row.id, requestCode: r.code, group: r.recipientGroup, units: r.units, urgency: r.urgency,
        sector: r.sector, state: row.state, requestStatus: r.status, offeredAt: r.createdAt,
      });
    }
    return out;
  }

  async setAvailability(available: boolean) {
    const d = this.ownDonor();
    if (!d) throw new Error('Only donor accounts have availability.');
    d.available = available;
  }
}
